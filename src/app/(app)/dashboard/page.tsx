// src/app/(app)/dashboard/page.tsx

// --- Server-Side Data Fetching Function (SIMPLIFIED) ---
async function getInitialQuizzes(userId: string, page: number = 1, limit: number = 9): Promise<PaginatedQuizzesData> {
    console.log("--- Dashboard Fetching for User ID (SIMPLIFIED):", userId); // Keep log
    // const skip = (page - 1) * limit; // Not using pagination for now
    try {
        // --- SIMPLIFIED QUERY ---
        // Fetch ALL quizzes for the user with minimal data first
        const allQuizzesForUser = await prisma.quiz.findMany({
            where: { userId: userId }, // Prisma schema uses userId
            // No select, no orderBy, no take, no skip for now
            include: { // Include questions temporarily to get count
                _count: {
                    select: { questions: true }
                }
            }
        });

        // Log the raw result count
        console.log(`--- Found ${allQuizzesForUser.length} raw quizzes for user ${userId} in DB`);

        // Manually handle pagination after fetching all (less efficient, but for debugging)
        const totalCount = allQuizzesForUser.length;
        const totalPages = Math.ceil(totalCount / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedQuizzesData = allQuizzesForUser.slice(startIndex, endIndex);

        // Map the paginated data
        const quizzes = paginatedQuizzesData.map(q => ({
            id: q.id,
            title: q.title,
            share_link: q.share_link ?? null,
            created_at: q.createdAt?.toISOString() || '', // Use 'createdAt' from schema
            is_public: q.is_public ?? false,
            questionsCount: q._count?.questions ?? 0, // Safely access count
        }));

        console.log(`--- Returning ${quizzes.length} quizzes for page ${page}`);

        return { quizzes, totalCount, totalPages, currentPage: page };

    } catch (error: any) {
        console.error(`Error fetching initial dashboard quizzes (SIMPLIFIED) for user ${userId}:`, error);
        // Return default/empty state on error
        return { quizzes: [], totalCount: 0, totalPages: 0, currentPage: 1 };
    }
}

// --- The Page Component (Server Component) ---
// (No changes needed below this line in this file)
// ... rest of the file ...