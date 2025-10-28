// src/app/(app)/dashboard/page.tsx

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { DashboardClientComponent } from './DashboardClientComponent'; // Import client component
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession'; // Ensure helper exists
import { Quiz } from '@/types/database'; // Base type

export const dynamic = 'force-dynamic'; // Ensures the page is always dynamically rendered

// Type for dashboard quiz list item
interface DashboardQuiz extends Omit<Quiz, 'questions' | 'user_id' | 'immediate_feedback'> {
  questionsCount: number;
}
// Type for paginated data structure
interface PaginatedQuizzesData {
    quizzes: DashboardQuiz[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
}


// --- Server-Side Data Fetching Function ---
async function getInitialQuizzes(userId: string, page: number = 1, limit: number = 9): Promise<PaginatedQuizzesData> {
    console.log("--- Dashboard Fetching for User ID:", userId); // Keep log
    const skip = (page - 1) * limit;
    try {
        const [quizzesData, totalCount] = await prisma.$transaction([
            prisma.quiz.findMany({
                where: { userId: userId }, // Prisma schema uses userId
                select: {
                    id: true, title: true, createdAt: true, is_public: true, share_link: true, // Use schema field names
                    _count: { select: { questions: true } }
                },
                // --- FIX HERE: Use correct casing for 'createdAt' ---
                orderBy: { createdAt: 'desc' }, // Use schema field name 'createdAt'
                take: limit,
                skip: skip,
            }),
            prisma.quiz.count({
                where: { userId: userId }, // Prisma schema uses userId
            }),
        ]);

        // Map data, ensuring correct field names from the query result
        const quizzes = quizzesData.map(q => ({
            id: q.id,
            title: q.title,
            share_link: q.share_link ?? null,
            created_at: q.createdAt?.toISOString() || '', // Use 'createdAt' from query result
            is_public: q.is_public ?? false,
            questionsCount: q._count.questions,
        }));

        const totalPages = Math.ceil(totalCount / limit);

        return { quizzes, totalCount, totalPages, currentPage: page };

    } catch (error: any) {
        console.error(`Error fetching initial dashboard quizzes for user ${userId}:`, error);
        // Return default/empty state on error
        return { quizzes: [], totalCount: 0, totalPages: 0, currentPage: 1 };
    }
}


// --- The Page Component (Server Component) ---
export default async function DashboardPage() {
    const session = await getServerSession();

    if (!session?.user) {
         return <div>Please log in.</div>; // Placeholder
    }

    console.log("--- Dashboard Page Got Session User ID:", session.user.id); // Keep log
    // Fetch initial data on the server
    const initialQuizzesData = await getInitialQuizzes(session.user.id, 1, 9);

    return (
        <Suspense fallback={<div className="flex h-[calc(100vh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
            {/* Render the Client Component */}
            <DashboardClientComponent initialData={initialQuizzesData} />
        </Suspense>
    );
}