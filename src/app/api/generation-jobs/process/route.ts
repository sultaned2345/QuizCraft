// src/app/api/generation-jobs/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  callAIToGenerateNote, 
  callAIToGenerateFlashcards, 
  callAIToGenerateQuiz 
} from '@/lib/aiGeneration';
import { generateEmbeddings } from '@/lib/ai-service';

export const maxDuration = 60; // Allow 60s timeout on Vercel Pro

export async function POST(req: NextRequest) {
  let jobId = ""; 

  try {
    const user = await requireAuth(req);
    const body = await req.json();
    jobId = body.jobId;

    if (!jobId) {
      return NextResponse.json({ error: "Missing Job ID" }, { status: 400 });
    }

    // 1. Fetch Job and Document
    const job = await prisma.generation_jobs.findUnique({
      where: { id: jobId },
      include: { document: true }
    });

    if (!job || job.user_id !== user.id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status === 'completed') {
      return NextResponse.json({ success: true, message: "Already completed" });
    }

    // Update status to processing
    await prisma.generation_jobs.update({
      where: { id: jobId },
      data: { status: 'processing' }
    });

    const text = job.document.extracted_text || "";
    const fileName = job.document.file_name;
    let outputId: string | null = null;

    // 2. Execute Logic based on Job Type
    switch (job.job_type) {
      case 'note': {
        // Use Gemini to generate structured notes
        const noteResult = await callAIToGenerateNote(text);
        
        // VALIDATION
        if (!noteResult || !noteResult.content) {
            throw new Error("AI failed to generate notes.");
        }

        const note = await prisma.notes.create({
          data: {
            user_id: user.id,
            document_id: job.document_id,
            title: noteResult.title || `${fileName} - Study Notes`,
            content: noteResult.content, // HTML content
            tags: ['auto-generated']
          }
        });
        outputId = note.id;
        break;
      }

      case 'flashcard': {
        // Use Gemini to generate flashcards
        const cardsData = await callAIToGenerateFlashcards(text, 15);
        
        // VALIDATION
        if (!cardsData || cardsData.length === 0) {
            throw new Error("AI returned 0 flashcards.");
        }

        const deck = await prisma.flashcard_decks.create({
          data: {
            user_id: user.id,
            document_id: job.document_id,
            title: `${fileName} - Flashcards`
          }
        });
        
        // Use explicit 'front_content' and 'back_content' from Gemini Schema
        await prisma.flashcards.createMany({
          data: cardsData.map((c: any) => ({
            deck_id: deck.id,
            front_content: c.front_content || c.front || "Error", // Fallback for safety
            back_content: c.back_content || c.back || "Error"
          }))
        });
        outputId = deck.id;
        break;
      }

      case 'quiz': {
        // Use Gemini to generate quiz
        const quizResult = await callAIToGenerateQuiz(text, 10, 'medium', 'MIXED');
        
        // VALIDATION
        if (!quizResult || !quizResult.questions || quizResult.questions.length === 0) {
            throw new Error("AI generated 0 questions.");
        }

        const quiz = await prisma.quiz.create({
          data: {
            userId: user.id,
            document_id: job.document_id,
            title: quizResult.title || `${fileName} - Pop Quiz`,
            time_limit_minutes: 15
          }
        });

        // Create questions sequentially
        for (const q of quizResult.questions) {
          await prisma.questions.create({
            data: {
              quiz_id: quiz.id,
              question_text: q.question_text,
              question_type: q.question_type,
              correct_answer: q.correct_answer,
              options: q.options || [],
              explanation: q.explanation || ""
            }
          });
        }
        outputId = quiz.id;
        break;
      }

      case 'embedding': {
        // Keep OpenAI/Embeddings for RAG (Gemini embeddings support requires different setup)
        const vector = await generateEmbeddings(text.slice(0, 8000));
        
        await prisma.$executeRaw`
          INSERT INTO content_embeddings (id, user_id, content_id, content_type, content_chunk, embedding)
          VALUES (
            gen_random_uuid(), 
            ${user.id}::uuid, 
            ${job.document_id}::uuid, 
            'document', 
            ${text.slice(0, 1000)}, 
            ${vector}::vector
          )
        `;
        outputId = job.document_id;
        break;
      }
    }

    // 3. Mark Job Complete
    await prisma.generation_jobs.update({
      where: { id: jobId },
      data: { 
        status: 'completed',
        output_id: outputId
      }
    });

    // Check if all jobs for this doc are done
    const pendingJobs = await prisma.generation_jobs.count({
      where: { 
        document_id: job.document_id,
        status: { not: 'completed' }
      }
    });

    if (pendingJobs === 0) {
      await prisma.documents.update({
        where: { id: job.document_id },
        data: { processing_status: 'completed' }
      });
    }

    return NextResponse.json({ success: true, jobId, outputId });

  } catch (e: any) {
    console.error(`Job Processing Failed:`, e);
    
    // Explicitly fail the job in DB so UI updates
    if (jobId) {
        try {
            await prisma.generation_jobs.update({
                where: { id: jobId },
                data: { 
                    status: 'failed',
                    error_message: e.message || "Unknown error."
                }
            });
        } catch (dbErr) {
            console.error("Failed to update job status:", dbErr);
        }
    }

    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}