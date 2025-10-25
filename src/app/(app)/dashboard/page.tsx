import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { DashboardClientComponent } from './DashboardClientComponent'; // Import client component
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession'; // Ensure helper exists
import { Quiz } from '@/types/database'; // Base type

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
    const skip = (page - 1) * limit;
    try {
        const [quizzesData, totalCount] = await prisma.$transaction([
            prisma.quiz.findMany({
                where: { userId: userId },
                select: {
                    id: true, title: true, created_at: true, is_public: true, share_link: true,
                    _count: { select: { questions: true } }
                },
                orderBy: { createdAt: 'desc' }, // Use schema field name
                take: limit,
                skip: skip,
            }),
            prisma.quiz.count({
                where: { userId: userId },
            }),
        ]);

        const quizzes = quizzesData.map(q => ({
            id: q.id,
            title: q.title,
            share_link: q.share_link ?? null,
            created_at: q.created_at?.toISOString() || '',
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
         // Handle redirect appropriately
         return <div>Please log in.</div>; // Placeholder
    }

    // Fetch initial data on the server
    const initialQuizzesData = await getInitialQuizzes(session.user.id, 1, 9);

    return (
        <Suspense fallback={<div className="flex h-[calc(100vh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
            {/* Render the Client Component */}
            <DashboardClientComponent initialData={initialQuizzesData} />
        </Suspense>
    );
}