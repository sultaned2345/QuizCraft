import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, validateRequestBody } from '@/lib/auth';
import { checkAIGenerationUsageLimit, USAGE_LIMITS } from '@/lib/usage-limits';
import { ApiResponse, FlashcardDeck } from '@/types/database'; // Import necessary types
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseHelpers } from '@/lib/supabase'; // Needed for incrementAIGenerationUsage
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// --- AI Configuration ---
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-1.5-flash"; // Or your preferred model

interface GenerateFlashcardsRequestBody {
    documentId: string;
    numberOfCards?: number; // Optional, defaults below
    deckTitle?: string; // Optional, defaults below
}

interface AICardOutput {
    front_content: string;
    back_content: string;
}

interface AIResponseFormat {
    flashcards: AICardOutput[];
}

// --- Helper Function to Build AI Prompt ---
function buildAIPrompt(text: string, numCards: number): string {
    // Basic prompt - can be refined for better results
    return `Based on the following text content, generate exactly ${numCards} flashcards. Each flashcard should represent a key concept, term, or question from the text. For each card, provide a "front_content" (the term/question) and a "back_content" (the definition/answer).

Focus on the most important information. Ensure the front and back content are concise and suitable for flashcards.

Content:
"""
${text}
"""

Return ONLY valid JSON in this exact shape:
{
  "flashcards": [
    { "front_content": "...", "back_content": "..." },
    { "front_content": "...", "back_content": "..." }
  ]
}`;
}

// --- Helper Function to Call AI ---
async function callAIToGenerateFlashcards(text: string, numCards: number): Promise<AICardOutput[]> {
    if (!API_KEY) {
        throw new Error("Missing GOOGLE_AI_API_KEY environment variable");
    }
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
        model: AI_MODEL_NAME,
        generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = buildAIPrompt(text, numCards);

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const content = response.text();

        if (!content) {
            throw new Error("Empty response from AI model.");
        }

        const parsed: AIResponseFormat = JSON.parse(content);

        if (!parsed.flashcards || !Array.isArray(parsed.flashcards) || parsed.flashcards.length === 0) {
            console.warn("AI returned invalid structure or empty flashcards array:", content);
            throw new Error("AI failed to generate flashcards in the expected format.");
        }

        // Basic validation of generated content
        parsed.flashcards.forEach((card, index) => {
             if (!card.front_content || !card.back_content || typeof card.front_content !== 'string' || typeof card.back_content !== 'string') {
                 throw new Error(`AI generated invalid content for card ${index + 1}.`);
             }
        });

        return parsed.flashcards;

    } catch (error: any) {
        console.error("Error calling or parsing AI response:", error);
        // Check for specific safety/blocking errors if the API provides them
        // Re-throw or handle specific AI errors
        throw new Error(`AI generation failed: ${error.message}`);
    }
}


// --- POST Handler: Generate Flashcards from Document ---
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        // 1. Check AI Generation Limits
        const usageCheck = await checkAIGenerationUsageLimit(user.id);
        if (!usageCheck.isValid || !usageCheck.canGenerate) {
            console.log(`AI generation blocked for user ${user.id}: ${usageCheck.error}`);
            return NextResponse.json<ApiResponse>({
                success: false,
                error: usageCheck.error,
                message: usageCheck.message
            }, { status: 403 }); // Forbidden
        }

        // 2. Parse and Validate Request Body
        let body: GenerateFlashcardsRequestBody;
        try {
            body = await request.json();
        } catch (parseError) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON body' }, { status: 400 });
        }

        const { documentId, numberOfCards = 10, deckTitle } = body; // Default to 10 cards

        if (!documentId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Missing required field: documentId' }, { status: 400 });
        }
        if (numberOfCards < 3 || numberOfCards > 50) { // Set reasonable limits
             return NextResponse.json<ApiResponse>({ success: false, error: 'Number of cards must be between 3 and 50.' }, { status: 400 });
        }

        // 3. Fetch Document Text and Verify Ownership
        let documentData: { extracted_text: string | null; file_name: string } | null = null;
        try {
            documentData = await prisma.documents.findUnique({
                where: {
                    id: documentId,
                    user_id: user.id, // Ownership check
                },
                select: {
                    extracted_text: true,
                    file_name: true,
                }
            });
        } catch (dbError) {
            // Handle potential invalid UUID format error
             if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2023') {
                 return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Document ID format.' }, { status: 400 });
             }
             throw dbError; // Re-throw other DB errors
        }


        if (!documentData) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found or access denied.' }, { status: 404 });
        }
        if (!documentData.extracted_text || documentData.extracted_text.length < 50) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document content is missing or too short for generation.' }, { status: 400 });
        }

        // 4. Call AI to Generate Flashcards
        const generatedCards = await callAIToGenerateFlashcards(documentData.extracted_text, numberOfCards);

        // If AI returned fewer cards than requested, adjust count (optional)
        const actualGeneratedCount = generatedCards.length;
        if (actualGeneratedCount === 0) {
             return NextResponse.json<ApiResponse>({ success: false, error: 'AI generation resulted in zero flashcards.' }, { status: 500 });
        }


        // 5. Create New Deck and Flashcards in Database (within a transaction)
        const finalDeckTitle = deckTitle?.trim() || `Flashcards from ${documentData.file_name}`;

        const newDeckAndCards = await prisma.$transaction(async (tx) => {
            // Create the deck
            const newDeck = await tx.flashcard_decks.create({
                data: {
                    user_id: user.id,
                    title: finalDeckTitle.substring(0, 255), // Limit title length
                },
                select: { id: true, title: true } // Select needed fields for response
            });

            // Prepare card data linked to the new deck
            const cardsToCreate = generatedCards.map(card => ({
                deck_id: newDeck.id,
                front_content: card.front_content,
                back_content: card.back_content,
            }));

            // Create the flashcards in bulk
            await tx.flashcards.createMany({
                data: cardsToCreate,
            });

            return newDeck;
        });

        // 6. Increment AI Usage Count (outside transaction)
        try {
            // Increment by the number of cards actually generated
            await supabaseHelpers.incrementAIGenerationUsage(user.id, new Date(), actualGeneratedCount);
        } catch (usageError) {
            // Log the error but don't fail the request, as cards are already created
            console.error(`Failed to increment AI usage for user ${user.id} after generating ${actualGeneratedCount} flashcards:`, usageError);
        }

        // 7. Return Success Response
        return NextResponse.json<ApiResponse<FlashcardDeck>>({
            success: true,
            data: newDeckAndCards, // Return basic deck info
            message: `${actualGeneratedCount} Flashcards generated successfully into deck "${newDeckAndCards.title}".`,
        }, { status: 201 }); // 201 Created

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors

        console.error('Error in /api/generate-flashcards:', error);

        // Handle specific known errors (like AI errors)
        if (error.message.startsWith('AI generation failed:') || error.message.includes('GOOGLE_AI_API_KEY')) {
             return NextResponse.json<ApiResponse>({ success: false, error: `AI Error: ${error.message}` }, { status: 502 }); // Bad Gateway for upstream AI issues
        }
        // Handle potential Prisma transaction errors
         if (error instanceof Prisma.PrismaClientKnownRequestError) {
             console.error('Prisma Transaction Error generating flashcards:', { code: error.code, meta: error.meta });
             return NextResponse.json<ApiResponse>({ success: false, error: 'Database error occurred while saving generated flashcards.' }, { status: 500 });
        }

        // Generic error
        const errorMessage = error.message || 'Failed to generate flashcards';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}