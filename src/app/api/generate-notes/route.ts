// src/app/api/generate-notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from '@/lib/prisma'; // Use the shared Prisma client again
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAIGenerationUsageLimit } from '@/lib/usage-limits';
import { Note, ApiResponse } from '@/types/database';

export const runtime = "nodejs";

const AI_MODEL_NAME = "gemini-2.5-flash-lite";
const MIN_CONTENT_LENGTH = 50;

// --- Helper Functions ---
function extractTextFromHtml(html: string): string {
    let cleanHtml = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
    cleanHtml = cleanHtml.replace(/<\/?[^>]+(>|$)/g, " ");
    cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim();
    return cleanHtml;
}

// Prompt for detailed, structured notes
function buildPrompt({ text }: { text: string }): string {
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

// callAIToGenerateNotes function (with logging)
async function callAIToGenerateNotes(text: string): Promise<Array<{ title: string; content: string; }>> {
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
    if(count<=0) return; const firstDayOfMonth=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1)).toISOString().split('T')[0]; const supabase=supabaseAdmin; try { const {data:currentUsage,error:fetchError}=await supabase.from('ai_usage').select('usage_count').eq('user_id',userId).eq('usage_month',firstDayOfMonth).maybeSingle(); if(fetchError&&fetchError.code!=='PGRST116'){ throw new Error(`Failed fetch AI usage: ${fetchError.message} (Code: ${fetchError.code})`);} const currentCount=currentUsage?.usage_count??0; const newCount=currentCount+count; const {error:upsertError}=await supabase.from('ai_usage').upsert({user_id:userId,usage_month:firstDayOfMonth,usage_count:newCount,updated_at:new Date().toISOString(),},{onConflict:'user_id, usage_month'}); if(upsertError){ throw new Error(`Failed upsert AI usage: ${upsertError.message} (Code: ${upsertError.code})`);} console.log(`[Admin] Updated AI usage for ${userId} in ${firstDayOfMonth}.`);} catch(error){console.error(`[Admin] Error during AI usage update for ${userId}:`,error); throw error;}
}


/**
 * POST handler for the /api/generate-notes route.
 */
export async function POST(request: NextRequest) {
  console.log("DEBUG: POST /api/generate-notes starting...");
  try {
    // *** TEMPORARY DEBUG LOGGING - REMOVE LATER ***
    console.log("DEBUG: Using DATABASE_URL:", process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 40) + "..." : "DATABASE_URL is NOT SET");

    const user = await requireAuth(request);
    const body = await request.json();
    const { text, url } = body;

    // 1. Validate request and get source content
    if (!url && !text) { return NextResponse.json<ApiResponse>({ success: false, error: "Either text or a URL is required." }, { status: 400 }); }
    let sourceContent = text;
    if (url) { try { const response = await fetch(url); if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`); const html = await response.text(); sourceContent = extractTextFromHtml(html); } catch (e: any) { return NextResponse.json<ApiResponse>({ success: false, error: `URL process error: ${e.message}` }, { status: 400 }); } }
    if (!sourceContent || sourceContent.trim().length < MIN_CONTENT_LENGTH) { return NextResponse.json<ApiResponse>({ success: false, error: `Source content too short (minimum ${MIN_CONTENT_LENGTH} chars).` }, { status: 400 }); }

    // 2. Check usage limits
    console.log("Checking usage limits...");
    const usage = await checkAIGenerationUsageLimit(user.id);
    const incrementCount = 1;
    if (!usage.canGenerate || (usage.currentCount !== undefined && usage.limit !== Infinity && (usage.currentCount + incrementCount) > usage.limit)) {
      const remaining = usage.limit !== Infinity && usage.currentCount !== undefined ? Math.max(0, usage.limit - usage.currentCount) : 0;
      console.warn("Usage limit exceeded.");
      return NextResponse.json<ApiResponse>({ success: false, error: `Usage limit exceeded. ${remaining} generations left.`, }, { status: 403 });
    }
    console.log("Usage limit check passed.");

    // 3. Call AI
    const generatedNotes = await callAIToGenerateNotes(sourceContent.trim());
    const actualGeneratedCount = generatedNotes.length;

    // 4. Prepare data for saving
    const notesToSave = generatedNotes.map(note => ({
        user_id: user.id,
        title: note.title.trim(),
        content: note.content.trim() // Ensure content is trimmed
    }));

    // *** ADDED LOGGING BEFORE SAVE ***
    console.log("----- Data to Save START -----");
    console.log(JSON.stringify(notesToSave, null, 2)); // Log the exact object array
    console.log("----- Data to Save END -----");
    // *** END LOGGING ***

    // Save note(s) using Prisma
    console.log("Attempting prisma.notes.createMany...");
    const savedNotesResult = await prisma.notes.createMany({ data: notesToSave });
    console.log(`Saved ${savedNotesResult.count} note(s).`);

    // 5. Update usage count
    console.log("Attempting to update AI usage count...");
    await updateAIUsage(user.id, new Date(), actualGeneratedCount);
    console.log("Updated AI usage count.");

    // 6. Return success
    return NextResponse.json<ApiResponse<{ count: number }>>({
        success: true,
        data: { count: savedNotesResult.count },
        message: `Notes generated successfully.`
    }, { status: 201 });

  } catch (error: any) {
    if (error instanceof Response) { console.error("Authentication error caught."); return error; }
    console.error("Error in /api/generate-notes POST handler:", error);

    // Specific error checks
    if (error.message?.startsWith("Failed to generate notes") || error.message?.includes("AI generated invalid") || error.message?.includes("Invalid JSON")) { return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 502 }); }
    if (error.message?.includes("AI usage")) { console.error("Critical error: Failed to update AI usage count:", error.message); return NextResponse.json<ApiResponse>({ success: false, error: "Failed to update usage count after generation." }, { status: 500 }); }
    if (error instanceof Prisma.PrismaClientInitializationError || (error.message && error.message.includes("Can't reach database server"))) { console.error("Database connection error confirmed:", error.message); return NextResponse.json<ApiResponse>({ success: false, error: `Database connection error: ${error.message}` }, { status: 503 }); }
    // Catch potential errors during the createMany operation specifically
    if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientUnknownRequestError || error instanceof Prisma.PrismaClientValidationError) {
        console.error("Prisma error during createMany:", error);
        return NextResponse.json<ApiResponse>({ success: false, error: `Database error saving note: ${error.message}` }, { status: 500 });
    }

    // Default internal server error
    return NextResponse.json<ApiResponse>({ success: false, error: error.message || "Internal server error during note generation." }, { status: 500 });
  }
}