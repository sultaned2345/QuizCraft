// src/app/api/flashcards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, validateRequestBody } from '@/lib/auth';
import { validateFlashcardCreation } from '@/lib/usage-limits'; 
import { ApiResponse, CreateFlashcardData, Flashcard } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// --- POST Handler: Create a new flashcard in a specific deck ---
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request); 

        // 1. Validate total flashcard usage limit
        const limitValidation = await validateFlashcardCreation(user.id);
        if (!limitValidation.isValid) {
            console.log(`Flashcard creation blocked for user ${user.id}: ${limitValidation.error}`);
            return NextResponse.json<ApiResponse>({
                success: false,
                error: limitValidation.error, 
                message: limitValidation.message
            }, { status: 403 }); 
        }

        // 2. Parse and validate request body
        let body: CreateFlashcardData;
        try {
            body = await request.json();
        } catch (parseError) {
            console.error('Failed to parse request body:', parseError);
            return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON in request body' }, { status: 400 });
        }

        // Validate required fields
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
                    user_id: user.id, 
                },
                select: {
                    id: true 
                }
            });

            if (!deckOwner) {
                console.warn(`User ${user.id} attempted to add flashcard to deck ${body.deck_id} they do not own or which does not exist.`);
                return NextResponse.json<ApiResponse>({ success: false, error: 'Target deck not found or access denied.' }, { status: 404 });
            }
        } catch (deckCheckError: any) {
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
                // --- FIX: Set review_at to NOW so it appears in study sessions immediately ---
                review_at: new Date(),
                // --- END FIX ---
            },
        });

        return NextResponse.json<ApiResponse<Flashcard>>({
            success: true,
            data: newFlashcard,
            message: 'Flashcard created successfully',
        }, { status: 201 }); 

    } catch (error: any) {
        if (error instanceof Response) {
            console.error('Authentication error caught in POST /api/flashcards:', error.status);
            return error;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2003') { 
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