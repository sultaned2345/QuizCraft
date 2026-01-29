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
export const maxDuration = 60; // Increased timeout for AI

const MIN_CONTENT_LENGTH = 50;

// --- Helper Functions (Restored) ---

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

// --- Main Handler ---

export async function POST(request: NextRequest) {
  console.log("DEBUG: POST /api/generate-notes starting...");
  try {
    const user = await requireAuth(request);
    console.log("DEBUG: Authentication successful, user ID:", user.id);

    // 1. Safe Body Parsing
    let body: any = {};
    try {
        const rawText = await request.text();
        if (rawText) body = JSON.parse(rawText);
    } catch (e) {
        console.error("Error parsing JSON body:", e);
        return NextResponse.json<ApiResponse>({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    let { text, url, youtubeUrl, documentId } = body;

    // 2. ROBUSTNESS FIX: Fetch text from DB if missing
    // If we have a documentId but no text/url, we fetch the extracted text from the DB.
    if (!text && !url && !youtubeUrl && documentId) {
        // Trap invalid "undefined" string from frontend bugs
        if (documentId === 'undefined' || documentId === 'null') {
             return NextResponse.json<ApiResponse>({ success: false, error: "Invalid document ID provided." }, { status: 400 });
        }

        console.log(`DEBUG: Fetching content for documentId: ${documentId}`);
        const doc = await prisma.documents.findUnique({
            where: { id: documentId, user_id: user.id },
            select: { extracted_text: true, file_name: true }
        });

        if (doc && doc.extracted_text) {
            console.log(`DEBUG: Retrieved ${doc.extracted_text.length} chars from document "${doc.file_name}"`);
            text = doc.extracted_text;
        } else {
            return NextResponse.json<ApiResponse>({ success: false, error: "Document not found or has no extracted text." }, { status: 404 });
        }
    }

    // 3. Validation
    if (!url && !text && !youtubeUrl) { 
        return NextResponse.json<ApiResponse>({ success: false, error: "Either text, a URL, a YouTube URL, or a valid documentId is required." }, { status: 400 }); 
    }
    
    let sourceContent = text || "";
    let noteTitlePrefix = "Notes from text";

    // 4. Handle URL Source
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
    // 5. Handle YouTube Source
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
    
    // 6. Content Validation
    if (!sourceContent || sourceContent.trim().length < MIN_CONTENT_LENGTH) { 
        return NextResponse.json<ApiResponse>({ success: false, error: `Source content too short (minimum ${MIN_CONTENT_LENGTH} chars).` }, { status: 400 }); 
    }

    // 7. Usage Limits Check
    let usage;
    try {
        usage = await checkAIGenerationUsageLimit(user.id);
    } catch (dbError: any) {
        throw new Error(`Failed to check usage limits: ${dbError.message}`);
    }

    if (!usage.canGenerate) {
      return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: usage.error, 
          message: usage.message 
      }, { status: 403 });
    }

    // 8. Generate with AI
    const generatedContent = await callAIToGenerateNote(sourceContent.trim());
    
    if (!generatedContent || !isContentMeaningful(generatedContent)) {
        throw new Error("AI failed to generate meaningful content for this note.");
    }
    
    // 9. Save to Database
    let savedNote;
    try {
        console.log("DEBUG: Saving note...");
        
        let validDocumentId = null;
        if (documentId && documentId !== 'undefined' && documentId !== 'null') {
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
        throw new Error(`Failed to save note to database: ${dbError.message}`);
    }

    // 10. Increment Usage
    await incrementAIGenerationUsage(user.id, 1).catch(e => console.error("Failed to increment usage", e));

    return NextResponse.json<ApiResponse<{ count: number; noteId: string }>>({
        success: true,
        data: { count: 1, noteId: savedNote.id }, 
        message: `Note generated successfully.`
    }, { status: 201 });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error("Error in /api/generate-notes POST handler:", error);
    return NextResponse.json<ApiResponse>({ success: false, error: error.message || "Internal server error." }, { status: 500 });
  }
}