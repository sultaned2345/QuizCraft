// src/app/api/generate-notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { Note, ApiResponse } from '@/types/database';
import { callAIToGenerateNote } from '@/lib/aiGeneration';
import { YoutubeTranscript } from 'youtube-transcript'; // <-- 1. IMPORT NEW LIBRARY

export const runtime = "nodejs";

const AI_MODEL_NAME = "gemini-2.5-flash-lite";
const MIN_CONTENT_LENGTH = 50;
const MAX_INPUT_LENGTH = 10000;

// --- Helper Functions ---
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

/**
 * POST handler for the /api/generate-notes route.
 */
export async function POST(request: NextRequest) {
  console.log("DEBUG: POST /api/generate-notes starting...");
  try {
    const user = await requireAuth(request);
    console.log("DEBUG: Authentication successful, user ID:", user.id);

    const body = await request.json();
    // --- 2. ADD youtubeUrl to DESTRUCTURING ---
    const { text, url, youtubeUrl } = body;

    // 1. Validate request and get source content
    // --- 3. UPDATE VALIDATION ---
    if (!url && !text && !youtubeUrl) { 
        return NextResponse.json<ApiResponse>({ success: false, error: "Either text, a URL, or a YouTube URL is required." }, { status: 400 }); 
    }
    
    let sourceContent = text;
    let noteTitlePrefix = "Notes from text"; // Default title prefix

    if (url) { 
        console.log(`DEBUG: Attempting to fetch URL: ${url}`);
        noteTitlePrefix = "Notes from URL";
        try { 
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            console.log(`DEBUG: Fetch response status for ${url}: ${response.status}`);
            if (!response.ok) { throw new Error(`Fetch failed with status: ${response.status} ${response.statusText}`); }
            const html = await response.text();
            sourceContent = extractTextFromHtml(html); 
            console.log(`DEBUG: Extracted text (length: ${sourceContent.length})`);
        } catch (e: any) { 
            console.error(`DEBUG: URL process error for ${url}:`, e.message);
            return NextResponse.json<ApiResponse>({ success: false, error: `URL process error: ${e.message}` }, { status: 400 }); 
        } 
    // --- 4. ADD NEW LOGIC BLOCK FOR YOUTUBE ---
    } else if (youtubeUrl) {
        console.log(`DEBUG: Attempting to fetch transcript for YouTube URL: ${youtubeUrl}`);
        noteTitlePrefix = "Notes from YouTube Video";
        try {
            const transcript = await YoutubeTranscript.fetchTranscript(youtubeUrl);
            if (!transcript || transcript.length === 0) {
                throw new Error("No transcript found for this video.");
            }
            // Combine all transcript parts into a single string
            sourceContent = transcript.map(item => item.text).join(' ');
            console.log(`DEBUG: Extracted transcript (length: ${sourceContent.length})`);
        } catch (e: any) {
             console.error(`DEBUG: YouTube transcript error for ${youtubeUrl}:`, e.message);
             if (e.message.includes('No transcript found')) {
                return NextResponse.json<ApiResponse>({ success: false, error: "No transcript is available for this video." }, { status: 400 });
             }
            return NextResponse.json<ApiResponse>({ success: false, error: `YouTube transcript error: ${e.message}` }, { status: 400 }); 
        }
    }
    // --- END NEW BLOCK ---

    
    if (!sourceContent || sourceContent.trim().length < MIN_CONTENT_LENGTH) { 
        console.warn(`DEBUG: Source content too short after processing. Length: ${sourceContent?.trim().length || 0}`);
        return NextResponse.json<ApiResponse>({ success: false, error: `Source content too short (minimum ${MIN_CONTENT_LENGTH} chars). The URL might be a web app or have anti-scraping measures.` }, { status: 400 }); 
    }
    console.log("DEBUG: Source content prepared.");

    // 2. Check usage limits (Unchanged)
    let usage;
    try {
        console.log("DEBUG: Attempting to check usage limits...");
        usage = await checkAIGenerationUsageLimit(user.id);
        console.log("DEBUG: Usage limit check result:", usage);
    } catch (dbError: any) {
        console.error("DEBUG: Error during checkAIGenerationUsageLimit:", dbError);
        if (dbError instanceof Prisma.PrismaClientInitializationError || (dbError.message && dbError.message.includes("Can't reach database server"))) {
            throw dbError; 
        }
        throw new Error(`Failed to check usage limits: ${dbError.message}`);
    }

    const incrementCount = 1;
    if (!usage.canGenerate || (usage.currentCount !== undefined && usage.limit !== Infinity && (usage.currentCount + incrementCount) > usage.limit)) {
      const remaining = usage.limit !== Infinity && usage.currentCount !== undefined ? Math.max(0, usage.limit - usage.currentCount) : 0;
      console.warn("Usage limit exceeded.");
      return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: usage.error, 
          message: usage.message || `Usage limit exceeded. ${remaining} generations left.`
      }, { status: 403 });
    }
    console.log("DEBUG: Usage limit check passed.");

    // 4. CALL THE IMPORTED HELPER (Unchanged)
    const generatedNote = await callAIToGenerateNote(sourceContent.trim());
    
    if (!isContentMeaningful(generatedNote.content)) {
        console.warn(`[generate-notes] AI returned a valid title ("${generatedNote.title}") but content was empty or meaningless.`);
        throw new Error("AI failed to generate meaningful content for this note.");
    }
    
    console.log("DEBUG: AI Note generation successful.");

    // 5. SAVE THE SINGLE NOTE (Unchanged)
    let savedNote;
    try {
        console.log("DEBUG: Attempting to save generated note to DB...");
        savedNote = await prisma.notes.create({ 
            data: { 
                user_id: user.id, 
                // --- 5. Use dynamic title prefix ---
                title: generatedNote.title.trim() || `${noteTitlePrefix}`, 
                content: generatedNote.content.trim() 
            } 
        });
        console.log(`DEBUG: Saved 1 note.`);
    } catch (dbError: any) {
        console.error("DEBUG: Error during prisma.notes.create:", dbError);
        if (dbError instanceof Prisma.PrismaClientInitializationError || (dbError.message && dbError.message.includes("Can't reach database server"))) {
            throw dbError; 
        }
        throw new Error(`Failed to save note to database: ${dbError.message}`);
    }

    // 6. Update usage count (Unchanged)
    try {
        console.log("DEBUG: Attempting to update AI usage count...");
        await incrementAIGenerationUsage(user.id, 1); // Increment by 1
        console.log("DEBUG: Updated AI usage count.");
    } catch (usageError: any) {
        console.error("CRITICAL DEBUG: Failed to update AI usage count AFTER saving note:", usageError);
    }

    // 7. Return success (Unchanged)
    return NextResponse.json<ApiResponse<{ count: number }>>({
        success: true,
        data: { count: 1 }, // We only save 1 note
        message: `Note generated successfully.`
    }, { status: 201 });

  } catch (error: any) {
    // Centralized Error Handling (Unchanged)
    if (error instanceof Response) {
        console.error("Authentication error caught.");
        return error;
    }
    console.error("Error in /api/generate-notes POST handler:", error);

    if (error.message?.startsWith("Failed to generate notes") || error.message?.includes("AI generated invalid") || error.message?.includes("Invalid JSON") || error.message?.includes("AI failed to return a valid note structure") || error.message?.includes("AI failed to generate meaningful content")) {
        return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 502 });
    }
    if (error instanceof Prisma.PrismaClientInitializationError || (error.message && error.message.includes("Can't reach database server"))) {
         console.error("Database connection error confirmed:", error.message);
         return NextResponse.json<ApiResponse>({ success: false, error: `Database connection error: ${error.message}` }, { status: 503 }); // 503 Service Unavailable
    }

    return NextResponse.json<ApiResponse>({ success: false, error: error.message || "Internal server error during note generation." }, { status: 500 });
  }
}