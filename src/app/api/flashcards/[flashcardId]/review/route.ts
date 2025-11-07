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
  isCramming?: boolean; // --- 1. ADD isCramming flag ---
}

// (calculateNextReview helper function is unchanged)
function calculateNextReview(
  quality: ReviewQuality,
  oldEaseFactor: number,
  repetitions: number
): { newEaseFactor: number; nextReviewDate: Date } {
    
    let newEaseFactor = oldEaseFactor;
    let nextIntervalDays = 1;
    const now = new Date();

    if (quality === 'again') {
        newEaseFactor = Math.max(1.3, oldEaseFactor - 0.2);
        const nextReviewDate = new Date(now.getTime() + 10 * 60 * 1000);
        return { newEaseFactor, nextReviewDate };
    }
    
    if (quality === 'good') {
        nextIntervalDays = Math.round(1 * oldEaseFactor);
    } else if (quality === 'easy') {
        newEaseFactor = oldEaseFactor + 0.15;
        nextIntervalDays = Math.round(4 * oldEaseFactor);
    }

    newEaseFactor = Math.max(1.3, newEaseFactor);
    const nextReviewDate = new Date(now.getTime() + nextIntervalDays * 24 * 60 * 60 * 1000);

    return { newEaseFactor, nextReviewDate };
}


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

        let body: ReviewRequestBody;
        try { body = await request.json(); } 
        catch (e) { return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON body.' }, { status: 400 }); }

        // --- 2. DESTRUCTURE isCramming ---
        const { quality, isCramming } = body;
        if (!['again', 'good', 'easy'].includes(quality)) {
             return NextResponse.json<ApiResponse>({ success: false, error: "Invalid review quality. Must be 'again', 'good', or 'easy'." }, { status: 400 });
        }
        
        // --- 3. CHECK CRAM FLAG ---
        // If cramming, don't update stats. Just return success.
        if (isCramming) {
            return NextResponse.json<ApiResponse<Flashcard>>({
                success: true,
                data: card, // Return the original card data
                message: 'Flashcard review acknowledged (cram mode).',
            });
        }
        // --- (End of modification) ---
        
        const { newEaseFactor, nextReviewDate } = calculateNextReview(
            quality,
            card.ease_factor || 2.5,
            0 // Repetitions not used here
        );

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