// src/app/api/generate-notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { ApiResponse } from '@/types/database';
import { callAIToGenerateNote } from '@/lib/aiGeneration';
import { YoutubeTranscript } from 'youtube-transcript';

export const runtime = "nodejs";
export const maxDuration = 60; // Allow 60s for AI generation

const MIN_CONTENT_LENGTH = 50;

// --- Helper Functions ---

function extractTextFromHtml(html: string): string {
    // Remove scripts
    let cleanHtml = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
    // Remove styles
    cleanHtml = cleanHtml.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
    // Replace tags with spaces
    cleanHtml = cleanHtml.replace(/<\/?[^>]+(>|$)/g, " ");
    // Collapse whitespace
    cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim();
    return cleanHtml;
}

function isContentMeaningful(content: string): boolean {
    if (!content) return false;
    // Remove tags and check if remaining text is substantial
    const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 20;
}

// --- Main Handler ---

export async function POST(request: NextRequest) {
  console.log("DEBUG: POST /api/generate-notes starting...");
  try {
    // 1. Auth Check
    const user = await requireAuth(request);
    
    // 2. Parse Body Safely
    let body: any = {};
    try {
        const textBody = await request.text();
        if (textBody) {
            body = JSON.parse(textBody);
        }
    } catch (e) {
        console.error("Failed to parse JSON body:", e);
        return NextResponse.json<ApiResponse>({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    let { text, url, youtubeUrl, documentId } = body;
    console.log(`[API] Payload: docId=${documentId}, url=${!!url}, youtube=${!!youtubeUrl}, textLength=${text?.length}`);

    // 3. ROBUSTNESS FIX: Backfill Text from DB
    // If we only have a documentId (and no explicit text/url), fetch the text content from the database.
    if (!text && !url && !youtubeUrl && documentId) {
        // Trap invalid "undefined" string from frontend bugs
        if (documentId === 'undefined' || documentId === 'null') {
             return NextResponse.json<ApiResponse>({ success: false, error: "Invalid document ID provided." }, { status: 400 });
        }

        console.log(`[API] Fetching extracted_text for documentId: ${documentId}`);
        const doc = await prisma.documents.findUnique({
            where: { id: documentId, user_id: user.id },
            select: { extracted_text: true, file_name: true }
        });

        if (doc && doc.extracted_text) {
            console.log(`[API] Text retrieved from DB (${doc.extracted_text.length} chars)`);
            text = doc.extracted_text;
        } else {
            return NextResponse.json<ApiResponse>({ success: false, error: "Document not found or has no extracted text." }, { status: 404 });
        }
    }

    // 4. Input Validation
    if (!url && !text && !youtubeUrl) { 
        return NextResponse.json<ApiResponse>({ success: false, error: "Either text, a URL, a YouTube URL, or a valid documentId is required." }, { status: 400 }); 
    }
    
    let sourceContent = text || "";
    let noteTitlePrefix = "Notes from text";

    // 5. Handle URL Source
    if (url) { 
        noteTitlePrefix = "Notes from URL";
        try { 
            console.log(`[API] Fetching URL: ${url}`);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            if (!response.ok) { throw new Error(`Fetch failed with status: ${response.status} ${response.statusText}`); }
            const html = await response.text();
            sourceContent = extractTextFromHtml(html); 
        } catch (e: any) { 
            console.error(`URL process error for ${url}:`, e.message);
            return NextResponse.json<ApiResponse>({ success: false, error: `URL process error: ${e.message}` }, { status: 400 }); 
        } 
    } 
    // 6. Handle YouTube Source
    else if (youtubeUrl) {
        noteTitlePrefix = "Notes from YouTube Video";
        try {
            console.log(`[API] Fetching YouTube transcript: ${youtubeUrl}`);
            const transcript = await YoutubeTranscript.fetchTranscript(youtubeUrl);
            if (!transcript || transcript.length === 0) {
                throw new Error("No transcript found for this video.");
            }
            sourceContent = transcript.map(item => item.text).join(' ');
        } catch (e: any) {
             console.error(`YouTube transcript error:`, e.message);
             if (e.message.includes('No transcript found') || e.message.includes('Transcript is disabled')) {
                return NextResponse.json<ApiResponse>({ success: false, error: "No transcript is available for this video." }, { status: 400 });
             }
            return NextResponse.json<ApiResponse>({ success: false, error: `YouTube transcript error: ${e.message}` }, { status: 400 }); 
        }
    } else if (documentId) {
        noteTitlePrefix = "Notes from Document";
    }
    
    // 7. Content Length Check
    if (!sourceContent || sourceContent.trim().length < MIN_CONTENT_LENGTH) { 
        return NextResponse.json<ApiResponse>({ success: false, error: `Source content too short (minimum ${MIN_CONTENT_LENGTH} chars). The URL might be a web app or have anti-scraping measures.` }, { status: 400 }); 
    }

    // 8. Usage Check
    const usage = await checkAIGenerationUsageLimit(user.id);
    if (!usage.canGenerate) {
      return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: usage.error || "limit_exceeded", 
          message: usage.message 
      }, { status: 403 });
    }

    // 9. Generate Notes with AI
    console.log("[API] Calling AI Service...");
    const generatedContent = await callAIToGenerateNote(sourceContent.trim());
    
    if (!generatedContent || !isContentMeaningful(generatedContent)) {
        throw new Error("AI failed to generate meaningful content for this note.");
    }
    
    // 10. Save to Database
    let savedNote;
    try {
        let validDocumentId = null;
        if (documentId && documentId !== 'undefined' && documentId !== 'null') {
             validDocumentId = documentId;
        }

        // Extract a title from the markdown (first H1 or first line)
        let noteTitle = noteTitlePrefix;
        const lines = generatedContent.split('\n');
        const titleLine = lines.find(l => l.startsWith('# '));
        if (titleLine) {
             noteTitle = titleLine.replace('# ', '').trim();
        } else if (lines.length > 0 && lines[0].trim().length > 0) {
             noteTitle = lines[0].trim();
        }

        savedNote = await prisma.notes.create({ 
            data: { 
                user_id: user.id, 
                title: noteTitle.substring(0, 255), 
                content: generatedContent.trim(),
                document_id: validDocumentId
            } 
        });
    } catch (dbError: any) {
        console.error("DB Save Error:", dbError);
        throw new Error(`Failed to save note to database: ${dbError.message}`);
    }

    // 11. Increment Usage
    try {
        await incrementAIGenerationUsage(user.id, 1);
    } catch (e) {
        console.error("Failed to increment usage stats:", e);
    }

    return NextResponse.json<ApiResponse<{ count: number; noteId: string }>>({
        success: true,
        data: { count: 1, noteId: savedNote.id }, 
        message: `Note generated successfully.`
    }, { status: 201 });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error("Error in /api/generate-notes POST handler:", error);
    
    if (error instanceof Prisma.PrismaClientInitializationError) {
         return NextResponse.json<ApiResponse>({ success: false, error: "Database connection failed." }, { status: 503 });
    }

    return NextResponse.json<ApiResponse>({ success: false, error: error.message || "Internal server error." }, { status: 500 });
  }
}