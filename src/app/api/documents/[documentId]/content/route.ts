import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// --- GET Handler: Fetch extracted text for a specific document ---
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
                extracted_text: true, // Only select the text field
                file_name: true, // Include filename for context
            },
        });

        if (!document) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found or access denied.' }, { status: 404 });
        }

        // Return just the text content (and maybe filename for reference)
        return NextResponse.json<ApiResponse<{ extracted_text: string | null; file_name: string }>>({
            success: true,
            data: {
                extracted_text: document.extracted_text,
                file_name: document.file_name,
            },
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors
        console.error(`Error fetching content for document ${params.documentId}:`, error);
        // Handle Prisma specific error for invalid UUID format
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Document ID format.' }, { status: 400 });
        }
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch document content';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}