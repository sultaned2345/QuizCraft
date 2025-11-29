// src/app/api/generate-quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Question, QuestionType } from '@/types/database';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';

export const runtime = 'nodejs';

type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionTypeOption = QuestionType | 'MIXED';

/**
 * Parses and validates query parameters from the request URL.
 */
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
  const immediateFeedbackParam = searchParams.get('immediateFeedback') !== 'false'; // Default to true

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
    'ORDERING', // --- ADDED ---
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

/**
 * Reads text content from either a multipart form (file upload) or plain text body.
 */
async function readMultipartOrText(
  request: NextRequest
): Promise<{ text: string; sourceType: 'text' | 'file' }> {
  const contentType = request.headers.get('content-type') || '';

  // Handle multipart/form-data (likely from /api/upload forwarding)
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const textField = (form.get('text') as string) || '';
    return { text: textField.trim(), sourceType: 'text' };
  }

  // Handle plain text directly
  if (contentType.includes('text/plain')) {
    const rawText = await request.text();
    return { text: rawText.trim(), sourceType: 'text' };
  }

  throw new Error(
    `Unsupported Content-Type: ${contentType}. Expected text/plain or multipart/form-data.`
  );
}

/**
 * Constructs the prompt for Gemini, including specific JSON schema instructions
 * for Matching and Ordering questions.
 */
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
      ? 'MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_THE_BLANK, MATCHING, and ORDERING'
      : questionType;

  const system = `You are an expert quiz creator. Based ONLY on the provided text, generate exactly ${numQuestions} ${difficulty} difficulty ${questionTypes} questions. Focus on the most important concepts and information in the text.`;

  // Detailed JSON schema instructions
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
      "question_type": "MULTIPLE_CHOICE",
      "options": [string, string, string, string], // Exactly 4 options
      "correct_answer": string, // MUST exactly match one of the options
      "explanation": string
    },
    {
      "question_text": string,
      "question_type": "TRUE_FALSE",
      "correct_answer": "True" | "False",
      "explanation": string
    },
    {
      "question_text": string, // use "____" for the blank(s)
      "question_type": "FILL_IN_THE_BLANK",
      "correct_answer": string, // The word(s) that fit the blank
      "explanation": string
    },
    {
      "question_text": "Match the following items:",
      "question_type": "MATCHING",
      "prompts": ["Prompt 1", "Prompt 2", "Prompt 3"],
      "options": ["Answer 1", "Answer 2", "Answer 3"],
      // CRITICAL: "options" MUST correspond index-for-index with "prompts".
      // options[0] MUST be the correct answer for prompts[0].
      // options[1] MUST be the correct answer for prompts[1], etc.
      "correct_answer": "N/A",
      "explanation": "Explanation of the relationships."
    },
    {
      "question_text": "Arrange the following in the correct order:",
      "question_type": "ORDERING",
      "options": ["First Step", "Second Step", "Third Step"],
      // CRITICAL: The "options" array MUST be in the CORRECT logical order (e.g., chronological).
      // The frontend will shuffle them for the user.
      "correct_answer": "N/A",
      "explanation": "Explanation of the sequence."
    }
  ]
}`;
  return { system, user };
}

/**
 * Calls Gemini API to generate the quiz JSON.
 */
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

  // Basic cleanup (remove markdown backticks if present)
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
    // Attempt fallback parsing if the main parse fails
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (fallbackError) {
        throw new Error(
          'Failed to parse Gemini JSON response. The AI returned an invalid format.'
        );
      }
    } else {
      throw new Error(
        'Failed to parse Gemini JSON response. No valid JSON object found.'
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
    throw new Error(
      'Gemini returned invalid or empty data structure (missing title or questions array).'
    );
  }

  // Validate individual questions
  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    if (!q || !q.question_text || !q.question_type) {
      throw new Error(
        `Question ${
          i + 1
        } is missing required fields (question_text, question_type).`
      );
    }

    // specific validation for MULTIPLE_CHOICE
    if (
      q.question_type === 'MULTIPLE_CHOICE' &&
      (!Array.isArray(q.options) || q.options.length !== 4)
    ) {
      throw new Error(
        `Question ${i + 1} (MULTIPLE_CHOICE) must have exactly 4 options.`
      );
    }

    // specific validation for ORDERING
    if (
        q.question_type === 'ORDERING' &&
        (!Array.isArray(q.options) || q.options.length < 2)
      ) {
        throw new Error(
          `Question ${i + 1} (ORDERING) must have at least 2 options to order.`
        );
      }

    // specific validation for MATCHING
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
        } (MATCHING) must have parallel 'prompts' and 'options' arrays of the same length.`
      );
    }
  }

  return parsed as { title: string; questions: Question[] };
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // 1. Check AI Usage Limit
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

    // 2. Parse Input
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

    // 3. Call AI
    const quiz = await callGeminiForQuiz({
      text,
      numQuestions,
      difficulty,
      questionType,
    });

    // 4. Prepare Data for Prisma
    const questionsToCreate = quiz.questions.map((q) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      correct_answer: q.correct_answer || 'N/A', // Default for types where answer is structural
      // Ensure options/prompts are arrays or undefined (Prisma Json expects valid JSON types)
      options: Array.isArray(q.options) ? q.options : undefined,
      prompts: Array.isArray(q.prompts) ? q.prompts : undefined,
      explanation: q.explanation || '',
    }));

    // 5. Save to Database
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

    // 6. Update AI Usage Count
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
      return error; // Handles requireAuth errors
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