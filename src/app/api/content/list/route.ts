// src/app/api/content/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ListItem = { id: string; title: string };

// GET /api/content/list?type=...&excludeProject=...
// Fetches a list of content items of a specific type,
// excluding those already in the specified project.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as
      | 'document'
      | 'quiz'
      | 'note'
      | 'deck';
    const excludeProjectId = searchParams.get('excludeProject');

    if (!type) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Type parameter is required.' },
        { status: 400 }
      );
    }

    let existingContentIds: string[] = [];
    if (excludeProjectId) {
      // Find all content IDs already linked to this project
      const links = await prisma.project_content_links.findMany({
        where: {
          project_id: excludeProjectId,
          user_id: user.id,
          content_type: type, // Only need to exclude IDs of the same type
        },
        select: {
          content_id: true,
        },
      });
      existingContentIds = links.map((link) => link.content_id);
    }

    let results: ListItem[] = [];

    switch (type) {
      case 'document':
        const docs = await prisma.documents.findMany({
          where: {
            user_id: user.id,
            id: { notIn: existingContentIds },
          },
          select: { id: true, file_name: true },
          orderBy: { created_at: 'desc' },
        });
        results = docs.map((d) => ({ id: d.id, title: d.file_name }));
        break;
      case 'quiz':
        const quizzes = await prisma.quiz.findMany({
          where: {
            userId: user.id, // Note: 'userId'
            id: { notIn: existingContentIds },
          },
          select: { id: true, title: true },
          orderBy: { createdAt: 'desc' },
        });
        results = quizzes;
        break;
      case 'note':
        const notes = await prisma.notes.findMany({
          where: {
            user_id: user.id,
            id: { notIn: existingContentIds },
          },
          select: { id: true, title: true },
          orderBy: { created_at: 'desc' },
        });
        results = notes;
        break;
      case 'deck':
        const decks = await prisma.flashcard_decks.findMany({
          where: {
            user_id: user.id,
            id: { notIn: existingContentIds },
          },
          select: { id: true, title: true },
          orderBy: { created_at: 'desc' },
        });
        results = decks;
        break;
      default:
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Invalid content type.' },
          { status: 400 }
        );
    }

    return NextResponse.json<ApiResponse<ListItem[]>>({
      success: true,
      data: results,
    });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error(`[API /api/content/list] Error:`, error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch content list.' },
      { status: 500 }
    );
  }
}