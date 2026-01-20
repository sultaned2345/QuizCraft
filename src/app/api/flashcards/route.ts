// src/app/api/flashcards/[flashcardId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, UpdateFlashcardData, Flashcard } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// --- Helper function ---
async function verifyFlashcardOwnership(flashcardId: string, userId: string): Promise<boolean> {
    try {
        const flashcard = await prisma.flashcards.findUnique({
            where: { id: flashcardId },
            select: {
                deck: {
                    select: {
                        user_id: true
                    }
                }
            }
        });
        return !!flashcard && flashcard.deck?.user_id === userId;
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
            console.warn(`Invalid UUID format for flashcardId: ${flashcardId}`);
            return false;
        }
        console.error(`Error verifying ownership for flashcard ${flashcardId}:`, error);
        return false;
    }
}

// --- PUT Handler ---
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

        // 1. Verify Ownership
        const isOwner = await verifyFlashcardOwnership(flashcardId, user.id);
        if (!isOwner) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Flashcard not found or access denied.' }, { status: 404 });
        }

        // 2. Parse body
        let body: UpdateFlashcardData;
        try {
            body = await request.json();
        } catch (parseError) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON in request body' }, { status: 400 });
        }

        const { front_content, back_content } = body;

        // Validation
        if (front_content === undefined && back_content === undefined) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Either front_content or back_content is required for update.' }, { status: 400 });
        }
        if (front_content !== undefined && front_content.trim().length === 0) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'front_content cannot be empty.' }, { status: 400 });
        }
        if (back_content !== undefined && back_content.trim().length === 0) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'back_content cannot be empty.' }, { status: 400 });
        }

        const updates: Partial<Pick<Flashcard, 'front_content' | 'back_content'>> = {};
        if (front_content !== undefined) updates.front_content = front_content.trim();
        if (back_content !== undefined) updates.back_content = back_content.trim();

        // 3. Update in DB
        const result = await prisma.flashcards.update({
            where: { id: flashcardId },
            data: updates,
        });

        // 4. Convert Prisma Dates to Strings for API response
        const formattedFlashcard: Flashcard = {
            ...result,
            created_at: result.created_at ? result.created_at.toISOString() : new Date().toISOString(),
            updated_at: result.updated_at ? result.updated_at.toISOString() : new Date().toISOString(),
            review_at: result.review_at ? result.review_at.toISOString() : null,
        };

        return NextResponse.json<ApiResponse<Flashcard>>({
            success: true,
            data: formattedFlashcard,
            message: 'Flashcard updated successfully.',
        });

    } catch (error: any) {
        if (error instanceof Response) return error;

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             if (error.code === 'P2025') {
                return NextResponse.json<ApiResponse>({ success: false, error: 'Flashcard not found.' }, { status: 404 });
             }
             if (error.code === 'P2023') {
                 return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Flashcard ID format.' }, { status: 400 });
             }
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Failed to update flashcard';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}

// --- DELETE Handler ---
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

        const deleteResult = await prisma.flashcards.deleteMany({
            where: {
                id: flashcardId,
                deck: {
                    user_id: user.id
                }
            },
        });

        if (deleteResult.count === 0) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Flashcard not found or access denied.' }, { status: 404 });
        }

        return NextResponse.json<ApiResponse>({
            success: true,
            message: 'Flashcard deleted successfully.',
        });

    } catch (error: any) {
        if (error instanceof Response) return error;

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Flashcard ID format.' }, { status: 400 });
        }

        const errorMessage = error instanceof Error ? error.message : 'Failed to delete flashcard';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}