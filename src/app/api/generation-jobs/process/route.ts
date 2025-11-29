// src/app/api/generation-jobs/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateQueryEmbedding } from '@/lib/embedding';
import { Prisma } from '@prisma/client';
import {
  callAIToGenerateQuiz,
  callAIToGenerateNote,
  callAIToGenerateFlashcards,
} from '@/lib/aiGeneration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function processJob(job: any) {
    let outputId: string | null = null;
    try {
        console.log(`Processing job ${job.id} for doc ${job.document_id} (Smart RAG Mode)`);
        
        // 1. Get Document & Insights
        const document = await prisma.documents.findFirst({
            where: { id: job.document_id, user_id: job.user_id },
            select: { ai_insights: true, file_name: true }
        });
        if (!document) throw new Error("Document not found.");

        // 2. Prepare Search Queries (Smart RAG)
        // We use the AI-generated "Key Concepts" to find the best parts of the file.
        let searchQueries: string[] = [];
        const insights = document.ai_insights as any;
        
        if (insights && insights.keyConcepts && Array.isArray(insights.keyConcepts)) {
            // Pick top 5 concepts to get a broad coverage of the document
            searchQueries = insights.keyConcepts.slice(0, 5);
        } else {
            // Fallback if no insights exist yet
            searchQueries = ["Summary", "Important Definitions", "Key Concepts", "Main Arguments", "Conclusion"];
        }

        console.log(`RAG Queries: ${JSON.stringify(searchQueries)}`);

        // 3. Generate Embeddings for these Queries
        const embeddingPromises = searchQueries.map(q => generateQueryEmbedding(q));
        const embeddings = await Promise.all(embeddingPromises);

        // 4. Find Relevant Chunks (Filtered by THIS Document)
        // We ask for 3 chunks per query. 5 queries * 3 chunks = max 15 chunks (~30k chars).
        const chunkPromises = embeddings.map(emb =>
            supabaseAdmin.rpc('match_content_chunks', {
                query_embedding: emb,
                match_threshold: 0.5, 
                match_count: 3, 
                p_user_id: job.user_id,
                p_content_id: job.document_id // <--- CRITICAL: Only look in this file
            })
        );
        const chunkResults = await Promise.all(chunkPromises);
        
        const allChunks = chunkResults.flatMap(res => res.data || []);
        
        if (allChunks.length === 0) {
             throw new Error("No content chunks found. The document might still be processing its embeddings. Please wait 1 minute and try again.");
        }

        // 5. De-duplicate and Create Focused Context
        const uniqueChunks = [...new Map(allChunks.map(c => [c.content_chunk, c])).values()];
        const contextText = uniqueChunks.map(c => c.content_chunk).join("\n\n---\n\n");

        console.log(`Constructed RAG Context: ${contextText.length} chars from ${uniqueChunks.length} chunks.`);

        if (contextText.length < 100) throw new Error("Context from RAG is too short to generate quality content.");

        // 6. Run the specific job type using the Focused RAG Context
        switch (job.job_type) {
            case 'quiz':
                const quizData = await callAIToGenerateQuiz(contextText, 10, 'medium', 'MIXED');
                const newQuiz = await prisma.quiz.create({
                    data: {
                        title: quizData.title || `Quiz: ${document.file_name}`,
                        userId: job.user_id,
                        immediate_feedback: true,
                        questions: {
                            create: quizData.questions.map((q: any) => ({ 
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
                        title: noteData.title || `Notes: ${document.file_name}`,
                        content: noteData.content,
                    },
                });
                outputId = newNote.id;
                break;
                
            case 'flashcard':
                const cards = await callAIToGenerateFlashcards(contextText, 15);
                const newDeck = await prisma.flashcard_decks.create({
                    data: {
                        user_id: job.user_id,
                        title: `Flashcards: ${document.file_name}`,
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

        await prisma.generation_jobs.update({
            where: { id: job.id },
            data: { status: 'complete', output_id: outputId }
        });
        console.log(`Job ${job.id} completed. Output: ${outputId}`);

    } catch (error: any) {
        console.error(`Failed to process job ${job.id}:`, error.message);
        await prisma.generation_jobs.update({
            where: { id: job.id },
            data: { status: 'failed', error_message: error.message }
        });
    }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Optional: Allow localhost to bypass for testing
    if (process.env.NODE_ENV === 'development') {
        console.log("Allowing dev bypass for cron");
    } else {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const jobsToProcess = await prisma.generation_jobs.findMany({
    where: { status: 'pending' },
    take: 3,
    orderBy: { created_at: 'asc' },
  });

  if (jobsToProcess.length === 0) {
    return NextResponse.json({ success: true, message: 'No pending jobs.' });
  }

  await prisma.generation_jobs.updateMany({
    where: { id: { in: jobsToProcess.map(j => j.id) } },
    data: { status: 'processing', updated_at: new Date() }
  });

  for (const job of jobsToProcess) {
    await processJob(job);
  }

  return NextResponse.json({ 
    success: true, 
    message: `Processed ${jobsToProcess.length} jobs.` 
  });
}