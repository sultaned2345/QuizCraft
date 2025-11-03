// src/app/api/dashboard/study-plan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface StudySuggestion {
  type: 'flashcard' | 'quiz';
  id: string; // Deck ID or Quiz ID
  title: string;
  reason: string;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const suggestions: StudySuggestion[] = [];

    // 1. Get due flashcard decks
    const dueDecks = await prisma.flashcard_decks.findMany({
      where: {
        user_id: user.id,
        flashcards: {
          some: {
            review_at: { lte: new Date() },
          },
        },
      },
      select: {
        id: true,
        title: true,
      },
      take: 3,
    });

    dueDecks.forEach(deck => {
      suggestions.push({
        type: 'flashcard',
        id: deck.id,
        title: deck.title,
        reason: 'Cards are due for review.',
      });
    });

    // 2. Get quizzes with recent low scores (score < 70%)
    const recentAttempts = await prisma.quiz_attempts.findMany({
      where: {
        user_id: user.id,
      },
      include: {
        quiz: {
          select: { id: true, title: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 20, // Look at last 20 attempts
    });
    
    const quizzesToReview: { [key: string]: StudySuggestion } = {};
    for (const attempt of recentAttempts) {
      if (!attempt.quiz) continue;
      
      const scorePercent = (attempt.score / attempt.total) * 100;
      
      // If score is low and we haven't already added this quiz
      if (scorePercent < 70 && !quizzesToReview[attempt.quiz.id]) {
        quizzesToReview[attempt.quiz.id] = {
          type: 'quiz',
          id: attempt.quiz.id,
          title: attempt.quiz.title,
          reason: `You scored ${scorePercent.toFixed(0)}% on a recent attempt.`,
        };
      }
      
      // Stop once we have a few quiz suggestions
      if (Object.keys(quizzesToReview).length >= 3) break;
    }

    suggestions.push(...Object.values(quizzesToReview));

    // Shuffle and take top 5 suggestions
    const finalSuggestions = suggestions
      .sort(() => 0.5 - Math.random())
      .slice(0, 5);

    return NextResponse.json<ApiResponse<StudySuggestion[]>>({
      success: true,
      data: finalSuggestions,
    });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('[API /dashboard/study-plan] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to generate study plan.' },
      { status: 500 }
    );
  }
}