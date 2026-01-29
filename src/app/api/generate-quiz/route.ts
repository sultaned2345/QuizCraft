// src/app/api/generate-quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { QuestionType } from '@/types/database';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { callAIToGenerateQuiz, callAIToGenerateQuizFromTopic } from '@/lib/aiGeneration'; 
import { YoutubeTranscript } from 'youtube-transcript';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow 60s for AI generation

type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionTypeOption = QuestionType | 'MIXED';

// --- Helpers ---

function extractTextFromHtml(html: string): string {
    let cleanHtml = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
    cleanHtml = cleanHtml.replace(/<\/?[^>]+(>|$)/g, " ");
    cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim();
    return cleanHtml;
}

function parseQuery(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const numQuestions = Math.min(15, Math.max(5, Number(searchParams.get('numQuestions') ?? '10')));
  const difficulty = (['easy', 'medium', 'hard'].includes(searchParams.get('difficulty') as string) ? searchParams.get('difficulty') : 'medium') as Difficulty;
  const questionType = (['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'MATCHING', 'MIXED'].includes(searchParams.get('questionType') as string) ? searchParams.get('questionType') : 'MIXED') as QuestionTypeOption;
  const immediateFeedback = searchParams.get('immediateFeedback') !== 'false';
  
  // 'topic' mode expects short text; 'content' mode expects full document text
  const mode = searchParams.get('mode') === 'topic' ? 'topic' : 'content';

  return { numQuestions, difficulty, questionType, immediateFeedback, mode };
}

// Robust input reader (supports JSON body, FormData, or plain Text)
async function readInputText(request: NextRequest, body: any): Promise<string> {
    // 1. Check if JSON body already provided the text (Priority from useTurboGenerator)
    if (body && (body.text || body.topic)) {
        return (body.text || body.topic).trim();
    }

    const contentType = request.headers.get('content-type') || '';

    // 2. Handle FormData (File uploads)
    if (contentType.includes('multipart/form-data')) {
        try {
            const form = await request.formData();
            return (form.get('text') as string)?.trim() || '';
        } catch (e) {
            console.warn("Error parsing form data:", e);
            return '';
        }
    }

    // 3. Handle Plain Text body
    if (contentType.includes('text/plain')) {
        return (await request.text()).trim();
    }
    
    return '';
}

// --- Main Handler ---

export async function POST(request: NextRequest) {
  try {
    // 1. Auth Check
    const user = await requireAuth(request);

    // 2. Usage Check
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid || !usageCheck.canGenerate) {
      return NextResponse.json({ success: false, error: usageCheck.error, message: usageCheck.message }, { status: 403 });
    }

    // 3. Parse Query Params
    const { numQuestions, difficulty, questionType, immediateFeedback, mode } = parseQuery(request);
    
    // 4. Safe Body Parsing
    let body: any = {};
    try {
        const textBody = await request.text();
        if (textBody) body = JSON.parse(textBody);
    } catch { /* ignore JSON errors, body remains empty object */ }

    // 5. Resolve Text and Metadata
    let text = await readInputText(request, body); 
    const { url, youtubeUrl, documentId } = body;

    console.log(`[API] Generate Quiz: mode=${mode}, docId=${documentId}, url=${!!url}, yt=${!!youtubeUrl}, textLen=${text?.length}`);

    // 6. SOURCE RESOLUTION (Backfill if text is missing)
    
    // A. URL Source
    if (!text && url) {
        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
            text = extractTextFromHtml(await response.text());
        } catch (e: any) {
            return NextResponse.json({ success: false, error: `URL error: ${e.message}` }, { status: 400 });
        }
    }
    
    // B. YouTube Source
    else if (!text && youtubeUrl) {
        try {
            const transcript = await YoutubeTranscript.fetchTranscript(youtubeUrl);
            if (!transcript?.length) throw new Error("No transcript found.");
            text = transcript.map(item => item.text).join(' ');
        } catch (e: any) {
            return NextResponse.json({ success: false, error: `YouTube error: ${e.message}` }, { status: 400 });
        }
    }
    
    // C. Database Backfill (Robustness Fix)
    else if (mode !== 'topic' && (!text || text.length < 50) && documentId) {
        if (documentId === 'undefined' || documentId === 'null') {
             return NextResponse.json({ success: false, error: 'Invalid document ID.' }, { status: 400 });
        }

        console.log(`[Quiz] Fetching text from DB for doc: ${documentId}`);
        const doc = await prisma.documents.findUnique({
            where: { id: documentId, user_id: user.id },
            select: { extracted_text: true }
        });

        if (doc && doc.extracted_text) {
            text = doc.extracted_text;
            console.log(`[Quiz] Retrieved ${text.length} characters.`);
        } else {
             return NextResponse.json({ success: false, error: 'Document not found or empty.' }, { status: 404 });
        }
    }

    // 7. Validation
    const minLength = mode === 'topic' ? 3 : 100;
    if (!text || text.length < minLength) {
      return NextResponse.json({ success: false, error: `Content too short (min ${minLength} chars).` }, { status: 400 });
    }

    // 8. Generate with AI
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

    // 9. Save to DB
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

    // 10. Update Usage
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