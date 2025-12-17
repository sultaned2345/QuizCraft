// src/app/api/generate-from-youtube/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import {
  checkAIGenerationUsageLimit,
  incrementAIGenerationUsage,
} from '@/lib/usage-limits';
import { callAIToGenerateQuiz, transcribeAudioFile } from '@/lib/aiGeneration';
import { ApiResponse, Quiz } from '@/types/database';
import { Prisma } from '@prisma/client';
import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

// --- NEW: Helper to fetch audio via Cobalt API (Bypasses IP Blocks) ---
async function downloadWithCobalt(url: string, outputPath: string): Promise<string> {
  console.log('[Cobalt] Attempting download via Cobalt API...');
  
  // 1. Request the stream URL from Cobalt
  const response = await fetch('https://api.cobalt.tools/api/json', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({
      url: url,
      isAudioOnly: true,
      aFormat: 'mp3',
      filenamePattern: 'nerdy'
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cobalt API Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  
  // Cobalt returns a 'url' (stream) or 'picker' (multiple). We need the 'url'.
  if (!data.url) {
    if (data.status === 'picker') throw new Error('Cobalt returned a picker (multiple streams), which is not supported yet.');
    throw new Error('Cobalt API did not return a stream URL.');
  }

  console.log('[Cobalt] Stream URL received. Downloading bytes...');

  // 2. Download the actual file from the stream URL
  const fileStream = fs.createWriteStream(outputPath);
  const streamResponse = await fetch(data.url);

  if (!streamResponse.ok || !streamResponse.body) {
    throw new Error(`Failed to download stream from Cobalt: ${streamResponse.statusText}`);
  }

  // 3. Pipe the Web Stream to the File System
  // @ts-ignore - ReadableStream/Node stream mismatch typing issue
  const reader = streamResponse.body.getReader();
  const chunks = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) fileStream.write(Buffer.from(value));
  }
  
  fileStream.end();

  return new Promise((resolve, reject) => {
    fileStream.on('finish', () => {
      console.log('[Cobalt] Download complete.');
      resolve(outputPath);
    });
    fileStream.on('error', (err) => reject(err));
  });
}

// --- Fallback: Standard YTDL ---
async function downloadWithYtdl(url: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`[YTDL] Starting download to ${outputPath}...`);
    // Try to force the 'ANDROID' client to bypass some bot checks
    const stream = ytdl(url, { 
      quality: 'lowestaudio', 
      filter: 'audioonly',
      // @ts-ignore - 'clients' option exists in newer @distube/ytdl-core versions
      requestOptions: {
         headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
         }
      }
    });
    
    const writeStream = fs.createWriteStream(outputPath);
    stream.pipe(writeStream);
    
    writeStream.on('finish', () => resolve(outputPath));
    writeStream.on('error', reject);
    stream.on('error', reject);
  });
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const user = await requireAuth(request);
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing videoUrl' }, { status: 400 });
    }

    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'limit_exceeded', message: usageCheck.message }, { status: 403 });
    }

    let transcriptText = '';
    
    // STRATEGY 1: Official Transcript
    try {
      console.log('Attempting to fetch transcript text directly...');
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoUrl);
      if (transcriptItems?.length > 0) {
        transcriptText = transcriptItems.map(item => item.text).join(' ');
      }
    } catch (transcriptError: any) {
      console.warn('Transcript fetch failed. Trying Audio Fallback...', transcriptError.message);
      
      // STRATEGY 2: Audio Download (Cobalt -> Fallback to YTDL)
      try {
        if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is missing.");

        const tempDir = os.tmpdir();
        tempFilePath = path.join(tempDir, `${uuidv4()}.mp3`);

        // Try Cobalt First (Best for Vercel/Cloud IPs)
        try {
          await downloadWithCobalt(videoUrl, tempFilePath);
        } catch (cobaltError: any) {
          console.error('Cobalt failed, trying YTDL:', cobaltError.message);
          // Fallback to YTDL
          await downloadWithYtdl(videoUrl, tempFilePath);
        }
        
        console.log('Transcribing audio with Groq...');
        transcriptText = await transcribeAudioFile(tempFilePath);
        
      } catch (audioError: any) {
        console.error('Audio extraction/transcription failed:', audioError);
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: 'transcription_failed',
            message: `Could not process video audio. Vercel IP may be blocked by YouTube. Error: ${audioError.message}`,
          },
          { status: 422 }
        );
      }
    }

    if (!transcriptText || transcriptText.trim().length < 100) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'transcript_unavailable', message: 'Content too short.' }, { status: 400 });
    }

    const quizData = await callAIToGenerateQuiz(transcriptText, 10, 'medium', 'MIXED');

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
        questions: { create: questionsToCreate },
      },
      select: { id: true, title: true, createdAt: true },
    });

    await incrementAIGenerationUsage(user.id, 1);

    return NextResponse.json<ApiResponse<Quiz>>({ success: true, data: savedQuiz as Quiz });

  } catch (error: any) {
    console.error('Error in generate-from-youtube:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) { /* ignore */ }
    }
  }
}