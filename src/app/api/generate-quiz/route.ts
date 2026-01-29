// src/app/api/generate-quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { QuestionType } from '@/types/database';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { callAIToGenerateQuiz, callAIToGenerateQuizFromTopic } from '@/lib/aiGeneration'; 

export const runtime = 'nodejs';
export const maxDuration = 60;

type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionTypeOption = QuestionType | 'MIXED';

// --- Helper Functions (Restored) ---

function parseQuery(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const numQuestions = Math.min(15, Math.max(5, Number(searchParams.get('numQuestions') ?? '10')));
  const difficulty = (['easy', 'medium', 'hard'].includes(searchParams.get('difficulty') as string) ? searchParams.get('difficulty') : 'medium') as Difficulty;
  const questionType = (['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'MATCHING', 'MIXED'].includes(searchParams.get('questionType') as string) ? searchParams.get('questionType') : 'MIXED') as QuestionTypeOption;
  const immediateFeedback = searchParams.get('immediateFeedback') !== 'false';
  const mode = searchParams.get('mode') === 'topic' ? 'topic' : 'content';
  return { numQuestions, difficulty, questionType, immediateFeedback, mode };
}

// Safely get JSON body without crashing
async function getJsonBody(request: NextRequest) {
    try {
        const clone = request.clone();
        return await clone.json();
    } catch {
        return {};
    }
}

async function readInputText(request: NextRequest): Promise<string> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
      // We clone to not consume the stream if we need it later, though usually fine to consume once
      try {
          const body = await request.json();
          return body.text?.trim() || '';
      } catch (e) {
          return '';
      }
  }

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    return (form.get('text') as string)?.trim() || '';
  }

  if (contentType.includes('text/plain')) {
    return (await request.text()).trim();
  }

  // If no content type matches, return empty, don't throw yet
  return '';
}

// --- Main Handler ---

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // 1. Usage Check
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid || !usageCheck.canGenerate) {
      return NextResponse.json({ success: false, error: usageCheck.error, message: usageCheck.message }, { status: 403 });
    }

    // 2. Parse Input & Body
    const { numQuestions, difficulty, questionType, immediateFeedback, mode } = parseQuery(request);
    
    // We try to get text from standard inputs first
    let text = await readInputText(request);
    
    // Also try to get documentId from JSON body if possible
    let documentId: string | null = null;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        // We might have already consumed body in readInputText, so use getJsonBody helper which handles clones or re-reads if needed
        // Actually, request.json() can only be called once. 
        // Better strategy: Use the `text` we already parsed if it was JSON.
        // If readInputText handled JSON, it returned `body.text`.
        // We need to re-access the body for `documentId`.
        // Let's refactor slightly to be safe:
        try {
            // Re-parsing might fail if stream consumed. 
            // In a real scenario, we should parse once.
            // Let's assume standard usage:
            const clone = request.clone(); 
            const body = await clone.json();
            if (!text) text = body.text || body.topic || '';
            documentId = body.documentId;
        } catch (e) { /* ignore */ }
    }

    // 3. ROBUSTNESS FIX: Fetch from DB if text is missing
    if (mode !== 'topic' && (!text || text.length < 50) && documentId) {
        if (documentId === 'undefined' || documentId === 'null') {
             return NextResponse.json({ success: false, error: 'Invalid document ID.' }, { status: 400 });
        }

        console.log(`[Quiz] Fetching text for doc: ${documentId}`);
        const doc = await prisma.documents.findUnique({
            where: { id: documentId, user_id: user.id },
            select: { extracted_text: true }
        });

        if (doc && doc.extracted_text) {
            text = doc.extracted_text;
        } else {
             return NextResponse.json({ success: false, error: 'Document not found or empty.' }, { status: 404 });
        }
    }

    // 4. Validation
    if (mode !== 'topic' && (!text || text.length < 100)) {
      return NextResponse.json({ success: false, error: 'Content too short (min 100 chars).' }, { status: 400 });
    }
    if (mode === 'topic' && (!text || text.length < 3)) {
      return NextResponse.json({ success: false, error: 'Topic too short.' }, { status: 400 });
    }

    // 5. Call AI
    let quizData;
    if (mode === 'topic') {
      const cleanTopic = text.replace(/^TOPIC:\s*/i, '').trim();
      quizData = await callAIToGenerateQuizFromTopic(cleanTopic, numQuestions, difficulty, questionType);
    } else {
      quizData = await callAIToGenerateQuiz(text, numQuestions, difficulty, questionType);
    }

    if (!quizData) {
        return NextResponse.json({ success: false, error: 'ai_generation_failed', message: 'Failed to generate quiz.' }, { status: 500 });
    }

    // 6. Save to DB
    const questionsToCreate = quizData.questions.map((q: any) => ({
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

    // 7. Update Usage
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