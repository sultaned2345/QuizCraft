// src/app/api/dashboard/study-queue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * @route GET /api/dashboard/study-queue
 * @description Fetches the total count of flashcards due for review for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const dueCount = await prisma.flashcards.count({
      where: {
        review_at: {
          lte: new Date(), // Cards due in the past or right now
        },
        deck: {
          user_id: user.id, // Where the deck belongs to the user
        },
      },
    });

    return NextResponse.json<ApiResponse<{ dueCount: number }>>({
      success: true,
      data: { dueCount },
    });
  } catch (error: any) {
    if (error instanceof Response) return error; // Handle requireAuth errors
    console.error('[API /dashboard/study-queue] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch study queue.' },
      { status: 500 }
    );
  }
}