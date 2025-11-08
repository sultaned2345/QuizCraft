// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  Content,
  SchemaType,
  FunctionDeclaration,
  Part,
} from "@google/generative-ai";
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; 
import { generateQueryEmbedding } from '@/lib/embedding';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const runtime = "nodejs";

const MODEL_NAME = "gemini-2.5-flash-lite";
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";

// Define the source structure
interface AISource {
  content_id: string;
  content_type: 'note' | 'document';
  content_title: string;
  citation: number;
  content_chunk: string;
}

// Define Context type
interface PageContext {
  type: 'quiz' | 'essay' | 'page' | 'document';
  id?: string;
  name?: string;
}

// Base generation config (can be overridden)
const generationConfig = {
  temperature: 0.6,
  topK: 1,
  topP: 1,
  maxOutputTokens: 4096,
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// --- (Tool Schemas and Handlers remain unchanged) ---
const tools: { spec: FunctionDeclaration }[] = [
  {
    spec: {
      name: "addQuestionToQuiz",
      description: "Adds a new question to a specific quiz.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          quizId: { type: SchemaType.STRING, description: "The ID of the quiz to add the question to." },
          question_text: { type: SchemaType.STRING },
          question_type: { 
            type: SchemaType.STRING,
            enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_IN_THE_BLANK", "MATCHING"]
          },
          options: { 
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            nullable: true,
            description: "For MULTIPLE_CHOICE or MATCHING. For FILL_IN_THE_BLANK, this is an array of acceptable answers."
          },
          prompts: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            nullable: true,
            description: "For MATCHING type only. The list of prompts."
          },
          correct_answer: { 
            type: SchemaType.STRING,
            description: "For MC, must be one of the options. For T/F, must be 'True' or 'False'. For FILL_IN_THE_BLANK, can be N/A. For MATCHING, can be N/A."
          },
          explanation: { type: SchemaType.STRING, nullable: true },
        },
        required: ["quizId", "question_text", "question_type", "correct_answer"]
      }
    }
  },
  {
    spec: {
      name: "updateQuestionInQuiz",
      description: "Updates an existing question in a quiz.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          questionId: { type: SchemaType.STRING, description: "The ID of the question to update." },
          newQuestionData: {
            type: SchemaType.OBJECT,
            description: "An object containing *only* the fields to be updated.",
            properties: {
              question_text: { type: SchemaType.STRING, nullable: true },
              options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
              prompts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
              correct_answer: { type: SchemaType.STRING, nullable: true },
              explanation: { type: SchemaType.STRING, nullable: true },
            }
          }
        },
        required: ["questionId", "newQuestionData"]
      }
    }
  },
  {
    spec: {
      name: "deleteQuestionFromQuiz",
      description: "Deletes a question from a quiz.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          questionId: { type: SchemaType.STRING, description: "The ID of the question to delete." }
        },
        required: ["questionId"]
      }
    }
  }
];

async function handleAddQuestionToQuiz(args: {
  quizId: string;
  question_text: string;
  question_type: any; // Type from schema
  options?: string[];
  prompts?: string[];
  correct_answer: string;
  explanation?: string;
}) {
  try {
    const newQuestion = await prisma.questions.create({
      data: {
        quiz_id: args.quizId,
        question_text: args.question_text,
        question_type: args.question_type,
        options: args.options || Prisma.JsonNull,
        prompts: args.prompts || Prisma.JsonNull,
        correct_answer: args.correct_answer,
        explanation: args.explanation || "",
      }
    });
    return { success: true, questionId: newQuestion.id, message: "Question added successfully." };
  } catch (e: any) {
    console.error("Error in handleAddQuestionToQuiz:", e);
    return { success: false, error: e.message || "Failed to add question to database." };
  }
}

async function handleUpdateQuestionInQuiz(args: {
  questionId: string;
  newQuestionData: {
    question_text?: string;
    options?: string[];
    prompts?: string[];
    correct_answer?: string;
    explanation?: string;
  }
}) {
  try {
    const { questionId, newQuestionData } = args;
    
    const dataToUpdate: Prisma.questionsUpdateInput = {};
    if (newQuestionData.question_text) dataToUpdate.question_text = newQuestionData.question_text;
    if (newQuestionData.options) dataToUpdate.options = newQuestionData.options;
    if (newQuestionData.prompts) dataToUpdate.prompts = newQuestionData.prompts;
    if (newQuestionData.correct_answer) dataToUpdate.correct_answer = newQuestionData.correct_answer;
    if (newQuestionData.explanation) dataToUpdate.explanation = newQuestionData.explanation;
    
    const updatedQuestion = await prisma.questions.update({
      where: { id: questionId },
      data: dataToUpdate
    });
    return { success: true, questionId: updatedQuestion.id, message: "Question updated successfully." };
  } catch (e: any) {
    console.error("Error in handleUpdateQuestionInQuiz:", e);
    return { success: false, error: e.message || "Failed to update question in database." };
  }
}

async function handleDeleteQuestionFromQuiz(args: { questionId: string }) {
  try {
    await prisma.questions.delete({
      where: { id: args.questionId }
    });
    return { success: true, questionId: args.questionId, message: "Question deleted successfully." };
  } catch (e: any) {
    console.error("Error in handleDeleteQuestionFromQuiz:", e);
    return { success: false, error: e.message || "Failed to delete question from database." };
  }
}

async function saveChatHistory(userId: string, role: 'user' | 'model', content: string, context?: PageContext | null) {
    if (!content.trim()) return; 
    try {
        await prisma.chat_history.create({
            data: {
                user_id: userId,
                role,
                content,
                context_id: context?.id || null, 
                context_type: context?.type || null, 
            }
        });
    } catch (e) {
        console.error("Failed to save chat history:", e);
    }
}


export async function POST(request: NextRequest) {
  let userMessageContent: string = "";
  let userId: string = "";
  let requestContext: PageContext | undefined | null = null; 

  try {
    const user = await requireAuth(request);
    userId = user.id; 
    const { history, message, context } = await request.json() as { 
      history: Content[], 
      message: string, 
      context?: PageContext 
    };
    userMessageContent = message; 
    requestContext = context; 

    if (!API_KEY) {
      throw new Error("Missing GOOGLE_AI_API_KEY environment variable");
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    
    let chatHistory: Content[] = [];
    let systemPrompt: string = "";
    let sources: AISource[] = [];
    let model: any; 
    
    if (context?.type === 'quiz' && context.id) {
      console.log(`[Chat API] Handling Quiz Refinement for quiz: ${context.id}`);
      
      await saveChatHistory(userId, 'user', message, context);

      const quiz = await prisma.quiz.findFirst({
        where: { id: context.id, userId: user.id },
        include: { questions: true }
      });

      if (!quiz) {
        throw new Error("Quiz not found or access denied.");
      }

      model = genAI.getGenerativeModel({ 
          model: MODEL_NAME, 
          generationConfig, 
          safetySettings,
          tools: [{ functionDeclarations: tools.map(t => t.spec) }]
      });

      systemPrompt = `You are an expert quiz editor. The user wants to modify their quiz.
Use the provided tools to add, update, or delete questions as requested.
The user's quiz JSON is provided below for context (including question IDs).
Always confirm the action you've taken (e.g., "I've updated question 2." or "I've added a new question.").
If the user's request is unclear (e.g., "delete question 10" on a 5-question quiz), ask for clarification instead of calling a tool.
Do not mention RAG or study materials. Your context is *only* this quiz.`;
      
      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "I'm ready to help you edit this quiz. The quiz JSON is loaded. What would you like to change?" }] },
        ...history.map((msg: { role: 'user' | 'model', text: string }) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
        { role: "user", parts: [{ text: `Here is the current quiz JSON for context:\n${JSON.stringify(quiz)}\n\nMy new request is: ${message}` }] }
      ];

    } else if (context?.type === 'document' && context.id) {
      console.log(`[Chat API] Handling Document-Specific RAG for doc: ${context.id}`);
      
      await saveChatHistory(userId, 'user', message, context); 
      
      model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig, safetySettings });

      const queryEmbedding = await generateQueryEmbedding(message);
      
      const { data: chunks, error: rpcError } = await supabaseAdmin.rpc('match_content_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: 0.7, 
          match_count: 5,
          p_user_id: user.id,
          p_content_id: context.id
      });

      if (rpcError) { 
        console.error("Error matching document chunks:", rpcError);
        throw new Error(`Failed to retrieve study materials: ${rpcError.message}`);
      }

      let contextString = `--- START: Relevant excerpts from document --- \n\n`;
      if (chunks && chunks.length > 0) {
          chunks.forEach((chunk: any, index: number) => {
              const citation = index + 1;
              contextString += `[${citation}] Excerpt (from ${chunk.content_title || 'Document'}):\n`;
              contextString += `${chunk.content_chunk}\n\n`;
              sources.push({
                  content_id: chunk.content_id,
                  content_type: chunk.content_type,
                  content_title: chunk.content_title || 'Document',
                  citation: citation,
                  content_chunk: chunk.content_chunk,
              });
          });
      } else {
          contextString += "No specific excerpts were found for your question in this document.\n";
      }
      contextString += "--- END: Relevant excerpts from document ---";

      systemPrompt = `You are a helpful AI tutor. Your task is to answer the user's questions based ONLY on the provided "RELEVANT EXCERPTS" from the document they are currently viewing.
- Do not use any external knowledge. 
- You MUST cite your sources by adding the citation number (e.g., [1], [2]) at the end of the sentence.
- If the answer cannot be found in the materials, you MUST respond with: "I'm sorry, but I can't answer that based on the provided excerpts from this document."

${contextString}`;

      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "I'm ready to answer questions about this document. What would you like to know?" }] },
        ...history.map((msg: { role: 'user' | 'model', text: string }) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
      ];
    } else if (context?.type === 'essay' && context.id) {
      console.log(`[Chat API] Handling Essay Follow-up for essay: ${context.id}`);

      await saveChatHistory(userId, 'user', message, context);
      
      model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig, safetySettings });

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
    } else {
      // --- BRANCH D: DEFAULT RAG (Retrieval-Augmented Generation) ---
      console.log(`[Chat API] Handling Default RAG for user: ${user.id}`);
      
      model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig, safetySettings });
      
      await saveChatHistory(userId, 'user', message, null);
      
      const queryEmbedding = await generateQueryEmbedding(message);
      const { data: chunks, error: rpcError } = await supabaseAdmin.rpc('match_content_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: 5,
          p_user_id: user.id,
          p_content_id: null
      });
      if (rpcError) { 
        console.error("Error matching chunks:", rpcError);
        throw new Error(`Failed to retrieve study materials: ${rpcError.message}`);
      }
      
      if (chunks && chunks.length > 0) {
        // SCENARIO 1: Chunks found. Use strict RAG prompt.
        console.log(`[Chat API] ${chunks.length} RAG chunks found. Using strict RAG prompt.`);
        let contextString = "--- START OF RELEVANT STUDY MATERIALS ---\n\n";
        chunks.forEach((chunk: any, index: number) => {
            const citation = index + 1;
            contextString += `[${citation}] Source (Title: ${chunk.content_title || 'Untitled'}):\n`;
            contextString += `${chunk.content_chunk}\n\n`;
            sources.push({
                content_id: chunk.content_id,
                content_type: chunk.content_type,
                content_title: chunk.content_title || 'Untitled',
                citation: citation,
                content_chunk: chunk.content_chunk,
            });
        });
        contextString += "--- END OF RELEVANT STUDY MATERIALS ---";

        systemPrompt = `You are a helpful AI tutor for an app called QuizCraft. Your task is to answer the user's questions based ONLY on the provided "RELEVANT STUDY MATERIALS". 
- Do not use any external knowledge. 
- You MUST cite your sources by adding the citation number (e.g., [1], [2]) at the end of the sentence or paragraph that uses that source.
- If the answer cannot be found in the materials, you MUST respond with: "I'm sorry, but I can't answer that question based on the relevant sections of your study materials."

${contextString}`;
      
      } else {
        // SCENARIO 2: No chunks found. Use general knowledge prompt.
        console.log("[Chat API] No RAG chunks found. Switching to general knowledge prompt.");
        
        systemPrompt = `You are a helpful AI tutor for an app called QuizCraft. The user's study materials did not contain a specific answer to their question.
- Your task is to answer the user's question using your general knowledge.
- You MUST clearly state that this information is from your general knowledge, not their study materials. (e.g., "Based on my general knowledge...").
- If the question seems unrelated to academics or studying (e.g., 'what's the weather?', 'who won the game?'), you should politely decline to answer and remind them you are a study tutor.
- If the question is academic (e.g., "What is mitosis?"), provide a helpful, educational answer.
- Do not add any citations.`;
      }

      // --- THIS IS THE FIX ---
      const generalHistory = await prisma.chat_history.findMany({
          where: { 
            user_id: user.id,
            context_id: null 
          },
          orderBy: { created_at: 'desc' }, // Get newest first
          take: 10, // Take 10 newest
      });

      const formattedHistory = generalHistory
          .map(h => ({ // Map them
              role: h.role,
              parts: [{ text: h.content }]
          }))
          .reverse() as Content[]; // Reverse to get oldest-to-newest order
      // --- END OF FIX ---

      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Of course! I'm ready to help you with your study materials. What's your question?" }] },
        ...formattedHistory, 
      ];
    }

    const chat = model.startChat({
      history: chatHistory,
    });
    
    const resultStream = await chat.sendMessageStream(message);
    let fullModelResponse = ""; 
    
    const outputStream = new ReadableStream({
      async start(controller) {
        // --- FIX #1: Iterate over resultStream.stream ---
        for await (const chunk of resultStream.stream) {
          const functionCalls = chunk.functionCalls();

          if (functionCalls && functionCalls.length > 0) {
            console.log("[Chat API] Tool call detected:", functionCalls.map(c => c.name));
            const functionResponseParts: Part[] = [];

            for (const call of functionCalls) {
              let apiResponse: any;
              const args = call.args;

              try {
                if (call.name === 'addQuestionToQuiz') {
                  apiResponse = await handleAddQuestionToQuiz(args as any);
                } else if (call.name === 'updateQuestionInQuiz') {
                  apiResponse = await handleUpdateQuestionInQuiz(args as any);
                } else if (call.name === 'deleteQuestionFromQuiz') {
                  apiResponse = await handleDeleteQuestionFromQuiz(args as any);
                } else {
                  apiResponse = { success: false, error: `Unknown tool: ${call.name}` };
                }
              } catch (e: any) {
                apiResponse = { success: false, error: `Error executing tool: ${e.message}` };
              }

              functionResponseParts.push({
                functionResponse: {
                  name: call.name,
                  response: apiResponse,
                }
              });
            }

            const toolResponseStream = await chat.sendMessageStream(functionResponseParts);

            // --- FIX #2: Iterate over toolResponseStream.stream ---
            for await (const finalChunk of toolResponseStream.stream) {
              const chunkText = finalChunk.text();
              fullModelResponse += chunkText; 
              controller.enqueue(new TextEncoder().encode(chunkText));
            }

          } else {
            const chunkText = chunk.text();
            fullModelResponse += chunkText; 
            controller.enqueue(new TextEncoder().encode(chunkText));
          }
        }
        
        await saveChatHistory(userId, 'model', fullModelResponse, requestContext);

        controller.close();
      },
    });

    return new Response(outputStream, {
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Ai-Sources': JSON.stringify(sources), 
      },
    });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error("Error in /api/chat:", error);
    
    if (userId && userMessageContent) {
        await saveChatHistory(userId, 'model', `Error: ${error.message || "An internal server error occurred."}`, requestContext);
    }
    
    return NextResponse.json(
      { success: false, error: error.message || "An internal server error occurred." },
      { status: 500 }
    );
  }
}