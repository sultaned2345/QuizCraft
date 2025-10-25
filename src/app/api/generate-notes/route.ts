// src/app/api/generate-notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

import { requireAuth, validateRequestBody } from '@/lib/auth';
import { supabaseHelpers } from '@/lib/supabase';
import { checkAIGenerationUsageLimit, USAGE_LIMITS } from '@/lib/usage-limits';
import { Note, ApiResponse } from '@/types/database'; // Added ApiResponse

export const runtime = "nodejs";

// --- UPDATED AI MODEL ---
const AI_MODEL_NAME = "gemini-2.5-flash-lite";

/**
 * A simple function to extract text from an HTML string.
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style elements
  let cleanHtml = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
  cleanHtml = cleanHtml.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
  // Remove all remaining HTML tags
  cleanHtml = cleanHtml.replace(/<\/?[^>]+(>|$)/g, " ");
  // Replace multiple whitespace characters with a single space
  cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim();
  return cleanHtml;
}


/**
 * Constructs a detailed prompt for the AI model to generate structured notes.
 */
function buildPrompt({ text, numberOfNotes }: { text: string; numberOfNotes: number }): string {
  return `Based on the following content, generate exactly ${numberOfNotes} structured notes. Each note must have a "title" and "content".

Content:
"""
${text}
"""

Return ONLY valid JSON in this exact shape:
{
  "notes": [
    { "title": "...", "content": "..." },
    { "title": "...", "content": "..." }
  ]
}`;
}

/**
 * Calls the Google Generative AI model to generate notes from text.
 */
async function callAIToGenerateNotes(text: string, numberOfNotes: number): Promise<Array<{ title: string; content: string; }>> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("Missing GOOGLE_AI_API_KEY environment variable");
  }

  const model = genAI.getGenerativeModel({
    model: AI_MODEL_NAME, // Use the updated model name
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = buildPrompt({ text, numberOfNotes });

  try {
      console.log(`Sending prompt to AI model: ${AI_MODEL_NAME} for notes generation...`);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error("Empty response from AI model");
      }

      const parsed = JSON.parse(content);
      if (!parsed.notes || !Array.isArray(parsed.notes)) {
        throw new Error("Invalid JSON structure returned from AI.");
      }
      // Add basic validation for title/content
      parsed.notes.forEach((note: any, index: number) => {
          if (!note.title || !note.content || typeof note.title !== 'string' || typeof note.content !== 'string') {
              throw new Error(`AI generated invalid content for note ${index + 1}.`);
          }
      });
      console.log(`AI notes generation successful using ${AI_MODEL_NAME}.`);
      return parsed.notes;

  } catch (e: any) {
      console.error(`Error calling or parsing AI response from ${AI_MODEL_NAME} for notes:`, e);
      throw new Error(`Failed to generate notes due to an AI error: ${e.message}`);
  }
}

/**
 * POST handler for the /api/generate-notes route.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { text, url, number_of_notes } = body;

    // 1. Validate incoming request
    if (!url && !text) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Either text or a URL is required." }, { status: 400 });
    }
    if (typeof number_of_notes !== 'number' || number_of_notes <= 0 || number_of_notes > 10) {
        return NextResponse.json<ApiResponse>({ success: false, error: "Number of notes must be a number between 1 and 10." }, { status: 400 });
    }

    let sourceContent = text;

    // Handle URL input
    if (url) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }
        const html = await response.text();
        sourceContent = extractTextFromHtml(html);
        if (!sourceContent || sourceContent.length < 100) {
          throw new Error("Could not extract enough meaningful content from the URL.");
        }
      } catch (fetchError: any) {
        return NextResponse.json<ApiResponse>({ success: false, error: `Failed to process URL: ${fetchError.message}` }, { status: 400 });
      }
    }
     // Validate source content length
     if (!sourceContent || sourceContent.trim().length < 50) {
        return NextResponse.json<ApiResponse>({ success: false, error: "Source content is too short (minimum 50 characters required)." }, { status: 400 });
    }


    // 2. Check user's plan and current AI usage limits
    const usage = await checkAIGenerationUsageLimit(user.id);
    // Adjust check: Ensure they have enough remaining for the *requested* number of notes
    if (!usage.canGenerate || (usage.currentCount !== undefined && usage.limit !== Infinity && (usage.currentCount + number_of_notes) > usage.limit)) {
      const remaining = usage.limit !== Infinity && usage.currentCount !== undefined ? Math.max(0, usage.limit - usage.currentCount) : 0;
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Usage limit exceeded or would be exceeded. You have ${remaining} generations left this month.`,
      }, { status: 403 });
    }

    // 3. Call the AI model to generate notes
    const generatedNotes = await callAIToGenerateNotes(sourceContent, number_of_notes);

    if (generatedNotes.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: "AI failed to generate any notes from the provided text." }, { status: 500 });
    }
    const actualGeneratedCount = generatedNotes.length; // Count how many were actually generated

    // 4. Save the generated notes to the database and update the usage count
    // Use Prisma directly for consistency if supabaseHelpers.createManyNotes isn't adapted
    const notesToSave = generatedNotes.map(note => ({
        user_id: user.id,
        title: note.title.trim(),
        content: note.content.trim()
    }));
    const savedNotesResult = await prisma.notes.createMany({
        data: notesToSave,
    });
    // Note: createMany doesn't return the created records by default.
    // If you need the created records, fetch them or insert one by one.
    // For simplicity, we'll just return success here.

    await supabaseHelpers.incrementAIGenerationUsage(user.id, new Date(), actualGeneratedCount);

    // 5. Return success (data might need adjustment if needed client-side)
    return NextResponse.json<ApiResponse<{ count: number }>>({
        success: true,
        data: { count: savedNotesResult.count },
        message: `${savedNotesResult.count} notes generated successfully.`
    });

  } catch (error: any) {
    if (error instanceof Response) {
      return error; // Forward auth errors
    }
    console.error("Error in /api/generate-notes:", error);
     if (error.message?.includes("GOOGLE_AI_API_KEY")) {
         return NextResponse.json<ApiResponse>({ success: false, error: "AI configuration error." }, { status: 500 });
     }
      if (error.message?.startsWith("Failed to generate notes due to an AI error:")) {
          return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 502 }); // Bad Gateway for AI issues
     }
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error.message || "An internal server error occurred."
    }, { status: 500 });
  }
}