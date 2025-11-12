// src/app/api/projects/links/[linkId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';

// DELETE /api/projects/links/[linkId]
// Removes an item from a project (does not delete the item itself)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { linkId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { linkId } = params;

    // Use deleteMany to ensure user ownership
    const deleteResult = await prisma.project_content_links.deleteMany({
      where: {
        id: linkId,
        user_id: user.id, // User must own the link to delete it
      },
    });

    if (deleteResult.count === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Link not found or access denied.' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Item removed from project.',
    });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error(`[API /api/projects/links/DELETE] Error:`, error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to remove item.' },
      { status: 500 }
    );
  }
}