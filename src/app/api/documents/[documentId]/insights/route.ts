// src/app/api/documents/[documentId]/insights/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface AIDocumentInsights {
  keyConcepts: string[];
  examQuestions: string[];
  mainArguments: string[];
}

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
            data: (document.ai_insights as AIDocumentInsights) || null,
        });

    } catch (error: any) {
        if (error instanceof Response) return error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Document ID format.' }, { status: 400 });
        }
        console.error(`[API /documents/${params.documentId}/insights] Error:`, error);
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Failed to fetch insights.' },
          { status: 500 }
        );
    }
}