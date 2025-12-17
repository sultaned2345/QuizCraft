// src/app/api/generate-from-youtube/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import {
  checkAIGenerationUsageLimit,
  incrementAIGenerationUsage,
} from '@/lib/usage-limits';
import { callAIToGenerateQuiz, transcribeAudioFile } from '@/lib/aiGeneration'; // Import new helper
import { ApiResponse, Quiz } from '@/types/database';
import { Prisma } from '@prisma/client';
import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from '@distube/ytdl-core'; // Make sure to install this
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

// Helper to download audio to temp file
async function downloadAudioToTemp(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, `${uuidv4()}.mp3`);
    
    // Low quality audio is fine for speech recognition and saves bandwidth
    const stream = ytdl(url, { quality: 'lowestaudio', filter: 'audioonly' });
    
    const writeStream = fs.createWriteStream(filePath);
    
    stream.pipe(writeStream);
    
    writeStream.on('finish', () => resolve(filePath));
    writeStream.on('error', (err) => reject(err));
    stream.on('error', (err) => reject(err));
  });
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const user = await requireAuth(request);
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing videoUrl' },
        { status: 400 }
      );
    }

    // 1. Check Usage Limit
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'limit_exceeded', message: usageCheck.message },
        { status: 403 }
      );
    }

    // 2. Fetch Transcript (Strategy: Text -> Fallback to Audio)
    let transcriptText = '';
    
    try {
      console.log('Attempting to fetch transcript text directly...');
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoUrl);
      if (transcriptItems && transcriptItems.length > 0) {
        transcriptText = transcriptItems.map(item => item.text).join(' ');
      }
    } catch (transcriptError: any) {
      console.warn('Transcript fetch failed, falling back to audio extraction:', transcriptError.message);
      
      // FALLBACK: Download Audio & Transcribe
      try {
        console.log('Downloading audio stream...');
        tempFilePath = await downloadAudioToTemp(videoUrl);
        
        console.log('Transcribing audio with Groq...');
        transcriptText = await transcribeAudioFile(tempFilePath);
        
      } catch (audioError: any) {
        console.error('Audio extraction/transcription failed:', audioError);
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: 'transcription_failed',
            message: 'Could not generate quiz. The video has no captions, and audio transcription failed.',
          },
          { status: 422 }
        );
      }
    }

    // 3. Check for sufficient length
    if (!transcriptText || transcriptText.trim().length < 100) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'transcript_unavailable',
          message: 'The content is too short to generate a quiz.',
        },
        { status: 400 }
      );
    }

    // 4. Proceed with Quiz Generation (Gemini)
    const quizData = await callAIToGenerateQuiz(
      transcriptText,
      10, 
      'medium', 
      'MIXED' 
    );

    // 5. Save quiz to database
    const questionsToCreate = quizData.questions.map((q: any) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      correct_answer: q.correct_answer,
      options: Array.isArray(q.options) ? q.options : Prisma.JsonNull,
      prompts: Array.isArray(q.prompts) ? q.prompts : Prisma.JsonNull,
      explanation: q.explanation || '',
    }));

    const savedQuiz = await prisma.quiz.create({
      data: {
        title: quizData.title || 'Quiz from YouTube Video',
        is_public: false,
        immediate_feedback: true,
        userId: user.id,
        questions: {
          create: questionsToCreate,
        },
      },
      select: { id: true, title: true, createdAt: true },
    });

    // 6. Increment usage
    await incrementAIGenerationUsage(user.id, 1);

    return NextResponse.json<ApiResponse<Quiz>>({
      success: true,
      data: savedQuiz as Quiz,
    });

  } catch (error: any) {
    console.error('Error in generate-from-youtube route:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  } finally {
    // Cleanup: Delete temp file if it exists
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.error('Failed to delete temp file:', e);
      }
    }
  }
}