// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from "@google/generative-ai";
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; 
import { generateQueryEmbedding } from '@/lib/embedding';
import { prisma } from '@/lib/prisma'; // <-- 1. IMPORT PRISMA

export const runtime = "nodejs";

const MODEL_NAME = "gemini-2.5-flash-lite";
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";

// --- 2. DEFINE CONTEXT TYPE ---
interface PageContext {
  type: 'quiz' | 'essay' | 'page';
  id?: string;
  name?: string;
}

const generationConfig = { /* ... (no changes) ... */ };
const safetySettings = [ /* ... (no changes) ... */ ];
interface AISource {
  content_id: string;
  content_type: 'note' | 'document';
  content_title: string;
  citation: number;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    // 3. PARSE CONTEXT FROM BODY
    const { history, message, context } = await request.json() as { 
      history: Content[], 
      message: string, 
      context?: PageContext 
    };

    if (!API_KEY) {
      throw new Error("Missing GOOGLE_AI_API_KEY environment variable");
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    let chatHistory: Content[] = [];
    let systemPrompt: string = "";
    let sources: AISource[] = [];
    
    // --- 4. NEW LOGIC BRANCHING ---
    if (context?.type === 'quiz' && context.id) {
      // --- BRANCH A: QUIZ REFINEMENT ---
      console.log(`[Chat API] Handling Quiz Refinement for quiz: ${context.id}`);
      
      const quiz = await prisma.quiz.findFirst({
        where: { id: context.id, userId: user.id },
        include: { questions: true }
      });

      if (!quiz) {
        throw new Error("Quiz not found or access denied.");
      }

      // Note: We stream text back, but the AI is instructed to create JSON *within* the text.
      systemPrompt = `You are an expert quiz editor. The user is editing their quiz and has a request.
Given the user's request, analyze the provided quiz JSON.
Your response MUST be a conversational message that CONTAINS a single valid JSON block for *only* the question that needs to be updated or added.
If the user asks to "make question 3 harder," modify the question at index 2.
If the user asks to "add a new question," generate one new question object.
The JSON block must be in this *exact* shape:
{
  "question_text": string,
  "question_type": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_IN_THE_BLANK",
  "options": string[] | null,
  "correct_answer": string,
  "explanation": string | null
}
Example response: "Sure! Here is the updated question 3 as a True/False question:\n\n\`\`\`json\n{ "question_text": "...", ... }\n\`\`\`"
If the request is conversational (e.g., "how are you?"), just respond normally without any JSON.`;
      
      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "I'm ready to help you edit this quiz. What would you like to change?" }] },
        { role: "user", parts: [{ text: `Here is the current quiz JSON for context:\n${JSON.stringify(quiz)}\n\nMy request is: ${message}` }] }
      ];
      
      // This branch will stream text, including the JSON block
      const chat = model.startChat({
        generationConfig: { ...generationConfig, responseMimeType: "text/plain" }, // Override to plain text
        safetySettings,
        history: chatHistory,
      });

      const result = await chat.sendMessageStream(message); // Use the user's message as the final prompt
      
      return new Response(result.stream, {
        headers: { 
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Ai-Sources': '[]', // No RAG sources for this
        },
      });

    } else if (context?.type === 'essay' && context.id) {
      // --- BRANCH B: ESSAY FOLLOW-UP ---
      console.log(`[Chat API] Handling Essay Follow-up for essay: ${context.id}`);
      
      const gradedEssay = await prisma.graded_essays.findFirst({
        where: { id: context.id, user_id: user.id }
      });

      if (!gradedEssay) {
        throw new Error("Graded essay not found or access denied.");
      }

      systemPrompt = `You are a helpful writing tutor. The user has just received AI-generated feedback on their essay and has a follow-up question.
Use the provided original essay and its feedback to answer the user's question conversationally.
DO NOT mention the JSON. Just act as the tutor who provided the original feedback.

--- ORIGINAL ESSAY ---
${gradedEssay.essay_content}
---
--- ORIGINAL FEEDBACK ---
${JSON.stringify(gradedEssay.feedback)}
---
--- (The user's previous chat history is below, followed by their new question) ---
`;
      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "I see you've reviewed my feedback on your essay. What follow-up questions do you have?" }] },
        ...history.map((msg: { role: 'user' | 'model', text: string }) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
      ];
      // This branch falls through to the common streaming logic

    } else {
      // --- BRANCH C: DEFAULT RAG (Retrieval-Augmented Generation) ---
      console.log(`[Chat API] Handling Default RAG for user: ${user.id}`);
      
      const queryEmbedding = await generateQueryEmbedding(message);
      const { data: chunks, error: rpcError } = await supabaseAdmin.rpc('match_content_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: 5,
          p_user_id: user.id
      });
      if (rpcError) throw new Error(`Failed to retrieve study materials: ${rpcError.message}`);

      let contextString = "--- START OF RELEVANT STUDY MATERIALS ---\n\n";
      if (chunks && chunks.length > 0) {
          chunks.forEach((chunk: any, index: number) => {
              const citation = index + 1;
              contextString += `[${citation}] Source (Title: ${chunk.content_title || 'Untitled'}):\n`;
              contextString += `${chunk.content_chunk}\n\n`;
              sources.push({
                  content_id: chunk.content_id,
                  content_type: chunk.content_type,
                  content_title: chunk.content_title || 'Untitled',
                  citation: citation,
              });
          });
      } else {
          contextString += "No specific study materials were found related to your question.\n";
      }
      contextString += "--- END OF RELEVANT STUDY MATERIALS ---";

      systemPrompt = `You are a helpful AI tutor for an app called QuizCraft. Your task is to answer the user's questions based ONLY on the provided "RELEVANT STUDY MATERIALS". 
- Do not use any external knowledge. 
- You MUST cite your sources by adding the citation number (e.g., [1], [2]) at the end of the sentence or paragraph that uses that source.
- If the answer cannot be found in the materials, you MUST respond with: "I'm sorry, but I can't answer that question based on the relevant sections of your study materials."

${contextString}`;

      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Of course! I'm ready to help you with your study materials. What's your question?" }] },
        ...history.map((msg: { role: 'user' | 'model', text: string }) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
      ];
      // This branch falls through to the common streaming logic
    }

    // --- 5. COMMON STREAMING LOGIC (for RAG and Essay Follow-up) ---
    const chat = model.startChat({
      generationConfig: { ...generationConfig, responseMimeType: "text/plain" },
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
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Ai-Sources': JSON.stringify(sources), // Send sources (empty for essay, populated for RAG)
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