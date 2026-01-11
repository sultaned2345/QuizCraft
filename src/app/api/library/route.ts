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
    const typeFilter = searchParams.get('type'); // 'document', 'quiz', 'note', 'deck'

    // Common filter for user ownership and search
    // Note: We construct specific filters for each query because fields differ (file_name vs title)
    
    // Helper to safely execute queries without crashing the whole request
    const safeQuery = async <T>(name: string, promise: Promise<T[]>, mapper: (item: T) => any) => {
      try {
        const results = await promise;
        return results.map(mapper);
      } catch (error) {
        console.error(`[API /library] Error fetching ${name}:`, error);
        return []; // Return empty array on failure instead of crashing
      }
    };

    const tasks = [];

    // 1. Fetch Documents (field: file_name)
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

    // 2. Fetch Quizzes (Model: Quiz, field: title, userId camelCase)
    if (!typeFilter || typeFilter === 'quiz') {
      // Check if prisma.quiz exists (handle case sensitivity issues)
      const quizDelegate = prisma.quiz || (prisma as any).Quiz;
      
      if (quizDelegate) {
        tasks.push(
          safeQuery('quizzes',
            quizDelegate.findMany({
              where: {
                userId: user.id, // Schema uses @map("user_id") but client uses userId
                ...(query && { title: { contains: query, mode: 'insensitive' } }),
              },
              select: { id: true, title: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            }),
            (i: any) => ({ ...i, type: 'quiz', created_at: i.createdAt })
          )
        );
      } else {
        console.error('[API /library] Prisma Quiz model not found on client');
      }
    }

    // 3. Fetch Notes (field: title)
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

    // 4. Fetch Flashcard Decks (field: title)
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

    // Execute all safe queries
    const results = await Promise.all(tasks);
    
    // Flatten and Sort
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
    console.error('[API /library] Critical Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to load library content.' },
      { status: 500 }
    );
  }
}