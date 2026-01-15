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

    // 1. Fetch all related content in parallel
    const [quiz, note, deck] = await Promise.all([
      // Fetch latest quiz for this document
      prisma.quiz.findFirst({
        where: { documentId: documentId },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      }),
      // Fetch latest note
      prisma.note.findFirst({
        where: { documentId: documentId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, content: true }
      }),
      // Fetch latest flashcard deck
      prisma.flashcardDeck.findFirst({
        where: { documentId: documentId },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      })
    ]);

    // 2. Return the IDs found
    return NextResponse.json({
      quizId: quiz?.id || null,
      noteId: note?.id || null,
      noteContent: note?.content || '',
      deckId: deck?.id || null,
    });

  } catch (error) {
    console.error('Error fetching related content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch related content' }, 
      { status: 500 }
    );
  }
}