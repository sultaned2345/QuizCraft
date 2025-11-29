// src/app/api/generate-pop-quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, Question } from '@/types/database';

export const runtime = 'nodejs';

const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.5-flash-lite";

// 500k char limit
const MAX_CONTEXT_LENGTH = 500000;

interface PopQuizResponse {
  questions: Omit<Question, 'id' | 'quiz_id' | 'created_at'>[];
}

function buildPopQuizPrompt(text: string, topics: string[]): string {
  const topicList = topics.join(', ');
  const numQuestions = 5;

  const system = `You are an expert professor creating a challenging pop quiz. 
  
  Instructions:
  1. Based ONLY on the provided text, generate exactly ${numQuestions} questions.
  2. Questions should test **comprehension and analysis**, not just keyword matching.
  3. **Distractors (wrong answers) MUST be plausible** and derived from the text context. Do NOT use obvious wrong answers.
  4. ${topicList ? `Focus on these specific topics: ${topicList}.` : ''}
  5. Provide a clear explanation for the correct answer.`;

  const user = `Generate ${numQuestions} high-quality quiz questions.

Content:
"""
${text}
"""

Return ONLY valid JSON:
{
  "questions": [
    {
      "question_text": "string",
      "question_type": "MULTIPLE_CHOICE" | "TRUE_FALSE",
      "options": ["Option A", "Option B", "Option C", "Option D"], 
      "correct_answer": "string", // Must match one option exactly
      "explanation": "string"
    }
  ]
}`;
  return `${system}\n\n${user}`;
}

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'AI is not configured.' }, { status: 500 });
  }

  try {
    const user = await requireAuth(request);
    const { documentId } = await request.json();

    if (!documentId) return NextResponse.json<ApiResponse>({ success: false, error: 'Missing documentId' }, { status: 400 });

    const doc = await prisma.documents.findFirst({
      where: { id: documentId, user_id: user.id },
      select: { extracted_text: true, ai_insights: true }
    });

    if (!doc || !doc.extracted_text) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Document text not found.' }, { status: 404 });
    }

    const topics = (doc.ai_insights as any)?.examQuestions || [];
    
    // Use Full Text (up to limit)
    let safeText = doc.extracted_text;
    if (safeText.length > MAX_CONTEXT_LENGTH) {
        safeText = safeText.substring(0, MAX_CONTEXT_LENGTH);
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: AI_MODEL_NAME,
      generationConfig: {
        temperature: 0.3, // Lower temperature = more precise
        responseMimeType: 'application/json',
      },
    });

    const prompt = buildPopQuizPrompt(safeText, topics);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    let parsed: PopQuizResponse;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        const cleaned = content.replace(/```json|```/g, '');
        parsed = JSON.parse(cleaned);
    }

    if (!parsed.questions || parsed.questions.length === 0) {
      throw new Error("AI failed to generate pop quiz questions.");
    }
    
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