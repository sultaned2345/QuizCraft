import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { FlashcardsClientComponent } from './FlashcardsClientComponent'; // Import client component
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession'; // Ensure this helper exists and works
import { USAGE_LIMITS } from '@/lib/usage-limits';
import { FlashcardDeck } from '@/types/database'; // Import type

// Define expected response structure for pagination
interface PaginatedDecksData {
  decks: FlashcardDeck[];
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}

// --- Server-Side Data Fetching Function ---
async function getInitialDecks(userId: string, page: number = 1, limit: number = 9): Promise<PaginatedDecksData> {
    const skip = (page - 1) * limit;
    try {
        const userProfile = await prisma.profiles.findUnique({
            where: { id: userId },
            select: { subscription_plan: true },
        });
        const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const usageLimit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_FLASHCARD_DECKS;

        const [decksData, totalCount] = await prisma.$transaction([
            prisma.flashcard_decks.findMany({
                where: { user_id: userId },
                orderBy: { created_at: 'desc' },
                take: limit,
                skip: skip,
                // Select only necessary fields if optimization needed later
                 select: { id: true, user_id: true, title: true, created_at: true, updated_at: true }
            }),
            prisma.flashcard_decks.count({
                where: { user_id: userId },
            }),
        ]);

        // Serialize dates
        const decks = decksData.map(deck => ({
            ...deck,
            created_at: deck.created_at?.toISOString() || '',
            updated_at: deck.updated_at?.toISOString() || '',
        }));

        const totalPages = Math.ceil(totalCount / limit);

        return {
            decks,
            count: totalCount,
            limit: usageLimit,
            totalPages,
            currentPage: page,
        };
    } catch (error) {
        console.error("Error fetching initial decks:", error);
        return {
            decks: [], count: 0, limit: USAGE_LIMITS.FREE_FLASHCARD_DECKS, totalPages: 0, currentPage: 1,
        };
    }
}


// --- The Page Component (Server Component) ---
export default async function FlashcardsPage() {
    const session = await getServerSession();

    if (!session?.user) {
        // Handle redirect or show login prompt
         return <div>Please log in.</div>; // Placeholder
    }

    // Fetch initial data on the server
    const initialDecksData = await getInitialDecks(session.user.id, 1, 9); // Page 1, 9 items

    return (
        <Suspense fallback={<div className="flex h-[calc(100vh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            {/* Render the Client Component */}
            <FlashcardsClientComponent initialData={initialDecksData} />
        </Suspense>
    );
}