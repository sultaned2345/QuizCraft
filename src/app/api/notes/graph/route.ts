import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';

// FIX: Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type GraphNode = {
  id: string;
  label: string;
  group: string; 
  val: number; 
};

type GraphLink = {
  source: string;
  target: string;
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const notes = await prisma.notes.findMany({
      where: { user_id: user.id },
      select: {
        id: true,
        title: true,
        tags: true,
        linked_note_ids: true, 
      },
    });

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeIds = new Set(notes.map((n) => n.id));

    notes.forEach((note) => {
      nodes.push({
        id: note.id,
        label: note.title,
        group: note.tags.length > 0 ? note.tags[0] : 'untagged',
        val: 1,
      });

      note.linked_note_ids.forEach((targetId) => {
        if (nodeIds.has(targetId)) {
          links.push({
            source: note.id,
            target: targetId,
          });
        }
      });
    });

    return NextResponse.json<ApiResponse<GraphData>>({
      success: true,
      data: { nodes, links },
    });
  } catch (error: any) {
    console.error('[API /api/notes/graph] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch graph data' },
      { status: 500 }
    );
  }
}