// src/app/api/documents/[documentId]/insights/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';
import { callAIToGenerateInsights } from '@/lib/aiGeneration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface AIDocumentInsights {
  keyConcepts: string[];
  examQuestions: string[];
  mainArguments: string[];
}

// GET: Fetch existing insights
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

        const document = await prisma.documents.findFirst({
            where: {
                id: documentId,
                user_id: user.id,
            },
            select: {
                ai_insights: true,
            },
        });

        if (!document) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found or access denied.' }, { status: 404 });
        }

        return NextResponse.json<ApiResponse<AIDocumentInsights | null>>({
            success: true,
            // FIX: Cast to 'unknown' first to satisfy TypeScript compiler
            data: (document.ai_insights as unknown as AIDocumentInsights) || null,
        });

    } catch (error: any) {
        if (error instanceof Response) return error;
        console.error(`[API GET Insights] Error:`, error);
        return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to fetch insights.' }, { status: 500 });
    }
}

// POST: Generate new insights
export async function POST(
    request: NextRequest,
    { params }: { params: { documentId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { documentId } = params;

        // 1. Fetch Document Text
        const document = await prisma.documents.findFirst({
            where: { id: documentId, user_id: user.id },
            select: { id: true, extracted_text: true }
        });

        if (!document || !document.extracted_text) {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Document text not found.' }, { status: 404 });
        }

        // 2. Call AI Service
        const insights = await callAIToGenerateInsights(document.extracted_text);

        // 3. Save to DB
        await prisma.documents.update({
            where: { id: documentId },
            data: { ai_insights: insights as unknown as Prisma.JsonObject }
        });

        return NextResponse.json<ApiResponse<AIDocumentInsights>>({
            success: true,
            data: insights
        });

    } catch (error: any) {
        if (error instanceof Response) return error;
        console.error(`[API POST Insights] Error:`, error);
        return NextResponse.json<ApiResponse>({ success: false, error: error.message || 'Failed to generate insights.' }, { status: 500 });
    }
}