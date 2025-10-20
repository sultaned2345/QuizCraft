import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

import { requireAuth, validateRequestBody } from '@/lib/auth';
import { supabaseHelpers } from '@/lib/supabase';
import { checkAIGenerationUsageLimit, USAGE_LIMITS } from '@/lib/usage-limits';
import { Note } from '@/types/database';

export const runtime = "nodejs";

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
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = buildPrompt({ text, numberOfNotes });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const content = response.text();

  if (!content) {
    throw new Error("Empty response from AI model");
  }

  try {
    const parsed = JSON.parse(content);
    if (!parsed.notes || !Array.isArray(parsed.notes)) {
      throw new Error("Invalid JSON structure returned from AI.");
    }
    return parsed.notes;
  } catch (e) {
    console.error("Failed to parse AI response:", content);
    throw new Error("Failed to generate notes due to an AI formatting error.");
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
      return NextResponse.json({ success: false, error: "Either text or a URL is required." }, { status: 400 });
    }
    if (typeof number_of_notes !== 'number' || number_of_notes <= 0 || number_of_notes > 10) {
        return NextResponse.json({ success: false, error: "Number of notes must be a number between 1 and 10." }, { status: 400 });
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
        return NextResponse.json({ success: false, error: `Failed to process URL: ${fetchError.message}` }, { status: 400 });
      }
    }

    // 2. Check user's plan and current AI usage limits
    const usage = await checkAIGenerationUsageLimit(user.id);
    if (!usage.canGenerate || (usage.currentCount + number_of_notes) > usage.limit) {
      const remaining = usage.limit - usage.currentCount;
      return NextResponse.json({
        success: false,
        error: `Usage limit exceeded. You have ${remaining > 0 ? remaining : 0} generations left this month.`,
      }, { status: 403 });
    }

    // 3. Call the AI model to generate notes
    const generatedNotes = await callAIToGenerateNotes(sourceContent, number_of_notes);

    if (generatedNotes.length === 0) {
      return NextResponse.json({ success: false, error: "AI failed to generate any notes from the provided text." }, { status: 500 });
    }
    
    // 4. Save the generated notes to the database and update the usage count
    const savedNotes = await supabaseHelpers.createManyNotes(user.id, generatedNotes);
    await supabaseHelpers.incrementAIGenerationUsage(user.id, new Date(), generatedNotes.length);

    // 5. Return the newly created notes
    return NextResponse.json({ success: true, notes: savedNotes });

  } catch (error: any) {
    if (error instanceof Response) {
      return error;
    }
    
    console.error("Error in /api/generate-notes:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "An internal server error occurred." 
    }, { status: 500 });
  }
}