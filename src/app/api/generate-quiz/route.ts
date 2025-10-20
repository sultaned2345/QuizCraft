import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse-fork";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Question, QuestionType } from "@/types/database";

export const runtime = "nodejs"; // Required for pdf-parse (Node APIs)

type Difficulty = "easy" | "medium" | "hard";
type QuestionTypeOption = QuestionType | 'MIXED';

function parseQuery(request: NextRequest): { numQuestions: number; difficulty: Difficulty; questionType: QuestionTypeOption; immediateFeedback: boolean } {
  const { searchParams } = new URL(request.url);
  const numQuestionsParam = Number(searchParams.get("numQuestions") ?? "10");
  const difficultyParam = (searchParams.get("difficulty") as Difficulty) ?? "medium";
  const questionTypeParam = (searchParams.get("questionType") as QuestionTypeOption) ?? "MIXED";
  const immediateFeedbackParam = searchParams.get("immediateFeedback") !== 'false'; // Default to true if not specified

  const numQuestions = Number.isFinite(numQuestionsParam)
    ? Math.min(15, Math.max(5, numQuestionsParam))
    : 10;

  const difficulty: Difficulty = ["easy", "medium", "hard"].includes(difficultyParam)
    ? difficultyParam
    : "medium";

  const questionType: QuestionTypeOption = ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_IN_THE_BLANK", "MATCHING", "MIXED"].includes(questionTypeParam)
    ? questionTypeParam
    : "MIXED";

  return { numQuestions, difficulty, questionType, immediateFeedback: immediateFeedbackParam };
}

async function readMultipartOrText(request: NextRequest): Promise<{ text: string; sourceType: "text" | "file"; }> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const textField = (form.get("text") as string) || "";
    const file = form.get("file") as File | null;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.byteLength > 3 * 1024 * 1024) {
        throw new Error("File exceeds 3MB limit");
      }
      let extracted = "";
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const pdfData = await pdfParse(buffer);
        extracted = pdfData.text || "";
      } else if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
        extracted = buffer.toString("utf8");
      } else {
        throw new Error("Unsupported file type. Please upload PDF or TXT.");
      }

      const combined = `${textField}\n${extracted}`.trim();
      return { text: combined, sourceType: "file" };
    }

    return { text: textField.trim(), sourceType: "text" };
  }

  const rawText = await request.text();
  return { text: rawText.trim(), sourceType: "text" };
}

function buildPrompt({ text, numQuestions, difficulty, questionType }: { text: string; numQuestions: number; difficulty: Difficulty; questionType: QuestionTypeOption }) {
    const questionTypes = questionType === 'MIXED'
      ? 'MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_THE_BLANK, and MATCHING'
      : questionType;

    const system = `You are an expert quiz creator. Based on the provided text, generate ${questionTypes} questions. Focus on the most important concepts and information in the text. For each question, provide a brief explanation for the correct answer.`;

    const user = `Generate ${numQuestions} ${difficulty} difficulty quiz questions of the following type(s): ${questionTypes}, based on the content below.

Content:
"""
${text}
"""

Return ONLY valid JSON with this exact shape:
{
  "title": string, // a concise quiz title
  "questions": [
    {
      "question_text": string,
      "question_type": "MULTIPLE_CHOICE",
      "options": [string, string, string, string],
      "correct_answer": string, // must exactly match one of the options
      "explanation": string // explanation for the correct answer
    },
    {
      "question_text": string,
      "question_type": "TRUE_FALSE",
      "correct_answer": "True" | "False",
      "explanation": string
    },
    {
      "question_text": string, // use "____" for the blank
      "question_type": "FILL_IN_THE_BLANK",
      "correct_answer": string,
      "explanation": string
    },
    {
      "question_text": "Match the following items.",
      "question_type": "MATCHING",
      "prompts": [string], // The items to be matched (e.g., ["Term A", "Term B"])
      "options": [string], // The corresponding definitions or values (e.g., ["Definition 1", "Definition 2"])
      "correct_answer": string, // A JSON string of an object mapping prompts to options, e.g., '{"Term A": "Definition 1", "Term B": "Definition 2"}'
      "explanation": string
    }
  ]
}`;
    return { system, user };
}

async function callGeminiForQuiz({ text, numQuestions, difficulty, questionType }: { text: string; numQuestions: number; difficulty: Difficulty, questionType: QuestionTypeOption }): Promise<{ title: string; questions: Question[] }> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("Missing GOOGLE_AI_API_KEY environment variable");
  }

  const { system, user } = buildPrompt({ text, numQuestions, difficulty, questionType });

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
    }
  });

  const prompt = `${system}\n\n${user}`;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const content = response.text();

  if (!content) {
    throw new Error("Empty response from Gemini");
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
    console.error("Failed to parse Gemini response:", cleanedContent.substring(0, 500));
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (fallbackError) {
        throw new Error("Failed to parse Gemini JSON response. The AI returned an invalid format.");
      }
    } else {
      throw new Error("Failed to parse Gemini JSON response. No valid JSON found in response.");
    }
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error("Gemini returned invalid or empty data structure.");
  }

  // Basic validation of the generated questions
  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    if (!q.question_text || !q.question_type || !q.correct_answer) {
        throw new Error(`Question ${i + 1} is missing required fields.`);
    }
    if (q.question_type === 'MULTIPLE_CHOICE' && (!Array.isArray(q.options) || q.options.length < 2)) {
        throw new Error(`Question ${i + 1} (MULTIPLE_CHOICE) must have at least 2 options.`);
    }
    if (q.question_type === 'MULTIPLE_CHOICE' && !q.options.includes(q.correct_answer)) {
        throw new Error(`Question ${i + 1} (MULTIPLE_CHOICE): correct_answer must match one of the options exactly.`);
    }
    if (q.question_type === 'MATCHING' && (!Array.isArray(q.prompts) || !Array.isArray(q.options))) {
        throw new Error(`Question ${i + 1} (MATCHING) must have prompts and options arrays.`);
    }
  }

  return parsed as { title: string; questions: Question[] };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { numQuestions, difficulty, questionType, immediateFeedback } = parseQuery(request);
    const { text } = await readMultipartOrText(request);

    if (!text) {
      return NextResponse.json({ error: "No input provided" }, { status: 400 });
    }

    const quiz = await callGeminiForQuiz({ text, numQuestions, difficulty, questionType });

    const saved = await prisma.quiz.create({
      data: {
        title: quiz.title || "Generated Quiz",
        is_public: false,
        immediate_feedback: immediateFeedback,
        questions: {
          create: quiz.questions.map((q) => ({
            question_text: q.question_text,
            question_type: q.question_type,
            correct_answer: q.correct_answer,
            options: q.options || [],
            prompts: q.prompts || [],
            explanation: q.explanation || "",
          })),
        },
        userId: user.id,
      },
    });

    return NextResponse.json({
      id: saved.id,
      title: saved.title,
      questions: quiz.questions,
      createdAt: saved.createdAt
    });
  } catch (error: any) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Quiz generation error details:", error);
    const message = error?.message || "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}