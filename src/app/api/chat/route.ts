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
// --- 1. IMPORT REAL AI HELPERS ---
import { 
  callAIToGenerateQuiz,
  callAIToGenerateNote, // We'll add this just in case we want a `createNote` tool later
  callAIToGenerateFlashcards 
} from '@/lib/aiGeneration';
import { incrementAIGenerationUsage, checkAIGenerationUsageLimit } from '@/lib/usage-limits';

export const runtime = "nodejs";

const MODEL_NAME = "gemini-2.5-flash-lite";
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";

// (Interfaces and base configs)
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

// --- (Tool Schemas) ---
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

// --- 2. REAL TOOL HANDLERS ---

// (Quiz Edit Handlers)
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

// (New Tool Handlers)
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
    // Simple text extraction from HTML content
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
    const { data, error } = await supabaseAdmin.rpc('get_study_queue_summary', { p_user_id: userId });
    
    if (error) throw error;

    const summary = data?.[0];
    if (!summary) throw new Error("No summary data returned.");

    return { success: true, data: summary };
  } catch (e: any) {
    console.error("Error in handleGetStudyQueueSummary:", e);
    return { success: false, error: e.message || "Failed to fetch study queue." };
  }
}

// (saveChatHistory is unchanged)
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
    
    // --- Context A: Quiz Refinement ---
    if (context?.type === 'quiz' && context.id) {
      console.log(`[Chat API] Handling Quiz Refinement for quiz: ${context.id}`);
      
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

      // --- FRIENDLY PROMPT ---
      systemPrompt = `You're an expert quiz editor and a helpful study assistant! The user wants to fine-tune their quiz.
- Use the provided tools to add, update, or delete questions as requested.
- The user's quiz JSON is provided below for context (including question IDs).
- Always be encouraging and clear (e.g., 'Great, I've updated question 2 for you!' or 'Got it, I've added that new true/false question.').
- If the user's request is unclear (e.g., "delete question 10" on a 5-question quiz), ask for clarification instead of calling a tool.
- Do not mention RAG or study materials. Your context is *only* this quiz.`;
      
      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        // --- FRIENDLY GREETING ---
        { role: "model", parts: [{ text: "I've got your quiz loaded up! What changes can I help you make?" }] },
        ...history.map((msg: { role: 'user' | 'model', text: string }) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
        { role: "user", parts: [{ text: `Here is the current quiz JSON for context:\n${JSON.stringify(quiz)}\n\nMy new request is: ${message}` }] }
      ];

    // --- Context B: Document-Specific RAG ---
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
      if (rpcError) throw new Error(`Failed to retrieve study materials: ${rpcError.message}`);

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

      // --- FRIENDLY PROMPT ---
      systemPrompt = `You are a helpful and friendly AI tutor. Your task is to answer the user's questions based *only* on the provided "RELEVANT EXCERPTS" from the document they are currently viewing.
- Be conversational and encouraging!
- Do not use any external knowledge. 
- You MUST cite your sources by adding the citation number (e.g., [1], [2]) at the end of the sentence.
- If the answer cannot be found in the materials, you MUST respond with: "I'm sorry, but I can't find that specific information in this document. Could you try rephrasing?"

${contextString}`;

      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        // --- FRIENDLY GREETING ---
        { role: "model", parts: [{ text: "I'm ready to help you with this document. What's on your mind?" }] },
        ...history.map((msg: { role: 'user' | 'model', text: string }) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
      ];

    // --- Context C: Essay Follow-up ---
    } else if (context?.type === 'essay' && context.id) {
      console.log(`[Chat API] Handling Essay Follow-up for essay: ${context.id}`);
      await saveChatHistory(userId, 'user', message, context);
      model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig, safetySettings });
      const gradedEssay = await prisma.graded_essays.findFirst({
        where: { id: context.id, user_id: user.id }
      });
      if (!gradedEssay) throw new Error("Graded essay not found or access denied.");

      // --- FRIENDLY PROMPT ---
      systemPrompt = `You are an encouraging and helpful writing tutor. The user has just received AI-generated feedback on their essay and has a follow-up question.
- Use the provided original essay and its feedback to answer the user's question conversationally, like you're the one who provided the original feedback.
- Be supportive and clear in your explanations.
- DO NOT mention the JSON. Just act as the tutor.

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
        // --- FRIENDLY GREETING ---
        { role: "model", parts: [{ text: "I see you've had a chance to look over my feedback on your essay. What follow-up questions do you have? I'm here to help!" }] },
        ...history.map((msg: { role: 'user' | 'model', text: string }) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
      ];

    // --- Context D: Project-Scoped RAG ---
    } else if (context?.type === 'project' && context.id) {
      console.log(`[Chat API] Handling Project-Scoped RAG for project: ${context.id}`);
      await saveChatHistory(userId, 'user', message, context); 
      model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig, safetySettings });
      const queryEmbedding = await generateQueryEmbedding(message);
      
      const { data: chunks, error: rpcError } = await supabaseAdmin.rpc('match_project_content_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: 0.7, 
          match_count: 5,
          p_user_id: user.id,
          p_project_id: context.id
      });
      if (rpcError) throw new Error(`Failed to retrieve project materials: ${rpcError.message}`);

      let contextString = `--- START: Relevant excerpts from project "${context.name || 'Project'}" --- \n\n`;
      if (chunks && chunks.length > 0) {
          chunks.forEach((chunk: any, index: number) => {
            const citation = index + 1;
            contextString += `[${citation}] Excerpt (from ${chunk.content_title || 'Content'}):\n`;
            contextString += `${chunk.content_chunk}\n\n`;
            sources.push({
                content_id: chunk.content_id,
                content_type: chunk.content_type,
                content_title: chunk.content_title || 'Content',
                citation: citation,
                content_chunk: chunk.content_chunk,
            });
          });
      } else {
          contextString += "No specific excerpts were found for your question in this project.\n";
      }
      contextString += `--- END: Relevant excerpts from project ---`;

      // --- FRIENDLY PROMPT ---
      systemPrompt = `You are a helpful and friendly AI tutor. Your task is to answer the user's questions based *only* on the provided "RELEVANT EXCERPTS" from the project they are currently viewing.
- Be conversational and encouraging!
- Do not use any external knowledge. 
- You MUST cite your sources by adding the citation number (e.g., [1], [2]) at the end of the sentence.
- If the answer cannot be found in the materials, you MUST respond with: "I'm sorry, but I can't find that specific information in this project. Could you try rephrasing?"

${contextString}`;

      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        // --- FRIENDLY GREETING ---
        { role: "model", parts: [{ text: `I've got your '${context.name || 'Project'}' materials open! What can I help you find?` }] },
        ...history.map((msg: { role: 'user' | 'model', text: string }) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
      ];
    
    // --- Context E: Default RAG (All Tools, Proactive Greeting) ---
    } else {
      console.log(`[Chat API] Handling Default RAG for user: ${user.id}`);
      
      model = genAI.getGenerativeModel({ 
          model: MODEL_NAME, 
          generationConfig, 
          safetySettings,
          tools: [{ functionDeclarations: tools.filter(t => !t.spec.name.includes("QuestionInQuiz")).map(t => t.spec) }]
      });
      
      await saveChatHistory(userId, 'user', message, null);
      
      const queryEmbedding = await generateQueryEmbedding(message);
      const { data: chunks, error: rpcError } = await supabaseAdmin.rpc('match_content_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: 5,
          p_user_id: user.id,
          p_content_id: null
      });
      if (rpcError) throw new Error(`Failed to retrieve study materials: ${rpcError.message}`);
      
      if (chunks && chunks.length > 0) {
        // SCENARIO 1: Chunks found.
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

        // --- FRIENDLY PROMPT ---
        systemPrompt = `You are a helpful and friendly AI tutor for an app called QuizCraft. 
- Your task is to answer the user's questions based *only* on their "RELEVANT STUDY MATERIALS". 
- Be conversational and encouraging.
- You MUST cite your sources by adding the citation number (e.g., [1], [2]).
- If the answer cannot be found in the materials, you MUST respond with: "I'm sorry, but I can't find that in your study materials. Is there another way I can help?"
- You can also help the user by:
  - Creating new quizzes or flashcard decks from their notes or documents using the 'createQuizFromContext' or 'createFlashcardsFromContext' tools.
  - Answering questions about their study queue using the 'getStudyQueueSummary' tool.

${contextString}`;
      
      } else {
        // SCENARIO 2: No chunks found.
        console.log("[Chat API] No RAG chunks found. Switching to general knowledge prompt.");
        
        // --- FRIENDLY PROMPT ---
        systemPrompt = `You are a helpful and friendly AI tutor for an app called QuizCraft. The user's study materials didn't seem to have the answer to their question.
- Your first priority is to use a tool if they ask to create content (like a quiz or flashcards) or check their study queue.
- If they ask a general knowledge question (like 'What is mitosis?'), be helpful and answer it, but *always* let them know you're using your general knowledge (e.g., 'I couldn't find that in your notes, but from my general knowledge...').
- If the question is off-topic (like 'what's the weather?'), politely decline and remind them you're here to help them study.
- Be conversational and encouraging!`;
      }

      const generalHistory = await prisma.chat_history.findMany({
          where: { user_id: user.id, context_id: null },
          orderBy: { created_at: 'desc' },
          take: 10,
      });
      const formattedHistory = generalHistory.map(h => ({ role: h.role, parts: [{ text: h.content }] })).reverse() as Content[];

      // --- FRIENDLY GREETING (Proactive) ---
      let modelGreeting = "Hi! I'm ready to help you study. What's on your mind?";
      
      if (formattedHistory.length === 0) { // Only be proactive on a new chat
        try {
          const { data, error } = await supabaseAdmin.rpc('get_study_queue_summary', { p_user_id: userId });
          if (error) throw error;
          const summary = data?.[0];

          if (summary && summary.due_card_count > 0) {
            modelGreeting = `Hi there! Just letting you know, you have ${summary.due_card_count} flashcard${summary.due_card_count > 1 ? 's' : ''} due for review, starting with your deck "${summary.first_due_deck_title}".\n\nWhat can I help you with? You can ask me to start a review, get a summary of your study queue, or ask any other question!`;
          } else if (summary && summary.low_score_quiz_count > 0) {
            modelGreeting = `Hey! I noticed you recently took the "${summary.lowest_score_quiz_title}" quiz. Don't worry, we can review the tough spots together!\n\nWhat can I help you with? You can ask me to help you review that topic, or ask any other question.`;
          }
        } catch (e) {
          console.error("Failed to fetch study queue for proactive greeting:", e);
        }
      }
      // --- END GREETING ---

      chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: modelGreeting }] }, 
        ...formattedHistory, 
      ];
    }

    // --- (Chat Execution Logic) ---
    const chat = model.startChat({
      history: chatHistory,
    });
    
    const resultStream = await chat.sendMessageStream(message);
    let fullModelResponse = ""; 
    
    const outputStream = new ReadableStream({
      async start(controller) {
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
                } else if (call.name === 'createQuizFromContext') {
                  apiResponse = await handleCreateQuizFromContext(args as any, userId);
                } else if (call.name === 'createFlashcardsFromContext') {
                  apiResponse = await handleCreateFlashcardsFromContext(args as any, userId);
                } else if (call.name === 'getStudyQueueSummary') {
                  apiResponse = await handleGetStudyQueueSummary(userId);
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