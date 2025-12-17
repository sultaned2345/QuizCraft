// src/app/api/generate-from-youtube/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import {
  checkAIGenerationUsageLimit,
  incrementAIGenerationUsage,
} from '@/lib/usage-limits';
import { callAIToGenerateQuiz } from '@/lib/aiGeneration';
import { ApiResponse, Quiz } from '@/types/database';
import { Prisma } from '@prisma/client';
import { YoutubeTranscript } from 'youtube-transcript';

// --- FIX: Prevent static generation for this route ---
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
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
        {
          success: false,
          error: 'limit_exceeded',
          message: usageCheck.message,
        },
        { status: 403 }
      );
    }

    // 2. Fetch Transcript
    let transcriptText = '';
    try {
      // Uses the 'youtube-transcript' library
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoUrl);
      
      if (!transcriptItems || transcriptItems.length === 0) {
         throw new Error('No transcript found');
      }

      // Combine all text segments into one string
      transcriptText = transcriptItems.map(item => item.text).join(' ');

    } catch (toolError: any) {
      console.warn(`YouTube tool error for URL ${videoUrl}:`, toolError.message);

      // Handle specific "disabled" error if the library throws it
      if (toolError.message.includes('Transcript is disabled') || toolError.message.includes('No transcript')) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: 'transcript_disabled',
            message: 'Quiz generation failed. The video does not have a transcript available.',
          },
          { status: 400 }
        );
      }

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'youtube_tool_failed',
          message: `Could not fetch video data: ${toolError.message}`,
        },
        { status: 502 }
      );
    }

    // 3. Check for sufficient length
    if (!transcriptText || transcriptText.trim().length < 100) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'transcript_unavailable',
          message: 'The transcript is too short to generate a quiz.',
        },
        { status: 400 }
      );
    }

    // 4. Proceed with Quiz Generation
    // Note: We use the existing 'callAIToGenerateQuiz' from aiGeneration.ts
    const quizData = await callAIToGenerateQuiz(
      transcriptText,
      10, // numQuestions
      'medium', // difficulty
      'MIXED' // questionType
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
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });

    // 6. Increment usage
    await incrementAIGenerationUsage(user.id, 1);

    return NextResponse.json<ApiResponse<Quiz>>({
      success: true,
      data: savedQuiz as Quiz,
    });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('Error in generate-from-youtube route:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}