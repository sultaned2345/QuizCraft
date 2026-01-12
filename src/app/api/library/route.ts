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
    const typeFilter = searchParams.get('type'); 

    const safeQuery = async <T>(name: string, promise: Promise<T[]>, mapper: (item: T) => any) => {
      try {
        const results = await promise;
        return results.map(mapper);
      } catch (error) {
        console.error(`[API /library] Error fetching ${name}:`, error);
        return []; 
      }
    };

    const tasks = [];

    // 1. Fetch Documents
    if (!typeFilter || typeFilter === 'document') {
      tasks.push(
        safeQuery('documents', 
          prisma.documents.findMany({
            where: {
              user_id: user.id,
              ...(query && { file_name: { contains: query, mode: 'insensitive' } }),
            },
            select: { id: true, file_name: true, file_type: true, created_at: true },
            orderBy: { created_at: 'desc' },
          }),
          (i) => ({ ...i, type: 'document', title: i.file_name })
        )
      );
    }

    // 2. Fetch Quizzes
    if (!typeFilter || typeFilter === 'quiz') {
      const quizDelegate = prisma.quiz || (prisma as any).Quiz;
      if (quizDelegate) {
        tasks.push(
          safeQuery('quizzes',
            quizDelegate.findMany({
              where: {
                userId: user.id,
                ...(query && { title: { contains: query, mode: 'insensitive' } }),
              },
              select: { id: true, title: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            }),
            (i: any) => ({ ...i, type: 'quiz', created_at: i.createdAt })
          )
        );
      }
    }

    // 3. Fetch Notes
    if (!typeFilter || typeFilter === 'note') {
      tasks.push(
        safeQuery('notes',
          prisma.notes.findMany({
            where: {
              user_id: user.id,
              ...(query && { title: { contains: query, mode: 'insensitive' } }),
            },
            select: { id: true, title: true, created_at: true, tags: true },
            orderBy: { created_at: 'desc' },
          }),
          (i) => ({ ...i, type: 'note' })
        )
      );
    }

    // 4. Fetch Decks
    if (!typeFilter || typeFilter === 'deck') {
      tasks.push(
        safeQuery('decks',
          prisma.flashcard_decks.findMany({
            where: {
              user_id: user.id,
              ...(query && { title: { contains: query, mode: 'insensitive' } }),
            },
            select: { id: true, title: true, created_at: true },
            orderBy: { created_at: 'desc' },
          }),
          (i) => ({ ...i, type: 'deck' })
        )
      );
    }

    const results = await Promise.all(tasks);
    
    const combinedContent = results.flat().sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: combinedContent
    });

  } catch (error: any) {
    // FIX: Check if the error is actually a Response object (thrown by requireAuth)
    if (error instanceof Response) {
      return error;
    }

    // Only log actual critical errors
    console.error('[API /library] Critical Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to load library content.' },
      { status: 500 }
    );
  }
}