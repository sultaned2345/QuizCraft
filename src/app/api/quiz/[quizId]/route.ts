// src/app/api/quiz/[quizId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Question, Quiz, ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

export async function PUT(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { quizId } = params;
    
    // Expect a body with title and an array of questions
    const body = await request.json();
    const { title, questions } = body as { title: string; questions: Question[] };

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Title is required.' }, { status: 400 });
    }
    if (!Array.isArray(questions)) {
       return NextResponse.json({ success: false, error: 'Questions must be an array.' }, { status: 400 });
    }

    // --- Verify Ownership ---
    // Use findFirst to check for ID *and* userId
    const quiz = await prisma.quiz.findFirst({
      where: { 
        id: quizId,
        userId: user.id
      },
      select: { id: true } // Just need to know if it exists and is owned by user
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: 'Quiz not found or you do not have permission.' }, { status: 404 });
    }

    // --- Prepare Question data for creation ---
    // This strips any 'id' or 'quiz_id' fields from the incoming questions,
    // as we want Prisma to generate new IDs.
    const questionsToCreate: Prisma.questionsCreateManyInput[] = questions.map(q => ({
        question_text: q.question_text,
        question_type: q.question_type,
        correct_answer: q.correct_answer,
        options: q.options || Prisma.JsonNull,
        prompts: q.prompts || Prisma.JsonNull,
        explanation: q.explanation || "",
        // quiz_id will be set by the nested createMany
    }));

    // --- Database Transaction ---
    // This ensures that if *any* part fails, the whole operation is rolled back.
    // We update the title, delete all old questions, and create all new questions.
    const transaction = await prisma.$transaction([
      // 1. Update the quiz title
      prisma.quiz.update({
        where: { id: quizId },
        data: {
          title: title.trim(),
        },
      }),

      // 2. Delete all existing questions for this quiz
      prisma.questions.deleteMany({
        where: { quiz_id: quizId },
      }),

      // 3. Create all the new questions
      prisma.questions.createMany({
        data: questionsToCreate.map(q => ({
          ...q,
          quiz_id: quizId, // Manually link each new question to the quiz
        })),
      })
    ]);

    // The result of the transaction is an array of results
    // We can return the updated quiz title
    const updatedQuiz = transaction[0];

    return NextResponse.json<ApiResponse<Quiz>>({ 
      success: true, 
      data: updatedQuiz as Quiz 
    });

  } catch (error) {
    if (error instanceof Response) {
      return error; // Handle requireAuth 401
    }
    console.error('Error updating quiz:', error);
    
    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientValidationError) {
        return NextResponse.json({ success: false, error: 'Invalid data format for questions.' }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
  }
}