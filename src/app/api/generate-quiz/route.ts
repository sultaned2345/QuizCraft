// src/app/api/generate-quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { QuestionType } from '@/types/database';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { callAIToGenerateQuiz, callAIToGenerateQuizFromTopic } from '@/lib/aiGeneration'; 
import { YoutubeTranscript } from 'youtube-transcript';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionTypeOption = QuestionType | 'MIXED';

// --- Helper: Clean HTML ---
function extractTextFromHtml(html: string): string {
    let cleanHtml = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
    cleanHtml = cleanHtml.replace(/<\/?[^>]+(>|$)/g, " ");
    cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim();
    return cleanHtml;
}

// --- Helper: Parse Query Params ---
function parseQuery(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const numQuestions = Math.min(15, Math.max(5, Number(searchParams.get('numQuestions') ?? '10')));
  const difficulty = (['easy', 'medium', 'hard'].includes(searchParams.get('difficulty') as string) ? searchParams.get('difficulty') : 'medium') as Difficulty;
  const questionType = (['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'MATCHING', 'MIXED'].includes(searchParams.get('questionType') as string) ? searchParams.get('questionType') : 'MIXED') as QuestionTypeOption;
  const immediateFeedback = searchParams.get('immediateFeedback') !== 'false';
  
  // 'topic' mode expects the input text to be a short topic string (e.g. "Photosynthesis")
  // 'content' mode expects the input text to be the full source material
  const mode = searchParams.get('mode') === 'topic' ? 'topic' : 'content';

  return { numQuestions, difficulty, questionType, immediateFeedback, mode };
}

// --- Helper: Parse Body Safe (Stream Safe) ---
async function parseRequestBody(request: NextRequest) {
    const contentType = request.headers.get('content-type') || '';
    
    // 1. Handle JSON
    if (contentType.includes('application/json')) {
        try {
            return await request.json();
        } catch (e) {
            console.error("[Quiz] Failed to parse JSON body");
            return {};
        }
    }
    
    // 2. Handle FormData (File uploads)
    if (contentType.includes('multipart/form-data')) {
        try {
            const formData = await request.formData();
            return {
                text: formData.get('text') as string,
                documentId: formData.get('documentId') as string,
                url: formData.get('url') as string,
                youtubeUrl: formData.get('youtubeUrl') as string,
                topic: formData.get('topic') as string,
            };
        } catch (e) {
            console.error("[Quiz] Failed to parse FormData");
            return {};
        }
    }

    // 3. Handle Plain Text
    if (contentType.includes('text/plain')) {
        try {
            const text = await request.text();
            return { text };
        } catch (e) {
            return {};
        }
    }

    return {};
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // 1. Usage Check
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid || !usageCheck.canGenerate) {
      return NextResponse.json({ success: false, error: usageCheck.error, message: usageCheck.message }, { status: 403 });
    }

    // 2. Parse Inputs
    const { numQuestions, difficulty, questionType, immediateFeedback, mode } = parseQuery(request);
    
    // Read Body (Stream Safe)
    const body = await parseRequestBody(request);
    
    // Extract potential sources
    let { text, topic, url, youtubeUrl, documentId } = body;
    
    // Normalize text input
    if (!text && topic) text = topic;

    console.log(`[API] Generate Quiz: mode=${mode}, docId=${documentId}, url=${!!url}, yt=${!!youtubeUrl}, textLen=${text?.length}`);

    // 3. SOURCE RESOLUTION LOGIC
    
    // A. Handle URL Source
    if (!text && url) {
        try {
            console.log(`[Quiz] Fetching URL: ${url}`);
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
            const html = await response.text();
            text = extractTextFromHtml(html);
        } catch (e: any) {
            return NextResponse.json({ success: false, error: `Failed to fetch URL: ${e.message}` }, { status: 400 });
        }
    }
    
    // B. Handle YouTube Source
    else if (!text && youtubeUrl) {
        try {
            console.log(`[Quiz] Fetching Transcript: ${youtubeUrl}`);
            const transcript = await YoutubeTranscript.fetchTranscript(youtubeUrl);
            if (!transcript || transcript.length === 0) throw new Error("No transcript found.");
            text = transcript.map(item => item.text).join(' ');
        } catch (e: any) {
            return NextResponse.json({ success: false, error: `Failed to fetch YouTube transcript: ${e.message}` }, { status: 400 });
        }
    }
    
    // C. Handle Document ID Backfill (The Fix)
    else if ((!text || text.length < 50) && documentId) {
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
            console.log(`[Quiz] Fetched ${text.length} characters from DB.`);
        } else {
             return NextResponse.json({ success: false, error: 'Document not found or empty.' }, { status: 404 });
        }
    }

    // 4. Validation
    const minLength = mode === 'topic' ? 3 : 100;
    if (!text || text.length < minLength) {
      return NextResponse.json({ success: false, error: `Content too short (min ${minLength} chars).` }, { status: 400 });
    }

    // 5. Generate with AI
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