// src/app/api/generate-quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { QuestionType } from '@/types/database';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { callAIToGenerateQuiz } from '@/lib/aiGeneration'; // <-- IMPORTED

export const runtime = 'nodejs';

type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionTypeOption = QuestionType | 'MIXED';

function parseQuery(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const numQuestions = Math.min(15, Math.max(5, Number(searchParams.get('numQuestions') ?? '10')));
  const difficulty = (['easy', 'medium', 'hard'].includes(searchParams.get('difficulty') as string) ? searchParams.get('difficulty') : 'medium') as Difficulty;
  const questionType = (['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'MATCHING', 'MIXED'].includes(searchParams.get('questionType') as string) ? searchParams.get('questionType') : 'MIXED') as QuestionTypeOption;
  const immediateFeedback = searchParams.get('immediateFeedback') !== 'false';

  return { numQuestions, difficulty, questionType, immediateFeedback };
}

async function readInputText(request: NextRequest): Promise<string> {
  const contentType = request.headers.get('content-type') || '';

  // 1. Handle JSON (New: for Voice Notes/Text)
  if (contentType.includes('application/json')) {
      const body = await request.json();
      return body.text?.trim() || '';
  }

  // 2. Handle Multipart (Legacy: for file uploads if needed)
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    return (form.get('text') as string)?.trim() || '';
  }

  // 3. Handle Plain Text
  if (contentType.includes('text/plain')) {
    return (await request.text()).trim();
  }

  throw new Error(`Unsupported Content-Type: ${contentType}`);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // 1. Usage Check
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid || !usageCheck.canGenerate) {
      return NextResponse.json({ success: false, error: usageCheck.error, message: usageCheck.message }, { status: 403 });
    }

    // 2. Parse Input
    const { numQuestions, difficulty, questionType, immediateFeedback } = parseQuery(request);
    const text = await readInputText(request);

    if (!text || text.length < 100) {
      return NextResponse.json({ success: false, error: 'Content too short (min 100 chars).' }, { status: 400 });
    }

    // 3. Call AI (Using Shared Library)
    const quizData = await callAIToGenerateQuiz(text, numQuestions, difficulty, questionType);

    // FIX: Check if quizData is null
    if (!quizData) {
        return NextResponse.json({ success: false, error: 'ai_generation_failed', message: 'Failed to generate quiz.' }, { status: 500 });
    }

    // 4. Save to DB
    const questionsToCreate = quizData.questions.map((q) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      correct_answer: q.correct_answer,
      options: Array.isArray(q.options) ? q.options : undefined,
      prompts: Array.isArray(q.prompts) ? q.prompts : undefined,
      explanation: q.explanation || '',
    }));

    const saved = await prisma.quiz.create({
      data: {
        title: quizData.title || 'Generated Quiz',
        is_public: false,
        immediate_feedback: immediateFeedback,
        userId: user.id,
        questions: { create: questionsToCreate },
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        questions: {
          select: {
            id: true,
            question_text: true,
            question_type: true,
            options: true,
            prompts: true,
            correct_answer: true,
            explanation: true,
          },
        },
      },
    });

    // 5. Update Usage
    await incrementAIGenerationUsage(user.id, 1);

    return NextResponse.json({
      success: true,
      id: saved.id,
      title: saved.title,
      createdAt: saved.createdAt,
      questions: saved.questions,
    });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('Quiz generation error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}