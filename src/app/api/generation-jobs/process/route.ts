// src/app/api/generation-jobs/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  generateDocumentSummary, 
  generateFlashcardsFromText, 
  generateQuizFromText,
  generateEmbeddings 
} from '@/lib/ai-service';

export const maxDuration = 60; // Allow 60s timeout on Vercel Pro

export async function POST(req: NextRequest) {
  let jobId = ""; // Scoped outside try/catch for error logging

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
    const title = job.document.file_name;
    let outputId: string | null = null;

    // 2. Execute Logic based on Job Type
    switch (job.job_type) {
      case 'note': {
        const noteContent = await generateDocumentSummary(text, title);
        
        // VALIDATION: Ensure AI actually generated content
        if (!noteContent || noteContent.length < 50) {
            throw new Error("AI failed to generate valid notes. Content was empty or too short.");
        }

        const note = await prisma.notes.create({
          data: {
            user_id: user.id,
            document_id: job.document_id,
            title: `${title} - Study Notes`,
            content: noteContent,
            tags: ['auto-generated']
          }
        });
        outputId = note.id;
        break;
      }

      case 'flashcard': {
        const cardsData = await generateFlashcardsFromText(text, 15);
        
        // VALIDATION: Ensure we have cards
        if (!cardsData || cardsData.length === 0) {
            throw new Error("AI returned 0 flashcards. Please check your API keys or document content.");
        }

        if (cardsData.length > 0) {
          const deck = await prisma.flashcard_decks.create({
            data: {
              user_id: user.id,
              document_id: job.document_id,
              title: `${title} - Flashcards`
            }
          });
          
          // FIX: Map the correct property names from the AI response
          await prisma.flashcards.createMany({
            data: cardsData.map((c: any) => ({
              deck_id: deck.id,
              front_content: c.front_content, // Fixed: was c.front
              back_content: c.back_content    // Fixed: was c.back
            }))
          });
          outputId = deck.id;
        }
        break;
      }

      case 'quiz': {
        const questionsData = await generateQuizFromText(text, 10);
        
        // VALIDATION: Ensure we have questions
        if (!questionsData || questionsData.length === 0) {
            throw new Error("AI generated 0 questions. The content may be too short or the AI service failed.");
        }

        if (questionsData.length > 0) {
          const quiz = await prisma.quiz.create({
            data: {
              userId: user.id,
              document_id: job.document_id,
              title: `${title} - Pop Quiz`,
              time_limit_minutes: 15
            }
          });

          // Create questions sequentially
          for (const q of questionsData) {
            await prisma.questions.create({
              data: {
                quiz_id: quiz.id,
                question_text: q.question_text,
                question_type: q.question_type,
                correct_answer: q.correct_answer,
                options: q.options,
                explanation: q.explanation
              }
            });
          }
          outputId = quiz.id;
        }
        break;
      }

      case 'embedding': {
        // Generate embedding vector for RAG (Chat with File)
        const vector = await generateEmbeddings(text.slice(0, 8000)); // Limit for embedding model
        
        // Use raw SQL for pgvector insertion
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
        outputId = job.document_id; // Maps back to the doc
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

    // Check if all jobs for this doc are done, if so, mark doc as ready
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
    
    if (jobId) {
        try {
            await prisma.generation_jobs.update({
                where: { id: jobId },
                data: { 
                    status: 'failed',
                    error_message: e.message || "Unknown error occurred during generation."
                }
            });
        } catch (dbErr) {
            console.error("Failed to update job status to failed:", dbErr);
        }
    }

    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}