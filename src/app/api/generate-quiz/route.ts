import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse-fork";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs"; // Required for pdf-parse (Node APIs)

type Difficulty = "easy" | "medium" | "hard";

function parseQuery(request: NextRequest): { numQuestions: number; difficulty: Difficulty } {
  const { searchParams } = new URL(request.url);
  const numQuestionsParam = Number(searchParams.get("numQuestions") ?? "10");
  const difficultyParam = (searchParams.get("difficulty") as Difficulty) ?? "medium";

  const numQuestions = Number.isFinite(numQuestionsParam)
    ? Math.min(15, Math.max(5, numQuestionsParam))
    : 10;

  const difficulty: Difficulty = ["easy", "medium", "hard"].includes(difficultyParam)
    ? difficultyParam
    : "medium";

  return { numQuestions, difficulty };
}

async function readMultipartOrText(request: NextRequest): Promise<{ text: string; sourceType: "text" | "file"; }> {
  const contentType = request.headers.get("content-type") || "";

  // If multipart, expect field names: file (optional), text (optional)
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

  // Otherwise, treat as raw text body
  const rawText = await request.text();
  return { text: rawText.trim(), sourceType: "text" };
}

function buildPrompt({ text, numQuestions, difficulty }: { text: string; numQuestions: number; difficulty: Difficulty }) {
  const system = `You are an assistant that generates high-quality multiple-choice quiz questions based strictly on the provided source content.`;
  const user = `Generate ${numQuestions} ${difficulty} difficulty multiple-choice questions based on the content below.

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
      "options": [string, string, string, string],
      "correct_answer": string // must exactly match one of the options
    }
  ]
}`;
  return { system, user };
}

async function callGeminiForQuiz({ text, numQuestions, difficulty }: { text: string; numQuestions: number; difficulty: Difficulty }) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("Missing GOOGLE_AI_API_KEY environment variable");
  }

  const { system, user } = buildPrompt({ text, numQuestions, difficulty });

  // Get the Gemini 2.5 Flash-Lite model
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

  // Clean the response - remove markdown code blocks if present
  let cleanedContent = content.trim();
  
  // Remove markdown code blocks (```json ... ``` or ``` ... ```)
  if (cleanedContent.startsWith('```')) {
    cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/i, '');
    cleanedContent = cleanedContent.replace(/\n?```\s*$/, '');
    cleanedContent = cleanedContent.trim();
  }

  // Try to parse the JSON
  let parsed: any;
  try {
    parsed = JSON.parse(cleanedContent);
  } catch (parseError) {
    console.error("Failed to parse Gemini response:", cleanedContent.substring(0, 500));
    
    // Try to extract JSON from the response using regex as fallback
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

  // Validate the parsed response
  if (!parsed || typeof parsed !== 'object') {
    throw new Error("Gemini returned invalid data structure");
  }

  if (!Array.isArray(parsed.questions)) {
    throw new Error("Gemini response missing 'questions' array");
  }

  if (parsed.questions.length === 0) {
    throw new Error("Gemini returned zero questions. Please try with different content.");
  }

  // Validate each question has required fields
  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    if (!q.question_text || !Array.isArray(q.options) || !q.correct_answer) {
      throw new Error(`Question ${i + 1} is missing required fields (question_text, options, or correct_answer)`);
    }
    if (q.options.length < 2) {
      throw new Error(`Question ${i + 1} must have at least 2 options`);
    }
    if (!q.options.includes(q.correct_answer)) {
      throw new Error(`Question ${i + 1}: correct_answer must match one of the options exactly`);
    }
  }

  return parsed as { title: string; questions: Array<{ question_text: string; options: string[]; correct_answer: string }>; };
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);
    
    const { numQuestions, difficulty } = parseQuery(request);
    const { text, sourceType } = await readMultipartOrText(request);

    if (!text) {
      return NextResponse.json({ error: "No input provided" }, { status: 400 });
    }

    //... inside the POST function in src/app/api/generate-quiz/route.ts

const quiz = await callGeminiForQuiz({ text, numQuestions, difficulty });

// Save to DB (Prisma)
const saved = await prisma.quiz.create({
  data: {
    title: quiz.title || "Generated Quiz",
    questions: {
      create: quiz.questions.map((q) => ({
        // FIX: Use the correct property names from the AI response
        question_text: q.question_text,
        correct_answer: q.correct_answer,
        options: q.options,
      })),
    },
    userId: user.id,
  },
});

//...

    return NextResponse.json({ 
      id: saved.id, 
      title: saved.title, 
      questions: quiz.questions, 
      sourceType: saved.sourceType, 
      createdAt: saved.createdAt 
    });
  } catch (error: any) {
    // Handle authentication errors
    if (error instanceof Response) {
      return error;
    }
    
    console.error("Quiz generation error details:", error);
    const message = error?.message || "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}