// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from "@google/generative-ai";
import { requireAuth } from '@/lib/auth';
// Use the admin client to call database functions
import { supabaseAdmin } from '@/lib/supabaseAdmin'; 
import { generateQueryEmbedding } from '@/lib/embedding'; // <-- NEW IMPORT

export const runtime = "nodejs";

const MODEL_NAME = "gemini-2.5-flash-lite"; //
const API_KEY = process.env.GOOGLE_AI_API_KEY || ""; //

const generationConfig = { /* ... */ }; //
const safetySettings = [ /* ... */ ]; //

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request); //
    const { history, message } = await request.json(); //

    if (!API_KEY) {
      throw new Error("Missing GOOGLE_AI_API_KEY environment variable"); //
    }

    // --- NEW RAG FLOW ---

    // 1. Get embedding for the user's question
    const queryEmbedding = await generateQueryEmbedding(message);

    // 2. Query Supabase for relevant chunks using the DB function
    const supabase = supabaseAdmin;
    const { data: chunks, error: rpcError } = await supabase.rpc('match_content_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7, // Adjust this threshold
        match_count: 5,       // Get top 5 matches
        p_user_id: user.id
    });

    if (rpcError) {
        console.error("Error matching chunks:", rpcError);
        throw new Error(`Failed to retrieve study materials: ${rpcError.message}`);
    }

    // 3. Create context string from relevant chunks
    let context = "--- START OF RELEVANT STUDY MATERIALS ---\n\n";
    if (chunks && chunks.length > 0) {
        chunks.forEach((chunk: any) => {
            context += `## Relevant Chunk:\n${chunk.content_chunk}\n\n`;
        });
    } else {
        context += "No specific study materials were found related to your question.\n";
    }
    context += "--- END OF RELEVANT STUDY MATERIALS ---";
    
    // --- END RAG FLOW ---

    const genAI = new GoogleGenerativeAI(API_KEY); //
    const model = genAI.getGenerativeModel({ model: MODEL_NAME }); //

    // 4. Create the strict prompt
    const chatHistory: Content[] = [
      {
        role: "user",
        // Updated prompt to use the *new* context
        parts: [{ text: `You are a helpful AI tutor for an app called QuizCraft. Your task is to answer the user's questions based ONLY on the provided "RELEVANT STUDY MATERIALS". Do not use any external knowledge. If the answer cannot be found in the materials, you MUST respond with: "I'm sorry, but I can't answer that question based on the relevant sections of your study materials."\n\n${context}` }],
      },
      {
        role: "model",
        parts: [{ text: "Of course! I'm ready to help you with your study materials. What's your question?" }], //
      },
      // Map the *provided* history, not the internal one we built
      ...history.map((msg: { role: 'user' | 'model', text: string }) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      })), //
    ];
    
    const chat = model.startChat({
      generationConfig,
      safetySettings,
      history: chatHistory,
    }); //

    const result = await chat.sendMessageStream(message); //

    // 5. Stream the response (same as before)
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
    }); //

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }); //

  } catch (error: any) {
    if (error instanceof Response) return error; //
    console.error("Error in /api/chat:", error); //
    return NextResponse.json(
      { success: false, error: error.message || "An internal server error occurred." },
      { status: 500 }
    ); //
  }
}