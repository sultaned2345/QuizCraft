// src/app/api/graded-essays/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, GradedEssay } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Ensure it's re-fetched

// Define the slimmed-down type for the list
type GradedEssayListItem = Pick<GradedEssay, 'id' | 'essay_title' | 'score' | 'graded_at'>;

/**
 * @route GET /api/graded-essays
 * @description Fetches a paginated list of the user's graded essays (metadata only).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Fetch the list, sorted by most recent
    const essays = await prisma.graded_essays.findMany({
      where: {
        user_id: user.id, // RLS/Policy check
      },
      select: {
        id: true,
        essay_title: true,
        score: true,
        graded_at: true,
      },
      orderBy: {
        graded_at: 'desc',
      },
      take: 20, // Limit to the 20 most recent
    });

    if (!essays) {
      return NextResponse.json<ApiResponse<GradedEssayListItem[]>>({
        success: true,
        data: [], // Return empty array if none found
      });
    }

    // Serialize data for client
    const responseData: GradedEssayListItem[] = essays.map(essay => ({
        id: essay.id,
        essay_title: essay.essay_title || 'Untitled Essay', // Provide fallback
        score: essay.score || null,
        graded_at: essay.graded_at?.toISOString() || '',
    }));

    return NextResponse.json<ApiResponse<GradedEssayListItem[]>>({
      success: true,
      data: responseData,
    });

  } catch (error: any) {
    if (error instanceof Response) return error; // Handle requireAuth errors

    console.error(`[API /api/graded-essays] Error:`, error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch essay history.' },
      { status: 500 }
    );
  }
}