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
// CHANGE: Import the robust helper instead of the raw library
import { fetchYoutubeTranscript } from '@/lib/youtube'; 

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

    // 2. Fetch Transcript (using robust helper with fallback)
    let transcriptText = '';
    let videoTitle = '';

    try {
      // CHANGE: Use the helper from src/lib/youtube.ts
      // This automatically tries the API first, then falls back to page scraping
      const videoData = await fetchYoutubeTranscript(videoUrl);
      transcriptText = videoData.transcript;
      videoTitle = videoData.title;

    } catch (toolError: any) {
      console.warn(`YouTube tool error for URL ${videoUrl}:`, toolError.message);

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'transcript_failed',
          message: toolError.message || 'Could not fetch video transcript. Ensure the video has captions enabled.',
        },
        { status: 400 }
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
    const quizData = await callAIToGenerateQuiz(
      transcriptText,
      10, // numQuestions
      'medium', // difficulty
      'MIXED' // questionType
    );

    if (!quizData) {
        return NextResponse.json<ApiResponse>(
            { success: false, error: 'ai_generation_failed', message: 'Failed to generate quiz from transcript.' },
            { status: 500 }
        );
    }

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
        title: quizData.title || videoTitle || 'Quiz from YouTube Video',
        is_public: false,
        immediate_feedback: true,
        userId: user.id,
        questions: {
          create: questionsToCreate,
        },
      },
    });

    // 6. Increment usage
    await incrementAIGenerationUsage(user.id, 1);

    const responseQuiz: Quiz = {
      id: savedQuiz.id,
      user_id: savedQuiz.userId!,
      title: savedQuiz.title,
      share_link: savedQuiz.share_link,
      created_at: savedQuiz.createdAt ? savedQuiz.createdAt.toISOString() : new Date().toISOString(),
      is_public: savedQuiz.is_public ?? false,
      immediate_feedback: savedQuiz.immediate_feedback ?? true,
      time_limit_minutes: savedQuiz.time_limit_minutes,
      questions: [],
    };

    return NextResponse.json<ApiResponse<Quiz>>({
      success: true,
      data: responseQuiz,
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