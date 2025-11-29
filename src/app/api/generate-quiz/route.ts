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

// --- 1. CONFIGURATION HELPER ---
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

// --- 2. INTELLIGENT PROMPT ENGINEERING ---
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
    ? 'MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_THE_BLANK, and MATCHING' 
    : questionType;

  // System Prompt: Instructions on HOW to think
  const system = `You are an expert educational AI. 
  
  **Your Process:**
  1. **Topic Extraction:** First, silently read the text and identify the core concepts, themes, and key facts ("The Topics").
  2. **Question Generation:** Generate exactly ${numQuestions} questions that test understanding of these specific Topics.
  
  **Guidelines:**
  - **Understand, Don't just Quote:** Questions should test if the user understands the *meaning* of the topic, not just word-matching.
  - **Contextual:** Use "Fill in the Blank" for key terminology. Use "Matching" for definitions or relationships.
  - **Difficulty:** ${difficulty} (Adjust complexity of scenarios accordingly).
  - **Distribution:** Ensure questions cover the identified topics evenly.`;

  // User Prompt: The Content and Output Format
  const user = `Content to Analyze:
  """
  ${text}
  """

  Task: Generate a ${numQuestions}-question quiz (${difficulty}) covering: ${typeStr}.
  
  Return strictly valid JSON with this exact schema:
  {
    "title": "A descriptive title based on the Identified Topics",
    "questions": [
      {
        "question_text": "The question or scenario...",
        "question_type": "MULTIPLE_CHOICE",
        "options": ["Correct Answer", "Distractor 1", "Distractor 2", "Distractor 3"],
        "correct_answer": "Correct Answer",
        "explanation": "Why this is correct..."
      },
      {
        "question_text": "True or False statement...",
        "question_type": "TRUE_FALSE",
        "correct_answer": "True",
        "explanation": "..."
      },
      {
        "question_text": "The missing term is ____.",
        "question_type": "FILL_IN_THE_BLANK",
        "options": ["term"],
        "correct_answer": "term",
        "explanation": "..."
      },
      {
        "question_text": "Match the following:",
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

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error("Invalid JSON from AI");
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error("Invalid Data Structure: 'questions' array missing.");
  }

  // Sanitize and Validate
  const sanitizedQuestions = parsed.questions.map((q: any, i: number) => {
    if (!q.question_text || !q.question_type || !q.correct_answer) {
      throw new Error(`Question ${i + 1} missing required fields.`);
    }

    // 1. Multiple Choice Safety
    if (q.question_type === 'MULTIPLE_CHOICE') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(`Question ${i + 1} (Multiple Choice) must have options.`);
      }
      if (!q.options.includes(q.correct_answer)) {
        q.options[0] = q.correct_answer; // Auto-fix
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
       const ans = String(q.correct_answer).toLowerCase();
       q.correct_answer = ans === 'true' ? 'True' : 'False';
       q.options = ['True', 'False'];
    }

    return {
      ...q,
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
             question_type: q.question_type, 
             correct_answer: q.correct_answer,
             options: q.options as any, 
             prompts: q.prompts as any,
             explanation: q.explanation
          }))
        }
      },
      select: { id: true, title: true, questions: true }
    });

    await incrementAIGenerationUsage(user.id, 1);
    
    return NextResponse.json({ success: true, ...saved });

  } catch (error: any) {
    console.error("Quiz Gen Error:", error);
    const msg = error.message.includes("Usage") ? error.message : "Failed to generate quiz";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}