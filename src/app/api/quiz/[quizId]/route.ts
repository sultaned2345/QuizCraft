import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { quizId } = params;
    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Title is required and cannot be empty.' }, { status: 400 });
    }

    // First, find the quiz to ensure it belongs to the user
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: 'Quiz not found.' }, { status: 404 });
    }

    if (quiz.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'You do not have permission to edit this quiz.' }, { status: 403 });
    }

    // If ownership is confirmed, update the quiz
    const updatedQuiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        title: title.trim(),
      },
    });

    return NextResponse.json({ success: true, data: updatedQuiz });

  } catch (error) {
    if (error instanceof Response) {
      // This handles the case where requireAuth throws a 401 response
      return error;
    }
    console.error('Error updating quiz:', error);
    return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
  }
}