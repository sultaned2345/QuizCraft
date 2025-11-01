// src/app/api/decks/[deckId]/study/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, DeckWithCardsResponse, Flashcard } from '@/types/database';
import { Prisma } from '@prisma/client';
import { USAGE_LIMITS } from '@/lib/usage-limits';

export const runtime = 'nodejs';

const STUDY_SESSION_LIMIT = 10; // Max 10 cards per study session

// --- GET Handler: Fetch a study session for a specific deck ---
export async function GET(
    request: NextRequest,
    { params }: { params: { deckId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { deckId } = params;

        if (!deckId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Deck ID is required.' }, { status: 400 });
        }

        // Fetch the deck owner and plan first
        const deck = await prisma.flashcard_decks.findUnique({
            where: {
                id: deckId,
                user_id: user.id, // Ensures the user owns the deck
            },
            include: {
                 profile: {
                    select: { subscription_plan: true }
                }
            },
        });

        if (!deck) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Deck not found or access denied.' }, { status: 404 });
        }
        
        // Now fetch cards due for review
        const dueCards = await prisma.flashcards.findMany({
            where: {
                deck_id: deckId,
                review_at: {
                    lte: new Date() // Fetch cards where review_at is in the past or now
                }
            },
            orderBy: {
                review_at: 'asc', // Show oldest due cards first
            },
            take: STUDY_SESSION_LIMIT
        });

        // Determine card limits based on plan
        const plan = deck.profile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const cardLimit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_TOTAL_FLASHCARDS;
        
        // Get total card count for the deck
        const totalCardCount = await prisma.flashcards.count({
            where: { deck_id: deckId }
        });

        // Prepare response data
        const responseData: DeckWithCardsResponse = {
            id: deck.id,
            user_id: deck.user_id,
            title: deck.title,
            created_at: deck.created_at?.toISOString() || '',
            updated_at: deck.updated_at?.toISOString() || '',
            flashcards: dueCards, // Only return the cards for this study session
            cardCount: totalCardCount, // Total cards in deck
            cardLimit: cardLimit,
        };

        return NextResponse.json<ApiResponse<DeckWithCardsResponse>>({
            success: true,
            data: responseData,
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors
        console.error(`Error fetching study session for deck ${params.deckId}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Deck ID format.' }, { status: 400 });
        }
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch deck';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}