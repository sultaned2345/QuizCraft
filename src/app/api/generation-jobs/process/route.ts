// src/app/api/generation-jobs/process/route.ts
// NEW FILE

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateQueryEmbedding } from '@/lib/embedding';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Prisma } from '@prisma/client';
import { Quiz, Note, FlashcardDeck, Question } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Ensure this route is always dynamic

// --- AI Configuration ---
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.5-flash-lite";
const genAI = new GoogleGenerativeAI(API_KEY);

// --- AI Helper Functions (Extracted from other routes) ---

// From /api/generate-quiz
async function callAIToGenerateQuiz(text: string, numQuestions: number): Promise<{ title: string; questions: Question[] }> {
    const prompt = `Based ONLY on the provided text, generate exactly ${numQuestions} questions (MULTIPLE_CHOICE or TRUE_FALSE). Focus on the most important concepts. For each, provide a brief explanation.
    Text: """${text}"""
    Return ONLY valid JSON: { "title": "...", "questions": [ { "question_text": "...", "question_type": "...", "options": [...], "correct_answer": "...", "explanation": "..." } ] }`;

    const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = JSON.parse(response.text());
    
    // Add basic validation
    if (!content.questions || !Array.isArray(content.questions) || content.questions.length === 0) {
        throw new Error("AI failed to return valid questions.");
    }
    return content as { title: string; questions: Question[] };
}

// From /api/generate-notes
async function callAIToGenerateNote(text: string): Promise<{ title: string; content: string; }> {
    const prompt = `Based on the following content, generate structured notes summarizing the key concepts. Return ONLY valid JSON: { "notes": [ { "title": "...", "content": "..." } ] }`;
    
    const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const parsed = JSON.parse(response.text());

    if (!parsed.notes || !Array.isArray(parsed.notes) || parsed.notes.length === 0 || !parsed.notes[0].title || !parsed.notes[0].content) {
         throw new Error("AI failed to return a valid note structure.");
    }
    return parsed.notes[0]; // Return just the first note
}

// From /api/generate-flashcards
async function callAIToGenerateFlashcards(text: string, numCards: number): Promise<{ front_content: string; back_content: string; }[]> {
     const prompt = `Based strictly on the following text, generate exactly ${numCards} flashcards (key terms, concepts).
     Text: """${text}"""
     Return ONLY valid JSON: { "flashcards": [ { "front_content": "...", "back_content": "..." } ] }`;
     
    const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const parsed = JSON.parse(response.text());

    if (!parsed.flashcards || !Array.isArray(parsed.flashcards) || parsed.flashcards.length === 0) {
        throw new Error("AI failed to return valid flashcards.");
    }
    return parsed.flashcards;
}

// --- Main Job Processing Function ---

async function processJob(job: any) {
    let outputId: string | null = null;
    try {
        console.log(`Processing job ${job.id} for doc ${job.document_id}`);
        
        // 1. Get Document and Insights
        const document = await prisma.documents.findFirst({
            where: { id: job.document_id, user_id: job.user_id },
            select: { ai_insights: true, file_name: true }
        });
        if (!document) throw new Error("Document not found.");

        const insights = document.ai_insights as any;
        const topics = insights?.keyConcepts || insights?.examQuestions;

        if (!topics || topics.length === 0) {
            throw new Error("No AI insights (key concepts or exam questions) found for this document. Cannot generate content.");
        }

        // 2. Smart RAG: Get embeddings for the top 5 topics
        const searchQueries = topics.slice(0, 5); // Use max 5 topics as queries
        const embeddingPromises = searchQueries.map((q: string) => generateQueryEmbedding(q));
        const embeddings = await Promise.all(embeddingPromises);

        // 3. Find relevant chunks for all topics
        const chunkPromises = embeddings.map(emb =>
            supabaseAdmin.rpc('match_content_chunks', {
                query_embedding: emb,
                match_threshold: 0.7,
                match_count: 2, // Get top 2 chunks for each topic
                p_user_id: job.user_id,
                p_content_id: job.document_id // Only search within this document
            })
        );
        const chunkResults = await Promise.all(chunkPromises);
        
        const allChunks = chunkResults.flatMap(res => res.data || []);
        if (allChunks.length === 0) throw new Error("No relevant text chunks found based on AI insights.");

        // 4. De-duplicate chunks and create context
        const uniqueChunks = [...new Map(allChunks.map(c => [c.content_chunk, c])).values()];
        const contextText = uniqueChunks.map(c => c.content_chunk).join("\n\n---\n\n");

        if (contextText.length < 50) throw new Error("Context from RAG is too short.");

        // 5. Run the specific job type
        switch (job.job_type) {
            case 'quiz':
                const quizData = await callAIToGenerateQuiz(contextText, 10); // Generate 10 questions
                const newQuiz = await prisma.quiz.create({
                    data: {
                        title: quizData.title || `Quiz for ${document.file_name}`,
                        userId: job.user_id,
                        immediate_feedback: true,
                        questions: {
                            create: quizData.questions.map(q => ({
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
                outputId = newQuiz.id;
                break;
            
            case 'note':
                const noteData = await callAIToGenerateNote(contextText);
                const newNote = await prisma.notes.create({
                    data: {
                        user_id: job.user_id,
                        title: noteData.title || `Notes for ${document.file_name}`,
                        content: noteData.content,
                    },
                });
                outputId = newNote.id;
                break;
                
            case 'flashcard':
                const cards = await callAIToGenerateFlashcards(contextText, 15); // Generate 15 cards
                const newDeck = await prisma.flashcard_decks.create({
                    data: {
                        user_id: job.user_id,
                        title: `Flashcards for ${document.file_name}`,
                        flashcards: {
                            create: cards.map(c => ({
                                front_content: c.front_content,
                                back_content: c.back_content
                            }))
                        }
                    }
                });
                outputId = newDeck.id;
                break;
                
            default:
                throw new Error(`Unknown job type: ${job.job_type}`);
        }

        // 6. Mark job as complete
        await prisma.generation_jobs.update({
            where: { id: job.id },
            data: { status: 'complete', output_id: outputId }
        });
        console.log(`Job ${job.id} completed successfully. Output ID: ${outputId}`);

    } catch (error: any) {
        // 7. Mark job as failed
        console.error(`Failed to process job ${job.id}:`, error.message);
        await prisma.generation_jobs.update({
            where: { id: job.id },
            data: { status: 'failed', error_message: error.message }
        });
    }
}

/**
 * @route GET /api/generation-jobs/process
 * @description Processes pending generation jobs. Secured by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  // 1. Check Cron Secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Fetch jobs to process (e.g., 3 at a time)
  const jobsToProcess = await prisma.generation_jobs.findMany({
    where: { status: 'pending' },
    take: 3,
    orderBy: { created_at: 'asc' },
  });

  if (jobsToProcess.length === 0) {
    return NextResponse.json({ success: true, message: 'No pending jobs.' });
  }

  // 3. Mark jobs as 'processing' first
  await prisma.generation_jobs.updateMany({
    where: {
      id: { in: jobsToProcess.map(j => j.id) }
    },
    data: {
      status: 'processing',
      updated_at: new Date()
    }
  });

  // 4. Process each job (fire-and-forget, but await to keep connection alive)
  // We run them sequentially to avoid overwhelming the AI or DB
  for (const job of jobsToProcess) {
    await processJob(job);
  }

  return NextResponse.json({ 
    success: true, 
    message: `Attempted to process ${jobsToProcess.length} jobs.` 
  });
}