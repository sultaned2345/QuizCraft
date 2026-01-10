// src/app/api/documents/[documentId]/study-set/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const user = await requireAuth(req);
    
    // Fetch all assets linked to this document
    const [notes, quizzes, decks] = await Promise.all([
      prisma.notes.findFirst({ where: { document_id: params.documentId, user_id: user.id } }),
      prisma.quiz.findMany({ 
        where: { document_id: params.documentId, userId: user.id },
        include: { questions: true } // Include questions for rendering
      }),
      prisma.flashcard_decks.findFirst({ 
        where: { document_id: params.documentId, user_id: user.id },
        include: { flashcards: true } // Include cards for rendering
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        note: notes,
        quiz: quizzes[0] || null, // Just grab the first one for now
        deck: decks
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}