// src/app/api/generation-jobs/process/route.ts
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

// Allow this route to run for up to 60 seconds (Vercel Pro/Hobby limit)
export const maxDuration = 60; 

export async function POST(req: NextRequest) {
  let jobId = ""; 
  console.log("---------------------------------------------------------");
  console.log("[Process API] ⚙️ Incoming Process Request");

  try {
    // 1. Authentication
    // We expect the auth cookie to be passed from the 'start' route
    const user = await requireAuth(req);
    if (!user) {
        console.error("[Process API] ❌ Unauthorized: No valid session found.");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse Body
    const body = await req.json();
    jobId = body.jobId;

    if (!jobId) {
      console.error("[Process API] ❌ Missing Job ID in body");
      return NextResponse.json({ error: "Missing Job ID" }, { status: 400 });
    }

    console.log(`[Process API] 🔄 Processing Job ID: ${jobId}`);

    // 3. Fetch Job and Document
    const job = await prisma.generation_jobs.findUnique({
      where: { id: jobId },
      include: { document: true }
    });

    if (!job) {
      console.error("[Process API] ❌ Job not found in DB");
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Security check: ensure the job belongs to the authenticated user
    if (job.user_id !== user.id) {
        console.error(`[Process API] ❌ User mismatch. Job User: ${job.user_id}, Current User: ${user.id}`);
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Idempotency check
    if (job.status === 'completed') {
      console.log("[Process API] ⚠️ Job already completed. Skipping.");
      return NextResponse.json({ success: true, message: "Already completed" });
    }

    // 4. Update status to 'processing'
    await prisma.generation_jobs.update({
      where: { id: jobId },
      data: { status: 'processing' }
    });

    const text = job.document.extracted_text || "";
    const fileName = job.document.file_name;
    let outputId: string | null = null;

    if (!text && job.job_type !== 'podcast') { 
        // Podcast might work with just a title/prompt in future, but generally we need text
        throw new Error("Document has no extracted text content.");
    }

    console.log(`[Process API] 🧠 Generating '${job.job_type}' for '${fileName}'...`);

    // 5. Execute Logic based on Job Type
    switch (job.job_type) {
      case 'note': {
        const noteContent = await generateNotesFromContent(text);
        
        if (!noteContent) throw new Error("AI failed to generate notes (returned null/empty).");

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
        
        // Batch insert flashcards
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

        // Insert questions one by one (createMany doesn't support nested relations easily in all Prisma versions yet)
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

      case 'podcast': {
        // This function handles the DB creation internally usually, 
        // but if it returns the object, we just grab the ID.
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

      case 'embedding': {
        // Truncate to avoid token limits if necessary
        const chunk = text.slice(0, 8000); 
        const vector = await generateEmbeddings(chunk);
        
        if (!vector) throw new Error("Failed to generate embeddings.");

        // Using raw SQL because Prisma doesn't natively support pgvector syntax cleanly without extensions
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

      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

    // 6. Mark Job Complete
    await prisma.generation_jobs.update({
      where: { id: jobId },
      data: { 
        status: 'completed',
        output_id: outputId
      }
    });
    
    console.log(`[Process API] ✅ Job Completed Successfully. Output ID: ${outputId}`);

    // 7. Check if ALL jobs for this document are done
    // If so, mark the document itself as 'completed' so it stops showing "Processing..." in the UI
    const pendingJobs = await prisma.generation_jobs.count({
      where: { 
        document_id: job.document_id,
        status: { not: 'completed' } // Count anything that is NOT completed (pending, processing, failed)
      }
    });

    if (pendingJobs === 0) {
      console.log(`[Process API] All jobs finished for Document ${job.document_id}. Marking doc as completed.`);
      await prisma.documents.update({
        where: { id: job.document_id },
        data: { processing_status: 'completed' }
      });
    }

    return NextResponse.json({ success: true, jobId, outputId });

  } catch (e: any) {
    console.error(`[Process API] 💥 Job Processing Failed:`, e);
    
    // Attempt to mark the job as failed in the DB so it doesn't hang forever
    if (jobId) {
        try {
            await prisma.generation_jobs.update({
                where: { id: jobId },
                data: { 
                    status: 'failed',
                    error_message: e.message || "Unknown error during processing."
                }
            });
        } catch (dbErr) {
            console.error("Failed to update job status to failed:", dbErr);
        }
    }

    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}