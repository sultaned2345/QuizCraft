import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  generateDocumentSummary, 
  generateFlashcardsFromText, 
  generateQuizFromText,
  generateEmbeddings // We will add this to ai-service next
} from '@/lib/ai-service';

export const maxDuration = 60; // Allow 60s timeout on Vercel Pro

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { jobId } = await req.json();

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
    let outputId = null;

    // 2. Execute Logic based on Job Type
    switch (job.job_type) {
      case 'note': {
        const noteContent = await generateDocumentSummary(text, title);
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
        if (cardsData.length > 0) {
          const deck = await prisma.flashcard_decks.create({
            data: {
              user_id: user.id,
              document_id: job.document_id,
              title: `${title} - Flashcards`
            }
          });
          
          await prisma.flashcards.createMany({
            data: cardsData.map((c: any) => ({
              deck_id: deck.id,
              front_content: c.front,
              back_content: c.back
            }))
          });
          outputId = deck.id;
        }
        break;
      }

      case 'quiz': {
        const questionsData = await generateQuizFromText(text, 10);
        if (questionsData.length > 0) {
          const quiz = await prisma.quiz.create({
            data: {
              userId: user.id,
              document_id: job.document_id,
              title: `${title} - Pop Quiz`,
              time_limit_minutes: 15
            }
          });

          // Create questions sequentially or look into createMany if schema allows (schema has complex relations, usually loop is safer for initial nesting)
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
    console.error(`Job ${req.json['jobId']} failed:`, e);
    // Mark job as failed
    if (req.body) {
        // Logic to extract ID and mark failed would go here
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}