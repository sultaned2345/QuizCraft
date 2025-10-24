import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, validateRequestBody } from '@/lib/auth';
import { validateFlashcardCreation } from '@/lib/usage-limits'; // Import validation for total card limit
import { ApiResponse, CreateFlashcardData, Flashcard } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// --- POST Handler: Create a new flashcard in a specific deck ---
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request); // Ensure user is authenticated

        // 1. Validate total flashcard usage limit
        const limitValidation = await validateFlashcardCreation(user.id);
        if (!limitValidation.isValid) {
            console.log(`Flashcard creation blocked for user ${user.id}: ${limitValidation.error}`);
            return NextResponse.json<ApiResponse>({
                success: false,
                error: limitValidation.error,
                message: limitValidation.message
            }, { status: 403 }); // Forbidden
        }

        // 2. Parse and validate request body
        let body: CreateFlashcardData;
        try {
            body = await request.json();
        } catch (parseError) {
            console.error('Failed to parse request body:', parseError);
            return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON in request body' }, { status: 400 });
        }

        // Validate required fields: deck_id, front_content, back_content
        const validation = validateRequestBody(body, ['deck_id', 'front_content', 'back_content']);
        if (!validation.isValid || !body.deck_id || !body.front_content || !body.back_content) {
            console.error('Validation failed:', validation.error);
            const errorMsg = validation.error || 'Missing required fields: deck_id, front_content, back_content.';
            return NextResponse.json<ApiResponse>({ success: false, error: errorMsg }, { status: 400 });
        }

        // 3. Verify user ownership of the target deck BEFORE inserting
        try {
            const deckOwner = await prisma.flashcard_decks.findUnique({
                where: {
                    id: body.deck_id,
                    user_id: user.id, // Check ownership directly
                },
                select: {
                    id: true // Just need to know if it exists and belongs to the user
                }
            });

            if (!deckOwner) {
                // If the deck doesn't exist or doesn't belong to the user, deny creation
                 console.warn(`User ${user.id} attempted to add flashcard to deck ${body.deck_id} they do not own or which does not exist.`);
                return NextResponse.json<ApiResponse>({ success: false, error: 'Target deck not found or access denied.' }, { status: 404 });
            }
        } catch (deckCheckError: any) {
             // Handle potential errors during the deck check (e.g., invalid deckId format)
             if (deckCheckError instanceof Prisma.PrismaClientKnownRequestError && deckCheckError.code === 'P2023') {
                 return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Deck ID format provided.' }, { status: 400 });
             }
             console.error(`Error checking deck ownership for deck ${body.deck_id}:`, deckCheckError);
             return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to verify deck ownership.' }, { status: 500 });
        }


        // 4. Create the new flashcard using Prisma
        const newFlashcard = await prisma.flashcards.create({
            data: {
                deck_id: body.deck_id,
                front_content: body.front_content.trim(),
                back_content: body.back_content.trim(),
                // created_at and updated_at handled by Prisma/database
            },
        });

        return NextResponse.json<ApiResponse<Flashcard>>({
            success: true,
            data: newFlashcard,
            message: 'Flashcard created successfully',
        }, { status: 201 }); // 201 Created status

    } catch (error: any) {
        // Handle errors from requireAuth, validation, Prisma, etc.
        if (error instanceof Response) {
            console.error('Authentication error caught in POST /api/flashcards:', error.status);
            return error;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             // Example: Handle foreign key constraint violation if deck_id somehow becomes invalid after check
            if (error.code === 'P2003') { // Foreign key constraint failed
                console.error('Prisma Error creating flashcard (FK violation):', { code: error.code, meta: error.meta });
                return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid target deck specified.' }, { status: 400 });
            }
            console.error('Prisma Error creating flashcard:', { code: error.code, meta: error.meta });
             return NextResponse.json<ApiResponse>({ success: false, error: 'Database error occurred while creating the flashcard.' }, { status: 500 });
        }
        console.error('Unexpected error creating flashcard:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to create flashcard';
        return NextResponse.json<ApiResponse>({
            success: false,
            error: errorMessage,
        }, { status: 500 });
    }
}

// Note: A GET handler here could list ALL flashcards for a user across all decks,
// but it might be less performant/useful than getting cards per deck.
// We are skipping GET /api/flashcards for now.