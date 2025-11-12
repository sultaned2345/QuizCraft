// src/app/api/projects/[projectId]/content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, Project, ProjectContentDetails } from '@/types/database';

export const runtime = 'nodejs';

// GET /api/projects/[projectId]/content
// Fetches all content items linked to a specific project
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { projectId } = params;

    // 1. Verify user owns the project and get its details
    const project = await prisma.projects.findFirst({
      where: { id: projectId, user_id: user.id },
    });

    if (!project) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Project not found or access denied.' }, { status: 404 });
    }

    // 2. Get all links for this project
    const links = await prisma.project_content_links.findMany({
      where: { project_id: projectId, user_id: user.id },
      orderBy: { created_at: 'asc' },
    });

    // 3. Group links by content type
    const contentIdsByType = links.reduce((acc, link) => {
      if (!acc[link.content_type]) {
        acc[link.content_type] = [];
      }
      acc[link.content_type].push(link.content_id);
      return acc;
    }, {} as Record<string, string[]>);

    // 4. Fetch details for each content type in parallel
    const promises = [];
    
    if (contentIdsByType.document) {
      promises.push(
        prisma.documents.findMany({
          where: { id: { in: contentIdsByType.document }, user_id: user.id },
          select: { id: true, file_name: true, ai_summary: true }
        }).then(items => items.map(item => ({ ...item, type: 'document', title: item.file_name, desc: item.ai_summary })))
      );
    }
    if (contentIdsByType.quiz) {
      promises.push(
        prisma.quiz.findMany({
          where: { id: { in: contentIdsByType.quiz }, userId: user.id },
          select: { id: true, title: true, _count: { select: { questions: true } } }
        }).then(items => items.map(item => ({ ...item, type: 'quiz', desc: `${item._count.questions} questions` })))
      );
    }
    if (contentIdsByType.note) {
      promises.push(
        prisma.notes.findMany({
          where: { id: { in: contentIdsByType.note }, user_id: user.id },
          select: { id: true, title: true, content: true } // Get content for a snippet
        }).then(items => items.map(item => ({ ...item, type: 'note', desc: item.content.replace(/<[^>]+>/g, ' ').substring(0, 100) + '...' })))
      );
    }
    if (contentIdsByType.deck) {
      promises.push(
        prisma.flashcard_decks.findMany({
          where: { id: { in: contentIdsByType.deck }, user_id: user.id },
          select: { id: true, title: true, _count: { select: { flashcards: true } } }
        }).then(items => items.map(item => ({ ...item, type: 'deck', desc: `${item._count.flashcards} cards` })))
      );
    }

    const allItemsArrays = await Promise.all(promises);
    const allItemsMap = new Map(allItemsArrays.flat().map(item => [item.id, item]));

    // 5. Combine links with details
    const responseData: ProjectContentDetails = {
      links: links.map(link => {
        const details = allItemsMap.get(link.content_id);
        return {
          id: link.id,
          content_id: link.content_id,
          content_type: link.content_type,
          created_at: link.created_at?.toISOString() || '',
          title: details?.title || 'Unknown Item',
          description: details?.desc || null,
          icon: link.content_type, // 'document', 'quiz', 'note', 'deck'
        };
      }),
    };

    return NextResponse.json<ApiResponse<ProjectContentDetails>>({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error(`Error fetching content for project ${params.projectId}:`, error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to fetch project content.' }, { status: 500 });
  }
}