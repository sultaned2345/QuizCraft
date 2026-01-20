import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Pass the request to the auth helper
  const session = await getUserSession(request);
  
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  
  // Handle different return types from auth helpers (User object vs Session object)
  // If getUserSession returns a User directly (like getAuthenticatedUser), handle that.
  // If it returns { user: ... }, handle that. 
  // Based on the existing code 'session.user.id', it expects a Session object.
  const userId = session.user?.id || (session as any).id;

  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

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
      score: { lt: 60 },
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