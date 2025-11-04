// src/app/api/generate-flashcards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, validateRequestBody } from '@/lib/auth';
import { checkAIGenerationUsageLimit, USAGE_LIMITS } from '@/lib/usage-limits';
import { ApiResponse, FlashcardDeck } from '@/types/database';
import { GoogleGenerativeAI } from "@google/generative-ai"; // <-- FIX: Changed hyphen to slash
import { supabaseAdmin } from '@/lib/supabaseAdmin'; // Import the admin client
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// --- AI Configuration ---
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.5-flash-lite"; // Use flash-lite
const MIN_CONTENT_LENGTH = 50; // Define minimum length


// --- Interfaces (AICardOutput, AIResponseFormat, GenerateFlashcardsRequestBody) remain the same ---
interface GenerateFlashcardsRequestBody { documentId: string; numberOfCards?: number; deckTitle?: string; }
interface AICardOutput { front_content: string; back_content: string; }
interface AIResponseFormat { flashcards: AICardOutput[]; }

// --- Helper Functions ---

// Updated buildAIPrompt for flash-lite
function buildAIPrompt(text: string, numCards: number): string {
    // Added instructions to focus on specific types of information
    return `Based strictly on the following text content, generate exactly ${numCards} flashcards. Focus on **key terms and their definitions**, **important concepts**, and **core principles** mentioned in the text.

For each flashcard:
- 'front_content' should be a term, concept, or question.
- 'back_content' should be its definition, explanation, or answer, derived directly from the text.

Text Content:
"""
${text}
"""

Return ONLY valid JSON in this exact shape:
{
  "flashcards": [
    { "front_content": "...", "back_content": "..." }
  ]
}`;
}


async function callAIToGenerateFlashcards(text: string, numCards: number): Promise<AICardOutput[]> {
    if (!API_KEY) throw new Error("Missing GOOGLE_AI_API_KEY"); const genAI = new GoogleGenerativeAI(API_KEY); const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME, generationConfig: { responseMimeType: "application/json" }, }); const prompt = buildAIPrompt(text, numCards); try { console.log(`Sending prompt to AI model: ${AI_MODEL_NAME} for flashcards...`); const result = await model.generateContent(prompt); const response = await result.response; const content = response.text(); if (!content) throw new Error("Empty response from AI."); const parsed: AIResponseFormat = JSON.parse(content); if (!parsed.flashcards || !Array.isArray(parsed.flashcards) || parsed.flashcards.length === 0) throw new Error("AI failed expected format."); parsed.flashcards.forEach((card, index) => { if (!card.front_content || !card.back_content) throw new Error(`Invalid content card ${index + 1}.`); }); console.log(`AI flashcards generation successful using ${AI_MODEL_NAME}.`); return parsed.flashcards; } catch (error: any) { console.error(`Error calling/parsing AI for flashcards from ${AI_MODEL_NAME}:`, error); throw new Error(`AI generation failed: ${error.message}`); }
}

// --- Helper to Update AI Usage using SERVICE ROLE ---
async function updateAIUsage(userId: string, month: Date, count: number = 1) {
    if (count <= 0) return;
    const firstDayOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)).toISOString().split('T')[0];
    const supabase = supabaseAdmin; // Use the imported admin client
    try {
        console.log(`[Admin] Attempting to fetch AI usage for ${userId} month ${firstDayOfMonth}`);
        const { data: currentUsage, error: fetchError } = await supabase.from('ai_usage').select('usage_count').eq('user_id', userId).eq('usage_month', firstDayOfMonth).maybeSingle();
        if (fetchError && fetchError.code !== 'PGRST116') { console.error("[Admin] Supabase fetch error (updateAIUsage):", fetchError); throw new Error(`Failed fetching current AI usage: ${fetchError.message} (Code: ${fetchError.code})`); }
        const currentCount = currentUsage?.usage_count ?? 0;
        const newCount = currentCount + count;
        console.log(`[Admin] Attempting to upsert AI usage for ${userId} month ${firstDayOfMonth} to ${newCount}`);
        const { error: upsertError } = await supabase.from('ai_usage').upsert({ user_id: userId, usage_month: firstDayOfMonth, usage_count: newCount, updated_at: new Date().toISOString(), }, { onConflict: 'user_id, usage_month' });
        if (upsertError) { console.error("[Admin] Supabase upsert error (updateAIUsage):", upsertError); throw new Error(`Failed upserting AI usage: ${upsertError.message} (Code: ${upsertError.code})`); }
        console.log(`[Admin] Successfully updated AI usage for ${userId} in ${firstDayOfMonth}.`);
    } catch (error) { console.error(`[Admin] Error during AI usage update logic for user ${userId}:`, error); throw error; }
}

// --- POST Handler: Generate Flashcards from Document ---
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        // 1. Check usage limits
        const usageCheck = await checkAIGenerationUsageLimit(user.id);
        if (!usageCheck.isValid || !usageCheck.canGenerate) {
            // --- MODIFICATION: Return standardized error ---
            return NextResponse.json<ApiResponse>({ 
                success: false, 
                error: usageCheck.error, // This will be "limit_exceeded"
                message: usageCheck.message 
            }, { status: 403 });
            // --- END MODIFICATION ---
        }

        // 2. Parse/Validate Body
        let body: GenerateFlashcardsRequestBody;
        try { body = await request.json(); } catch (e) { return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON' }, { status: 400 }); }
        const { documentId, numberOfCards = 10, deckTitle } = body;
        if (!documentId) return NextResponse.json<ApiResponse>({ success: false, error: 'Missing documentId' }, { status: 400 });
        if (numberOfCards < 3 || numberOfCards > 50) return NextResponse.json<ApiResponse>({ success: false, error: 'Number of cards must be between 3 and 50.' }, { status: 400 });

        // 3. Fetch Document Text (Prisma)
        let documentData: { extracted_text: string | null; file_name: string } | null = null;
        try { documentData = await prisma.documents.findUnique({ where: { id: documentId, user_id: user.id }, select: { extracted_text: true, file_name: true } }); } catch (dbError) { if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2023') return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Document ID format.' }, { status: 400 }); throw dbError; }
        if (!documentData) return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found or access denied.' }, { status: 404 });

        // *** ADDED CHECK: Validate extracted text length BEFORE calling AI ***
        if (!documentData.extracted_text || documentData.extracted_text.trim().length < MIN_CONTENT_LENGTH) {
            return NextResponse.json<ApiResponse>({ success: false, error: `Document content too short (minimum ${MIN_CONTENT_LENGTH} characters required).` }, { status: 400 });
        }
        // *** END ADDED CHECK ***

        // 4. Call AI
        const generatedCards = await callAIToGenerateFlashcards(documentData.extracted_text.trim(), numberOfCards); // Trim content
        const actualGeneratedCount = generatedCards.length;
        if (actualGeneratedCount === 0) return NextResponse.json<ApiResponse>({ success: false, error: 'AI generated zero cards.' }, { status: 500 });

        // 5. Save Deck/Cards (Prisma Transaction)
        const finalDeckTitle = deckTitle?.trim() || `Flashcards from ${documentData.file_name}`;
        const newDeckAndCards = await prisma.$transaction(async (tx) => {
            const newDeck = await tx.flashcard_decks.create({ data: { user_id: user.id, title: finalDeckTitle.substring(0, 255) }, select: { id: true, title: true } });
            const cardsToCreate = generatedCards.map(card => ({ deck_id: newDeck.id, front_content: card.front_content, back_content: card.back_content }));
            await tx.flashcards.createMany({ data: cardsToCreate });
            return newDeck;
        });

        // 6. Update AI Usage using Admin client helper
        await updateAIUsage(user.id, new Date(), 1); // --- MODIFICATION: Only count as 1 generation, not per card ---

        // 7. Return Success
        const responseDeck: FlashcardDeck = { ...newDeckAndCards, user_id: user.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        return NextResponse.json<ApiResponse<FlashcardDeck>>({ success: true, data: responseDeck, message: `${actualGeneratedCount} cards generated into "${newDeckAndCards.title}".` }, { status: 201 });

    } catch (error: any) {
        if (error instanceof Response) return error;
        console.error('Error in /api/generate-flashcards:', error);
        if (error.message?.includes("AI usage")) { console.error("Critical error: Failed to update AI usage count:", error.message); /* Decide response */ }
        if (error.message.startsWith('AI generation failed:')) return NextResponse.json<ApiResponse>({ success: false, error: `AI Error: ${error.message}` }, { status: 502 });
        if (error instanceof Prisma.PrismaClientKnownRequestError) return NextResponse.json<ApiResponse>({ success: false, error: 'DB error saving cards.' }, { status: 500 });
        return NextResponse.json<ApiResponse>({ success: false, error: error.message || 'Failed to generate cards' }, { status: 500 });
    }
}