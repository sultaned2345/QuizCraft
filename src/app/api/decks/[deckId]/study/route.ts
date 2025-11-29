// src/app/api/decks/[deckId]/study/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, DeckWithCardsResponse } from '@/types/database';
import { Prisma } from '@prisma/client';
import { USAGE_LIMITS } from '@/lib/usage-limits';

export const runtime = 'nodejs';

const STUDY_SESSION_LIMIT = 20;

export async function GET(
    request: NextRequest,
    { params }: { params: { deckId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { deckId } = params;
        const url = new URL(request.url);
        const mode = url.searchParams.get('mode') || 'due'; // 'due', 'new', 'cram'

        if (!deckId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Deck ID is required.' }, { status: 400 });
        }

        const deck = await prisma.flashcard_decks.findUnique({
            where: {
                id: deckId,
                user_id: user.id,
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
        
        // --- LOGIC UPDATE ---
        let whereClause: Prisma.flashcardsWhereInput = { deck_id: deckId };
        let orderByClause: Prisma.flashcardsOrderByWithRelationInput | Prisma.flashcardsOrderByWithRelationInput[] = {};
        let takeClause: number | undefined = undefined;
        const now = new Date();

        if (mode === 'due') {
            whereClause.review_at = { lte: now };
            orderByClause = { review_at: 'asc' };
            takeClause = STUDY_SESSION_LIMIT;
        } else if (mode === 'new') {
            whereClause.review_at = { lte: now };
            whereClause.ease_factor = 2.5;
            orderByClause = { created_at: 'asc' };
            takeClause = STUDY_SESSION_LIMIT;
        } else if (mode === 'cram' || mode === 'all') {
            // Return ALL cards, ignoring due dates
            whereClause = { deck_id: deckId };
            orderByClause = { created_at: 'asc' }; // Frontend will shuffle
            takeClause = undefined; // No limit for cramming
        }
        
        const cards = await prisma.flashcards.findMany({
            where: whereClause,
            orderBy: orderByClause,
            take: takeClause
        });

        const plan = deck.profile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const cardLimit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_TOTAL_FLASHCARDS;
        
        // Count TOTAL cards (ignoring the 'due' filter)
        const totalCardCount = await prisma.flashcards.count({
            where: { deck_id: deckId }
        });

        const responseData: DeckWithCardsResponse = {
            id: deck.id,
            user_id: deck.user_id,
            title: deck.title,
            created_at: deck.created_at?.toISOString() || '',
            updated_at: deck.updated_at?.toISOString() || '',
            flashcards: cards,
            cardCount: totalCardCount, // This tells frontend if deck is truly empty
            cardLimit: cardLimit,
        };

        return NextResponse.json<ApiResponse<DeckWithCardsResponse>>({
            success: true,
            data: responseData,
        });

    } catch (error: any) {
        if (error instanceof Response) return error; 
        console.error(`Error fetching study session for deck ${params.deckId}:`, error);
        return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to load cards' }, { status: 500 });
    }
}