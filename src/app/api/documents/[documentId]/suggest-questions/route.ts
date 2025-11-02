// src/app/api/documents/[documentId]/suggest-questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = 'nodejs';

// --- AI Configuration ---
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.5-flash-lite";

/**
 * Generates 3-5 suggested questions based on document content.
 */
async function generateSuggestedQuestions(text: string): Promise<string[]> {
    if (!API_KEY) {
        console.error("Missing GOOGLE_AI_API_KEY for suggested questions.");
        return [];
    }
    // Take first ~4000 chars for a fast response
    const textSnippet = text.substring(0, 4000); 

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: AI_MODEL_NAME,
            generationConfig: { temperature: 0.5, responseMimeType: "application/json" }
        });
        const prompt = `Based on the following text, generate 3 insightful questions a student might ask about its main topics. Return ONLY valid JSON in this exact shape: {"questions": ["question1", "question2", "question3"]}\n\nText:\n"""\n${textSnippet}\n"""`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const content = response.text();
        
        const parsed: { questions: string[] } = JSON.parse(content);
        return parsed.questions || [];
    } catch (error) {
        console.error("Failed to generate suggested questions:", error);
        return []; // Return empty on error, don't fail the chat
    }
}

// --- GET Handler ---
export async function GET(
    request: NextRequest,
    { params }: { params: { documentId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { documentId } = params;

        if (!documentId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document ID is required.' }, { status: 400 });
        }

        // Fetch the document's extracted text, ensuring user ownership
        const document = await prisma.documents.findUnique({
            where: {
                id: documentId,
                user_id: user.id, // Verify ownership
            },
            select: {
                extracted_text: true,
            },
        });

        if (!document || !document.extracted_text) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found or has no content.' }, { status: 404 });
        }

        if (document.extracted_text.length < 100) {
             return NextResponse.json<ApiResponse<string[]>>({ success: true, data: [] }); // Not enough content
        }
        
        // Generate questions
        const questions = await generateSuggestedQuestions(document.extracted_text);

        return NextResponse.json<ApiResponse<string[]>>({
            success: true,
            data: questions,
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors
        console.error(`Error fetching suggested questions for doc ${params.documentId}:`, error);
        
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Document ID format.' }, { status: 400 });
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggested questions';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}