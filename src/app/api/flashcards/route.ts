// src/app/api/flashcards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, CreateFlashcardData, Flashcard } from '@/types/database'; // Added CreateFlashcardData
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// --- POST Handler: Create a new flashcard ---
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        let body: CreateFlashcardData;
        try {
            body = await request.json();
        } catch (e) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON body' }, { status: 400 });
        }

        const { deck_id, front_content, back_content } = body;

        // Basic validation
        if (!deck_id || !front_content || !back_content) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Missing required fields: deck_id, front_content, back_content' }, { status: 400 });
        }

        // Verify deck ownership
        const deck = await prisma.flashcard_decks.findUnique({
            where: { id: deck_id },
            select: { user_id: true }
        });

        if (!deck || deck.user_id !== user.id) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Deck not found or access denied.' }, { status: 404 });
        }

        // Create the flashcard
        const newFlashcard = await prisma.flashcards.create({
            data: {
                deck_id,
                front_content: front_content.trim(),
                back_content: back_content.trim(),
            }
        });

        // FIX: Transform Dates to Strings
        const formattedFlashcard: Flashcard = {
            ...newFlashcard,
            created_at: newFlashcard.created_at?.toISOString() ?? new Date().toISOString(),
            updated_at: newFlashcard.updated_at?.toISOString() ?? new Date().toISOString(),
            review_at: newFlashcard.review_at?.toISOString() ?? null,
        };

        return NextResponse.json<ApiResponse<Flashcard>>({
            success: true,
            data: formattedFlashcard,
            message: 'Flashcard created successfully',
        }, { status: 201 });

    } catch (error: any) {
        if (error instanceof Response) return error;

        console.error('Error creating flashcard:', error);
        return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to create flashcard' }, { status: 500 });
    }
}