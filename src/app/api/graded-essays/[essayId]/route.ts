// src/app/api/graded-essays/[essayId]/route.ts
// (This is the new, correct path for this file)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, GradedEssay } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

/**
 * @route GET /api/graded-essays/[essayId]
 * @description Fetches a single graded essay by ID, including full content and feedback.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { essayId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { essayId } = params;

    if (!essayId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Essay ID is required.' }, { status: 400 });
    }

    const essay = await prisma.graded_essays.findFirst({
      where: {
        id: essayId,
        user_id: user.id, // RLS/Policy check
      },
    });

    if (!essay) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Essay not found or access denied.' }, { status: 404 });
    }

    // Serialize data for client
    const responseData: GradedEssay = {
        ...essay,
        essay_title: essay.essay_title || null,
        rubric_or_criteria: essay.rubric_or_criteria || null,
        feedback: essay.feedback || null,
        score: essay.score || null,
        graded_at: essay.graded_at?.toISOString() || '',
    };

    return NextResponse.json<ApiResponse<GradedEssay>>({
      success: true,
      data: responseData,
    });

  } catch (error: any) {
    if (error instanceof Response) return error; // Handle requireAuth errors

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Essay ID format.' }, { status: 400 });
    }
    console.error(`[API /api/graded-essays/${params.essayId}] Error:`, error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch essay details.' },
      { status: 500 }
    );
  }
}