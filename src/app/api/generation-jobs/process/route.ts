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

// Allow this route to run for up to 60 seconds (Vercel Limit)
// If you are on a Pro plan, you can increase this.
export const maxDuration = 60; 

export async function POST(req: NextRequest) {
  let jobId = ""; 
  
  try {
    // 1. Authentication
    // The 'start' route forwards the user's cookie, so requireAuth works here.
    const user = await requireAuth(req);
    const body = await req.json();
    jobId = body.jobId;

    if (!jobId) {
      return NextResponse.json({ error: "Missing Job ID" }, { status: 400 });
    }

    // 2. Fetch Job & Document Data
    const job = await prisma.generation_jobs.findUnique({
      where: { id: jobId },
      include: { document: true }
    });

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    
    // Security Check: Ensure user owns this job
    if (job.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Idempotency: Don't re-run completed jobs
    if (job.status === 'completed') {
      return NextResponse.json({ success: true, message: "Job already completed" });
    }

    // 3. Mark as Processing
    await prisma.generation_jobs.update({
      where: { id: jobId },
      data: { status: 'processing' }
    });

    const text = job.document.extracted_text || "";
    const fileName = job.document.file_name;
    let outputId: string | null = null;

    console.log(`[Worker] Processing '${job.job_type}' for Job ${jobId}...`);

    // 4. Execute Logic based on Job Type
    switch (job.job_type) {
      case 'note': {
        if (!text) throw new Error("No text content available for notes.");
        
        const noteContent = await generateNotesFromContent(text);
        if (!noteContent) throw new Error("AI returned empty content for notes.");

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
        if (!text) throw new Error("No text content available for flashcards.");

        const cards = await generateFlashcardsFromContent(text);
        if (!cards || cards.length === 0) throw new Error("AI returned 0 flashcards.");

        // Transaction: Create Deck -> Create Cards
        const deck = await prisma.flashcard_decks.create({
          data: {
            user_id: user.id,
            document_id: job.document_id,
            title: `${fileName} - Flashcards`
          }
        });

        await prisma.flashcards.createMany({
          data: cards.map((c: any) => ({
            deck_id: deck.id,
            front_content: c.front_content || c.front || "Error",
            back_content: c.back_content || c.back || "Error"
          }))
        });
        outputId = deck.id;
        break;
      }

      case 'quiz': {
        if (!text) throw new Error("No text content available for quiz.");

        const quizRes = await generateQuizFromContent(text);
        if (!quizRes || !quizRes.questions || quizRes.questions.length === 0) {
           throw new Error("AI generated 0 questions.");
        }

        const quiz = await prisma.quiz.create({
          data: {
            userId: user.id,
            document_id: job.document_id,
            title: quizRes.title || `${fileName} - Quiz`,
            time_limit_minutes: 15,
            questions: {
              create: quizRes.questions.map((q: any) => ({
                question_text: q.question_text,
                question_type: q.question_type,
                correct_answer: q.correct_answer,
                options: q.options || [],
                explanation: q.explanation || ""
              }))
            }
          }
        });
        outputId = quiz.id;
        break;
      }

      case 'podcast': {
        // Only run if specifically requested (text is optional if we implement topic-based later, but required for now)
        if (!text) throw new Error("No text content for podcast generation.");
        
        const podcast = await generatePodcastForDocument(
          text, 
          fileName, 
          user.id, 
          job.document_id, 
          'document'
        );
        
        if (!podcast) throw new Error("Podcast generation returned null.");
        outputId = podcast.id;
        break;
      }

      case 'embedding': {
        if (!text) break; // Skip if no text
        // Truncate to first 2000 chars to save costs/tokens for search
        const vector = await generateEmbeddings(text.slice(0, 2000));
        
        if (vector) {
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
           outputId = job.document_id;
        }
        break;
      }

      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

    // 5. Mark Job as Completed
    await prisma.generation_jobs.update({
      where: { id: jobId },
      data: { 
        status: 'completed',
        output_id: outputId,
        error_message: null // Clear any previous errors
      }
    });

    console.log(`[Worker] Job ${jobId} Completed Successfully.`);

    // 6. Check for Document Completion
    // If NO other jobs are "pending" or "processing" for this doc, mark the doc as complete.
    const remainingJobs = await prisma.generation_jobs.count({
      where: { 
        document_id: job.document_id,
        status: { in: ['pending', 'processing'] }
      }
    });

    if (remainingJobs === 0) {
      console.log(`[Worker] All jobs finished for Document ${job.document_id}. Marking complete.`);
      await prisma.documents.update({
        where: { id: job.document_id },
        data: { processing_status: 'completed' }
      });
    }

    return NextResponse.json({ success: true, outputId });

  } catch (e: any) {
    console.error(`[Worker Error] Job ${jobId}:`, e);

    // Fail the job in the DB so it doesn't stay 'processing' forever
    if (jobId) {
      try {
        await prisma.generation_jobs.update({
          where: { id: jobId },
          data: { 
            status: 'failed', 
            error_message: e.message || "Unknown processing error" 
          }
        });
      } catch (dbErr) {
        console.error("Failed to update job status to failed:", dbErr);
      }
    }

    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
  }
}