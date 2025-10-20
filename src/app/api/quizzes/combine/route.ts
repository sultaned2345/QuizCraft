import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { quizIds, title } = await request.json();

    if (!Array.isArray(quizIds) || quizIds.length < 2) {
      return NextResponse.json({ success: false, error: 'Please select at least two quizzes to combine.' }, { status: 400 });
    }
    
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json({ success: false, error: 'A title for the combined quiz is required.' }, { status: 400 });
    }

    // Fetch all questions from the selected quizzes owned by the user
    const quizzesWithQuestions = await prisma.quiz.findMany({
      where: {
        id: { in: quizIds },
        userId: user.id, // Ensure user owns the quizzes
      },
      include: {
        questions: true,
      },
    });

    if (quizzesWithQuestions.length !== quizIds.length) {
        return NextResponse.json({ success: false, error: 'One or more selected quizzes could not be found or you do not have permission to access them.' }, { status: 404 });
    }

    const allQuestions = quizzesWithQuestions.flatMap(quiz => quiz.questions);
    
    // Create the new combined quiz
    const combinedQuiz = await prisma.quiz.create({
      data: {
        title: title.trim(),
        userId: user.id,
        is_public: false,
        immediate_feedback: true, // Default for combined quizzes
        questions: {
          create: allQuestions.map(q => ({
            question_text: q.question_text,
            question_type: q.question_type,
            correct_answer: q.correct_answer,
            options: q.options || undefined,
            prompts: q.prompts || undefined,
            explanation: q.explanation || undefined,
          })),
        },
      },
    });

    return NextResponse.json({ success: true, data: combinedQuiz });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('Error combining quizzes:', error);
    return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
  }
}