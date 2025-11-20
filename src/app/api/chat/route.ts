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
import { 
  callAIToGenerateQuiz,
  callAIToGenerateFlashcards 
} from '@/lib/aiGeneration';
import { incrementAIGenerationUsage, checkAIGenerationUsageLimit } from '@/lib/usage-limits';

export const runtime = "nodejs";

// Updated to the latest efficient model
const MODEL_NAME = "gemini-2.0-flash-lite-preview-02-05";
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";

// --- Interfaces ---
interface AISource {
  content_id: string;
  content_type: 'note' | 'document' | 'project';
  content_title: string;
  citation: number;
  content_chunk: string;
}
interface PageContext {
  type: 'quiz' | 'essay' | 'page' | 'document' | 'project';
  id?: string;
  name?: string;
}

// Updated configuration for Socratic tutoring
const generationConfig = {
  temperature: 0.4, 
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 8192,
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// --- Tools Definitions ---
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
  },
  {
    spec: {
      name: "createQuizFromContext",
      description: "Creates a new quiz from a specific note or document.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          contentType: { type: SchemaType.STRING, enum: ["note", "document"] },
          contentId: { type: SchemaType.STRING, description: "The ID of the note or document." },
          numQuestions: { type: SchemaType.NUMBER, description: "The number of questions to generate (e.g., 5, 10)." },
          title: { type: SchemaType.STRING, description: "The title for the new quiz." }
        },
        required: ["contentType", "contentId", "numQuestions", "title"]
      }
    }
  },
  {
    spec: {
      name: "createFlashcardsFromContext",
      description: "Creates a new flashcard deck from a specific note or document.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          contentType: { type: SchemaType.STRING, enum: ["note", "document"] },
          contentId: { type: SchemaType.STRING, description: "The ID of the note or document." },
          numCards: { type: SchemaType.NUMBER, description: "The number of flashcards to generate (e.g., 10, 20)." },
          title: { type: SchemaType.STRING, description: "The title for the new deck." }
        },
        required: ["contentType", "contentId", "numCards", "title"]
      }
    }
  },
  {
    spec: {
      name: "getStudyQueueSummary",
      description: "Fetches a summary of the user's current study queue, including due flashcards and low-scoring quizzes.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {},
        required: []
      }
    }
  }
];

// --- Tool Handlers ---
async function handleAddQuestionToQuiz(args: {
  quizId: string;
  question_text: string;
  question_type: any;
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

async function checkUsageForTool(userId: string): Promise<{ success: true } | { success: false, error: string }> {
  const usageCheck = await checkAIGenerationUsageLimit(userId);
  if (!usageCheck.isValid) {
    return { success: false, error: usageCheck.message || "AI generation limit reached." };
  }
  return { success: true };
}

async function getContentForTool(contentType: 'note' | 'document', contentId: string, userId: string): Promise<{ success: true, text: string, title: string } | { success: false, error: string }> {
  let textContent: string | null | undefined = null;
  let title: string | null | undefined = null;

  if (contentType === 'note') {
    const note = await prisma.notes.findFirst({
      where: { id: contentId, user_id: userId },
      select: { content: true, title: true }
    });
    textContent = note?.content?.replace(/<[^>]+>/g, ' ');
    title = note?.title;
  } else if (contentType === 'document') {
    const doc = await prisma.documents.findFirst({
      where: { id: contentId, user_id: userId },
      select: { extracted_text: true, file_name: true }
    });
    textContent = doc?.extracted_text;
    title = doc?.file_name;
  }
  
  if (!textContent || !title) {
    return { success: false, error: `${contentType} not found or access denied.` };
  }
  if (textContent.length < 50) {
    return { success: false, error: `Content is too short to generate materials.` };
  }
  return { success: true, text: textContent, title };
}

async function handleCreateQuizFromContext(args: {
  contentType: 'note' | 'document';
  contentId: string;
  numQuestions: number;
  title: string;
}, userId: string) {
  try {
    const usage = await checkUsageForTool(userId);
    if (!usage.success) return usage;

    const content = await getContentForTool(args.contentType, args.contentId, userId);
    if (!content.success) return content;

    const aiQuizData = await callAIToGenerateQuiz(content.text, args.numQuestions); 

    const newQuiz = await prisma.quiz.create({
      data: {
        title: args.title || aiQuizData.title || `Quiz from ${content.title}`,
        userId: userId,
        immediate_feedback: true,
        questions: {
          create: aiQuizData.questions.map(q => ({
            question_text: q.question_text,
            question_type: q.question_type,
            correct_answer: q.correct_answer,
            options: q.options || Prisma.JsonNull,
            prompts: q.prompts || Prisma.JsonNull,
            explanation: q.explanation || "",
          })),
        },
      },
    });

    await incrementAIGenerationUsage(userId, 1);
    return { success: true, quizId: newQuiz.id, title: newQuiz.title, message: `Successfully created quiz "${newQuiz.title}".` };
  } catch (e: any) {
    console.error("Error in handleCreateQuizFromContext:", e);
    return { success: false, error: e.message || "Failed to create quiz." };
  }
}

async function handleCreateFlashcardsFromContext(args: {
  contentType: 'note' | 'document';
  contentId: string;
  numCards: number;
  title: string;
}, userId: string) {
  try {
    const usage = await checkUsageForTool(userId);
    if (!usage.success) return usage;
    
    const content = await getContentForTool(args.contentType, args.contentId, userId);
    if (!content.success) return content;

    const aiCardsData = await callAIToGenerateFlashcards(content.text, args.numCards);

    const newDeck = await prisma.flashcard_decks.create({
      data: {
        user_id: userId,
        title: args.title || `Flashcards from ${content.title}`,
        flashcards: {
          create: aiCardsData.map(c => ({
            front_content: c.front_content,
            back_content: c.back_content
          }))
        }
      }
    });
    
    await incrementAIGenerationUsage(userId, 1);
    return { success: true, deckId: newDeck.id, title: newDeck.title, message: `Successfully created deck "${newDeck.title}".` };
  } catch (e: any) {
    console.error("Error in handleCreateFlashcardsFromContext:", e);
    return { success: false, error: e.message || "Failed to create flashcards." };
  }
}

async function handleGetStudyQueueSummary(userId: string) {
  try {
    const [dueCards, dueCount, lowAttempts, lowCount] = await Promise.all([
      prisma.flashcards.findFirst({
        where: { deck: { user_id: userId }, review_at: { lte: new Date() } },
        select: { deck_id: true, deck: { select: { title: true } } },
        orderBy: { review_at: 'asc' },
      }),
      prisma.flashcards.count({
        where: { deck: { user_id: userId }, review_at: { lte: new Date() } },
      }),
      prisma.quiz_attempts.findFirst({
        where: { user_id: userId, score: { lt: 7 } }, 
        select: { quiz: { select: { id: true, title: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.quiz_attempts.count({
        where: { user_id: userId, score: { lt: 7 } },
      })
    ]);
    
    const summary = {
      due_card_count: dueCount,
      first_due_deck_id: dueCards?.deck_id || null,
      first_due_deck_title: dueCards?.deck.title || null,
      low_score_quiz_count: lowCount,
      lowest_score_quiz_id: lowAttempts?.quiz.id || null,
      lowest_score_quiz_title: lowAttempts?.quiz.title || null,
    };

    return { success: true, data: summary };
  } catch (e: any) {
    console.error("Error in handleGetStudyQueueSummary:", e);
    return { success: false, error: e.message || "Failed to fetch study queue." };
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

// --- MAIN ROUTE ---
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
    
    // --- Context A: Quiz Refinement ---
    if (context?.type === 'quiz' && context.id) {
      await saveChatHistory(userId, 'user', message, context);

      const quiz = await prisma.quiz.findFirst({
        where: { id: context.id, userId: user.id },
        include: { questions: true }
      });
      if (!quiz) throw new Error("Quiz not found or access denied.");

      model = genAI.getGenerativeModel({ 
          model: MODEL_NAME, 
          generationConfig, 
          safetySettings,
          tools: [{ functionDeclarations: tools.filter(t => t.spec.name.includes("Question")).map(t => t.spec) }]
      });

      systemPrompt = `You're an expert quiz editor.
- Use tools to modify the quiz as requested.
- Context: Quiz JSON provided below.
- Be clear and concise.`;
      
      const recentHistory = await prisma.chat_history.findMany({
        where: { user_id: userId, context_id: context.id },
        orderBy: { created_at: 'desc' },
        take: 30,
      });
      const formattedHistory = recentHistory.map(h => ({ role: h.role, parts: [{ text: h.content }] })).reverse() as Content[];

      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Quiz loaded. Ready for edits." }] },
        ...formattedHistory,
        { role: "user", parts: [{ text: `Quiz JSON:\n${JSON.stringify(quiz)}\n\nRequest: ${message}` }] }
      ];

    // --- Context B: Document-Specific RAG (SMART SOCRATIC TUTOR) ---
    } else if (context?.type === 'document' && context.id) {
      await saveChatHistory(userId, 'user', message, context); 
      
      model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig, safetySettings });
      const queryEmbedding = await generateQueryEmbedding(message);
      
      const { data: chunks, error: rpcError } = await supabaseAdmin.rpc('match_content_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: 0.60, 
          match_count: 6,
          p_user_id: user.id,
          p_content_id: context.id 
      });
      
      if (rpcError) throw new Error(`Failed to retrieve study materials: ${rpcError.message}`);

      let contextString = "";
      if (chunks && chunks.length > 0) {
          contextString = `--- DOCUMENT EXCERPTS --- \n\n`;
          chunks.forEach((chunk: any, index: number) => {
              const citation = index + 1;
              contextString += `[${citation}] ${chunk.content_chunk}\n\n`;
              sources.push({
                  content_id: chunk.content_id,
                  content_type: chunk.content_type,
                  content_title: chunk.content_title || 'Document',
                  citation: citation,
                  content_chunk: chunk.content_chunk,
              });
          });
          
          // --- NEW SOCRATIC PROMPT ---
          systemPrompt = `You are a smart, Socratic study companion.
Your goal is to help the user learn from their document, not just give answers.

RULES:
1. **Ask Before Answering:** If the user's question is broad (e.g., "Explain this document", "What is this about?"), DO NOT summarize immediately. Instead, ask 1-2 short clarifying questions to understand their goal (e.g., "Are you looking for a high-level summary, or specific details on [Topic X]?").
2. **Be Direct:** If the question is specific (e.g., "What is the definition of X?"), answer directly using the excerpts.
3. **Cite Sources:** Use [1], [2] when referencing specific text.
4. **Formatting:** Use Markdown (bold, lists) to make text readable.

CONTEXT FROM DOCUMENT:
${contextString}`;
          
      } else {
          // Fallback: Full Text
          const doc = await prisma.documents.findFirst({
              where: { id: context.id, user_id: user.id },
              select: { extracted_text: true }
          });
          
          if (!doc || !doc.extracted_text) throw new Error("Document not found.");
          
          contextString = doc.extracted_text.substring(0, 25000);

          systemPrompt = `You are a helpful AI tutor.
Answer based on the full document text below.
- Be direct.
- No citations needed if you can't find exact matches.

CONTEXT:
${contextString}`;
      }

      const recentHistory = await prisma.chat_history.findMany({
        where: { user_id: userId, context_id: context.id },
        orderBy: { created_at: 'desc' },
        take: 10,
      });
      const formattedHistory = recentHistory.map(h => ({ role: h.role, parts: [{ text: h.content }] })).reverse() as Content[];

      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "I'm ready to help you study this document." }] },
        ...formattedHistory,
      ];

    // --- Context C: Essay Follow-up ---
    } else if (context?.type === 'essay' && context.id) {
      await saveChatHistory(userId, 'user', message, context);
      model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig, safetySettings });
      const gradedEssay = await prisma.graded_essays.findFirst({
        where: { id: context.id, user_id: user.id }
      });
      if (!gradedEssay) throw new Error("Graded essay not found.");

      systemPrompt = `You are a writing tutor.
Answer follow-up questions about this essay and its feedback.

ESSAY:
${gradedEssay.essay_content}

FEEDBACK:
${JSON.stringify(gradedEssay.feedback)}`;
      
      const recentHistory = await prisma.chat_history.findMany({
        where: { user_id: userId, context_id: context.id },
        orderBy: { created_at: 'desc' },
        take: 30,
      });
      const formattedHistory = recentHistory.map(h => ({ role: h.role, parts: [{ text: h.content }] })).reverse() as Content[];

      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "I'm ready to discuss your essay." }] },
        ...formattedHistory,
      ];

    // --- Context D: Default/Project ---
    } else {
       model = genAI.getGenerativeModel({ 
          model: MODEL_NAME, 
          generationConfig, 
          safetySettings,
          tools: [{ functionDeclarations: tools.filter(t => !t.spec.name.includes("QuestionInQuiz")).map(t => t.spec) }]
      });
      
      await saveChatHistory(userId, 'user', message, null);
      const queryEmbedding = await generateQueryEmbedding(message);
      const { data: chunks } = await supabaseAdmin.rpc('match_content_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: 5,
          p_user_id: user.id,
          p_content_id: null
      });

      if (chunks && chunks.length > 0) {
        let contextString = chunks.map((c: any, i: number) => `[${i+1}] ${c.content_chunk}`).join("\n\n");
        chunks.forEach((chunk: any, index: number) => {
             sources.push({
                content_id: chunk.content_id,
                content_type: chunk.content_type,
                content_title: chunk.content_title || 'Untitled',
                citation: index + 1,
                content_chunk: chunk.content_chunk,
            });
        });

        systemPrompt = `You are a helpful AI tutor.
Answer based on the study materials below.
- Cite sources [1].
- If not found, say so.

MATERIALS:
${contextString}`;
      } else {
        systemPrompt = `You are a helpful AI tutor. The answer wasn't found in the user's notes. Answer using general knowledge but mention that.`;
      }

      const recentHistory = await prisma.chat_history.findMany({
          where: { user_id: user.id, context_id: null },
          orderBy: { created_at: 'desc' },
          take: 30, 
      });
      const formattedHistory = recentHistory.map(h => ({ role: h.role, parts: [{ text: h.content }] })).reverse() as Content[];
      
      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Hi! How can I help you study?" }] }, 
        ...formattedHistory, 
      ];
    }

    // --- Execution ---
    const chat = model.startChat({ history: chatHistory });
    const resultStream = await chat.sendMessageStream(message);
    let fullModelResponse = ""; 
    
    const outputStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of resultStream.stream) {
          const functionCalls = chunk.functionCalls();

          if (functionCalls && functionCalls.length > 0) {
            const functionResponseParts: Part[] = [];
            for (const call of functionCalls) {
              let apiResponse: any;
              const args = call.args;
              try {
                if (call.name === 'addQuestionToQuiz') apiResponse = await handleAddQuestionToQuiz(args as any);
                else if (call.name === 'updateQuestionInQuiz') apiResponse = await handleUpdateQuestionInQuiz(args as any);
                else if (call.name === 'deleteQuestionFromQuiz') apiResponse = await handleDeleteQuestionFromQuiz(args as any);
                else if (call.name === 'createQuizFromContext') apiResponse = await handleCreateQuizFromContext(args as any, userId);
                else if (call.name === 'createFlashcardsFromContext') apiResponse = await handleCreateFlashcardsFromContext(args as any, userId);
                else if (call.name === 'getStudyQueueSummary') apiResponse = await handleGetStudyQueueSummary(userId);
                else apiResponse = { success: false, error: `Unknown tool: ${call.name}` };
              } catch (e: any) {
                apiResponse = { success: false, error: e.message };
              }
              functionResponseParts.push({ functionResponse: { name: call.name, response: apiResponse } });
            }
            const toolResponseStream = await chat.sendMessageStream(functionResponseParts);
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
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Ai-Sources': JSON.stringify(sources) },
    });

  } catch (error: any) {
    console.error("Chat Error:", error);
    if (userId && userMessageContent) await saveChatHistory(userId, 'model', `Error: ${error.message}`, requestContext);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}