// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  Content,
  FunctionDeclarationSchemaType, // <-- FIX: Renamed from FunctionDeclarationSchema.Type
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
}

// Define Context type
interface PageContext {
  type: 'quiz' | 'essay' | 'page';
  id?: string;
  name?: string;
}

// Base generation config (can be overridden)
const generationConfig = {
  temperature: 0.6,
  topK: 1,
  topP: 1,
  maxOutputTokens: 4096,
  // responseMimeType: "application/json", // REMOVED: Must be text/plain for tool use streaming
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// --- NEW: Define Tool Schemas ---
const tools: { spec: FunctionDeclaration }[] = [
  {
    spec: {
      name: "addQuestionToQuiz",
      description: "Adds a new question to a specific quiz.",
      parameters: {
        type: FunctionDeclarationSchemaType.OBJECT, // <-- FIX
        properties: {
          quizId: { type: FunctionDeclarationSchemaType.STRING, description: "The ID of the quiz to add the question to." }, // <-- FIX
          question_text: { type: FunctionDeclarationSchemaType.STRING }, // <-- FIX
          question_type: { 
            type: FunctionDeclarationSchemaType.STRING, // <-- FIX
            enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_IN_THE_BLANK", "MATCHING"]
          },
          options: { 
            type: FunctionDeclarationSchemaType.ARRAY, // <-- FIX
            items: { type: FunctionDeclarationSchemaType.STRING }, // <-- FIX
            nullable: true,
            description: "For MULTIPLE_CHOICE or MATCHING. For FILL_IN_THE_BLANK, this is an array of acceptable answers."
          },
          prompts: {
            type: FunctionDeclarationSchemaType.ARRAY, // <-- FIX
            items: { type: FunctionDeclarationSchemaType.STRING }, // <-- FIX
            nullable: true,
            description: "For MATCHING type only. The list of prompts."
          },
          correct_answer: { 
            type: FunctionDeclarationSchemaType.STRING, // <-- FIX
            description: "For MC, must be one of the options. For T/F, must be 'True' or 'False'. For FILL_IN_THE_BLANK, can be N/A. For MATCHING, can be N/A."
          },
          explanation: { type: FunctionDeclarationSchemaType.STRING, nullable: true }, // <-- FIX
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
        type: FunctionDeclarationSchemaType.OBJECT, // <-- FIX
        properties: {
          questionId: { type: FunctionDeclarationSchemaType.STRING, description: "The ID of the question to update." }, // <-- FIX
          newQuestionData: {
            type: FunctionDeclarationSchemaType.OBJECT, // <-- FIX
            description: "An object containing *only* the fields to be updated.",
            properties: {
              question_text: { type: FunctionDeclarationSchemaType.STRING, nullable: true }, // <-- FIX
              options: { type: FunctionDeclarationSchemaType.ARRAY, items: { type: FunctionDeclarationSchemaType.STRING }, nullable: true }, // <-- FIX
              prompts: { type: FunctionDeclarationSchemaType.ARRAY, items: { type: FunctionDeclarationSchemaType.STRING }, nullable: true }, // <-- FIX
              correct_answer: { type: FunctionDeclarationSchemaType.STRING, nullable: true }, // <-- FIX
              explanation: { type: FunctionDeclarationSchemaType.STRING, nullable: true }, // <-- FIX
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
        type: FunctionDeclarationSchemaType.OBJECT, // <-- FIX
        properties: {
          questionId: { type: FunctionDeclarationSchemaType.STRING, description: "The ID of the question to delete." } // <-- FIX
        },
        required: ["questionId"]
      }
    }
  }
];

// --- NEW: Tool Handler Functions ---

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
    
    // Prisma cannot update with 'undefined' values, so we clean the object
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

// --- Helper to save chat history ---
async function saveChatHistory(userId: string, role: 'user' | 'model', content: string) {
    if (!content.trim()) return; // Don't save empty messages
    try {
        await prisma.chat_history.create({
            data: {
                user_id: userId,
                role,
                content
            }
        });
    } catch (e) {
        console.error("Failed to save chat history:", e);
    }
}


export async function POST(request: NextRequest) {
  let userMessageContent: string = "";
  let userId: string = "";

  try {
    const user = await requireAuth(request);
    userId = user.id; // Store userId for history saving
    const { history, message, context } = await request.json() as { 
      history: Content[], 
      message: string, 
      context?: PageContext 
    };
    userMessageContent = message; // Store for history saving

    if (!API_KEY) {
      throw new Error("Missing GOOGLE_AI_API_KEY environment variable");
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    
    let chatHistory: Content[] = [];
    let systemPrompt: string = "";
    let sources: AISource[] = [];
    let model: any; // To store the generative model instance
    
    // --- 4. MODIFIED LOGIC BRANCHING ---
    if (context?.type === 'quiz' && context.id) {
      // --- BRANCH A: QUIZ REFINEMENT (Refactored for Tool Use) ---
      console.log(`[Chat API] Handling Quiz Refinement for quiz: ${context.id}`);
      
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
          tools: [{ functionDeclarations: tools.map(t => t.spec) }] // --- ADDED TOOLS ---
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
        // Add previous conversational history
        ...history.map((msg: { role: 'user' | 'model', text: string }) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
        // Add the *full quiz context* as part of the *new* user message
        { role: "user", parts: [{ text: `Here is the current quiz JSON for context:\n${JSON.stringify(quiz)}\n\nMy new request is: ${message}` }] }
      ];

      // Save user message to history (Quiz-specific, not general)
      // Note: We'll skip saving context-specific chats for now to meet the "general chat history" requirement.
      // await saveChatHistory(userId, 'user', `(Context: Quiz ${quiz.id}) ${message}`);


    } else if (context?.type === 'essay' && context.id) {
      // --- BRANCH B: ESSAY FOLLOW-UP (Unchanged) ---
      console.log(`[Chat API] Handling Essay Follow-up for essay: ${context.id}`);
      
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
      // This branch falls through to the common streaming logic
      // We will save this history as it's general follow-up.
      await saveChatHistory(userId, 'user', message);

    } else {
      // --- BRANCH C: DEFAULT RAG (Retrieval-Augmented Generation) (Modified to save history) ---
      console.log(`[Chat API] Handling Default RAG for user: ${user.id}`);
      
      model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig, safetySettings });
      
      // --- Save user message to DB ---
      await saveChatHistory(userId, 'user', message);
      
      const queryEmbedding = await generateQueryEmbedding(message);
      const { data: chunks, error: rpcError } = await supabaseAdmin.rpc('match_content_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: 5,
          p_user_id: user.id
      });
      if (rpcError) { 
        console.error("Error matching chunks:", rpcError);
        throw new Error(`Failed to retrieve study materials: ${rpcError.message}`);
      }

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

      // --- NEW: Load general chat history ---
      const generalHistory = await prisma.chat_history.findMany({
          where: { user_id: user.id },
          orderBy: { created_at: 'asc' },
          takeLast: 10, // Get last 10 messages
      });

      const formattedHistory = generalHistory.map(h => ({
          role: h.role,
          parts: [{ text: h.content }]
      })) as Content[];

      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Of course! I'm ready to help you with your study materials. What's your question?" }] },
        ...formattedHistory, // Add the loaded history
        // Note: The *current* user message is not in history, it's sent separately.
      ];
      // This branch falls through to the common streaming logic
    }

    // --- 5. MODIFIED STREAMING LOGIC (Handles Tool Calling) ---
    const chat = model.startChat({
      history: chatHistory,
    });
    
    // Start the first stream
    const resultStream = await chat.sendMessageStream(message);
    let fullModelResponse = ""; // To save full response for history
    
    // We must return a new stream that intercepts the tool calls
    const outputStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of resultStream) {
          const functionCalls = chunk.functionCalls();

          if (functionCalls && functionCalls.length > 0) {
            // --- Tool Call Detected ---
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

            // Send tool results back to the model and stream *that* response
            const toolResponseStream = await chat.sendMessageStream(functionResponseParts);

            for await (const finalChunk of toolResponseStream) {
              const chunkText = finalChunk.text();
              fullModelResponse += chunkText; // Add to full response
              controller.enqueue(new TextEncoder().encode(chunkText));
            }

          } else {
            // --- No Tool Call, just text ---
            const chunkText = chunk.text();
            fullModelResponse += chunkText; // Add to full response
            controller.enqueue(new TextEncoder().encode(chunkText));
          }
        }
        
        // --- Save model response to history ---
        // Only save if it's not a quiz-editing context
        if (context?.type !== 'quiz') {
            await saveChatHistory(userId, 'model', fullModelResponse);
        }

        controller.close();
      },
    });

    return new Response(outputStream, {
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Ai-Sources': JSON.stringify(sources), // Send sources
      },
    });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error("Error in /api/chat:", error);
    
    // Save error to history? Maybe not.
    // if (userId && userMessageContent) {
    //     await saveChatHistory(userId, 'user', userMessageContent);
    //     await saveChatHistory(userId, 'model', `Error: ${error.message || "An internal server error occurred."}`);
    // }
    
    return NextResponse.json(
      { success: false, error: error.message || "An internal server error occurred." },
      { status: 500 }
    );
  }
}