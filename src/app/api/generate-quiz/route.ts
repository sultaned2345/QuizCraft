// src/app/api/generate-quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai'; 
import pdfParse from 'pdf-parse-fork';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Question, QuestionType } from '@/types/database';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';

export const runtime = 'nodejs';

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
  const difficultyParam =
    (searchParams.get('difficulty') as Difficulty) ?? 'medium';
  const questionTypeParam =
    (searchParams.get('questionType') as QuestionTypeOption) ?? 'MIXED';
  const immediateFeedbackParam = searchParams.get('immediateFeedback') !== 'false'; 

  const numQuestions = Number.isFinite(numQuestionsParam)
    ? Math.min(15, Math.max(5, numQuestionsParam))
    : 10;

  const difficulty: Difficulty = ['easy', 'medium', 'hard'].includes(
    difficultyParam
  )
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
    console.warn(
      "generate-quiz received multipart/form-data, expected text/plain. Attempting to read 'text' field."
    );
    const form = await request.formData();
    const textField = (form.get('text') as string) || '';
    return { text: textField.trim(), sourceType: 'text' };
  }

  if (contentType.includes('text/plain')) {
    const rawText = await request.text();
    return { text: rawText.trim(), sourceType: 'text' };
  }

  throw new Error(
    `Unsupported Content-Type: ${contentType}. Expected text/plain.`
  );
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

  // --- UPDATED SYSTEM PROMPT FOR DISTRACTORS ---
  const system = `You are an expert educational assessment creator. Your goal is to generate ${numQuestions} ${difficulty}-level questions based ONLY on the provided text.

CRITICAL INSTRUCTIONS FOR GENERATING "DISTRACTORS" (WRONG ANSWERS):
1. PLAUSIBILITY: Distractors must be plausible to a student who understands the general topic but misses specific details. Do NOT use obvious joke answers or impossibilities (e.g., "Mitochondria" vs "A Pizza").
2. COMMON MISCONCEPTIONS: Base incorrect options on common confusions found in the domain (e.g., confusing "Effect" with "Cause", or similar-sounding terms).
3. HOMOGENEITY: All options must be of similar length, grammatical structure, and complexity.
4. INDEPENDENCE: The correct answer should not be guessable purely by logic (e.g., avoiding "All of the above" unless strictly necessary).

Generate questions of type: ${questionTypes}.`;

  const user = `Content to test:
"""
${text}
"""

Return ONLY valid JSON with this exact shape:
{
  "title": "string",
  "questions": [
    {
      "question_text": "string",
      "question_type": "MULTIPLE_CHOICE",
      "options": ["string", "string", "string", "string"], // 1 Correct, 3 Plausible Distractors
      "correct_answer": "string", 
      "explanation": "string" // Explain why the correct answer is right AND why the misconceptions are wrong.
    },
    {
      "question_text": "string",
      "question_type": "TRUE_FALSE",
      "correct_answer": "True" | "False",
      "explanation": "string"
    },
    {
      "question_text": "string", 
      "question_type": "FILL_IN_THE_BLANK",
      "correct_answer": "string",
      "explanation": "string"
    },
    {
      "question_text": "Match the following items:",
      "question_type": "MATCHING",
      "prompts": ["Prompt 1", "Prompt 2", "Prompt 3"],
      "options": ["Answer 1", "Answer 2", "Answer 3"], 
      "correct_answer": "N/A",
      "explanation": "Explanation of the relationships."
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

  const { system, user } = buildPrompt({
    text,
    numQuestions,
    difficulty,
    questionType,
  });

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      temperature: 0.4,
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
    console.error(
      'Failed to parse Gemini response:',
      cleanedContent.substring(0, 500)
    ); 
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (fallbackError) {
        throw new Error(
          'Failed to parse Gemini JSON response. The AI returned an invalid format even after fallback.'
        );
      }
    } else {
      throw new Error(
        'Failed to parse Gemini JSON response. No valid JSON object found in response.'
      );
    }
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !parsed.title ||
    !Array.isArray(parsed.questions) ||
    parsed.questions.length === 0
  ) {
    throw new Error(
      'Gemini returned invalid or empty data structure (missing title or questions array).'
    );
  }

  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    if (!q || !q.question_text || !q.question_type || !q.correct_answer) {
      throw new Error(
        `Question ${
          i + 1
        } is missing required fields (question_text, question_type, correct_answer).`
      );
    }
    if (
      q.question_type === 'MULTIPLE_CHOICE' &&
      (!Array.isArray(q.options) || q.options.length !== 4)
    ) {
      throw new Error(
        `Question ${i + 1} (MULTIPLE_CHOICE) must have exactly 4 options.`
      );
    }
    if (
      q.question_type === 'MULTIPLE_CHOICE' &&
      !q.options.includes(q.correct_answer)
    ) {
      throw new Error(
        `Question ${
          i + 1
        } (MULTIPLE_CHOICE): correct_answer ('${
          q.correct_answer
        }') must exactly match one of the options.`
      );
    }
    if (
      q.question_type === 'TRUE_FALSE' &&
      !['True', 'False'].includes(q.correct_answer)
    ) {
      throw new Error(
        `Question ${
          i + 1
        } (TRUE_FALSE): correct_answer must be 'True' or 'False'.`
      );
    }
    if (
      q.question_type === 'MATCHING' &&
      (!Array.isArray(q.prompts) ||
        !Array.isArray(q.options) ||
        q.prompts.length !== q.options.length ||
        q.prompts.length === 0)
    ) {
      throw new Error(
        `Question ${
          i + 1
        } (MATCHING) must have non-empty, parallel 'prompts' and 'options' arrays of the same length.`
      );
    }
  }

  return parsed as { title: string; questions: Question[] };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

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

    const { numQuestions, difficulty, questionType, immediateFeedback } =
      parseQuery(request);
    const { text } = await readMultipartOrText(request);

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'No input text provided' },
        { status: 400 }
      );
    }
    if (text.length < 100) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Content is too short. Please provide at least 100 characters.',
        },
        { status: 400 }
      );
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
    if (error instanceof Response) {
      return error;
    }

    console.error('Quiz generation error details:', error);

    const message =
      error?.message || 'Internal server error during quiz generation.';
    let status = 500;
    if (message.includes('limit reached')) status = 403;
    if (
      message.includes('Content-Type') ||
      message.includes('No input text provided') ||
      message.includes('too short')
    )
      status = 400;
    if (message.includes('Gemini') || message.includes('parse')) status = 502;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}