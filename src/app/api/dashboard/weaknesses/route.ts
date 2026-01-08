import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';

// FIX: Force dynamic rendering because this route uses headers/cookies (via requireAuth)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    // 1. Group quiz attempts by quiz_id where the score was < 70%
    const weakAttempts = await prisma.quiz_attempts.groupBy({
      by: ['quiz_id'],
      where: {
        user_id: user.id,
        score: { lt: 70 },
      },
      _count: {
        id: true,
      },
      _max: {
        created_at: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 5,
    });

    // If no weaknesses found, return empty early
    if (weakAttempts.length === 0) {
      return NextResponse.json<ApiResponse>({ success: true, data: [] });
    }

    // 2. Fetch Quiz Titles
    const weakQuizIds = weakAttempts.map((wa) => wa.quiz_id);
    const quizDetails = await prisma.quiz.findMany({
      where: {
        id: { in: weakQuizIds },
      },
      select: {
        id: true,
        title: true,
      },
    });

    // 3. Combine Data
    const formattedWeaknesses = weakAttempts.map((attempt) => {
      const quiz = quizDetails.find((q) => q.id === attempt.quiz_id);
      return {
        quiz_id: attempt.quiz_id,
        title: quiz?.title || 'Unknown Quiz',
        fail_count: attempt._count.id,
        last_failed_at: attempt._max.created_at,
      };
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: formattedWeaknesses,
    });
  } catch (error: any) {
    if (error instanceof Response) return error; 
    console.error('[API /api/dashboard/weaknesses] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch weakness analysis.' },
      { status: 500 }
    );
  }
}