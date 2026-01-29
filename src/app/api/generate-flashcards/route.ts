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
export const maxDuration = 60; 

// --- Helper to Update AI Usage using SERVICE ROLE (Restored) ---
async function updateAIUsage(userId: string, month: Date, count: number = 1) {
    if (count <= 0) return;
    const firstDayOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)).toISOString().split('T')[0];
    const supabase = supabaseAdmin; 
    try {
        // Try RPC first if available (common pattern in this app)
        const { error: rpcError } = await (supabase.rpc as any)('increment_ai_usage', {
            p_user_id: userId,
            p_amount: count,
            p_month: firstDayOfMonth
        });

        if (!rpcError) return;

        // Fallback: Manual Upsert logic
        // FIX: Cast query builder to 'any' to bypass strict typing for dynamic/unknown tables
        const { data: currentUsage, error: fetchError } = await (supabase
            .from('ai_usage' as any) as any)
            .select('usage_count')
            .eq('user_id', userId)
            .eq('usage_month', firstDayOfMonth)
            .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') throw new Error(`Failed fetching usage: ${fetchError.message}`);
        
        const currentCount = currentUsage?.usage_count ?? 0;
        const newCount = currentCount + count;
        
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

        // 2. Safe Body Parsing
        let body: any = {};
        try { 
            const textBody = await request.text();
            if (textBody) body = JSON.parse(textBody);
        } catch (e) { 
            return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON body' }, { status: 400 }); 
        }
        
        let { documentId, text, numberOfCards = 10, deckTitle } = body;
        
        // 3. Robust Content Backfilling
        let sourceText = "";
        let finalDeckTitle = deckTitle?.trim() || "Generated Flashcards";

        // If text is provided (e.g. from raw input), use it
        if (text) {
             sourceText = text;
             if (!deckTitle) finalDeckTitle = "Flashcards from Text";
        } 
        // If no text, but we have a documentId, fetch from DB
        else if (documentId) {
             // Trap "undefined" string
             if (documentId === 'undefined' || documentId === 'null') {
                 return NextResponse.json<ApiResponse>({ success: false, error: "Invalid document ID." }, { status: 400 });
             }

             console.log(`[Flashcards] Fetching text from DB for doc: ${documentId}`);
             const doc = await prisma.documents.findUnique({ 
                 where: { id: documentId, user_id: user.id }, 
                 select: { extracted_text: true, file_name: true } 
             });
             
             if (!doc || !doc.extracted_text) {
                 return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found or contains no text.' }, { status: 404 });
             }
             
             sourceText = doc.extracted_text;
             if (!deckTitle) finalDeckTitle = `Flashcards from ${doc.file_name}`;
        }

        // 4. Validation
        if (!sourceText || sourceText.length < 50) {
             // Specific error message depending on whether they sent an ID or raw text
             const msg = documentId ? "Document content is too short (min 50 chars)." : "Input text is too short (min 50 chars).";
             return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 400 });
        }
        
        const validNumCards = Math.max(3, Math.min(50, Number(numberOfCards) || 10));

        // 5. Call AI
        const generatedCards = await callAIToGenerateFlashcards(sourceText.trim(), validNumCards);

        if (!generatedCards || generatedCards.length === 0) {
             return NextResponse.json<ApiResponse>({ success: false, error: 'AI failed to generate valid flashcards.' }, { status: 500 });
        }

        const actualGeneratedCount = generatedCards.length;

        // 6. Save to DB
        const newDeckAndCards = await prisma.$transaction(async (tx) => {
            const newDeck = await tx.flashcard_decks.create({ 
                data: { user_id: user.id, title: finalDeckTitle.substring(0, 255) }, 
                select: { id: true, title: true } 
            });
            const cardsToCreate = generatedCards.map((card: any) => ({ 
                deck_id: newDeck.id, 
                front_content: card.front_content, 
                back_content: card.back_content 
            }));
            await tx.flashcards.createMany({ data: cardsToCreate });
            return newDeck;
        });

        // 7. Update Usage
        await updateAIUsage(user.id, new Date(), 1);

        const responseDeck: FlashcardDeck = { 
            ...newDeckAndCards, 
            user_id: user.id, 
            created_at: new Date().toISOString(), 
            updated_at: new Date().toISOString() 
        };
        
        return NextResponse.json<ApiResponse<FlashcardDeck>>({ 
            success: true, 
            data: responseDeck, 
            message: `${actualGeneratedCount} cards generated.` 
        }, { status: 201 });

    } catch (error: any) {
        if (error instanceof Response) return error;
        console.error('Error in /api/generate-flashcards:', error);
        return NextResponse.json<ApiResponse>({ success: false, error: error.message || 'Failed to generate cards' }, { status: 500 });
    }
}