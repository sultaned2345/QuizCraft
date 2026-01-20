import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Question, Quiz, ApiResponse, QuestionType } from '@/types/database';
import { Prisma } from '@prisma/client';

// --- GET HANDLER ---
export async function GET(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  try {
    // 1. Authenticate the user
    const user = await requireAuth(request);
    const { quizId } = params;

    if (!quizId || quizId === 'null' || quizId === 'undefined') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Quiz ID is missing or invalid.' },
        { status: 400 }
      );
    }

    // 2. Define the shape the client (page.tsx) expects
    interface QuizData {
      quiz: Omit<Quiz, 'questions'>;
      questions: Question[];
    }

    // 3. Fetch the quiz and its questions
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: quizId,
        userId: user.id,
      },
      include: {
        questions: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Quiz not found or access denied.' },
        { status: 404 }
      );
    }

    // 4. Separate and Map Data
    const { questions, ...quizData } = quiz;

    // FIX: Manually map Prisma fields (camelCase) to Interface (snake_case)
    const formattedQuiz: Quiz = {
      id: quizData.id,
      user_id: quizData.userId || '', // Prisma: userId -> Interface: user_id
      title: quizData.title,
      share_link: quizData.share_link || null,
      created_at: quizData.createdAt?.toISOString() || new Date().toISOString(), // Prisma: createdAt -> Interface: created_at
      is_public: quizData.is_public || false,
      immediate_feedback: quizData.immediate_feedback || true,
      time_limit_minutes: quizData.time_limit_minutes || null,
    };

    const formattedQuestions: Question[] = questions.map((q) => ({
      id: q.id,
      quiz_id: q.quiz_id || '',
      question_text: q.question_text,
      question_type: q.question_type as QuestionType,
      options: q.options || [],
      prompts: q.prompts || [],
      correct_answer: q.correct_answer,
      explanation: q.explanation || null,
      created_at: q.createdAt?.toISOString() || new Date().toISOString(),
    }));

    // 5. Construct Final Response
    const responseData: QuizData = {
      quiz: formattedQuiz,
      questions: formattedQuestions,
    };

    return NextResponse.json<ApiResponse<QuizData>>({
      success: true,
      data: responseData,
    });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error(`Error fetching quiz ${params.quizId}:`, error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2023' || error.code === '22P02')
    ) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid Quiz ID format.' },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch quiz details.' },
      { status: 500 }
    );
  }
}

// --- PUT HANDLER ---
export async function PUT(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { quizId } = params;

    const body = await request.json();
    const { title, questions } = body as {
      title: string;
      questions: Question[];
    };

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Title is required.' },
        { status: 400 }
      );
    }
    if (!Array.isArray(questions)) {
      return NextResponse.json(
        { success: false, error: 'Questions must be an array.' },
        { status: 400 }
      );
    }

    const quiz = await prisma.quiz.findFirst({
      where: {
        id: quizId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found or you do not have permission.' },
        { status: 404 }
      );
    }

    const questionsToCreate: Prisma.questionsCreateManyInput[] = questions.map(
      (q) => ({
        question_text: q.question_text,
        question_type: q.question_type,
        correct_answer: q.correct_answer,
        options: q.options || Prisma.JsonNull,
        prompts: q.prompts || Prisma.JsonNull,
        explanation: q.explanation || '',
        quiz_id: quizId,
      })
    );

    const transaction = await prisma.$transaction([
      prisma.quiz.update({
        where: { id: quizId },
        data: { title: title.trim() },
      }),
      prisma.questions.deleteMany({
        where: { quiz_id: quizId },
      }),
      prisma.questions.createMany({
        data: questionsToCreate,
      }),
    ]);

    const updatedQuiz = transaction[0];

    // Map response safely
    const finalQuiz: Quiz = {
      id: updatedQuiz.id,
      user_id: updatedQuiz.userId || '',
      title: updatedQuiz.title,
      share_link: updatedQuiz.share_link || null,
      created_at: updatedQuiz.createdAt?.toISOString() || new Date().toISOString(),
      is_public: updatedQuiz.is_public || false,
      immediate_feedback: updatedQuiz.immediate_feedback || true,
      time_limit_minutes: updatedQuiz.time_limit_minutes || null,
    };

    return NextResponse.json<ApiResponse<Quiz>>({
      success: true,
      data: finalQuiz,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error updating quiz:', error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { success: false, error: 'Invalid data format for questions.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

// --- DELETE HANDLER ---
export async function DELETE(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { quizId } = params;

    if (!quizId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Quiz ID is required.' },
        { status: 400 }
      );
    }

    const deleteResult = await prisma.quiz.deleteMany({
      where: {
        id: quizId,
        userId: user.id,
      },
    });

    if (deleteResult.count === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Quiz not found or access denied.' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Quiz deleted successfully.',
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error deleting quiz:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2023') {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Invalid Quiz ID format.' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}