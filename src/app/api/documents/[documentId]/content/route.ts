// src/app/api/documents/[documentId]/content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: { params: { documentId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { documentId } = params;
        
        // Check if client wants full text or just metadata
        const url = new URL(request.url);
        const includeText = url.searchParams.get('text') !== 'false';

        if (!documentId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document ID is required.' }, { status: 400 });
        }

        const document = await prisma.documents.findFirst({
            where: {
                id: documentId,
                user_id: user.id,
            },
            select: {
                extracted_text: includeText, // Conditionally fetch text
                file_name: true,
            },
        });

        if (!document) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found or access denied.' }, { status: 404 });
        }

        return NextResponse.json<ApiResponse<{ extracted_text: string | null; file_name: string }>>({
            success: true,
            data: {
                extracted_text: document.extracted_text || null,
                file_name: document.file_name,
            },
        });

    } catch (error: any) {
        if (error instanceof Response) return error;
        console.error(`Error fetching content for document ${params.documentId}:`, error);
        
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Document ID format.' }, { status: 400 });
        }
        
        return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to fetch document content' }, { status: 500 });
    }
}