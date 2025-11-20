// src/app/api/generate-from-youtube/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { callAIToGenerateQuiz } from '@/lib/aiGeneration';
import { ApiResponse, Quiz } from '@/types/database';
import { Prisma } from '@prisma/client';
// Requires: npm install youtubei.js
import { Innertube, UniversalCache } from 'youtubei.js';

export const runtime = 'nodejs';

function extractVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function getYouTubeTranscript(videoId: string): Promise<string> {
  try {
    // 'UniversalCache(false)' is crucial for serverless environments (Vercel)
    // to prevent writing temp files that cause permission errors.
    const yt = await Innertube.create({ cache: new UniversalCache(false) });
    
    const info = await yt.getInfo(videoId);
    const transcriptData = await info.getTranscript();
    
    if (transcriptData?.transcript?.content?.body?.initial_segments) {
      return transcriptData.transcript.content.body.initial_segments
        .map((seg: any) => seg.snippet.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    throw new Error("Transcript format not recognized");
  } catch (error: any) {
    console.error("YouTube Fetch Error:", error);
    if (error.message?.includes('disabled') || error.message?.includes('unavailable')) {
       throw new Error("Transcripts are disabled for this video.");
    }
    throw new Error("Failed to fetch video. It might be private or age-restricted.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing videoUrl' }, { status: 400 });
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // 1. Check Usage Limit
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'limit_exceeded', message: usageCheck.message }, { status: 403 });
    }

    // 2. Fetch Transcript (Robust Method)
    let transcript = "";
    try {
      transcript = await getYouTubeTranscript(videoId);
    } catch (toolError: any) {
      return NextResponse.json({
        success: false,
        error: toolError.message.includes('disabled') ? 'transcript_disabled' : 'youtube_tool_failed',
        message: toolError.message
      }, { status: 400 });
    }

    if (!transcript || transcript.length < 100) {
      return NextResponse.json({ success: false, error: 'transcript_too_short', message: 'Transcript is too short.' }, { status: 400 });
    }

    // 3. Generate Quiz 
    // This calls src/lib/aiGeneration.ts, which is now using gemini-2.5-flash-lite
    const quizData = await callAIToGenerateQuiz(transcript, 10, 'medium', 'MIXED');

    // 4. Save to Database
    const savedQuiz = await prisma.quiz.create({
      data: {
        title: quizData.title || 'Quiz from YouTube',
        is_public: false,
        immediate_feedback: true,
        userId: user.id,
        questions: {
          create: quizData.questions.map((q: any) => ({
            question_text: q.question_text,
            question_type: q.question_type,
            correct_answer: q.correct_answer,
            options: Array.isArray(q.options) ? q.options : Prisma.JsonNull,
            explanation: q.explanation || '',
            prompts: Array.isArray(q.prompts) ? q.prompts : Prisma.JsonNull,
          })),
        },
      },
    });

    await incrementAIGenerationUsage(user.id, 1);

    return NextResponse.json<ApiResponse<Quiz>>({ success: true, data: savedQuiz as Quiz });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('Error in YouTube route:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}