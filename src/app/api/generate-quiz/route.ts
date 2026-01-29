// src/app/api/generate-quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { QuestionType } from '@/types/database';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { callAIToGenerateQuiz, callAIToGenerateQuizFromTopic } from '@/lib/aiGeneration'; 

export const runtime = 'nodejs';

type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionTypeOption = QuestionType | 'MIXED';

function parseQuery(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const numQuestions = Math.min(15, Math.max(5, Number(searchParams.get('numQuestions') ?? '10')));
  const difficulty = (['easy', 'medium', 'hard'].includes(searchParams.get('difficulty') as string) ? searchParams.get('difficulty') : 'medium') as Difficulty;
  const questionType = (['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'MATCHING', 'MIXED'].includes(searchParams.get('questionType') as string) ? searchParams.get('questionType') : 'MIXED') as QuestionTypeOption;
  const immediateFeedback = searchParams.get('immediateFeedback') !== 'false';
  
  const mode = searchParams.get('mode') === 'topic' ? 'topic' : 'content';

  return { numQuestions, difficulty, questionType, immediateFeedback, mode };
}

// Safely read body, returns object even if body is empty
async function getBody(request: NextRequest) {
    try {
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return await request.json();
        }
        return {}; 
    } catch (e) {
        return {};
    }
}

async function readInputText(request: NextRequest, body: any): Promise<string> {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
        return body.text?.trim() || '';
    }
    if (contentType.includes('multipart/form-data')) {
        const form = await request.formData();
        return (form.get('text') as string)?.trim() || '';
    }
    if (contentType.includes('text/plain')) {
        return (await request.text()).trim();
    }
    return '';
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // 1. Usage Check
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid || !usageCheck.canGenerate) {
      return NextResponse.json({ success: false, error: usageCheck.error, message: usageCheck.message }, { status: 403 });
    }

    // 2. Parse Input (Including Mode)
    const { numQuestions, difficulty, questionType, immediateFeedback, mode } = parseQuery(request);
    
    const body = await getBody(request);
    let text = await readInputText(request, body);
    const documentId = body.documentId;

    // --- FIX: Fetch content from Document ID if text is missing & not in topic mode ---
    if (mode !== 'topic' && (!text || text.length < 50) && documentId) {
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
    // ---------------------------------------------------------------------------------

    // Basic validation
    // If mode is topic, text might be short (e.g. "Biology"), so we relax the length check
    if (mode !== 'topic' && (!text || text.length < 100)) {
      return NextResponse.json({ success: false, error: 'Content too short (min 100 chars).' }, { status: 400 });
    }
    if (mode === 'topic' && (!text || text.length < 3)) {
      return NextResponse.json({ success: false, error: 'Topic too short.' }, { status: 400 });
    }

    // 3. Call AI (Switch based on Mode)
    let quizData;
    
    if (mode === 'topic') {
      // Remove the "TOPIC:" prefix if the frontend sent it
      const cleanTopic = text.replace(/^TOPIC:\s*/i, '').trim();
      quizData = await callAIToGenerateQuizFromTopic(cleanTopic, numQuestions, difficulty, questionType);
    } else {
      quizData = await callAIToGenerateQuiz(text, numQuestions, difficulty, questionType);
    }

    if (!quizData) {
        return NextResponse.json({ success: false, error: 'ai_generation_failed', message: 'Failed to generate quiz.' }, { status: 500 });
    }

    // 4. Save to DB
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