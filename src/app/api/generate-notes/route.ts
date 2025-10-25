// src/app/api/generate-notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; // Use admin client for usage update
import { checkAIGenerationUsageLimit } from '@/lib/usage-limits';
import { Note, ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = "nodejs";

const AI_MODEL_NAME = "gemini-2.5-flash-lite";

// --- Helper Functions ---
function extractTextFromHtml(html: string): string { /* ... (keep existing function) ... */
    let cleanHtml = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, ''); cleanHtml = cleanHtml.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, ''); cleanHtml = cleanHtml.replace(/<\/?[^>]+(>|$)/g, " "); cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim(); return cleanHtml;
}

// Updated buildPrompt to always ask for 1 note
function buildPrompt({ text }: { text: string }): string {
  const numberOfNotes = 1; // Hardcoded to 1
  return `Based on the following content, generate exactly ${numberOfNotes} structured note. The note must have a "title" and "content". Focus on the main topic or summary.

Content:
"""
${text}
"""

Return ONLY valid JSON in this exact shape:
{
  "notes": [
    { "title": "...", "content": "..." }
  ]
}`;
}

// Updated callAIToGenerateNotes to always request 1 note
async function callAIToGenerateNotes(text: string): Promise<Array<{ title: string; content: string; }>> {
  const numberOfNotes = 1; // Hardcoded to 1
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
  if (!process.env.GOOGLE_AI_API_KEY) throw new Error("Missing GOOGLE_AI_API_KEY");
  const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
  const prompt = buildPrompt({ text }); // Pass only text
  try {
    console.log(`Sending prompt to AI model: ${AI_MODEL_NAME} for 1 note...`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();
    if (!content) throw new Error("Empty response from AI model");
    const parsed = JSON.parse(content);
    if (!parsed.notes || !Array.isArray(parsed.notes)) throw new Error("Invalid JSON structure returned.");
    if (parsed.notes.length === 0) throw new Error("AI failed to generate the note."); // Check if at least one was generated
    // Basic validation
    parsed.notes.forEach((note: any) => { if (!note.title || !note.content) throw new Error(`AI generated invalid note content.`); });
    console.log(`AI note generation successful using ${AI_MODEL_NAME}.`);
    // Return only the first note if more than 1 were somehow generated, though prompt asks for 1
    return parsed.notes.slice(0, 1);
  } catch (e: any) {
    console.error(`Error calling/parsing AI for notes from ${AI_MODEL_NAME}:`, e);
    throw new Error(`Failed to generate notes AI error: ${e.message}`);
  }
}

// Helper to Update AI Usage using SERVICE ROLE
async function updateAIUsage(userId: string, month: Date, count: number = 1) { /* ... (keep existing function from previous steps) ... */
    if(count<=0) return; const firstDayOfMonth=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1)).toISOString().split('T')[0]; const supabase=supabaseAdmin; try { console.log(`[Admin] Fetch AI usage for ${userId} month ${firstDayOfMonth}`); const {data:currentUsage,error:fetchError}=await supabase.from('ai_usage').select('usage_count').eq('user_id',userId).eq('usage_month',firstDayOfMonth).maybeSingle(); if(fetchError&&fetchError.code!=='PGRST116'){console.error("[Admin] Supabase fetch error (updateAIUsage):",fetchError); throw new Error(`Failed fetch AI usage: ${fetchError.message} (Code: ${fetchError.code})`);} const currentCount=currentUsage?.usage_count??0; const newCount=currentCount+count; console.log(`[Admin] Upsert AI usage for ${userId} month ${firstDayOfMonth} to ${newCount}`); const {error:upsertError}=await supabase.from('ai_usage').upsert({user_id:userId,usage_month:firstDayOfMonth,usage_count:newCount,updated_at:new Date().toISOString(),},{onConflict:'user_id, usage_month'}); if(upsertError){console.error("[Admin] Supabase upsert error (updateAIUsage):",upsertError); throw new Error(`Failed upsert AI usage: ${upsertError.message} (Code: ${upsertError.code})`);} console.log(`[Admin] Updated AI usage for ${userId} in ${firstDayOfMonth}.`);} catch(error){console.error(`[Admin] Error during AI usage update for ${userId}:`,error); throw error;}
}


/**
 * POST handler for the /api/generate-notes route.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    // Remove number_of_notes from expected body
    const { text, url } = body;

    // 1. Validate request (only text or url needed)
    if (!url && !text) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Either text or a URL is required." }, { status: 400 });
    }
    // No longer need to validate number_of_notes

    let sourceContent = text;
    if (url) { /* ... (keep URL fetching logic) ... */ try { const response = await fetch(url); if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`); const html = await response.text(); sourceContent = extractTextFromHtml(html); if (!sourceContent || sourceContent.length < 100) throw new Error("Not enough content from URL."); } catch (e: any) { return NextResponse.json<ApiResponse>({ success: false, error: `URL process error: ${e.message}` }, { status: 400 }); } }
    if (!sourceContent || sourceContent.trim().length < 50) return NextResponse.json<ApiResponse>({ success: false, error: "Source content too short (min 50 chars)." }, { status: 400 });

    // 2. Check usage limits (assume count = 1)
    const usage = await checkAIGenerationUsageLimit(user.id);
    const incrementCount = 1; // Always incrementing by 1 now
    if (!usage.canGenerate || (usage.currentCount !== undefined && usage.limit !== Infinity && (usage.currentCount + incrementCount) > usage.limit)) {
      const remaining = usage.limit !== Infinity && usage.currentCount !== undefined ? Math.max(0, usage.limit - usage.currentCount) : 0;
      return NextResponse.json<ApiResponse>({ success: false, error: `Usage limit exceeded. ${remaining} generations left.`, }, { status: 403 });
    }

    // 3. Call AI (no longer passes number_of_notes)
    const generatedNotes = await callAIToGenerateNotes(sourceContent);
    if (generatedNotes.length === 0) return NextResponse.json<ApiResponse>({ success: false, error: "AI failed to generate the note." }, { status: 500 });
    const actualGeneratedCount = generatedNotes.length; // Should be 1

    // 4. Save note(s) using Prisma
    const notesToSave = generatedNotes.map(note => ({ user_id: user.id, title: note.title.trim(), content: note.content.trim() }));
    // Using createMany might be slight overkill now, but harmless
    const savedNotesResult = await prisma.notes.createMany({ data: notesToSave });

    // 5. Update usage count (always by 1, or actualGeneratedCount)
    await updateAIUsage(user.id, new Date(), actualGeneratedCount);

    // 6. Return success
    return NextResponse.json<ApiResponse<{ count: number }>>({
        success: true,
        data: { count: savedNotesResult.count },
        message: `Note generated successfully.` // Simplified message
    }, { status: 201 });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error("Error in /api/generate-notes:", error);
    if (error.message?.includes("AI usage")) { console.error("Critical error: Failed to update AI usage count:", error.message); }
    if (error.message?.startsWith("Failed to generate notes")) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 502 });
    return NextResponse.json<ApiResponse>({ success: false, error: error.message || "Internal server error." }, { status: 500 });
  }
}