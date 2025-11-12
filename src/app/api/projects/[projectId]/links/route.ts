// src/app/api/projects/[projectId]/links/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, ProjectContentLink } from '@/types/database';
import { ProjectContentDetails } from '@/types/database'; // Import the specific type for the response

export const runtime = 'nodejs';

type ContentItem = { id: string; title: string; desc: string | null; type: string };

// POST /api/projects/[projectId]/links
// Adds an existing content item to a project
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { projectId } = params;
    const { contentId, contentType } = (await request.json()) as {
      contentId: string;
      contentType: 'document' | 'quiz' | 'note' | 'deck';
    };

    if (!contentId || !contentType) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'contentId and contentType are required.' },
        { status: 400 }
      );
    }

    // 1. Verify user owns the project
    const project = await prisma.projects.findFirst({
      where: { id: projectId, user_id: user.id },
    });
    if (!project) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    // 2. Verify user owns the content item and get its details
    let contentItem: ContentItem | null = null;
    switch (contentType) {
      case 'document':
        const doc = await prisma.documents.findFirst({
          where: { id: contentId, user_id: user.id },
          select: { id: true, file_name: true, ai_summary: true },
        });
        if (doc)
          contentItem = { id: doc.id, title: doc.file_name, desc: doc.ai_summary, type: 'document' };
        break;
      case 'quiz':
        const quiz = await prisma.quiz.findFirst({
          where: { id: contentId, userId: user.id }, // Note: 'userId'
          select: { id: true, title: true, _count: { select: { questions: true } } },
        });
        if (quiz)
          contentItem = { id: quiz.id, title: quiz.title, desc: `${quiz._count.questions} questions`, type: 'quiz' };
        break;
      case 'note':
        const note = await prisma.notes.findFirst({
          where: { id: contentId, user_id: user.id },
          select: { id: true, title: true, content: true },
        });
        if (note)
          contentItem = { id: note.id, title: note.title, desc: note.content.replace(/<[^>]+>/g, ' ').substring(0, 100) + '...', type: 'note' };
        break;
      case 'deck':
        const deck = await prisma.flashcard_decks.findFirst({
          where: { id: contentId, user_id: user.id },
          select: { id: true, title: true, _count: { select: { flashcards: true } } },
        });
        if (deck)
          contentItem = { id: deck.id, title: deck.title, desc: `${deck._count.flashcards} cards`, type: 'deck' };
        break;
    }

    if (!contentItem) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Content item not found or access denied.' },
        { status: 404 }
      );
    }

    // 3. Create the link
    const newLink = await prisma.project_content_links.create({
      data: {
        user_id: user.id,
        project_id: projectId,
        content_id: contentId,
        content_type: contentType,
      },
    });

    // 4. Return the full item shape the client component expects
    const responseItem: ProjectContentDetails['links'][0] = {
      id: newLink.id,
      content_id: newLink.content_id,
      content_type: newLink.content_type,
      created_at: newLink.created_at?.toISOString() || '',
      title: contentItem.title,
      description: contentItem.desc,
      icon: contentItem.type,
    };

    return NextResponse.json<ApiResponse<typeof responseItem>>(
      { success: true, data: responseItem },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error(`[API /api/projects/links/POST] Error:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
       return NextResponse.json<ApiResponse>(
        { success: false, error: 'This item is already in the project.' },
        { status: 400 }
      );
    }
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to add item to project.' },
      { status: 500 }
    );
  }
}