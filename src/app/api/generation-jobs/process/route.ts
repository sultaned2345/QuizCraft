import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  generateNotesFromContent,
  generateFlashcardsFromContent, 
  generateQuizFromContent, 
  generatePodcastForDocument     
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
        const noteContent = await generateNotesFromContent(text);
        
        if (!noteContent) throw new Error("AI failed to generate notes.");

        const note = await prisma.notes.create({
          data: {
            user_id: user.id,
            document_id: job.document_id,
            title: `${fileName} - Study Notes`,
            content: noteContent, 
            tags: ['auto-generated']
          }
        });
        outputId = note.id;
        break;
      }

      case 'flashcard': {
        const cardsData = await generateFlashcardsFromContent(text);
        
        if (!cardsData || cardsData.length === 0) throw new Error("AI returned 0 flashcards.");

        const deck = await prisma.flashcard_decks.create({
          data: {
            user_id: user.id,
            document_id: job.document_id,
            title: `${fileName} - Flashcards`
          }
        });
        
        await prisma.flashcards.createMany({
          data: cardsData.map((c: any) => ({
            deck_id: deck.id,
            front_content: c.front_content || c.front || "Error", 
            back_content: c.back_content || c.back || "Error"
          }))
        });
        outputId = deck.id;
        break;
      }

      case 'quiz': {
        // Fix: Removed 'fileName' argument. The function expects (content, numQuestions, ...).
        // Filename is used for the title fallback below anyway.
        const quizResult = await generateQuizFromContent(text);
        
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

      // ✅ NEW: Podcast Generation
      case 'podcast': {
        const podcast = await generatePodcastForDocument(
            text, 
            fileName, 
            user.id, 
            job.document_id, 
            'document'
        );
        
        if (!podcast) throw new Error("Podcast generation returned null");
        outputId = podcast.id;
        break;
      }

      // ✅ NEW: Chat Embeddings (for RAG)
      case 'embedding': {
        const vector = await generateEmbeddings(text.slice(0, 8000));
        
        // Using raw SQL for pgvector insertion
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

    // Check if ALL jobs for this document are done
    // If so, mark the document itself as 'completed'
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