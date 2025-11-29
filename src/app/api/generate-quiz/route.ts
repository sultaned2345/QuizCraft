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

// --- UPGRADED PROMPT LOGIC: BLOOM'S TAXONOMY ---
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

  const system = `You are an expert educational assessment specialist. Your goal is to generate "Higher-Order Thinking" quiz questions based ONLY on the provided text.

  STRICT GENERATION RULES:
  1. **Bloom's Taxonomy (Apply & Analyze)**: Do NOT generate simple definition questions (e.g., "What is X?"). Instead:
     - **Apply**: Present a scenario and ask how to use a concept to solve it.
     - **Analyze**: Show a code snippet or a process description and ask the user to identify a bug, a missing step, or the underlying principle.
     - **Evaluate**: Present two approaches and ask which is better for a specific goal.
  2. **Scenario-Based Questions**: Questions should start with a context (e.g., "A user reports error 500...", "In a React component...", "During mitosis...").
  3. **Plausible Distractors**: For Multiple Choice, incorrect options must be **common misconceptions** or "near-miss" answers, not random or obviously wrong fillers.
  4. **Code & Formatting**: If the input text is technical, you MUST use markdown code blocks (\`code\`) in the 'question_text' to present snippets for analysis.

  Generate exactly ${numQuestions} ${difficulty} difficulty ${questionTypes} questions.`;

  const user = `Generate ${numQuestions} ${difficulty} difficulty quiz questions of the following type(s): ${questionTypes}, based *only* on the content below.

Content:
"""
${text}
"""

Return ONLY valid JSON with this exact shape:
{
  "title": string, // a concise, scenario-focused title
  "questions": [
    {
      "question_text": string, // E.g., "Review the code below. What causes the memory leak?\n\n\`\`\`javascript\n...\n\`\`\`",
      "question_type": "MULTIPLE_CHOICE", 
      "options": [string, string, string, string], // 4 options
      "correct_answer": string, // Must match one option exactly
      "explanation": string // Explain WHY the correct answer works and WHY the others fail
    },
    {
      "question_text": string,
      "question_type": "TRUE_FALSE", 
      "correct_answer": "True" | "False",
      "explanation": string
    },
    {
      "question_text": string, // Use "____" for blanks
      "question_type": "FILL_IN_THE_BLANK",
      "correct_answer": string,
      "explanation": string
    },
    {
      "question_text": "Match the problem to its solution:",
      "question_type": "MATCHING", 
      "prompts": ["Problem A", "Problem B", "Problem C"], 
      "options": ["Solution A", "Solution B", "Solution C"], 
      "correct_answer": "N/A", 
      "explanation": "Explain the relationships."
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

  // Basic cleanup
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
        throw new Error('Failed to parse Gemini JSON response via fallback.');
      }
    } else {
      throw new Error('Failed to parse Gemini JSON response.');
    }
  }

  // Validate basic structure
  if (!parsed || typeof parsed !== 'object' || !parsed.title || !Array.isArray(parsed.questions)) {
    throw new Error('Gemini returned invalid data structure.');
  }

  // Validate individual questions
  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    if (!q.question_text || !q.question_type || !q.correct_answer) {
      throw new Error(`Question ${i + 1} is missing required fields.`);
    }
    if (q.question_type === 'MULTIPLE_CHOICE' && (!Array.isArray(q.options) || q.options.length !== 4)) {
      throw new Error(`Question ${i + 1} (MULTIPLE_CHOICE) must have exactly 4 options.`);
    }
    if (q.question_type === 'MATCHING' && (!Array.isArray(q.prompts) || !Array.isArray(q.options) || q.prompts.length !== q.options.length)) {
      throw new Error(`Question ${i + 1} (MATCHING) mismatched prompts/options.`);
    }
  }

  return parsed as { title: string; questions: Question[] };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Check Usage
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid || !usageCheck.canGenerate) {
      return NextResponse.json(
        { success: false, error: usageCheck.error, message: usageCheck.message },
        { status: 403 }
      );
    }

    const { numQuestions, difficulty, questionType, immediateFeedback } = parseQuery(request);
    const { text } = await readMultipartOrText(request);

    if (!text || text.length < 100) {
      return NextResponse.json(
        { success: false, error: 'Content is too short. Please provide at least 100 characters.' },
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
    if (error instanceof Response) return error;

    console.error('Quiz generation error:', error);
    const message = error?.message || 'Internal server error.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}