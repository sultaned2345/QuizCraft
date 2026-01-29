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

const MIN_CONTENT_LENGTH = 50;

function extractTextFromHtml(html: string): string {
    let cleanHtml = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
    cleanHtml = cleanHtml.replace(/<\/?[^>]+(>|$)/g, " ");
    cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim();
    return cleanHtml;
}

function isContentMeaningful(content: string): boolean {
    if (!content) return false;
    const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 20;
}

export async function POST(request: NextRequest) {
  console.log("DEBUG: POST /api/generate-notes starting...");
  try {
    const user = await requireAuth(request);
    console.log("DEBUG: Authentication successful, user ID:", user.id);

    let body;
    try { 
        body = await request.json(); 
    } catch(e) { 
        body = {}; 
    }
    
    // We allow 'text' to be modified if we fetch it from the DB
    let { text, url, youtubeUrl, documentId } = body;

    // --- FIX: Fetch content from DB if missing ---
    if (!text && !url && !youtubeUrl && documentId) {
        // Guard against "undefined" string from frontend
        if (documentId === 'undefined') {
            return NextResponse.json({ success: false, error: "Invalid document ID" }, { status: 400 });
        }

        console.log(`DEBUG: Fetching content for documentId: ${documentId}`);
        const doc = await prisma.documents.findUnique({
            where: { id: documentId, user_id: user.id },
            select: { extracted_text: true }
        });

        if (doc && doc.extracted_text) {
            text = doc.extracted_text;
        } else {
            return NextResponse.json<ApiResponse>({ success: false, error: "Document not found or has no text content." }, { status: 404 });
        }
    }
    // ---------------------------------------------

    if (!url && !text && !youtubeUrl) { 
        return NextResponse.json<ApiResponse>({ success: false, error: "Either text, a URL, a YouTube URL, or a valid documentId is required." }, { status: 400 }); 
    }
    
    let sourceContent = text;
    let noteTitlePrefix = "Notes from text";

    // 1. Handle URL Source
    if (url) { 
        console.log(`DEBUG: Attempting to fetch URL: ${url}`);
        noteTitlePrefix = "Notes from URL";
        try { 
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            if (!response.ok) { throw new Error(`Fetch failed with status: ${response.status} ${response.statusText}`); }
            const html = await response.text();
            sourceContent = extractTextFromHtml(html); 
        } catch (e: any) { 
            console.error(`DEBUG: URL process error for ${url}:`, e.message);
            return NextResponse.json<ApiResponse>({ success: false, error: `URL process error: ${e.message}` }, { status: 400 }); 
        } 
    } 
    // 2. Handle YouTube Source
    else if (youtubeUrl) {
        console.log(`DEBUG: Attempting to fetch transcript for YouTube URL: ${youtubeUrl}`);
        noteTitlePrefix = "Notes from YouTube Video";
        try {
            const transcript = await YoutubeTranscript.fetchTranscript(youtubeUrl);
            if (!transcript || transcript.length === 0) {
                throw new Error("No transcript found for this video.");
            }
            sourceContent = transcript.map(item => item.text).join(' ');
        } catch (e: any) {
             console.error(`DEBUG: YouTube transcript error for ${youtubeUrl}:`, e.message);
             if (e.message.includes('No transcript found')) {
                return NextResponse.json<ApiResponse>({ success: false, error: "No transcript is available for this video." }, { status: 400 });
             }
            return NextResponse.json<ApiResponse>({ success: false, error: `YouTube transcript error: ${e.message}` }, { status: 400 }); 
        }
    } else if (documentId) {
        noteTitlePrefix = "Notes from Document";
    }
    
    // 3. Content Validation
    if (!sourceContent || sourceContent.trim().length < MIN_CONTENT_LENGTH) { 
        return NextResponse.json<ApiResponse>({ success: false, error: `Source content too short (minimum ${MIN_CONTENT_LENGTH} chars). The URL might be a web app or have anti-scraping measures.` }, { status: 400 }); 
    }

    // 4. Usage Limits Check
    let usage;
    try {
        usage = await checkAIGenerationUsageLimit(user.id);
    } catch (dbError: any) {
        if (dbError instanceof Prisma.PrismaClientInitializationError || (dbError.message && dbError.message.includes("Can't reach database server"))) {
            throw dbError; 
        }
        throw new Error(`Failed to check usage limits: ${dbError.message}`);
    }

    const incrementCount = 1;
    const isLimitDefined = usage.limit !== undefined && usage.limit !== Infinity;
    const isOverLimit = isLimitDefined && 
                        usage.currentCount !== undefined && 
                        (usage.currentCount + incrementCount) > (usage.limit as number);

    if (!usage.canGenerate || isOverLimit) {
      const limitVal = usage.limit !== undefined && usage.limit !== Infinity ? usage.limit : 0;
      const currentVal = usage.currentCount !== undefined ? usage.currentCount : 0;
      const remaining = Math.max(0, limitVal - currentVal);
      
      return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: usage.error, 
          message: usage.message || `Usage limit exceeded. ${remaining} generations left.`
      }, { status: 403 });
    }

    // 5. Generate with AI
    const generatedContent = await callAIToGenerateNote(sourceContent.trim());
    
    if (!generatedContent || !isContentMeaningful(generatedContent)) {
        throw new Error("AI failed to generate meaningful content for this note.");
    }
    
    // 6. Save to Database
    let savedNote;
    try {
        console.log("DEBUG: Saving note...");
        
        let validDocumentId = null;
        if (documentId && documentId !== 'undefined') {
             // Simple regex check for UUID validity could be added here, but the DB call earlier implicitly validates existence
             validDocumentId = documentId;
        }

        let noteTitle = noteTitlePrefix;
        const lines = generatedContent.split('\n');
        if (lines.length > 0 && lines[0].startsWith('# ')) {
             noteTitle = lines[0].substring(2).trim();
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
        if (dbError instanceof Prisma.PrismaClientInitializationError || (dbError.message && dbError.message.includes("Can't reach database server"))) {
            throw dbError; 
        }
        throw new Error(`Failed to save note to database: ${dbError.message}`);
    }

    // 7. Increment Usage
    try {
        await incrementAIGenerationUsage(user.id, 1); 
    } catch (usageError: any) {
        console.error("CRITICAL DEBUG: Failed to update AI usage count AFTER saving note:", usageError);
    }

    return NextResponse.json<ApiResponse<{ count: number; noteId: string }>>({
        success: true,
        data: { count: 1, noteId: savedNote.id }, 
        message: `Note generated successfully.`
    }, { status: 201 });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error("Error in /api/generate-notes POST handler:", error);

    if (error.message?.startsWith("Failed to generate notes") || error.message?.includes("AI generated invalid")) {
        return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 502 });
    }
    if (error instanceof Prisma.PrismaClientInitializationError || (error.message && error.message.includes("Can't reach database server"))) {
         return NextResponse.json<ApiResponse>({ success: false, error: `Database connection error: ${error.message}` }, { status: 503 });
    }

    return NextResponse.json<ApiResponse>({ success: false, error: error.message || "Internal server error during note generation." }, { status: 500 });
  }
}