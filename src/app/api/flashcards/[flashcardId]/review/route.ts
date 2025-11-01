// src/app/api/flashcards/[flashcardId]/review/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, Flashcard } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

type ReviewQuality = 'again' | 'good' | 'easy';

interface ReviewRequestBody {
  quality: ReviewQuality;
}

// Simple SM-2 based algorithm helper
function calculateNextReview(
  quality: ReviewQuality,
  oldEaseFactor: number,
  repetitions: number // We'll simplify and just use ease_factor
): { newEaseFactor: number; nextReviewDate: Date } {
    
    let newEaseFactor = oldEaseFactor;
    let nextIntervalDays = 1; // Default interval
    const now = new Date();

    if (quality === 'again') {
        newEaseFactor = Math.max(1.3, oldEaseFactor - 0.2);
        // Reset interval to 10 minutes from now
        const nextReviewDate = new Date(now.getTime() + 10 * 60 * 1000);
        return { newEaseFactor, nextReviewDate };
    }
    
    // For 'good' and 'easy'
    if (quality === 'good') {
        // No change to ease factor
        nextIntervalDays = Math.round(1 * oldEaseFactor); // 1 day * ease
    } else if (quality === 'easy') {
        newEaseFactor = oldEaseFactor + 0.15;
        nextIntervalDays = Math.round(4 * oldEaseFactor); // 4 days * ease
    }

    // Clamp ease factor
    newEaseFactor = Math.max(1.3, newEaseFactor);

    // Calculate next review date
    const nextReviewDate = new Date(now.getTime() + nextIntervalDays * 24 * 60 * 60 * 1000);

    return { newEaseFactor, nextReviewDate };
}


// --- POST Handler: Update a flashcard's review status ---
export async function POST(
    request: NextRequest,
    { params }: { params: { flashcardId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { flashcardId } = params;

        if (!flashcardId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Flashcard ID is required.' }, { status: 400 });
        }

        // 1. Verify Ownership & get current card data
        const card = await prisma.flashcards.findFirst({
            where: { 
                id: flashcardId,
                deck: {
                    user_id: user.id
                }
            }
        });

        if (!card) {
            console.warn(`User ${user.id} attempt to review flashcard ${flashcardId} denied.`);
            return NextResponse.json<ApiResponse>({ success: false, error: 'Flashcard not found or access denied.' }, { status: 404 });
        }

        // 2. Parse and validate request body
        let body: ReviewRequestBody;
        try { body = await request.json(); } 
        catch (e) { return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON body.' }, { status: 400 }); }

        const { quality } = body;
        if (!['again', 'good', 'easy'].includes(quality)) {
             return NextResponse.json<ApiResponse>({ success: false, error: "Invalid review quality. Must be 'again', 'good', or 'easy'." }, { status: 400 });
        }
        
        // 3. Calculate new review data
        const { newEaseFactor, nextReviewDate } = calculateNextReview(
            quality,
            card.ease_factor || 2.5
        );

        // 4. Update the flashcard
        const updatedFlashcard = await prisma.flashcards.update({
            where: {
                id: flashcardId
            },
            data: {
                review_at: nextReviewDate,
                ease_factor: newEaseFactor
            },
        });

        return NextResponse.json<ApiResponse<Flashcard>>({
            success: true,
            data: updatedFlashcard,
            message: 'Flashcard review status updated.',
        });

    } catch (error: any) {
        if (error instanceof Response) return error; 
        
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             if (error.code === 'P2025') { 
                return NextResponse.json<ApiResponse>({ success: false, error: 'Flashcard not found.' }, { status: 404 });
             }
         }
         console.error(`Unexpected error reviewing flashcard ${params.flashcardId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update flashcard review';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}