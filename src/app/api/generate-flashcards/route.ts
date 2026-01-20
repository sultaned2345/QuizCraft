// src/app/api/generate-flashcards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit } from '@/lib/usage-limits';
import { ApiResponse, FlashcardDeck } from '@/types/database';
import { callAIToGenerateFlashcards } from '@/lib/aiGeneration';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// --- Helper to Update AI Usage using SERVICE ROLE ---
async function updateAIUsage(userId: string, month: Date, count: number = 1) {
    if (count <= 0) return;
    const firstDayOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)).toISOString().split('T')[0];
    const supabase = supabaseAdmin; 
    try {
        // FIX: Cast the query builder to 'any' to completely bypass strict typing for this unknown table
        const { data: currentUsage, error: fetchError } = await (supabase
            .from('ai_usage' as any) as any)
            .select('usage_count')
            .eq('user_id', userId)
            .eq('usage_month', firstDayOfMonth)
            .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') throw new Error(`Failed fetching usage: ${fetchError.message}`);
        
        const currentCount = currentUsage?.usage_count ?? 0;
        const newCount = currentCount + count;
        
        // FIX: Cast the query builder to 'any' here as well for upsert
        const { error: upsertError } = await (supabase
            .from('ai_usage' as any) as any)
            .upsert({ 
                user_id: userId, 
                usage_month: firstDayOfMonth, 
                usage_count: newCount, 
                updated_at: new Date().toISOString(), 
            }, { onConflict: 'user_id, usage_month' });

        if (upsertError) throw new Error(`Failed upserting usage: ${upsertError.message}`);
    } catch (error) { console.error(`[Admin] Error updating AI usage:`, error); }
}

export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        // 1. Check usage limits
        const usageCheck = await checkAIGenerationUsageLimit(user.id);
        if (!usageCheck.isValid || !usageCheck.canGenerate) {
            return NextResponse.json<ApiResponse>({ 
                success: false, 
                error: usageCheck.error, 
                message: usageCheck.message 
            }, { status: 403 });
        }

        // 2. Parse Body
        let body;
        try { body = await request.json(); } catch (e) { return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON' }, { status: 400 }); }
        
        const { documentId, text, numberOfCards = 10, deckTitle } = body;
        
        if (!documentId && !text) {
             return NextResponse.json<ApiResponse>({ success: false, error: "Missing 'text' or 'documentId'." }, { status: 400 });
        }
        if (numberOfCards < 3 || numberOfCards > 50) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Number of cards must be between 3 and 50.' }, { status: 400 });
        }

        // 3. Determine Source Text
        let sourceText = "";
        let finalDeckTitle = deckTitle?.trim() || "Generated Flashcards";

        if (text) {
             // Case A: Raw Text (e.g. from Voice Note)
             sourceText = text;
             if (!deckTitle) finalDeckTitle = "Flashcards from Text";
        } else if (documentId) {
             // Case B: From Document
             const doc = await prisma.documents.findUnique({ 
                 where: { id: documentId, user_id: user.id }, 
                 select: { extracted_text: true, file_name: true } 
             });
             if (!doc || !doc.extracted_text) return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found or empty.' }, { status: 404 });
             
             sourceText = doc.extracted_text;
             if (!deckTitle) finalDeckTitle = `Flashcards from ${doc.file_name}`;
        }

        // 4. Validate Length
        if (sourceText.length < 50) {
            return NextResponse.json<ApiResponse>({ success: false, error: "Content too short (minimum 50 chars)." }, { status: 400 });
        }

        // 5. Call AI (Using Shared Library)
        const generatedCards = await callAIToGenerateFlashcards(sourceText.trim(), numberOfCards);
        const actualGeneratedCount = generatedCards.length;

        // 6. Save to DB
        const newDeckAndCards = await prisma.$transaction(async (tx) => {
            const newDeck = await tx.flashcard_decks.create({ 
                data: { user_id: user.id, title: finalDeckTitle.substring(0, 255) }, 
                select: { id: true, title: true } 
            });
            const cardsToCreate = generatedCards.map(card => ({ deck_id: newDeck.id, front_content: card.front_content, back_content: card.back_content }));
            await tx.flashcards.createMany({ data: cardsToCreate });
            return newDeck;
        });

        // 7. Update Usage
        await updateAIUsage(user.id, new Date(), 1);

        const responseDeck: FlashcardDeck = { ...newDeckAndCards, user_id: user.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        return NextResponse.json<ApiResponse<FlashcardDeck>>({ success: true, data: responseDeck, message: `${actualGeneratedCount} cards generated.` }, { status: 201 });

    } catch (error: any) {
        if (error instanceof Response) return error;
        console.error('Error in /api/generate-flashcards:', error);
        return NextResponse.json<ApiResponse>({ success: false, error: error.message || 'Failed to generate cards' }, { status: 500 });
    }
}