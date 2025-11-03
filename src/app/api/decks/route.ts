// src/app/api/decks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, validateRequestBody } from '@/lib/auth';
import { validateDeckCreation, USAGE_LIMITS } from '@/lib/usage-limits';
import { ApiResponse, CreateDeckData, FlashcardDeck } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// --- NEW: Define the type for our enhanced deck list item ---
interface DeckWithStats extends FlashcardDeck {
  cardCount: number;
  dueCount: number;
  newCount: number;
}

interface PaginatedDecksResponse {
  decks: DeckWithStats[]; // Use the new type
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}


// --- UPDATED GET Handler: Fetch all decks with Pagination and Stats ---
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '9', 10);
        const skip = (page - 1) * limit;
        const now = new Date(); // Use for 'due' and 'new' calculation

        const userProfile = await prisma.profiles.findUnique({
            where: { id: user.id },
            select: { subscription_plan: true },
        });
        const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const usageLimit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_FLASHCARD_DECKS;

        // --- Use a single raw query to get decks and counts ---
        // This query joins decks with flashcards and uses conditional aggregation
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
                d.user_id = ${user.id}::uuid
            GROUP BY
                d.id
            ORDER BY
                d.created_at DESC
            LIMIT ${limit}
            OFFSET ${skip}
        `;

        const totalCount = await prisma.flashcard_decks.count({
            where: { user_id: user.id },
        });

        // Serialize dates and ensure types
        const decks: DeckWithStats[] = decksData.map(deck => ({
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

        const responseData: PaginatedDecksResponse = {
            decks,
            count: totalCount,
            limit: usageLimit,
            totalPages,
            currentPage: page,
        };

        return NextResponse.json<ApiResponse<PaginatedDecksResponse>>({
            success: true,
            data: responseData,
        });

    } catch (error: any) {
        if (error instanceof Response) return error;
        console.error('Error fetching decks with stats:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch decks';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}

// --- POST Handler (remains the same) ---
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request); 

        // --- MODIFICATION: Use standardized validator ---
        const limitValidation = await validateDeckCreation(user.id);
        if (!limitValidation.isValid) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: limitValidation.error, // This will be "limit_exceeded"
                message: limitValidation.message
            }, { status: 403 });
        }
        // --- END MODIFICATION ---

        let body: CreateDeckData;
        try {
            body = await request.json();
        } catch (parseError) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON in request body' }, { status: 400 });
        }

        const validation = validateRequestBody(body, ['title']);
        if (!validation.isValid || !body.title) {
            return NextResponse.json<ApiResponse>({ success: false, error: validation.error || 'Title is required and cannot be empty.' }, { status: 400 });
        }

        const newDeckData = await prisma.flashcard_decks.create({
            data: {
                user_id: user.id,
                title: body.title.trim(),
            },
        });

        const newDeck = {
            ...newDeckData,
            created_at: newDeckData.created_at?.toISOString() || '',
            updated_at: newDeckData.updated_at?.toISOString() || '',
        };

        return NextResponse.json<ApiResponse<FlashcardDeck>>({ 
            success: true,
            data: newDeck,
            message: 'Flashcard deck created successfully',
        }, { status: 201 });

    } catch (error: any) {
        if (error instanceof Response) return error; 
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             console.error('Prisma Error creating deck:', { code: error.code, meta: error.meta });
            return NextResponse.json<ApiResponse>({ success: false, error: 'Database error occurred while creating the deck.' }, { status: 500 });
        }
        console.error('Unexpected error creating deck:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to create deck';
        return NextResponse.json<ApiResponse>({
            success: false,
            error: errorMessage,
        }, { status: 500 });
    }
}