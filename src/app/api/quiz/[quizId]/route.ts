// src/app/api/quiz/[quizId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Question, Quiz, ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

// --- NEWLY ADDED GET HANDLER ---
export async function GET(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  try {
    // 1. Authenticate the user
    // The client-side (page.tsx) SWR hook only runs if a session exists,
    // so this route should require authentication.
    const user = await requireAuth(request);
    const { quizId } = params;

    if (!quizId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Quiz ID is required.' },
        { status: 400 }
      );
    }

    // 2. Define the shape the client (page.tsx) expects
    interface QuizData {
      quiz: Omit<Quiz, 'questions'>; // Quiz data *without* the nested questions
      questions: Question[]; // Questions as a separate top-level array
    }

    // 3. Fetch the quiz and its questions, ensuring user ownership
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: quizId,
        userId: user.id, // RLS also protects, but this is explicit
      },
      include: {
        questions: {
          orderBy: {
            createdAt: 'asc', // Ensure consistent question order
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

    // 4. Separate the quiz data from the questions to match client expectation
    const { questions, ...quizData } = quiz;

    // 5. Format the data for the client, ensuring types are correct
    const responseData: QuizData = {
      quiz: {
        ...quizData,
        // Serialize dates and ensure nulls
        share_link: quizData.share_link || null,
        time_limit_minutes: quizData.time_limit_minutes || null,
        created_at: quizData.createdAt?.toISOString() || '',
        // We rename createdAt to created_at to match the type
        // but the client-side type might be `createdAt`. Let's just send the object.
      } as Quiz, // Cast to the Quiz type (assuming createdAt maps ok)
      questions: questions.map((q) => ({
        ...q,
        // Ensure options/prompts are null if undefined, and serialize dates
        options: q.options || null,
        prompts: q.prompts || null,
        explanation: q.explanation || null,
        created_at: q.createdAt?.toISOString() || '',
      })),
    };
    
    // The types in database.ts use snake_case (created_at), 
    // but Prisma returns camelCase (createdAt). Let's fix the mapping.
    const finalQuizData: Quiz = {
        id: quizData.id,
        user_id: quizData.userId!,
        title: quizData.title,
        share_link: quizData.share_link || null,
        created_at: quizData.createdAt?.toISOString() || '',
        is_public: quizData.is_public || false,
        immediate_feedback: quizData.immediate_feedback || true,
        time_limit_minutes: quizData.time_limit_minutes || null,
    };
    
    const finalResponseData: QuizData = {
        quiz: finalQuizData,
        questions: responseData.questions
    };


    return NextResponse.json<ApiResponse<QuizData>>({
      success: true,
      data: finalResponseData,
    });
  } catch (error: any) {
    if (error instanceof Response) return error; // Auth error
    console.error(`Error fetching quiz ${params.quizId}:`, error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2023'
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
// --- END NEW GET HANDLER ---

export async function PUT(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { quizId } = params;

    // Expect a body with title and an array of questions
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

    // --- Verify Ownership ---
    // Use findFirst to check for ID *and* userId
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: quizId,
        userId: user.id,
      },
      select: { id: true }, // Just need to know if it exists and is owned by user
    });

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found or you do not have permission.' },
        { status: 404 }
      );
    }

    // --- Prepare Question data for creation ---
    // This strips any 'id' or 'quiz_id' fields from the incoming questions,
    // as we want Prisma to generate new IDs.
    const questionsToCreate: Prisma.questionsCreateManyInput[] = questions.map(
      (q) => ({
        question_text: q.question_text,
        question_type: q.question_type,
        correct_answer: q.correct_answer,
        options: q.options || Prisma.JsonNull,
        prompts: q.prompts || Prisma.JsonNull,
        explanation: q.explanation || '',
        // quiz_id will be set by the nested createMany
      })
    );

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
        data: questionsToCreate.map((q) => ({
          ...q,
          quiz_id: quizId, // Manually link each new question to the quiz
        })),
      }),
    ]);

    // The result of the transaction is an array of results
    // We can return the updated quiz title
    const updatedQuiz = transaction[0];

    return NextResponse.json<ApiResponse<Quiz>>({
      success: true,
      data: {
        ...updatedQuiz,
        user_id: updatedQuiz.userId!,
        share_link: updatedQuiz.share_link || null,
        created_at: updatedQuiz.createdAt?.toISOString() || '',
        is_public: updatedQuiz.is_public || false,
        immediate_feedback: updatedQuiz.immediate_feedback || true,
        time_limit_minutes: updatedQuiz.time_limit_minutes || null,
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error; // Handle requireAuth 401
    }
    console.error('Error updating quiz:', error);

    // Handle Prisma errors
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
} // <-- The PUT function ends here

// --- The DELETE function starts here, *after* the PUT function ---
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

    // --- Secure Deletion using Prisma ---
    // We use deleteMany which allows a compound `where` clause.
    // This ensures we only delete the quiz if the ID matches AND
    // the quiz is owned by the currently authenticated user.
    // The `onDelete: Cascade` in your schema.prisma will handle
    // deleting all associated questions and quiz_attempts.
    const deleteResult = await prisma.quiz.deleteMany({
      where: {
        id: quizId,
        userId: user.id, // Ensures user can only delete their own quizzes
      },
    });

    // Check if any quiz was actually deleted
    if (deleteResult.count === 0) {
      // This means no quiz matched both the ID and the user ID
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Quiz not found or access denied.' },
        { status: 404 }
      );
    }

    // --- Success ---
    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Quiz deleted successfully.',
    });
  } catch (error) {
    if (error instanceof Response) {
      return error; // Handle requireAuth 401
    }

    console.error('Error deleting quiz:', error);

    // Handle specific Prisma errors, like an invalid UUID format
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2023') {
        // Invalid UUID
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
} // <-- The DELETE function ends here