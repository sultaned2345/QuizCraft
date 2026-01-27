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

    // Helper to safely execute queries without failing the whole request
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
            select: { 
              id: true, 
              file_name: true, 
              file_type: true, 
              created_at: true,
              // ✅ FIX 1: 'questions' does not exist on documents. Changed to 'quizzes'.
              _count: {
                select: { 
                  quizzes: true,   // was 'questions'
                  flashcard_decks: true // checks the 'flashcard_decks' relation
                }
              },
              // ✅ FIX 2: Relation is 'podcasts' (plural). We take 1 to simplify.
              podcasts: {
                take: 1,
                select: { id: true, audioUrl: true }
              }
            },
            orderBy: { created_at: 'desc' },
          }),
          (i) => ({ 
            ...i, 
            type: 'document', 
            title: i.file_name,
            // Map the array [podcasts] -> single object {podcast} for frontend convenience
            podcast: i.podcasts[0] || null,
            // Normalize counts for the UI (ui expects 'questions' key sometimes)
            _count: {
               questions: i._count.quizzes, // showing quiz count as proxy, or just use quizzes
               flashcards: i._count.flashcard_decks
            }
          })
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
            select: { 
              id: true, 
              title: true, 
              created_at: true, 
              tags: true,
              // ✅ FIX 3: Relation is 'podcasts' (plural) here too
              podcasts: {
                take: 1,
                select: { id: true, audioUrl: true }
              }
            },
            orderBy: { created_at: 'desc' },
          }),
          (i) => ({ 
            ...i, 
            type: 'note',
            // Map the array [podcasts] -> single object {podcast}
            podcast: i.podcasts[0] || null
          })
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
    if (error instanceof Response) {
      return error;
    }

    console.error('[API /library] Critical Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to load library content.' },
      { status: 500 }
    );
  }
}