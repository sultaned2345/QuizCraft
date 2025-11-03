// src/app/api/notes/[noteId]/backlinks/route.ts
// NEW FILE
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';

type Backlink = {
  id: string;
  title: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: { noteId: string } },
) {
  try {
    const user = await requireAuth(request);
    const { noteId } = params;

    if (!noteId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Note ID is required.' }, { status: 400 });
    }

    // Find notes where the linked_note_ids array contains the current noteId
    const backlinks = await prisma.notes.findMany({
      where: {
        user_id: user.id,
        linked_note_ids: {
          has: noteId,
        },
      },
      select: {
        id: true,
        title: true,
      },
      take: 10, // Limit to 10 backlinks
    });

    return NextResponse.json<ApiResponse<Backlink[]>>({
      success: true,
      data: backlinks,
    });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error(`[API /api/notes/backlinks] Error:`, error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch backlinks.' },
      { status: 500 },
    );
  }
}