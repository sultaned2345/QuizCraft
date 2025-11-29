// src/app/api/generate-pop-quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, Question } from '@/types/database';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateQueryEmbedding } from '@/lib/embedding';

export const runtime = 'nodejs';

const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.5-flash-lite";

interface PopQuizResponse {
  questions: Omit<Question, 'id' | 'quiz_id' | 'created_at'>[];
}

function buildPopQuizPrompt(text: string): string {
  const numQuestions = 5;

  return `You are creating a quick pop quiz. 
Based ONLY on the snippets below, generate exactly ${numQuestions} questions.
The questions should be MULTIPLE_CHOICE or TRUE_FALSE.
For each question, provide a short explanation.

Content Snippets:
"""
${text}
"""

Return ONLY valid JSON:
{
  "questions": [
    {
      "question_text": "string",
      "question_type": "MULTIPLE_CHOICE" | "TRUE_FALSE",
      "options": ["A", "B", "C", "D"], // or ["True", "False"]
      "correct_answer": "string",
      "explanation": "string"
    }
  ]
}`;
}

export async function POST(request: NextRequest) {
  if (!API_KEY) return NextResponse.json<ApiResponse>({ success: false, error: 'AI not configured.' }, { status: 500 });

  try {
    const user = await requireAuth(request);
    const { documentId } = await request.json();

    if (!documentId) return NextResponse.json<ApiResponse>({ success: false, error: 'Missing documentId' }, { status: 400 });

    const doc = await prisma.documents.findFirst({
      where: { id: documentId, user_id: user.id },
      select: { extracted_text: true, ai_insights: true, file_name: true }
    });

    if (!doc) return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found.' }, { status: 404 });

    // --- RAG STRATEGY ---
    // 1. Determine what to search for
    let searchQueries = ["Summary", "Key Points", "Important Facts"];
    const insights = doc.ai_insights as any;
    if (insights && insights.keyConcepts && Array.isArray(insights.keyConcepts)) {
        searchQueries = insights.keyConcepts.slice(0, 3); // Top 3 concepts
    }

    // 2. Generate Embeddings & Search
    const embeddings = await Promise.all(searchQueries.map(q => generateQueryEmbedding(q)));
    
    const chunkPromises = embeddings.map(emb =>
        supabaseAdmin.rpc('match_content_chunks', {
            query_embedding: emb,
            match_threshold: 0.5,
            match_count: 2, // 2 chunks per concept -> ~6 chunks total
            p_user_id: user.id,
            p_content_id: documentId
        })
    );
    const chunkResults = await Promise.all(chunkPromises);
    const allChunks = chunkResults.flatMap(res => res.data || []);

    // 3. Fallback to raw text if no chunks found (e.g. embeddings not ready yet)
    let contextText = "";
    if (allChunks.length > 0) {
        const uniqueChunks = [...new Map(allChunks.map(c => [c.content_chunk, c])).values()];
        contextText = uniqueChunks.map(c => c.content_chunk).join("\n\n---\n\n");
    } else {
        // Fallback: Just take the first 15k chars of the file if RAG fails
        // This ensures the user still gets a quiz even if embeddings aren't ready.
        if (doc.extracted_text) {
             contextText = doc.extracted_text.substring(0, 15000);
        } else {
             throw new Error("No text content available.");
        }
    }

    // 4. Generate
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: AI_MODEL_NAME,
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
    });

    const prompt = buildPopQuizPrompt(contextText);
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

    // 5. Format & Return
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
    console.error('Pop Quiz Error:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: error.message || 'Failed to generate quiz.' }, { status: 500 });
  }
}