import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

import { requireAuth, validateRequestBody } from '@/lib/auth';
import { supabaseHelpers } from '@/lib/supabase';
import { checkAIGenerationUsageLimit, USAGE_LIMITS } from '@/lib/usage-limits';
import { Note } from '@/types/database';

export const runtime = "nodejs";

/**
 * Constructs a detailed prompt for the AI model to generate structured notes.
 * @param text The source text for note generation.
 * @param numberOfNotes The exact number of notes to generate.
 * @returns A string prompt for the AI.
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
 * @param text The source text.
 * @param numberOfNotes The number of notes to generate.
 * @returns A promise that resolves to an array of generated note objects.
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
 * Orchestrates the process of AI note generation.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    // 1. Validate incoming request body
    const validation = validateRequestBody(body, ['text', 'number_of_notes']);
    if (!validation.isValid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const { text, number_of_notes } = body;
    if (typeof number_of_notes !== 'number' || number_of_notes <= 0 || number_of_notes > 10) {
        return NextResponse.json({ success: false, error: "Number of notes must be a number between 1 and 10." }, { status: 400 });
    }

    // 2. Check user's plan and current AI usage limits
    const usage = await checkAIGenerationUsageLimit(user.id);
    if (!usage.canGenerate || (usage.currentCount + number_of_notes) > usage.limit) {
      const remaining = usage.limit - usage.currentCount;
      return NextResponse.json({
        success: false,
        error: `Usage limit exceeded. You have ${remaining > 0 ? remaining : 0} generations left this month.`,
      }, { status: 403 }); // 403 Forbidden is appropriate for exceeding limits
    }

    // 3. Call the AI model to generate notes
    const generatedNotes = await callAIToGenerateNotes(text, number_of_notes);

    if (generatedNotes.length === 0) {
      return NextResponse.json({ success: false, error: "AI failed to generate any notes from the provided text." }, { status: 500 });
    }
    
    // 4. Save the generated notes to the database and update the usage count
    const savedNotes = await supabaseHelpers.createManyNotes(user.id, generatedNotes);
    await supabaseHelpers.incrementAIGenerationUsage(user.id, new Date(), generatedNotes.length);

    // 5. Return the newly created notes
    return NextResponse.json({ success: true, notes: savedNotes });

  } catch (error: any) {
    // Handle authentication errors thrown by requireAuth
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