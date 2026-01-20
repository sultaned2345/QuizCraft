import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, validateRequestBody } from '@/lib/auth';
import { ApiResponse, DeckWithCardsResponse, UpdateDeckData } from '@/types/database';
import { Prisma } from '@prisma/client';
import { USAGE_LIMITS } from '@/lib/usage-limits'; // Import limits for GET response

export const runtime = 'nodejs';

// --- GET Handler: Fetch a specific deck by ID (including cards) ---
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

        // Fetch the deck and its flashcards using Prisma
        const deck = await prisma.flashcard_decks.findUnique({
            where: {
                id: deckId,
                user_id: user.id, // Ensures the user owns the deck
            },
            include: {
                flashcards: { // Include related flashcards
                    orderBy: {
                        created_at: 'asc', // Order cards by creation time
                    },
                },
                 // Include profile to get subscription plan for limits
                profile: {
                    select: { subscription_plan: true }
                }
            },
        });

        if (!deck) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Deck not found or access denied.' }, { status: 404 });
        }

        // Determine card limits based on plan
        const plan = deck.profile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const cardLimit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_TOTAL_FLASHCARDS;
        // Note: We fetch all cards, the limit info is just for the frontend display

        // Prepare response data
        const responseData: DeckWithCardsResponse = {
            id: deck.id,
            user_id: deck.user_id,
            title: deck.title,
            created_at: deck.created_at?.toISOString() || '',
            updated_at: deck.updated_at?.toISOString() || '',
            // Fix: Map over flashcards to convert Date objects to strings
            flashcards: deck.flashcards.map(card => ({
                ...card,
                created_at: card.created_at ? card.created_at.toISOString() : '',
                updated_at: card.updated_at ? card.updated_at.toISOString() : '',
                review_at: card.review_at ? card.review_at.toISOString() : null,
            })),
            cardCount: deck.flashcards.length, // Count included cards
            cardLimit: cardLimit, // Add limit info to response
        };


        return NextResponse.json<ApiResponse<DeckWithCardsResponse>>({
            success: true,
            data: responseData,
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors
        console.error(`Error fetching deck ${params.deckId}:`, error);
        // Handle Prisma specific error for invalid UUID format
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Deck ID format.' }, { status: 400 });
        }
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch deck';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}

// --- PUT Handler: Update a deck's title ---
export async function PUT(
    request: NextRequest,
    { params }: { params: { deckId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { deckId } = params;

        if (!deckId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Deck ID is required.' }, { status: 400 });
        }

        // Parse and validate request body
        let body: UpdateDeckData;
        try {
            body = await request.json();
        } catch (parseError) {
            console.error('Failed to parse request body:', parseError);
            return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON in request body' }, { status: 400 });
        }

        const validation = validateRequestBody(body, ['title']); // Only title is updatable here
         if (!validation.isValid || !body.title) {
            console.error('Validation failed:', validation.error);
            return NextResponse.json<ApiResponse>({ success: false, error: validation.error || 'Title is required and cannot be empty.' }, { status: 400 });
        }

        // Update the deck using Prisma, including an ownership check in the where clause
        const updatedDeck = await prisma.flashcard_decks.update({
            where: {
                id: deckId,
                user_id: user.id, // Ensure user owns the deck they are trying to update
            },
            data: {
                title: body.title.trim(),
                // updated_at is handled automatically by Prisma @updatedAt
            },
        });
        // Note: `update` throws an error if the record is not found (P2025), covering the case
        // where the deck doesn't exist or the user doesn't own it.

        return NextResponse.json<ApiResponse<typeof updatedDeck>>({
            success: true,
            data: updatedDeck,
            message: 'Deck updated successfully.',
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors

        // Handle specific Prisma errors
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             if (error.code === 'P2025') { // Record to update not found
                return NextResponse.json<ApiResponse>({ success: false, error: 'Deck not found or access denied.' }, { status: 404 });
             }
             if (error.code === 'P2023') { // Invalid UUID
                 return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Deck ID format.' }, { status: 400 });
             }
             console.error('Prisma Error updating deck:', { code: error.code, meta: error.meta });
        } else {
            console.error(`Unexpected error updating deck ${params.deckId}:`, error);
        }

        const errorMessage = error instanceof Error ? error.message : 'Failed to update deck';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}

// --- DELETE Handler: Delete a deck ---
export async function DELETE(
    request: NextRequest,
    { params }: { params: { deckId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { deckId } = params;

        if (!deckId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Deck ID is required.' }, { status: 400 });
        }

        // Delete the deck using Prisma, ensuring ownership in the where clause
        await prisma.flashcard_decks.delete({
            where: {
                id: deckId,
                user_id: user.id, // Ensure user owns the deck
            },
        });
        // Prisma's `delete` throws an error (P2025) if the record is not found,
        // covering cases where the deck doesn't exist or isn't owned by the user.
        // Cascade delete defined in the schema handles deleting associated flashcards.

        return NextResponse.json<ApiResponse>({
            success: true,
            message: 'Deck deleted successfully.',
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors

        // Handle specific Prisma errors
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             if (error.code === 'P2025') { // Record to delete not found
                // If not found, arguably the desired state is achieved, could return success or 404
                return NextResponse.json<ApiResponse>({ success: false, error: 'Deck not found or access denied.' }, { status: 404 });
             }
              if (error.code === 'P2023') { // Invalid UUID
                 return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Deck ID format.' }, { status: 400 });
             }
             console.error('Prisma Error deleting deck:', { code: error.code, meta: error.meta });
        } else {
             console.error(`Unexpected error deleting deck ${params.deckId}:`, error);
        }

        const errorMessage = error instanceof Error ? error.message : 'Failed to delete deck';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}