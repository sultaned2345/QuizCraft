// src/app/api/dashboard/weaknesses/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession';

// --- FIX: Prevent static generation for this route ---
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. Group quiz attempts by quiz_id where the score was < 70%
    const weakAttempts = await prisma.quiz_attempts.groupBy({
      by: ['quiz_id'],
      where: {
        user_id: userId,
        score: { lt: 70 }, // Less than 70% is considered a "weakness"
      },
      _count: {
        id: true, // Count how many times they failed this quiz
      },
      // You can also get the latest failure date
      _max: {
        created_at: true
      },
      orderBy: {
        _count: {
          id: 'desc' // Order by most failed quizzes first
        }
      },
      take: 5 // Limit to top 5 weak areas
    });

    // 2. Extract the Quiz IDs
    const weakQuizIds = weakAttempts.map((wa) => wa.quiz_id);

    // 3. Fetch the Quiz details (Title) for these IDs
    // We cannot use 'include' in groupBy, so we fetch details separately
    const quizDetails = await prisma.quiz.findMany({
      where: {
        id: { in: weakQuizIds }
      },
      select: {
        id: true,
        title: true
        // If you add a 'topic' field to your Schema later, select it here:
        // topic: true, 
      }
    });

    // 4. Combine the data into a clean response
    const formattedWeaknesses = weakAttempts.map((attempt) => {
      const quiz = quizDetails.find((q) => q.id === attempt.quiz_id);
      return {
        quiz_id: attempt.quiz_id,
        title: quiz?.title || "Unknown Quiz",
        fail_count: attempt._count.id,
        last_failed_at: attempt._max.created_at,
      };
    });

    return NextResponse.json({ 
      success: true, 
      data: formattedWeaknesses 
    });

  } catch (error) {
    console.error('Error fetching weakness analysis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weakness analysis' }, 
      { status: 500 }
    );
  }
}