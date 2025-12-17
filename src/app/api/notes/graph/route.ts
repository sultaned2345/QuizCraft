import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';

type GraphNode = {
  id: string;
  label: string;
  group: string; // 'note' or tag
  val: number; // For node size
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

    // 1. Fetch ALL notes for the user in a single optimized query
    // We only need id, title, and the adjacency list (linked_note_ids)
    const notes = await prisma.notes.findMany({
      where: { user_id: user.id },
      select: {
        id: true,
        title: true,
        tags: true,
        linked_note_ids: true, // These are outgoing links
      },
    });

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeIds = new Set(notes.map((n) => n.id));

    // 2. Transform into Graph format (Nodes & Edges)
    notes.forEach((note) => {
      // Add Node
      nodes.push({
        id: note.id,
        label: note.title,
        group: note.tags.length > 0 ? note.tags[0] : 'untagged',
        val: 1,
      });

      // Add Edges (Links)
      // linked_note_ids stores outgoing links. 
      // We check if the target exists to prevent broken edges.
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