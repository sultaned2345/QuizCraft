// src/app/(app)/flashcards/page.tsx
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { FlashcardsClientComponent } from './FlashcardsClientComponent'; // Import client component
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession'; // Ensure this helper exists and works
import { USAGE_LIMITS } from '@/lib/usage-limits';
import { FlashcardDeck } from '@/types/database'; // Import type

// --- 1. DEFINE THE DeckWithStats type here ---
interface DeckWithStats extends FlashcardDeck {
  cardCount: number;
  dueCount: number;
  newCount: number;
}

// Define expected response structure for pagination
interface PaginatedDecksData {
  decks: DeckWithStats[]; // Use the new type
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}
// --- END 1 ---

// --- NEW ---
// Define the study queue data structure
interface StudyQueueData {
  dueCount: number;
  firstDueDeckId: string | null;
}

// Combine all initial data into one prop
interface FlashcardsPageData extends PaginatedDecksData, StudyQueueData {}

// --- 2. UPDATE getInitialDecks FUNCTION ---
async function getInitialDecks(userId: string, page: number = 1, limit: number = 9): Promise<PaginatedDecksData> {
  const skip = (page - 1) * limit;
  const now = new Date(); // Use for 'due' and 'new' calculation

  try {
    const userProfile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { subscription_plan: true },
    });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
    const usageLimit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_FLASHCARD_DECKS;

    // --- Use the more complex query from /api/decks/route.ts ---
    const decksData: any[] = await prisma.$queryRaw`
        SELECT
            d.id,
            d.user_id,
            d.title,
            d.created_at,
            d.updated_at,
            COUNT(f.id)::int AS "cardCount",
            COUNT(CASE WHEN f.review_at <= ${now} THEN 1 ELSE NULL END)::int AS "dueCount",
            COUNT(CASE WHEN f.review_at <= ${now} AND f.ease_factor = 2.5 THEN 1 ELSE NULL END)::int AS "newCount"
        FROM
            public.flashcard_decks d
        LEFT JOIN
            public.flashcards f ON d.id = f.deck_id
        WHERE
            d.user_id = ${userId}::uuid
        GROUP BY
            d.id
        ORDER BY
            d.created_at DESC
        LIMIT ${limit}
        OFFSET ${skip}
    `;

    const totalCount = await prisma.flashcard_decks.count({
      where: { user_id: userId },
    });
    // --- End complex query ---

    // Serialize dates and ensure types
    const decks: DeckWithStats[] = decksData.map((deck) => ({
      id: deck.id,
      user_id: deck.user_id,
      title: deck.title,
      created_at: deck.created_at?.toISOString() || '',
      updated_at: deck.updated_at?.toISOString() || '',
      cardCount: deck.cardCount || 0,
      dueCount: deck.dueCount || 0,
      newCount: deck.newCount || 0,
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
    console.error('Error fetching initial decks:', error);
    return {
      decks: [],
      count: 0,
      limit: USAGE_LIMITS.FREE_FLASHCARD_DECKS,
      totalPages: 0,
      currentPage: 1,
    };
  }
}
// --- END 2 ---

// --- NEW: Server-Side Function to get Study Queue (Unchanged) ---
async function getStudyQueueData(userId: string): Promise<StudyQueueData> {
  try {
    // Find the oldest due card to get its deck ID
    const oldestDueCard = await prisma.flashcards.findFirst({
      where: {
        review_at: { lte: new Date() },
        deck: { user_id: userId },
      },
      orderBy: { review_at: 'asc' },
      select: { deck_id: true },
    });

    // Get the total count of all due cards
    const dueCount = await prisma.flashcards.count({
      where: {
        review_at: { lte: new Date() },
        deck: { user_id: userId },
      },
    });

    return {
      dueCount,
      firstDueDeckId: oldestDueCard?.deck_id || null,
    };
  } catch (error) {
    console.error('Error fetching study queue data:', error);
    return { dueCount: 0, firstDueDeckId: null };
  }
}

// --- The Page Component (Server Component) (Unchanged) ---
export default async function FlashcardsPage() {
  const session = await getServerSession();

  if (!session?.user) {
    // Handle redirect or show login prompt
    return <div>Please log in.</div>; // Placeholder
  }

  // Fetch all initial data in parallel
  const [initialDecksData, studyQueueData] = await Promise.all([
    getInitialDecks(session.user.id, 1, 9), // Page 1, 9 items
    getStudyQueueData(session.user.id),
  ]);

  // Combine data to pass as a single prop
  const initialData: FlashcardsPageData = {
    ...initialDecksData,
    ...studyQueueData,
  };

  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      {/* Render the Client Component */}
      <FlashcardsClientComponent initialData={initialData} />
    </Suspense>
  );
}