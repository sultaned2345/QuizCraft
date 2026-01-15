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
        where: { documentId: documentId },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      }),
      // Fetch latest note
      prisma.notes.findFirst({  // Changed from 'note' to 'notes' (check your schema map name)
        where: { document_id: documentId }, // Changed from 'documentId' to 'document_id' to match typical Prisma naming
        orderBy: { created_at: 'desc' }, // Changed to snake_case if your DB uses it
        select: { id: true, content: true }
      }),
      // Fetch latest flashcard deck
      prisma.flashcard_decks.findFirst({ // Changed to 'flashcard_decks'
        where: { document_id: documentId },
        orderBy: { created_at: 'desc' },
        select: { id: true }
      })
    ]);

    // 2. Extract Data (Handling Success/Failure)
    const quiz = results[0].status === 'fulfilled' ? results[0].value : null;
    // NOTE: I am guessing your schema names based on your previous logs (flashcard_decks vs FlashcardDeck). 
    // Please verify if your schema uses `notes` or `Note`, and `document_id` or `documentId`.
    // I will use snake_case for fields based on your previous logs.
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
    // Return 200 with nulls instead of 500 to prevent page crash
    return NextResponse.json({
      quizId: null,
      noteId: null,
      noteContent: '',
      deckId: null
    });
  }
}