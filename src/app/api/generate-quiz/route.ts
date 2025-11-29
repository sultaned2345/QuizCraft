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

// --- 1. CONFIGURATION ---
function parseQuery(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return {
    numQuestions: Number(searchParams.get('numQuestions') ?? '10'),
    difficulty: (searchParams.get('difficulty') as Difficulty) ?? 'medium',
    questionType: (searchParams.get('questionType') as QuestionTypeOption) ?? 'MIXED',
    immediateFeedback: searchParams.get('immediateFeedback') !== 'false',
  };
}

async function readMultipartOrText(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    return { text: (form.get('text') as string).trim(), sourceType: 'text' };
  }
  return { text: (await req.text()).trim(), sourceType: 'text' };
}

// --- 2. PROMPT ENGINEERING (Natural & Smart) ---
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
  const typeStr = questionType === 'MIXED' 
    ? 'Multiple Choice, True/False, Fill-in-Blank, and Matching' 
    : questionType;

  const system = `You are a helpful tutor creating a practice quiz.
  
  Your goal is to test *understanding*, not just memorization.
  
  **Style Guidelines:**
  1. **Be Natural:** Use clear, conversational English. Avoid stiff academic phrasing.
  2. **Be Practical:** Wherever possible, frame questions as small "real world" scenarios (e.g. "You see this error...", "You need to fix X...").
  3. **No Trick Questions:** Distractors should be plausible common mistakes, not confusing word-play.
  4. **Code Snippets:** If the content is technical, include short code blocks (markdown) in the question text.

  Generate exactly ${numQuestions} ${difficulty} questions.`;

  const user = `Create a ${numQuestions}-question quiz (${difficulty} level) covering: ${typeStr}.
  Base it ONLY on the text below.

  Text Content:
  """
  ${text}
  """

  Return valid JSON matching this structure:
  {
    "title": "Short, catchy title",
    "questions": [
      {
        "question_text": "Scenario or Question here...",
        "question_type": "MULTIPLE_CHOICE",
        "options": ["Correct Answer", "Wrong 1", "Wrong 2", "Wrong 3"], // Exactly 4 options
        "correct_answer": "Correct Answer", // MUST match one option exactly
        "explanation": "Simple explanation of why this is correct."
      },
      {
        "question_text": "Statement...",
        "question_type": "TRUE_FALSE",
        "correct_answer": "True",
        "explanation": "..."
      },
      {
        "question_text": "The function used to print is ____.",
        "question_type": "FILL_IN_THE_BLANK",
        "options": ["console.log"], // Acceptable answer(s)
        "correct_answer": "console.log", // Primary answer
        "explanation": "..."
      },
      {
        "question_text": "Match the terms:",
        "question_type": "MATCHING",
        "prompts": ["Term A", "Term B"],
        "options": ["Def A", "Def B"],
        "correct_answer": "N/A",
        "explanation": "..."
      }
    ]
  }`;

  return { system, user };
}

// --- 3. AI GENERATION & VALIDATION ---
async function callGeminiForQuiz(params: any): Promise<{ title: string; questions: Question[] }> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash-lite',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.3 } 
  });

  const { system, user } = buildPrompt(params);
  const result = await model.generateContent(`${system}\n\n${user}`);
  const text = result.response.text();

  // Robust Parsing
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error("Invalid JSON from AI");
  }

  // --- RESTORED VALIDATION LOGIC ---
  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error("Invalid Data Structure: 'questions' array missing.");
  }

  // Sanitize and Validate each question
  const sanitizedQuestions = parsed.questions.map((q: any, i: number) => {
    // Basic Field Checks
    if (!q.question_text || !q.question_type || !q.correct_answer) {
      throw new Error(`Question ${i + 1} missing required fields.`);
    }

    // 1. Multiple Choice Safety
    if (q.question_type === 'MULTIPLE_CHOICE') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(`Question ${i + 1} (Multiple Choice) must have options.`);
      }
      // Ensure correct answer is actually in the options
      if (!q.options.includes(q.correct_answer)) {
        // Auto-fix: Add correct answer if missing
        q.options[0] = q.correct_answer; 
      }
    }

    // 2. Matching Safety
    if (q.question_type === 'MATCHING') {
      if (!Array.isArray(q.prompts) || !Array.isArray(q.options) || q.prompts.length !== q.options.length) {
        throw new Error(`Question ${i + 1} (Matching) has mismatched prompts/options.`);
      }
    }

    // 3. True/False Safety
    if (q.question_type === 'TRUE_FALSE') {
       // Normalize to Title Case
       const ans = String(q.correct_answer).toLowerCase();
       q.correct_answer = ans === 'true' ? 'True' : 'False';
       q.options = ['True', 'False'];
    }

    return {
      ...q,
      // Fallbacks for optional fields to prevent null crashes
      explanation: q.explanation || "No explanation provided.",
      options: Array.isArray(q.options) ? q.options : [],
      prompts: Array.isArray(q.prompts) ? q.prompts : [],
    };
  });

  return { title: parsed.title || "Generated Quiz", questions: sanitizedQuestions };
}

// --- 4. ROUTE HANDLER ---
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    
    // Usage Check
    const usage = await checkAIGenerationUsageLimit(user.id);
    if (!usage.isValid) return NextResponse.json({ error: usage.error }, { status: 403 });

    // Input Parsing
    const params = parseQuery(req);
    const { text } = await readMultipartOrText(req);

    if (!text || text.length < 50) {
      return NextResponse.json({ error: 'Content too short' }, { status: 400 });
    }

    // Generate
    const quiz = await callGeminiForQuiz({ ...params, text });

    // Save to Database
    const saved = await prisma.quiz.create({
      data: {
        title: quiz.title,
        userId: user.id,
        immediate_feedback: params.immediateFeedback,
        questions: {
          create: quiz.questions.map(q => ({
             question_text: q.question_text,
             question_type: q.question_type, // Cast as QuestionType
             correct_answer: q.correct_answer,
             // Explicitly handle JSON types for Prisma
             options: q.options as any, 
             prompts: q.prompts as any,
             explanation: q.explanation
          }))
        }
      },
      select: { id: true, title: true, questions: true }
    });

    // Increment Usage
    await incrementAIGenerationUsage(user.id, 1);
    
    return NextResponse.json({ success: true, ...saved });

  } catch (error: any) {
    console.error("Quiz Gen Error:", error);
    // Safe error message to client
    const msg = error.message.includes("Usage") ? error.message : "Failed to generate quiz";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}