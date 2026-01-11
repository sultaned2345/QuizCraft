// src/app/api/library/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.toLowerCase() || '';
    const typeFilter = searchParams.get('type'); // 'document', 'quiz', 'note', 'deck' or undefined

    // Prepare filter conditions
    const filter = (field: string) => ({
      user_id: user.id,
      ...(query && { [field]: { contains: query, mode: 'insensitive' } }),
    });

    // Run parallel queries based on type filter
    // If typeFilter is 'quiz', only fetch quizzes, etc.
    const promises = [];

    if (!typeFilter || typeFilter === 'document') {
      promises.push(
        prisma.documents.findMany({
          where: filter('file_name'),
          select: { id: true, file_name: true, file_type: true, created_at: true },
          orderBy: { created_at: 'desc' },
        }).then(res => res.map(i => ({ ...i, type: 'document', title: i.file_name })))
      );
    } else { promises.push(Promise.resolve([])); }

    if (!typeFilter || typeFilter === 'quiz') {
      promises.push(
        prisma.quiz.findMany({
          where: { userId: user.id, ...(query && { title: { contains: query, mode: 'insensitive' } }) }, // Note: userId (camelCase) vs user_id depending on schema
          select: { id: true, title: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }).then(res => res.map(i => ({ ...i, type: 'quiz', created_at: i.createdAt })))
      );
    } else { promises.push(Promise.resolve([])); }

    if (!typeFilter || typeFilter === 'note') {
      promises.push(
        prisma.notes.findMany({
          where: filter('title'),
          select: { id: true, title: true, created_at: true, tags: true },
          orderBy: { created_at: 'desc' },
        }).then(res => res.map(i => ({ ...i, type: 'note' })))
      );
    } else { promises.push(Promise.resolve([])); }

    if (!typeFilter || typeFilter === 'deck') {
       promises.push(
        prisma.flashcard_decks.findMany({
          where: filter('title'),
          select: { id: true, title: true, created_at: true },
          orderBy: { created_at: 'desc' },
        }).then(res => res.map(i => ({ ...i, type: 'deck' })))
      );
    } else { promises.push(Promise.resolve([])); }

    // Execute all necessary queries
    const results = await Promise.all(promises);
    
    // Flatten and Sort combined results by date
    const combinedContent = results.flat().sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: combinedContent
    });

  } catch (error: any) {
    console.error('[API /library] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to load library content.' },
      { status: 500 }
    );
  }
}