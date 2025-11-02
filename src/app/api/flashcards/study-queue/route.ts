// src/app/api/flashcards/study-queue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StudyQueueData {
  dueCount: number;
  firstDueDeckId: string | null;
}

/**
 * @route GET /api/flashcards/study-queue
 * @description Fetches the total count of due flashcards and the deck ID of the oldest due card.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Find the oldest due card to get its deck ID
    const oldestDueCard = await prisma.flashcards.findFirst({
      where: {
        review_at: {
          lte: new Date(), // Cards due in the past or right now
        },
        deck: {
          user_id: user.id, // Where the deck belongs to the user
        },
      },
      orderBy: {
        review_at: 'asc', // Find the oldest one
      },
      select: {
        deck_id: true,
      },
    });

    // Get the total count of all due cards
    const dueCount = await prisma.flashcards.count({
      where: {
        review_at: {
          lte: new Date(),
        },
        deck: {
          user_id: user.id,
        },
      },
    });

    const responseData: StudyQueueData = {
      dueCount,
      firstDueDeckId: oldestDueCard?.deck_id || null,
    };

    return NextResponse.json<ApiResponse<StudyQueueData>>({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    if (error instanceof Response) return error; // Handle requireAuth errors
    console.error('[API /flashcards/study-queue] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch study queue.' },
      { status: 500 }
    );
  }
}