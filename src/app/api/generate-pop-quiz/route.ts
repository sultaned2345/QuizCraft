// src/app/api/generate-pop-quiz/route.ts
// NEW FILE

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, Question } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.5-flash-lite";

// Simplified type for the AI response
interface PopQuizResponse {
  questions: Omit<Question, 'id' | 'quiz_id' | 'created_at'>[];
}

function buildPopQuizPrompt(text: string, topics: string[]): string {
  const topicList = topics.join(', ');
  const numQuestions = Math.min(topics.length, 5); // Max 5 questions

  const system = `You are an expert quiz creator. Based ONLY on the provided text, generate exactly ${numQuestions} questions.
The questions should be MULTIPLE_CHOICE or TRUE_FALSE.
Crucially, you MUST focus on the following topics/questions: ${topicList}.
For each question, provide an explanation for the correct answer derived strictly from the text.`;

  const user = `Generate ${numQuestions} quiz questions based *only* on the content below, focusing on these topics: ${topicList}

Content:
"""
${text}
"""

Return ONLY valid JSON with this exact shape:
{
  "questions": [
    {
      "question_text": string,
      "question_type": "MULTIPLE_CHOICE" | "TRUE_FALSE",
      "options": [string, string, string, string] | ["True", "False"],
      "correct_answer": string,
      "explanation": string
    }
  ]
}`;
  return `${system}\n\n${user}`;
}

// POST /api/generate-pop-quiz
// Body: { documentId: string }
export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'AI is not configured.' }, { status: 500 });
  }

  try {
    const user = await requireAuth(request);
    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing documentId' }, { status: 400 });
    }

    // 1. Fetch document text and insights
    const doc = await prisma.documents.findFirst({
      where: { id: documentId, user_id: user.id },
      select: { extracted_text: true, ai_insights: true }
    });

    if (!doc) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found.' }, { status: 404 });
    }

    const text = doc.extracted_text;
    const insights = doc.ai_insights as any;
    const topics = insights?.examQuestions as string[] | undefined;

    if (!text || text.length < 50) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Document text is too short.' }, { status: 400 });
    }
    if (!topics || topics.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'No exam topics found in document insights.' }, { status: 400 });
    }

    // 2. Call AI
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: AI_MODEL_NAME,
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
      },
    });

    const prompt = buildPopQuizPrompt(text, topics);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    const parsed: PopQuizResponse = JSON.parse(content);

    if (!parsed.questions || parsed.questions.length === 0) {
      throw new Error("AI failed to generate pop quiz questions.");
    }
    
    // 3. Format into temporary Question objects (with fake IDs)
    const questions: Question[] = parsed.questions.map((q, i) => ({
      ...q,
      id: `temp-${i}`,
      quiz_id: 'temp-quiz',
      created_at: new Date().toISOString(),
      prompts: null,
      explanation: q.explanation || 'No explanation provided.',
      options: q.options || (q.question_type === 'TRUE_FALSE' ? ['True', 'False'] : []),
    }));

    return NextResponse.json<ApiResponse<{ questions: Question[] }>>({
      success: true,
      data: { questions },
    });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('Error generating pop quiz:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: error.message || 'Failed to generate pop quiz.' }, { status: 500 });
  }
}