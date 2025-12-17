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

// List of public Cobalt instances to try in order
const COBALT_INSTANCES = [
  'https://api.cobalt.tools/api/json',
  'https://cobalt.api.kwiatekmiki.pl/api/json', // Backup instance
];

// --- Helper: Fetch audio via Cobalt API (Bypasses IP Blocks) ---
async function downloadWithCobalt(url: string, outputPath: string): Promise<string> {
  let lastError: Error | null = null;

  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`[Cobalt] Attempting download via ${instance}...`);
      
      const response = await fetch(instance, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
          url: url,
          downloadMode: 'audio', // Correct parameter
          audioFormat: 'mp3',
          filenamePattern: 'basic'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.url) {
        if (data.status === 'picker') throw new Error('Cobalt returned a picker (multiple streams), which is not supported yet.');
        throw new Error(`Cobalt API did not return a stream URL. Status: ${data.status}`);
      }

      console.log('[Cobalt] Stream URL received. Downloading bytes...');

      // Download the actual file from the stream URL
      const fileStream = fs.createWriteStream(outputPath);
      const streamResponse = await fetch(data.url);

      if (!streamResponse.ok || !streamResponse.body) {
        throw new Error(`Failed to download stream from Cobalt: ${streamResponse.statusText}`);
      }

      // Pipe the Web Stream to the File System
      // @ts-ignore - ReadableStream/Node stream mismatch typing issue
      const reader = streamResponse.body.getReader();
      
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

    } catch (err: any) {
      console.warn(`[Cobalt] Failed on instance ${instance}:`, err.message);
      lastError = err;
      // Continue to next instance...
    }
  }

  throw lastError || new Error('All Cobalt instances failed.');
}

// --- Fallback: Standard YTDL ---
async function downloadWithYtdl(url: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`[YTDL] Starting download to ${outputPath}...`);
    
    const stream = ytdl(url, { 
      quality: 'lowestaudio', 
      filter: 'audioonly',
      // @ts-ignore
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
          console.error('Cobalt failed, trying YTDL fallback:', cobaltError.message);
          // Fallback to YTDL if Cobalt fails
          await downloadWithYtdl(videoUrl, tempFilePath);
        }
        
        console.log('Transcribing audio with Groq...');
        transcriptText = await transcribeAudioFile(tempFilePath);
        
      } catch (audioError: any) {
        // Log the actual chain of errors
        const msg = audioError.message || 'Unknown audio error';
        console.error('Audio processing completely failed:', msg);
        
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: 'transcription_failed',
            message: `Could not process video. Transcript disabled and audio download failed. (Detail: ${msg})`,
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