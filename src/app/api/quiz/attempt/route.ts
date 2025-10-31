// src/app/api/quiz/attempt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';

interface AttemptRequestBody {
  quizId: string;
  score: number;
  total: number;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body: AttemptRequestBody = await request.json();
    const { quizId, score, total } = body;

    if (!quizId || score === undefined || total === undefined) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: quizId, score, and total.',
      }, { status: 400 });
    }

    // Optional: Verify the quiz exists
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true } // Just check for existence
    });

    if (!quiz) {
       return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Quiz not found.',
      }, { status: 404 });
    }

    // Save the attempt
    const newAttempt = await prisma.quiz_attempts.create({
      data: {
        user_id: user.id,
        quiz_id: quizId,
        score: score,
        total: total,
      }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: newAttempt,
      message: 'Quiz attempt saved successfully.',
    }, { status: 201 });

  } catch (error: any) {
    if (error instanceof Response) return error; // Handle requireAuth errors
    console.error('[POST /api/quiz/attempt] Error saving attempt:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to save attempt';
    return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
  }
}