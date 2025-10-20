import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from "@google/generative-ai";
import { requireAuth } from '@/lib/auth';
import { supabaseHelpers } from '@/lib/supabase';

export const runtime = "nodejs";

// Use the gemini-2.5-flash-lite model as requested
const MODEL_NAME = "gemini-2.5-flash-lite";
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";

const generationConfig = {
  temperature: 0.5, // Lower temperature for more factual, context-based answers
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { history, message } = await request.json();

    if (!API_KEY) {
      throw new Error("Missing GOOGLE_AI_API_KEY environment variable");
    }

    // 1. Fetch user's study materials (notes and quizzes)
    const [notes, quizzes] = await Promise.all([
      supabaseHelpers.getNotes(user.id),
      supabaseHelpers.getQuizzes(user.id),
    ]);

    // 2. Create a context string from the materials
    let context = "--- START OF STUDY MATERIALS ---\n\n";
    notes.forEach(note => {
        context += `## Note: ${note.title}\n${note.content}\n\n`;
    });
    quizzes.forEach(quiz => {
        context += `## Quiz: ${quiz.title}\n`;
        // Ensure questions is an array before iterating
        if (Array.isArray(quiz.questions)) {
            quiz.questions.forEach((q: any) => {
                context += `- ${q.question_text} (Answer: ${q.correct_answer})\n`;
            });
        }
        context += "\n";
    });
    context += "--- END OF STUDY MATERIALS ---";

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // 3. Create the strict prompt to limit the AI to the provided context
    const chatHistory: Content[] = [
      {
        role: "user",
        parts: [{ text: `You are a helpful AI tutor for an app called QuizCraft. Your task is to answer the user's questions based ONLY on the provided study materials. Do not use any external knowledge. If the answer cannot be found in the materials, you MUST respond with: "I'm sorry, but I can't answer that question as it's not covered in your study materials."\n\n${context}` }],
      },
      {
        role: "model",
        parts: [{ text: "Of course! I'm ready to help you with your study materials. What's your question?" }],
      },
      ...history.map((msg: { role: 'user' | 'model', text: string }) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      })),
    ];
    
    const chat = model.startChat({
      generationConfig,
      safetySettings,
      history: chatHistory,
    });

    const result = await chat.sendMessageStream(message);

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          try {
            const chunkText = chunk.text();
            controller.enqueue(new TextEncoder().encode(chunkText));
          } catch (e) {
            console.error('Error processing stream chunk', e);
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error("Error in /api/chat:", error);
    return NextResponse.json(
      { success: false, error: error.message || "An internal server error occurred." },
      { status: 500 }
    );
  }
}