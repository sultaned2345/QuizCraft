// src/app/api/generate-quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai'; // <-- FIX: Changed hyphen to slash
import pdfParse from 'pdf-parse-fork';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Question, QuestionType } from '@/types/database';
// --- MODIFIED IMPORTS ---
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits'; // Import usage limit checker
// import { supabaseAdmin } from '@/lib/supabaseAdmin'; // REMOVED
// --- END MODIFICATION ---

export const runtime = 'nodejs'; // Required for pdf-parse (Node APIs)

type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionTypeOption = QuestionType | 'MIXED';

// --- REMOVED LOCAL updateAIUsage HELPER ---

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
  const immediateFeedbackParam = searchParams.get('immediateFeedback') !== 'false'; // Default to true if not specified

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

  // Check if it's multipart/form-data (likely from /api/upload)
  if (contentType.includes('multipart/form-data')) {
    // This route should ideally receive plain text, but handle if needed
    console.warn(
      "generate-quiz received multipart/form-data, expected text/plain. Attempting to read 'text' field."
    );
    const form = await request.formData();
    const textField = (form.get('text') as string) || '';
    // Note: File handling logic removed as this route expects text body now
    return { text: textField.trim(), sourceType: 'text' };
  }

  // Expect plain text directly in the body
  if (contentType.includes('text/plain')) {
    const rawText = await request.text();
    return { text: rawText.trim(), sourceType: 'text' };
  }

  // Fallback / Error
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
      ? 'MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_THE_BLANK, and MATCHING' // --- MODIFIED: Added MATCHING ---
      : questionType;

  const system = `You are an expert quiz creator. Based ONLY on the provided text, generate exactly ${numQuestions} ${difficulty} difficulty ${questionTypes} questions. Focus on the most important concepts and information in the text. For each question, provide a brief explanation for the correct answer derived strictly from the text.`;

  // --- MODIFIED: Added MATCHING type to example structure ---
  const user = `Generate ${numQuestions} ${difficulty} difficulty quiz questions of the following type(s): ${questionTypes}, based *only* on the content below.

Content:
"""
${text}
"""

Return ONLY valid JSON with this exact shape:
{
  "title": string, // a concise quiz title based on the content
  "questions": [
    {
      "question_text": string,
      "question_type": "MULTIPLE_CHOICE", // Must be one of the requested types
      "options": [string, string, string, string], // Exactly 4 options
      "correct_answer": string, // MUST exactly match one of the options
      "explanation": string // explanation for the correct answer based on the text
    },
    {
      "question_text": string,
      "question_type": "TRUE_FALSE", // Must be one of the requested types
      "correct_answer": "True" | "False", // Must be "True" or "False"
      "explanation": string
    },
    {
      "question_text": string, // use "____" for the blank(s)
      "question_type": "FILL_IN_THE_BLANK", // Must be one of the requested types
      "correct_answer": string, // The word(s) that fit the blank
      "explanation": string
    },
    {
      "question_text": "Match the following items:",
      "question_type": "MATCHING", // Must be one of the requested types
      "prompts": ["Prompt 1", "Prompt 2", "Prompt 3"], // The list of prompts
      "options": ["Answer 1", "Answer 2", "Answer 3"], // The list of correct, corresponding answers in order
      "correct_answer": "N/A", // Can be "N/A" or "See matched lists"
      "explanation": "Explanation of how the items are related."
    }
    // ... more questions matching the requested types and total number
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

  // Basic cleanup (remove markdown backticks if present)
  if (cleanedContent.startsWith('```')) {
    cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/i, '');
    cleanedContent = cleanedContent.replace(/\n?```\s*$/, '');
    cleanedContent = cleanedContent.trim();
  }

  // --- DEBUGGING: Log the raw response from AI ---
  console.log(
    '----- RAW AI Response START -----\n',
    cleanedContent,
    '\n----- RAW AI Response END -----'
  );
  // --- END DEBUGGING ---

  let parsed: any;
  try {
    parsed = JSON.parse(cleanedContent);
  } catch (parseError) {
    console.error(
      'Failed to parse Gemini response:',
      cleanedContent.substring(0, 500)
    ); // Log snippet on error
    // Attempt fallback parsing if the main parse fails
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        console.log('Attempting fallback JSON parsing...');
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

  // Validate basic structure
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !parsed.title ||
    !Array.isArray(parsed.questions) ||
    parsed.questions.length === 0
  ) {
    console.error('Parsed Gemini data has invalid structure:', parsed);
    throw new Error(
      'Gemini returned invalid or empty data structure (missing title or questions array).'
    );
  }

  // Validate individual questions (adjust validation as needed)
  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    if (!q || !q.question_text || !q.question_type || !q.correct_answer) {
      console.error(`Invalid question structure at index ${i}:`, q);
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
      // Expect exactly 4 options now
      console.error(
        `Invalid MULTIPLE_CHOICE options at index ${i}:`,
        q.options
      );
      throw new Error(
        `Question ${i + 1} (MULTIPLE_CHOICE) must have exactly 4 options.`
      );
    }
    if (
      q.question_type === 'MULTIPLE_CHOICE' &&
      !q.options.includes(q.correct_answer)
    ) {
      console.error(
        `Correct answer mismatch at index ${i}: Answer='${
          q.correct_answer
        }', Options=${JSON.stringify(q.options)}`
      );
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
      console.error(
        `Invalid TRUE_FALSE answer at index ${i}: Answer='${q.correct_answer}'`
      );
      throw new Error(
        `Question ${
          i + 1
        } (TRUE_FALSE): correct_answer must be 'True' or 'False'.`
      );
    }
    // --- MODIFIED: Added validation for MATCHING ---
    if (
      q.question_type === 'MATCHING' &&
      (!Array.isArray(q.prompts) ||
        !Array.isArray(q.options) ||
        q.prompts.length !== q.options.length ||
        q.prompts.length === 0)
    ) {
      console.error(`Invalid MATCHING structure at index ${i}:`, q);
      throw new Error(
        `Question ${
          i + 1
        } (MATCHING) must have non-empty, parallel 'prompts' and 'options' arrays of the same length.`
      );
    }
    // ---
  }

  return parsed as { title: string; questions: Question[] };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // --- Check AI Usage Limit ---
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid || !usageCheck.canGenerate) {
      return NextResponse.json(
        {
          success: false,
          error: usageCheck.error, // <-- This will be "limit_exceeded"
          message: usageCheck.message,
        },
        { status: 403 }
      );
    }
    // --- End Usage Check ---

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
      // Add length check here too
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

    // --- DEBUGGING: Log the data structure before saving ---
    console.log(
      '----- Data going to Prisma START -----\n',
      JSON.stringify(quiz, null, 2),
      '\n----- Data going to Prisma END -----'
    );
    // --- END DEBUGGING ---

    // Ensure options and prompts are always arrays (or null/undefined) for Prisma
    const questionsToCreate = quiz.questions.map((q) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      correct_answer: q.correct_answer,
      // Ensure options is an array or undefined (Prisma Json expects valid JSON types)
      options: Array.isArray(q.options) ? q.options : undefined,
      // Ensure prompts is an array or undefined
      prompts: Array.isArray(q.prompts) ? q.prompts : undefined,
      explanation: q.explanation || '', // Default to empty string if missing
    }));

    const saved = await prisma.quiz.create({
      data: {
        title: quiz.title || 'Generated Quiz',
        is_public: false, // Default to private
        immediate_feedback: immediateFeedback,
        userId: user.id, // Link to the authenticated user
        questions: {
          create: questionsToCreate, // Use the mapped questions
        },
      },
      // Select necessary fields to return
      select: {
        id: true,
        title: true,
        createdAt: true, // Use schema field name
        questions: {
          // Include generated questions in response
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

    // --- Update AI Usage Count ---
    // --- MODIFIED CALL ---
    await incrementAIGenerationUsage(user.id, 1); // Increment by 1
    // --- End Usage Update ---

    return NextResponse.json({
      success: true,
      id: saved.id,
      title: saved.title,
      createdAt: saved.createdAt,
      questions: saved.questions, // Return the saved questions with IDs
    });
  } catch (error: any) {
    if (error instanceof Response) {
      // Handles requireAuth error (401)
      return error;
    }

    // --- DEBUGGING: Log the full error object ---
    console.error('Quiz generation error details:', error);
    // --- END DEBUGGING ---

    const message =
      error?.message || 'Internal server error during quiz generation.';
    // Determine status code based on error type if possible
    let status = 500;
    if (message.includes('limit reached')) status = 403;
    if (
      message.includes('Content-Type') ||
      message.includes('No input text provided') ||
      message.includes('too short')
    )
      status = 400;
    if (message.includes('Gemini') || message.includes('parse')) status = 502; // Bad Gateway for upstream AI issues

    return NextResponse.json({ success: false, error: message }, { status });
  }
}