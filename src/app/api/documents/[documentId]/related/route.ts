// src/app/api/documents/[documentId]/related/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession';

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId } = params;

    if (!documentId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
    }

    // 1. Fetch related content safely using Promise.allSettled
    // We use allSettled so one failure doesn't crash the whole endpoint
    const results = await Promise.allSettled([
      // Fetch latest quiz
      prisma.quiz.findFirst({
        where: { document_id: documentId },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      }),
      // Fetch latest note (Schema model: 'notes')
      prisma.notes.findFirst({  
        where: { document_id: documentId }, 
        orderBy: { created_at: 'desc' }, 
        select: { id: true, content: true }
      }),
      // Fetch latest deck (Schema model: 'flashcard_decks')
      prisma.flashcard_decks.findFirst({ 
        where: { document_id: documentId },
        orderBy: { created_at: 'desc' },
        select: { id: true }
      })
    ]);

    // 2. Extract Data (Handling Success/Failure)
    // results[0] = Quiz, results[1] = Note, results[2] = Deck
    const quiz = results[0].status === 'fulfilled' ? results[0].value : null;
    const note = results[1].status === 'fulfilled' ? results[1].value : null;
    const deck = results[2].status === 'fulfilled' ? results[2].value : null;

    return NextResponse.json({
      quizId: quiz?.id || null,
      noteId: note?.id || null,
      noteContent: note?.content || '',
      deckId: deck?.id || null,
    });

  } catch (error) {
    console.error('Error fetching related content:', error);
    // Return empty 200 OK instead of 500 to keep the UI alive
    return NextResponse.json({
      quizId: null,
      noteId: null,
      noteContent: '',
      deckId: null
    });
  }
}