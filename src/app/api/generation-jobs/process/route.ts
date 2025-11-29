// src/app/api/generation-jobs/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
// --- 1. IMPORT CENTRALIZED AI HELPERS ---
import {
  callAIToGenerateQuiz,
  callAIToGenerateNote,
  callAIToGenerateFlashcards,
} from '@/lib/aiGeneration';
// ---

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- CONFIG ---
// 500,000 characters is roughly 100-150 single-spaced pages.
// This ensures high quality without hitting the 4MB hard limit.
const MAX_CONTEXT_LENGTH = 500000; 

async function processJob(job: any) {
    let outputId: string | null = null;
    try {
        console.log(`Processing job ${job.id} for doc ${job.document_id} (Full Text Mode)`);
        
        // 1. Get Full Document Text
        // We do NOT use RAG here. We want the "Big Picture" for quizzes/notes.
        const document = await prisma.documents.findFirst({
            where: { id: job.document_id, user_id: job.user_id },
            select: { extracted_text: true, file_name: true }
        });
        if (!document) throw new Error("Document not found.");

        let fullText = document.extracted_text || "";
        
        if (fullText.length < 50) {
            throw new Error("Document text is empty or too short.");
        }

        // 2. Truncate if absolutely necessary (Safety Cap)
        if (fullText.length > MAX_CONTEXT_LENGTH) {
            console.log(`Truncating text from ${fullText.length} to ${MAX_CONTEXT_LENGTH} chars.`);
            fullText = fullText.substring(0, MAX_CONTEXT_LENGTH);
        }

        // 3. Run the specific job type
        switch (job.job_type) {
            case 'quiz':
                const quizData = await callAIToGenerateQuiz(fullText, 10, 'medium', 'MIXED');
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
                const noteData = await callAIToGenerateNote(fullText);
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
                const cards = await callAIToGenerateFlashcards(fullText, 15);
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

        // 4. Mark Complete
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
     // Allow dev bypass
     if (process.env.NODE_ENV !== 'development') {
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