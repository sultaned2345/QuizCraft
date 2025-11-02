// file: src/app/api/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from "@google/generative-ai";
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; 
import { generateQueryEmbedding } from '@/lib/embedding';

export const runtime = "nodejs";

const MODEL_NAME = "gemini-2.5-flash-lite";
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";

const generationConfig = { /* ... */ };
const safetySettings = [ /* ... */ ];

// Define the source structure
interface AISource {
  content_id: string;
  content_type: 'note' | 'document';
  content_title: string;
  citation: number;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { history, message } = await request.json();

    if (!API_KEY) {
      throw new Error("Missing GOOGLE_AI_API_KEY environment variable");
    }

    // 1. Get embedding for the user's question
    const queryEmbedding = await generateQueryEmbedding(message);

    // 2. Query Supabase for relevant chunks using the DB function
    const supabase = supabaseAdmin;
    const { data: chunks, error: rpcError } = await supabase.rpc('match_content_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 5,
        p_user_id: user.id
    });

    if (rpcError) {
        console.error("Error matching chunks:", rpcError);
        throw new Error(`Failed to retrieve study materials: ${rpcError.message}`);
    }

    // 3. Create context string AND sources array
    let context = "--- START OF RELEVANT STUDY MATERIALS ---\n\n";
    const sources: AISource[] = [];
    
    if (chunks && chunks.length > 0) {
        // --- MODIFICATION: Build context with citations ---
        chunks.forEach((chunk: any, index: number) => {
            const citation = index + 1;
            context += `[${citation}] Source (Title: ${chunk.content_title || 'Untitled'}):\n`;
            context += `${chunk.content_chunk}\n\n`;
            
            // Add to sources array
            sources.push({
                content_id: chunk.content_id,
                content_type: chunk.content_type,
                content_title: chunk.content_title || 'Untitled',
                citation: citation,
            });
        });
    } else {
        context += "No specific study materials were found related to your question.\n";
    }
    context += "--- END OF RELEVANT STUDY MATERIALS ---";
    
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // 4. Create the strict prompt
    const chatHistory: Content[] = [
      {
        role: "user",
        // --- MODIFIED: Updated prompt to instruct AI to use citations ---
        parts: [{ text: `You are a helpful AI tutor for an app called QuizCraft. Your task is to answer the user's questions based ONLY on the provided "RELEVANT STUDY MATERIALS". 
- Do not use any external knowledge. 
- You MUST cite your sources by adding the citation number (e.g., [1], [2]) at the end of the sentence or paragraph that uses that source.
- If the answer cannot be found in the materials, you MUST respond with: "I'm sorry, but I can't answer that question based on the relevant sections of your study materials."

${context}` }],
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

    // 5. Stream the response
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

    // --- MODIFICATION: Return stream with custom header ---
    return new Response(stream, {
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Ai-Sources': JSON.stringify(sources), // Send sources as a header
      },
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