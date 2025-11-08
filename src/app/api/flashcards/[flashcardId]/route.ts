import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, validateRequestBody } from '@/lib/auth';
import { ApiResponse, UpdateFlashcardData, Flashcard } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// --- Helper function (Still needed for PUT) ---
async function verifyFlashcardOwnership(flashcardId: string, userId: string): Promise<boolean> {
    try {
        const flashcard = await prisma.flashcards.findUnique({
            where: { id: flashcardId },
            select: {
                deck: { // Select the related deck
                    select: {
                        user_id: true // Select the owner's ID from the deck
                    }
                }
            }
        });

        // Return true if flashcard exists and its deck's user_id matches the provided userId
        return !!flashcard && flashcard.deck?.user_id === userId;

    } catch (error) {
        // Handle errors like invalid flashcardId format
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
            console.warn(`Invalid UUID format for flashcardId: ${flashcardId}`);
            return false; // Invalid ID cannot be owned
        }
        console.error(`Error verifying ownership for flashcard ${flashcardId}:`, error);
        return false; // Assume not owned if there's an error
    }
}


// --- PUT Handler: Update a flashcard (Unchanged) ---
export async function PUT(
    request: NextRequest,
    { params }: { params: { flashcardId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { flashcardId } = params;

        if (!flashcardId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Flashcard ID is required.' }, { status: 400 });
        }

        // 1. Verify Ownership before proceeding
        const isOwner = await verifyFlashcardOwnership(flashcardId, user.id);
        if (!isOwner) {
            console.warn(`User ${user.id} attempt to update flashcard ${flashcardId} denied.`);
            return NextResponse.json<ApiResponse>({ success: false, error: 'Flashcard not found or access denied.' }, { status: 404 });
        }

        // 2. Parse and validate request body
        let body: UpdateFlashcardData;
        try {
            body = await request.json();
        } catch (parseError) {
            console.error('Failed to parse request body:', parseError);
            return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON in request body' }, { status: 400 });
        }

        const { front_content, back_content } = body;

        // Ensure at least one field is provided and non-empty if provided
        if (front_content === undefined && back_content === undefined) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Either front_content or back_content is required for update.' }, { status: 400 });
        }
        if (front_content !== undefined && front_content.trim().length === 0) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'front_content cannot be empty.' }, { status: 400 });
        }
        if (back_content !== undefined && back_content.trim().length === 0) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'back_content cannot be empty.' }, { status: 400 });
        }

        // 3. Prepare updates, trimming content
        const updates: Partial<Pick<Flashcard, 'front_content' | 'back_content'>> = {};
        if (front_content !== undefined) updates.front_content = front_content.trim();
        if (back_content !== undefined) updates.back_content = back_content.trim();

        // 4. Update the flashcard using Prisma
        const updatedFlashcard = await prisma.flashcards.update({
            where: {
                id: flashcardId
                // Ownership already verified, no need to include user_id here
            },
            data: updates,
        });

        return NextResponse.json<ApiResponse<Flashcard>>({
            success: true,
            data: updatedFlashcard,
            message: 'Flashcard updated successfully.',
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors

        // Handle specific Prisma errors
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             if (error.code === 'P2025') { // Record to update not found (should be caught by verifyOwnership)
                return NextResponse.json<ApiResponse>({ success: false, error: 'Flashcard not found.' }, { status: 404 });
             }
              if (error.code === 'P2023') { // Invalid UUID format (should be caught by verifyOwnership)
                 return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Flashcard ID format.' }, { status: 400 });
             }
             console.error('Prisma Error updating flashcard:', { code: error.code, meta: error.meta });
        } else {
            console.error(`Unexpected error updating flashcard ${params.flashcardId}:`, error);
        }

        const errorMessage = error instanceof Error ? error.message : 'Failed to update flashcard';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}

// --- DELETE Handler: Delete a flashcard (Refactored) ---
export async function DELETE(
    request: NextRequest,
    { params }: { params: { flashcardId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { flashcardId } = params;

        if (!flashcardId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Flashcard ID is required.' }, { status: 400 });
        }

        // 1. Delete the flashcard using deleteMany with a nested ownership check
        const deleteResult = await prisma.flashcards.deleteMany({
            where: {
                id: flashcardId,
                deck: {
                    user_id: user.id // Ensures user owns the deck this card is in
                }
            },
        });

        // 2. Check if any card was actually deleted
        if (deleteResult.count === 0) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Flashcard not found or access denied.' }, { status: 404 });
        }

        return NextResponse.json<ApiResponse>({
            success: true,
            message: 'Flashcard deleted successfully.',
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors

        // Handle specific Prisma errors
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             if (error.code === 'P2023') { // Invalid UUID
                 return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Flashcard ID format.' }, { status: 400 });
             }
             console.error('Prisma Error deleting flashcard:', { code: error.code, meta: error.meta });
        } else {
             console.error(`Unexpected error deleting flashcard ${params.flashcardId}:`, error);
        }

        const errorMessage = error instanceof Error ? error.message : 'Failed to delete flashcard';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}