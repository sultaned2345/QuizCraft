// src/app/(app)/quizzes/page.tsx

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
// --- MODIFICATION: Renamed component import ---
import { QuizzesClientComponent } from './QuizzesClientComponent';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession';
import { Quiz, QuizAttempt } from '@/types/database';

export const dynamic = 'force-dynamic';

// Type for dashboard quiz list item
interface DashboardQuiz extends Omit<Quiz, 'questions' | 'user_id' | 'immediate_feedback'> {
  questionsCount: number;
}
// Type for all dashboard data
interface DashboardData {
  quizzes: DashboardQuiz[];
  totalQuizCount: number;
  quizzesTotalPages: number;
  quizzesCurrentPage: number;
  dueCardCount: number;
  recentAttempts: QuizAttempt[];
  // We can add recentActivity here in the future
}

// --- Server-Side Data Fetching Function ---
async function getDashboardData(userId: string, page: number = 1, limit: number = 9): Promise<DashboardData> {
  console.log("--- Dashboard Fetching for User ID:", userId);
  const skip = (page - 1) * limit;

  try {
    // Use $transaction to fetch all data concurrently
    const [
      quizzesData,
      totalQuizCount,
      dueCardCount,
      recentAttempts
    ] = await prisma.$transaction([
      // 1. Get Quizzes (paginated)
      prisma.quiz.findMany({
        where: { userId: userId },
        select: {
          id: true,
          title: true,
          createdAt: true,
          is_public: true,
          share_link: true,
          _count: { select: { questions: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: skip,
      }),
      // 2. Get Total Quiz Count
      prisma.quiz.count({
        where: { userId: userId },
      }),
      // 3. Get Due Flashcard Count
      prisma.flashcards.count({
        where: {
          review_at: { lte: new Date() },
          deck: { user_id: userId },
        },
      }),
      // 4. Get Recent Quiz Attempts (last 5)
      prisma.quiz_attempts.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: 5,
      }),
    ]);

    // Map quiz data
    const quizzes = quizzesData.map((q) => ({
      id: q.id,
      title: q.title,
      share_link: q.share_link ?? null,
      created_at: q.createdAt?.toISOString() || '',
      is_public: q.is_public ?? false,
      questionsCount: q._count.questions,
    }));

    // Map attempts data (serialize date)
    const formattedAttempts = recentAttempts.map(att => ({
      ...att,
      created_at: att.created_at?.toISOString() || '',
    }));

    const totalPages = Math.ceil(totalQuizCount / limit);

    return {
      quizzes,
      totalQuizCount,
      quizzesTotalPages: totalPages,
      quizzesCurrentPage: page,
      dueCardCount,
      recentAttempts: formattedAttempts,
    };

  } catch (error: any) {
    console.error(`Error fetching dashboard data for user ${userId}:`, error);
    // Return default/empty state on error
    return {
      quizzes: [],
      totalQuizCount: 0,
      quizzesTotalPages: 0,
      quizzesCurrentPage: 1,
      dueCardCount: 0,
      recentAttempts: [],
    };
  }
}

// --- The Page Component (Server Component) ---
export default async function QuizzesPage() { // --- MODIFICATION: Renamed component ---
  const session = await getServerSession();

  if (!session?.user) {
    return <div>Please log in.</div>; // Placeholder
  }

  console.log("--- Quizzes Page Got Session User ID:", session.user.id);
  // Fetch initial data on the server
  const initialDashboardData = await getDashboardData(session.user.id, 1, 9);

  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      {/* --- MODIFICATION: Renamed component --- */}
      <QuizzesClientComponent initialData={initialDashboardData} />
    </Suspense>
  );
}