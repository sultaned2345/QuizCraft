// src/app/api/generate-quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Question, QuestionType } from '@/types/database';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';

export const runtime = 'nodejs';

// Keep 500k limit
const MAX_INPUT_LENGTH = 500000;

type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionTypeOption = QuestionType | 'MIXED';

// ... (parseQuery and readMultipartOrText remain the same) ...
function parseQuery(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const numQuestions = Number(searchParams.get('numQuestions') ?? '10');
  const difficulty = (searchParams.get('difficulty') as Difficulty) ?? 'medium';
  const questionType = (searchParams.get('questionType') as QuestionTypeOption) ?? 'MIXED';
  const immediateFeedback = searchParams.get('immediateFeedback') !== 'false';
  return { numQuestions, difficulty, questionType, immediateFeedback };
}

async function readMultipartOrText(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    return { text: (form.get('text') as string).trim(), sourceType: 'text' as const };
  }
  if (contentType.includes('text/plain')) {
    return { text: (await request.text()).trim(), sourceType: 'text' as const };
  }
  throw new Error(`Unsupported Content-Type: ${contentType}`);
}

function buildPrompt({
  text,
  numQuestions,
  difficulty,
  questionType,
}: {
  text: string;
  numQuestions: number;
  difficulty: Difficulty;
  questionType: QuestionTypeOption;
}) {
  const questionTypes =
    questionType === 'MIXED'
      ? 'MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_THE_BLANK, and MATCHING'
      : questionType;

  // --- REVERTED TO ORIGINAL PROMPT ---
  const system = `You are an expert quiz creator. Based ONLY on the provided text, generate exactly ${numQuestions} ${difficulty} difficulty ${questionTypes} questions. Focus on the most important concepts and information in the text. For each question, provide a brief explanation for the correct answer derived strictly from the text.`;

  const user = `Generate ${numQuestions} ${difficulty} difficulty quiz questions of the following type(s): ${questionTypes}, based *only* on the content below.

Content:
"""
${text}
"""

Return ONLY valid JSON with this exact shape:
{
  "title": string,
  "questions": [
    {
      "question_text": string,
      "question_type": "MULTIPLE_CHOICE",
      "options": [string, string, string, string],
      "correct_answer": string,
      "explanation": string
    },
    {
      "question_text": string,
      "question_type": "TRUE_FALSE",
      "correct_answer": "True" | "False",
      "explanation": string
    },
    {
      "question_text": string,
      "question_type": "FILL_IN_THE_BLANK",
      "correct_answer": string,
      "explanation": string
    },
    {
      "question_text": "Match the following items:",
      "question_type": "MATCHING",
      "prompts": ["A", "B", "C"],
      "options": ["1", "2", "3"],
      "correct_answer": "N/A",
      "explanation": "string"
    }
  ]
}`;
  return { system, user };
}

async function callGeminiForQuiz({
  text,
  numQuestions,
  difficulty,
  questionType,
}: {
  text: string;
  numQuestions: number;
  difficulty: Difficulty;
  questionType: QuestionTypeOption;
}): Promise<{ title: string; questions: Question[] }> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
  if (!process.env.GOOGLE_AI_API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY');

  const safeText = text.substring(0, MAX_INPUT_LENGTH);
  const { system, user } = buildPrompt({ text: safeText, numQuestions, difficulty, questionType });

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      temperature: 0.4, // Reverted to 0.4
      responseMimeType: 'application/json',
    },
  });

  const result = await model.generateContent(`${system}\n\n${user}`);
  const response = await result.response;
  const content = response.text();

  if (!content) throw new Error('Empty response from Gemini');

  let cleanedContent = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleanedContent);
  } catch (parseError) {
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    else throw new Error('Failed to parse Gemini JSON response.');
  }

  return parsed as { title: string; questions: Question[] };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid || !usageCheck.canGenerate) {
      return NextResponse.json({ success: false, error: usageCheck.error, message: usageCheck.message }, { status: 403 });
    }

    const { numQuestions, difficulty, questionType, immediateFeedback } = parseQuery(request);
    const { text } = await readMultipartOrText(request);

    if (!text || text.length < 100) return NextResponse.json({ success: false, error: 'Content too short.' }, { status: 400 });

    const quiz = await callGeminiForQuiz({ text, numQuestions, difficulty, questionType });

    const questionsToCreate = quiz.questions.map((q) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      correct_answer: q.correct_answer,
      options: Array.isArray(q.options) ? q.options : undefined,
      prompts: Array.isArray(q.prompts) ? q.prompts : undefined,
      explanation: q.explanation || '',
    }));

    const saved = await prisma.quiz.create({
      data: {
        title: quiz.title || 'Generated Quiz',
        is_public: false,
        immediate_feedback: immediateFeedback,
        userId: user.id,
        questions: { create: questionsToCreate },
      },
      select: { id: true, title: true, createdAt: true, questions: { select: { id: true, question_text: true, question_type: true, options: true, prompts: true, correct_answer: true, explanation: true } } },
    });

    await incrementAIGenerationUsage(user.id, 1);

    return NextResponse.json({ success: true, ...saved });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('Quiz generation error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error.' }, { status: 500 });
  }
}