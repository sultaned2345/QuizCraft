// src/app/api/generate-notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { Note, ApiResponse } from '@/types/database';
// 1. IMPORT THE CENTRALIZED AI HELPER
import { callAIToGenerateNote } from '@/lib/aiGeneration';

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

// --- FIX: ADDED NEW HELPER ---
/**
 * Strips HTML tags and checks if the remaining text is meaningful.
 */
function isContentMeaningful(content: string): boolean {
    if (!content) return false;
    // Strip HTML tags and normalize whitespace
    const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 20; // Require at least 20 characters of *actual text*
}
// --- END NEW HELPER ---

/**
 * POST handler for the /api/generate-notes route.
 */
export async function POST(request: NextRequest) {
  console.log("DEBUG: POST /api/generate-notes starting...");
  try {
    const user = await requireAuth(request);
    console.log("DEBUG: Authentication successful, user ID:", user.id);

    const body = await request.json();
    const { text, url } = body;

    // 1. Validate request and get source content
    if (!url && !text) { return NextResponse.json<ApiResponse>({ success: false, error: "Either text or a URL is required." }, { status: 400 }); }
    
    let sourceContent = text;

    if (url) { 
        console.log(`DEBUG: Attempting to fetch URL: ${url}`);
        try { 
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            console.log(`DEBUG: Fetch response status for ${url}: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`Fetch failed with status: ${response.status} ${response.statusText}`); 
            }
            
            const html = await response.text();
            
            sourceContent = extractTextFromHtml(html); 
            console.log(`DEBUG: Extracted text (length: ${sourceContent.length})`);

        } catch (e: any) { 
            console.error(`DEBUG: URL process error for ${url}:`, e.message);
            return NextResponse.json<ApiResponse>({ success: false, error: `URL process error: ${e.message}` }, { status: 400 }); 
        } 
    }
    
    if (!sourceContent || sourceContent.trim().length < MIN_CONTENT_LENGTH) { 
        console.warn(`DEBUG: Source content too short after processing. Length: ${sourceContent?.trim().length || 0}`);
        return NextResponse.json<ApiResponse>({ success: false, error: `Source content too short (minimum ${MIN_CONTENT_LENGTH} chars). The URL might be a web app or have anti-scraping measures.` }, { status: 400 }); 
    }
    console.log("DEBUG: Source content prepared.");

    // 2. Check usage limits
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

    // 4. CALL THE IMPORTED HELPER
    const generatedNote = await callAIToGenerateNote(sourceContent.trim());
    
    // --- FIX: ADDED VALIDATION ---
    if (!isContentMeaningful(generatedNote.content)) {
        console.warn(`[generate-notes] AI returned a valid title ("${generatedNote.title}") but content was empty or meaningless.`);
        throw new Error("AI failed to generate meaningful content for this note.");
    }
    // --- END FIX ---
    
    console.log("DEBUG: AI Note generation successful.");

    // 5. SAVE THE SINGLE NOTE
    let savedNote;
    try {
        console.log("DEBUG: Attempting to save generated note to DB...");
        savedNote = await prisma.notes.create({ 
            data: { 
                user_id: user.id, 
                title: generatedNote.title.trim(), 
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

    // 6. Update usage count
    try {
        console.log("DEBUG: Attempting to update AI usage count...");
        await incrementAIGenerationUsage(user.id, 1); // Increment by 1
        console.log("DEBUG: Updated AI usage count.");
    } catch (usageError: any) {
        console.error("CRITICAL DEBUG: Failed to update AI usage count AFTER saving note:", usageError);
    }

    // 7. Return success
    return NextResponse.json<ApiResponse<{ count: number }>>({
        success: true,
        data: { count: 1 }, // We only save 1 note
        message: `Note generated successfully.`
    }, { status: 201 });

  } catch (error: any) {
    // Centralized Error Handling
    if (error instanceof Response) {
        console.error("Authentication error caught.");
        return error;
    }
    console.error("Error in /api/generate-notes POST handler:", error);

    // --- FIX: CATCH NEW ERROR ---
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