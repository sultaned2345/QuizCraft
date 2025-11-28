// src/app/(app)/flashcards/page.tsx
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { FlashcardsClientComponent } from './FlashcardsClientComponent';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession';
import { USAGE_LIMITS } from '@/lib/usage-limits';
import { FlashcardDeck } from '@/types/database';

// 1. Define strict types for the dashboard data
interface DeckWithStats extends FlashcardDeck {
  cardCount: number;
  dueCount: number;
  newCount: number;
}

interface PaginatedDecksData {
  decks: DeckWithStats[];
  count: number;
  limit: number; // Changed from 'number | typeof Infinity' to just 'number'
  totalPages: number;
  currentPage: number;
}

interface StudyQueueData {
  dueCount: number;
  firstDueDeckId: string | null;
}

interface FlashcardsPageData extends PaginatedDecksData, StudyQueueData {}

// 2. Data fetching with safe serialization
async function getInitialDecks(userId: string, page: number = 1, limit: number = 9): Promise<PaginatedDecksData> {
  const skip = (page - 1) * limit;
  const now = new Date();

  try {
    const userProfile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { subscription_plan: true },
    });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
    const usageLimit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_FLASHCARD_DECKS;

    // Use raw query for performance, but we must manually parse the result
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

    // 3. Serialize Data (BigInt -> Number, Date -> String)
    const decks: DeckWithStats[] = decksData.map((deck) => ({
      id: deck.id,
      user_id: deck.user_id,
      title: deck.title,
      created_at: deck.created_at ? new Date(deck.created_at).toISOString() : '',
      updated_at: deck.updated_at ? new Date(deck.updated_at).toISOString() : '',
      // Explicitly convert counts to Number to avoid serialization errors
      cardCount: Number(deck.cardCount || 0),
      dueCount: Number(deck.dueCount || 0),
      newCount: Number(deck.newCount || 0),
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

async function getStudyQueueData(userId: string): Promise<StudyQueueData> {
  try {
    const oldestDueCard = await prisma.flashcards.findFirst({
      where: {
        review_at: { lte: new Date() },
        deck: { user_id: userId },
      },
      orderBy: { review_at: 'asc' },
      select: { deck_id: true },
    });

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

export default async function FlashcardsPage() {
  const session = await getServerSession();

  if (!session?.user) {
    return <div>Please log in.</div>; 
  }

  const [initialDecksData, studyQueueData] = await Promise.all([
    getInitialDecks(session.user.id, 1, 9),
    getStudyQueueData(session.user.id),
  ]);

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
      <FlashcardsClientComponent initialData={initialData} />
    </Suspense>
  );
}