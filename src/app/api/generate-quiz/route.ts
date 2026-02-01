// src/app/api/generate-quiz/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { callAIToGenerateQuiz } from '@/lib/aiGeneration';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { extractTextFromServerFile } from '@/lib/file-parser.server';
import { YoutubeTranscript } from 'youtube-transcript';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow 60s for AI processing

const MIN_CONTENT_LENGTH = 50;

// Helper to clean HTML from URLs
function extractTextFromHtml(html: string): string {
    let cleanHtml = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
    cleanHtml = cleanHtml.replace(/<\/?[^>]+(>|$)/g, " ");
    return cleanHtml.replace(/\s+/g, ' ').trim();
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    
    // 1. Parse Body
    let body: any = {};
    try {
      const textBody = await req.text();
      if (textBody) body = JSON.parse(textBody);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let { text, documentId, url, youtubeUrl, numQuestions, difficulty = 'medium', type = 'MIXED' } = body;

    // 2. Question Count Logic (7 to 12 questions default)
    if (!numQuestions) {
        // Random number between 7 and 12
        numQuestions = Math.floor(Math.random() * (12 - 7 + 1)) + 7;
    } else if (numQuestions < 5) {
        numQuestions = 7; // Enforce minimum
    }

    // 3. Source Resolution & Self-Healing
    
    // A. Handle Document ID (with Self-Healing)
    if ((!text || text.length < MIN_CONTENT_LENGTH) && documentId) {
       console.log(`[QuizAPI] Text missing/short for doc ${documentId}. Checking DB...`);
       
       const doc = await prisma.documents.findUnique({
         where: { id: documentId, user_id: user.id },
         select: { id: true, extracted_text: true, file_name: true, storage_path: true, file_type: true }
       });

       if (!doc) {
         return NextResponse.json({ error: 'Document not found' }, { status: 404 });
       }

       // Case 1: Text exists in DB
       if (doc.extracted_text && doc.extracted_text.length >= MIN_CONTENT_LENGTH) {
         text = doc.extracted_text;
         console.log(`[QuizAPI] Retrieved text from DB (${text.length} chars).`);
       } 
       // Case 2: Text missing -> Self-Heal from Storage
       else if (doc.storage_path) {
         console.warn(`[QuizAPI] Triggering Self-Healing for ${doc.file_name}...`);
         
         const { data: fileData, error: dlError } = await supabaseAdmin.storage
           .from('documents')
           .download(doc.storage_path);
           
         if (dlError || !fileData) {
           console.error("[QuizAPI] Download failed:", dlError);
           return NextResponse.json({ error: 'Failed to recover file content from storage.' }, { status: 500 });
         }

         const buffer = Buffer.from(await fileData.arrayBuffer());
         const mockFile = { name: doc.file_name, type: fileData.type } as unknown as File;
         
         try {
           // Use the robust server-side parser
           text = await extractTextFromServerFile(mockFile, buffer);
           
           // Update DB to prevent doing this again
           await prisma.documents.update({
             where: { id: doc.id },
             data: { extracted_text: text, processing_status: 'completed' }
           });
           console.log(`[QuizAPI] Self-Healing successful. Recovered ${text.length} chars.`);
         } catch (err) {
           console.error("[QuizAPI] Re-parse failed:", err);
           return NextResponse.json({ error: 'Failed to re-process document text.' }, { status: 422 });
         }
       }
    }

    // B. Handle URL
    if ((!text || text.length < MIN_CONTENT_LENGTH) && url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch URL");
            text = extractTextFromHtml(await response.text());
        } catch (e: any) {
            return NextResponse.json({ error: `URL error: ${e.message}` }, { status: 400 });
        }
    }

    // C. Handle YouTube
    if ((!text || text.length < MIN_CONTENT_LENGTH) && youtubeUrl) {
        try {
            const transcript = await YoutubeTranscript.fetchTranscript(youtubeUrl);
            text = transcript.map(t => t.text).join(' ');
        } catch (e: any) {
            return NextResponse.json({ error: "No transcript available for this video." }, { status: 400 });
        }
    }

    // 4. Final Validation
    if (!text || text.length < MIN_CONTENT_LENGTH) {
      return NextResponse.json({ error: 'No text content available to generate quiz.' }, { status: 400 });
    }

    // 5. Usage Check
    const usage = await checkAIGenerationUsageLimit(user.id);
    if (!usage.canGenerate) {
      return NextResponse.json({ error: usage.error }, { status: 403 });
    }

    // 6. Generate Quiz
    console.log(`[QuizAPI] Generating ${numQuestions} questions...`);
    const quizData = await callAIToGenerateQuiz(text, numQuestions, difficulty, type);
    
    if (!quizData) {
        throw new Error("AI failed to generate quiz structure.");
    }

    // 7. Save to DB (Corrected Schema)
    // Using prisma.quiz (singular) based on 'model Quiz' in schema.prisma
    const savedQuiz = await prisma.quiz.create({
      data: {
        userId: user.id, // Matches 'userId' field in schema
        document_id: documentId || null,
        title: quizData.title || `Generated ${difficulty} Quiz`,
        // Note: 'description', 'score', 'status' fields are NOT in your schema, so we skip them.
        is_public: false,
        questions: {
          create: quizData.questions.map((q: any) => ({
             question_text: q.question_text,
             question_type: q.question_type,
             correct_answer: q.correct_answer,
             options: q.options || [], // Ensure JSON compatibility
             explanation: q.explanation || ''
          }))
        }
      }
    });

    // 8. Increment Usage
    await incrementAIGenerationUsage(user.id, 1);

    return NextResponse.json({ 
        success: true, 
        quizId: savedQuiz.id,
        message: `Generated ${quizData.questions.length} questions.`
    });

  } catch (error: any) {
    console.error("Quiz Gen Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}