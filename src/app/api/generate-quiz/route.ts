// src/app/api/generate-quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai'; 
import pdfParse from 'pdf-parse-fork';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Question, QuestionType } from '@/types/database';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';

export const runtime = 'nodejs';

// 500k limit
const MAX_INPUT_LENGTH = 500000;

type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionTypeOption = QuestionType | 'MIXED';

function parseQuery(
  request: NextRequest
): {
  numQuestions: number;
  difficulty: Difficulty;
  questionType: QuestionTypeOption;
  immediateFeedback: boolean;
} {
  const { searchParams } = new URL(request.url);
  const numQuestionsParam = Number(searchParams.get('numQuestions') ?? '10');
  const difficultyParam = (searchParams.get('difficulty') as Difficulty) ?? 'medium';
  const questionTypeParam = (searchParams.get('questionType') as QuestionTypeOption) ?? 'MIXED';
  const immediateFeedbackParam = searchParams.get('immediateFeedback') !== 'false';

  const numQuestions = Number.isFinite(numQuestionsParam)
    ? Math.min(15, Math.max(5, numQuestionsParam))
    : 10;

  const difficulty: Difficulty = ['easy', 'medium', 'hard'].includes(difficultyParam)
    ? difficultyParam
    : 'medium';

  const questionType: QuestionTypeOption = [
    'MULTIPLE_CHOICE',
    'TRUE_FALSE',
    'FILL_IN_THE_BLANK',
    'MATCHING',
    'MIXED',
  ].includes(questionTypeParam)
    ? questionTypeParam
    : 'MIXED';

  return {
    numQuestions,
    difficulty,
    questionType,
    immediateFeedback: immediateFeedbackParam,
  };
}

async function readMultipartOrText(
  request: NextRequest
): Promise<{ text: string; sourceType: 'text' | 'file' }> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const textField = (form.get('text') as string) || '';
    return { text: textField.trim(), sourceType: 'text' };
  }

  if (contentType.includes('text/plain')) {
    const rawText = await request.text();
    return { text: rawText.trim(), sourceType: 'text' };
  }

  throw new Error(`Unsupported Content-Type: ${contentType}. Expected text/plain.`);
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

  // --- IMPROVED PROMPT ---
  const system = `You are a strict university professor creating a ${difficulty} difficulty exam.
  
  Goal: Test deep understanding, not just recall.
  
  Rules:
  1. **Questions must be challenging.** Focus on application, analysis, and synthesis of ideas.
  2. **Distractors must be high quality.** No "silly" answers. They should be plausible misconceptions.
  3. **Strict JSON output only.**`;

  const user = `Generate ${numQuestions} ${difficulty} questions of type: ${questionTypes}.

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
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error('Missing GOOGLE_AI_API_KEY environment variable');
  }

  // Safe Text Limit
  const safeText = text.substring(0, MAX_INPUT_LENGTH);

  const { system, user } = buildPrompt({
    text: safeText,
    numQuestions,
    difficulty,
    questionType,
  });

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `${system}\n\n${user}`;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const content = response.text();

  if (!content) {
    throw new Error('Empty response from Gemini');
  }

  let cleanedContent = content.trim();
  if (cleanedContent.startsWith('```')) {
    cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/i, '');
    cleanedContent = cleanedContent.replace(/\n?```\s*$/, '');
    cleanedContent = cleanedContent.trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleanedContent);
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', cleanedContent.substring(0, 500));
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (fallbackError) {
        throw new Error('Failed to parse Gemini JSON response.');
      }
    } else {
      throw new Error('Failed to parse Gemini JSON response.');
    }
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.title || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('Gemini returned invalid or empty data structure.');
  }

  return parsed as { title: string; questions: Question[] };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Usage Check
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid || !usageCheck.canGenerate) {
      return NextResponse.json(
        {
          success: false,
          error: usageCheck.error,
          message: usageCheck.message,
        },
        { status: 403 }
      );
    }

    const { numQuestions, difficulty, questionType, immediateFeedback } = parseQuery(request);
    const { text } = await readMultipartOrText(request);

    if (!text) {
      return NextResponse.json({ success: false, error: 'No input text provided' }, { status: 400 });
    }
    if (text.length < 100) {
      return NextResponse.json({ success: false, error: 'Content is too short.' }, { status: 400 });
    }

    const quiz = await callGeminiForQuiz({
      text,
      numQuestions,
      difficulty,
      questionType,
    });

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
        questions: {
          create: questionsToCreate,
        },
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

    console.error('Quiz generation error details:', error);
    const message = error?.message || 'Internal server error during quiz generation.';
    let status = 500;
    if (message.includes('limit reached')) status = 403;
    if (message.includes('Content-Type') || message.includes('No input text') || message.includes('too short')) status = 400;
    if (message.includes('Gemini') || message.includes('parse')) status = 502;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}