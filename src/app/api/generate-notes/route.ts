// src/app/api/generate-notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
// Use the shared Prisma client again
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client'; // Import Prisma namespace for types if needed
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAIGenerationUsageLimit } from '@/lib/usage-limits';
import { Note, ApiResponse } from '@/types/database';

export const runtime = "nodejs";

const AI_MODEL_NAME = "gemini-2.5-flash-lite";
const MIN_CONTENT_LENGTH = 50;

// --- Helper Functions ---
function extractTextFromHtml(html: string): string {
    // ... (keep existing function) ...
    let cleanHtml = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
    cleanHtml = cleanHtml.replace(/<\/?[^>]+(>|$)/g, " ");
    cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim();
    return cleanHtml;
}

// Prompt for detailed, structured notes (same as before)
function buildPrompt({ text }: { text: string }): string {
  // ... (keep existing prompt) ...
  return `Based on the following content, generate structured notes summarizing the **key concepts, definitions, examples, and important points**. Organize the notes logically, potentially using headings or bullet points using markdown syntax (e.g., '# Heading', '- Bullet point') for clarity. The notes should be detailed enough to capture the essential information from the text. The output must include a main "title" for the notes and the detailed "content".

Content:
"""
${text}
"""

Return ONLY valid JSON in this exact shape:
{
  "notes": [
    {
      "title": "Concise Title Reflecting Main Topic",
      "content": "Detailed structured notes covering key points, definitions, examples etc. Use markdown for formatting like headings (# Heading 1, ## Heading 2) or bullet points (- Point)."
    }
  ]
}`;
}

// callAIToGenerateNotes function (with logging, same as before)
async function callAIToGenerateNotes(text: string): Promise<Array<{ title: string; content: string; }>> {
  // ... (keep existing function with raw response logging) ...
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
  if (!process.env.GOOGLE_AI_API_KEY) throw new Error("Missing GOOGLE_AI_API_KEY");
  const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
  const prompt = buildPrompt({ text });

  try {
    console.log(`Sending prompt to AI model: ${AI_MODEL_NAME} for detailed notes...`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawContent = response.text();

    console.log("----- RAW AI Response START -----");
    console.log(rawContent);
    console.log("----- RAW AI Response END -----");

    if (!rawContent) { throw new Error("Empty response from AI model"); }

    let parsed;
    try { parsed = JSON.parse(rawContent); }
    catch (parseError) {
        console.error(`AI Error: Failed to parse JSON response. Snippet:`, rawContent.substring(0, 500));
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) { try { parsed = JSON.parse(jsonMatch[0]); } catch (fallbackError){ throw new Error(`Invalid JSON structure, even after fallback.`);}}
        else { throw new Error(`Invalid JSON structure. No JSON object found.`); }
    }

    if (!parsed.notes || !Array.isArray(parsed.notes) || parsed.notes.length === 0) { throw new Error("Invalid JSON structure or zero notes returned."); }

    const validNotes = parsed.notes.filter((note: any) => note && note.title?.trim() && note.content?.trim().length > 10);
    if (validNotes.length === 0) { throw new Error(`AI generated invalid note content (missing title or content).`); }

    console.log(`AI note generation successful using ${AI_MODEL_NAME}. Generated ${validNotes.length} valid note(s).`);
    return validNotes.slice(0, 1);

  } catch (e: any) {
    console.error(`Error during AI call/parsing using ${AI_MODEL_NAME}:`, e);
    throw new Error(`Failed to generate notes: ${e.message}`);
  }
}

// updateAIUsage (remains the same)
async function updateAIUsage(userId: string, month: Date, count: number = 1) {
    // ... (keep existing function) ...
     if(count<=0) return; const firstDayOfMonth=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1)).toISOString().split('T')[0]; const supabase=supabaseAdmin; try { const {data:currentUsage,error:fetchError}=await supabase.from('ai_usage').select('usage_count').eq('user_id',userId).eq('usage_month',firstDayOfMonth).maybeSingle(); if(fetchError&&fetchError.code!=='PGRST116'){ throw new Error(`Failed fetch AI usage: ${fetchError.message} (Code: ${fetchError.code})`);} const currentCount=currentUsage?.usage_count??0; const newCount=currentCount+count; const {error:upsertError}=await supabase.from('ai_usage').upsert({user_id:userId,usage_month:firstDayOfMonth,usage_count:newCount,updated_at:new Date().toISOString(),},{onConflict:'user_id, usage_month'}); if(upsertError){ throw new Error(`Failed upsert AI usage: ${upsertError.message} (Code: ${upsertError.code})`);} console.log(`[Admin] Updated AI usage for ${userId} in ${firstDayOfMonth}.`);} catch(error){console.error(`[Admin] Error during AI usage update for ${userId}:`,error); throw error;}
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
    const { text, url } = body;

    // 1. Validate request and get source content
    if (!url && !text) { return NextResponse.json<ApiResponse>({ success: false, error: "Either text or a URL is required." }, { status: 400 }); }
    
    let sourceContent = text;

    // --- FIX: Add User-Agent to fetch and improve logging ---
    if (url) { 
        console.log(`DEBUG: Attempting to fetch URL: ${url}`);
        try { 
            const response = await fetch(url, {
                headers: {
                    // Set a common User-Agent to avoid simple bot blockers
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            console.log(`DEBUG: Fetch response status for ${url}: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`Fetch failed with status: ${response.status} ${response.statusText}`); 
            }
            
            const html = await response.text();
            console.log(`DEBUG: Fetched HTML (first 500 chars): ${html.substring(0, 500)}...`);
            
            sourceContent = extractTextFromHtml(html); 
            console.log(`DEBUG: Extracted text (first 500 chars): ${sourceContent.substring(0, 500)}...`);

        } catch (e: any) { 
            console.error(`DEBUG: URL process error for ${url}:`, e.message);
            return NextResponse.json<ApiResponse>({ success: false, error: `URL process error: ${e.message}` }, { status: 400 }); 
        } 
    }
    // --- END FIX ---
    
    if (!sourceContent || sourceContent.trim().length < MIN_CONTENT_LENGTH) { 
        console.warn(`DEBUG: Source content too short after processing. Length: ${sourceContent?.trim().length || 0}`);
        return NextResponse.json<ApiResponse>({ success: false, error: `Source content too short (minimum ${MIN_CONTENT_LENGTH} chars). The URL might be a web app or have anti-scraping measures.` }, { status: 400 }); 
    }
    console.log("DEBUG: Source content prepared.");

    // 2. Check usage limits
    let usage;
    try {
        console.log("DEBUG: Attempting to check usage limits...");
        usage = await checkAIGenerationUsageLimit(user.id); // This function uses prisma internally
        console.log("DEBUG: Usage limit check result:", usage);
    } catch (dbError: any) {
        console.error("DEBUG: Error during checkAIGenerationUsageLimit:", dbError);
        if (dbError instanceof Prisma.PrismaClientInitializationError || (dbError.message && dbError.message.includes("Can't reach database server"))) {
            throw dbError; // Let the main catch block handle it
        }
        throw new Error(`Failed to check usage limits: ${dbError.message}`);
    }

    const incrementCount = 1;
    if (!usage.canGenerate || (usage.currentCount !== undefined && usage.limit !== Infinity && (usage.currentCount + incrementCount) > usage.limit)) {
      const remaining = usage.limit !== Infinity && usage.currentCount !== undefined ? Math.max(0, usage.limit - usage.currentCount) : 0;
      console.warn("Usage limit exceeded.");
      return NextResponse.json<ApiResponse>({ success: false, error: `Usage limit exceeded. ${remaining} generations left.`, }, { status: 403 });
    }
    console.log("DEBUG: Usage limit check passed.");

    // 3. Call AI
    const generatedNotes = await callAIToGenerateNotes(sourceContent.trim());
    const actualGeneratedCount = generatedNotes.length;
    console.log("DEBUG: AI Note generation successful.");

    // 4. Save note(s) using Prisma
    let savedNotesResult;
    try {
        console.log("DEBUG: Attempting to save generated notes to DB...");
        const notesToSave = generatedNotes.map(note => ({ user_id: user.id, title: note.title.trim(), content: note.content.trim() }));
        savedNotesResult = await prisma.notes.createMany({ data: notesToSave });
        console.log(`DEBUG: Saved ${savedNotesResult.count} note(s).`);
    } catch (dbError: any) {
        console.error("DEBUG: Error during prisma.notes.createMany:", dbError);
        if (dbError instanceof Prisma.PrismaClientInitializationError || (dbError.message && dbError.message.includes("Can't reach database server"))) {
            throw dbError; // Let the main catch block handle it
        }
        throw new Error(`Failed to save notes to database: ${dbError.message}`);
    }


    // 5. Update usage count (Uses supabaseAdmin, should be less prone to Vercel connection issues)
    try {
        console.log("DEBUG: Attempting to update AI usage count...");
        await updateAIUsage(user.id, new Date(), actualGeneratedCount);
        console.log("DEBUG: Updated AI usage count.");
    } catch (usageError: any) {
        console.error("CRITICAL DEBUG: Failed to update AI usage count AFTER saving note:", usageError);
    }


    // 6. Return success
    return NextResponse.json<ApiResponse<{ count: number }>>({
        success: true,
        data: { count: savedNotesResult.count },
        message: `Notes generated successfully.`
    }, { status: 201 });

  } catch (error: any) {
    // Centralized Error Handling
    if (error instanceof Response) {
        console.error("Authentication error caught.");
        return error;
    }
    console.error("Error in /api/generate-notes POST handler:", error);

    if (error.message?.startsWith("Failed to generate notes") || error.message?.includes("AI generated invalid") || error.message?.includes("Invalid JSON")) {
        return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 502 });
    }
    if (error instanceof Prisma.PrismaClientInitializationError || (error.message && error.message.includes("Can't reach database server"))) {
         console.error("Database connection error confirmed:", error.message);
         return NextResponse.json<ApiResponse>({ success: false, error: `Database connection error: ${error.message}` }, { status: 503 }); // 503 Service Unavailable
    }

    return NextResponse.json<ApiResponse>({ success: false, error: error.message || "Internal server error during note generation." }, { status: 500 });
  }
}