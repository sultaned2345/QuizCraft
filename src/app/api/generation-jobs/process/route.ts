import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  generateDocumentSummary, 
  generateQuizFromText, 
  generateFlashcardsFromText 
} from '@/lib/ai-service';
import { generateEmbeddings } from '@/lib/embeddings';

// Allow this API to run for up to 5 minutes (AI generation is slow)
export const maxDuration = 300; 
export const runtime = 'nodejs';

export async function POST(req: Request) {
  let jobId: string | null = null;

  try {
    // 1. Fetch the oldest PENDING job
    // We fetch 'include: { document: true }' to get the text content
    const job = await prisma.generation_jobs.findFirst({
      where: { status: 'pending' },
      include: { 
        document: true 
      },
      orderBy: { created_at: 'asc' }
    });

    if (!job) {
      return NextResponse.json({ message: 'No pending jobs found.' });
    }

    jobId = job.id;
    console.log(`[Job ${jobId}] Starting processing. Type: ${job.job_type}`);

    // 2. Mark as PROCESSING (Lock the job)
    await prisma.generation_jobs.update({
      where: { id: jobId },
      data: { status: 'processing' }
    });

    // 3. Validate Content
    const textContext = job.document.extracted_text;
    if (!textContext) {
      throw new Error("Document has no extracted text content.");
    }

    let outputId = null;
    let outputType = '';

    // =========================================================
    // SWITCH: HANDLE JOB TYPES
    // =========================================================

    if (job.job_type === 'summary') {
      // --- A. SUMMARY JOB (Standard "New File" Flow) ---
      
      // 1. Generate Embeddings (The "Brain")
      // We run this here because 'summary' is usually the first job triggered on upload
      try {
        console.log(`[Job ${jobId}] Generating embeddings for RAG...`);
        await generateEmbeddings(
          textContext, 
          job.document.id, 
          'document', 
          job.user_id
        );
      } catch (embError) {
        console.error(`[Job ${jobId}] Embedding generation failed (continuing):`, embError);
      }

      // 2. Generate Summary Text
      console.log(`[Job ${jobId}] Generating AI Summary...`);
      const summaryMarkdown = await generateDocumentSummary(textContext, job.document.file_name);
      
      // 3. Save as Note
      const note = await prisma.notes.create({
        data: {
          user_id: job.user_id,
          title: `Summary: ${job.document.file_name}`,
          content: summaryMarkdown,
          tags: ['ai-generated', 'summary', 'study-guide'],
        }
      });
      outputId = note.id;
      outputType = 'note';

      // 4. Update Document Metadata
      await prisma.documents.update({
        where: { id: job.document_id },
        data: { ai_summary: summaryMarkdown }
      });

    } 
    else if (job.job_type === 'quiz') {
      // --- B. QUIZ JOB ---
      console.log(`[Job ${jobId}] Generating Quiz...`);
      
      const questions = await generateQuizFromText(textContext, 5); // Default 5 questions

      if (!questions || questions.length === 0) {
        throw new Error("AI returned no questions.");
      }

      const quiz = await prisma.quiz.create({
        data: {
          userId: job.user_id,
          title: `Practice: ${job.document.file_name}`,
          // Prisma handles creating the nested questions automatically
          questions: {
            create: questions.map((q: any) => ({
              question_text: q.question_text,
              question_type: q.question_type,
              correct_answer: q.correct_answer,
              options: q.options || [],
              explanation: q.explanation
            }))
          }
        }
      });
      outputId = quiz.id;
      outputType = 'quiz';

    } 
    else if (job.job_type === 'flashcard') {
      // --- C. FLASHCARD JOB ---
      console.log(`[Job ${jobId}] Generating Flashcards...`);

      const cards = await generateFlashcardsFromText(textContext, 10); // Default 10 cards

      if (!cards || cards.length === 0) {
        throw new Error("AI returned no flashcards.");
      }

      const deck = await prisma.flashcard_decks.create({
        data: {
          user_id: job.user_id,
          title: `Terms: ${job.document.file_name}`,
          flashcards: {
            create: cards.map((c: any) => ({
              front_content: c.front,
              back_content: c.back
            }))
          }
        }
      });
      outputId = deck.id;
      outputType = 'deck';
    }

    // 4. LINK CONTENT TO PROJECT
    // We find the Project this document belongs to, then link the new Output (Quiz/Note/Deck) to it.
    if (outputId && outputType) {
      await linkContentToProject(job.user_id, job.document_id, outputId, outputType);
    }

    // 5. MARK COMPLETE
    await prisma.generation_jobs.update({
      where: { id: jobId },
      data: { 
        status: 'complete', 
        output_id: outputId 
      }
    });

    console.log(`[Job ${jobId}] Complete. Created ${outputType} (${outputId})`);
    return NextResponse.json({ success: true, jobId, outputId });

  } catch (error: any) {
    console.error("Job Processing Critical Error:", error);
    
    // Attempt to mark as failed
    if (jobId) {
      try {
        await prisma.generation_jobs.update({
          where: { id: jobId },
          data: { 
            status: 'failed', 
            error_message: error.message || 'Unknown processing error' 
          }
        });
      } catch (dbError) {
        console.error("Failed to update job status in DB:", dbError);
      }
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Helper: Finds which project the source document belongs to,
 * then links the new generated content (Note/Quiz) to that same project.
 */
async function linkContentToProject(userId: string, sourceDocId: string, contentId: string, contentType: string) {
  try {
    // 1. Find the link between the Document and a Project
    const sourceLink = await prisma.project_content_links.findFirst({
      where: { 
        content_id: sourceDocId, 
        content_type: 'document' 
      }
    });
    
    // 2. If the document is part of a project, add the new content to the same project
    if (sourceLink) {
      await prisma.project_content_links.create({
        data: {
          user_id: userId,
          project_id: sourceLink.project_id,
          content_id: contentId,
          content_type: contentType
        }
      });
      console.log(`[Link] Linked new ${contentType} to Project ${sourceLink.project_id}`);
    }
  } catch (error) {
    console.error("Failed to link generated content to project:", error);
    // We don't throw here because the content was created successfully, 
    // it just might be "orphaned" (visible in 'All Notes' but not specific project view)
  }
}