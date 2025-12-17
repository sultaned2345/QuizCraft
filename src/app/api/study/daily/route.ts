import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/auth";
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getUserSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const userId = session.user.id;

  const now = new Date();

  // 1. Get Due Flashcards
  const dueFlashcards = await prisma.flashcards.findMany({
    where: {
      deck: { user_id: userId },
      review_at: { lte: now } // Due now or in the past
    },
    take: 20,
    select: { id: true }
  });

  // 2. Identify Weak Areas (Quizzes with < 60% score recently)
  const weakAttempts = await prisma.quiz_attempts.findMany({
    where: {
      user_id: userId,
      score: { lt: 60 }, // Assuming score is percentage, adjust logic if raw score
    },
    orderBy: { created_at: 'desc' },
    take: 3,
    include: { quiz: true }
  });

  const hasWork = dueFlashcards.length > 0 || weakAttempts.length > 0;

  return NextResponse.json({
    hasWork,
    dueCount: dueFlashcards.length,
    weakTopics: weakAttempts.map(a => a.quiz.title),
    estimatedMinutes: Math.ceil((dueFlashcards.length * 1) + (weakAttempts.length * 5)) // Rough calc
  });
}