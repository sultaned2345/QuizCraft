// src/app/api/documents/[documentId]/url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; // Use admin client for signed URLs
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const STORAGE_BUCKET_NAME = 'user_documents';
const SIGNED_URL_EXPIRES_IN = 60 * 5; // 5 minutes

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

        // 1. Fetch the document's storage_path, ensuring user ownership
        const document = await prisma.documents.findUnique({
            where: {
                id: documentId,
                user_id: user.id, // Verify ownership
            },
            select: {
                storage_path: true,
                file_type: true,
            },
        });

        if (!document) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found or access denied.' }, { status: 404 });
        }
        
        // 2. Check if it's a PDF
        if (document.file_type !== 'application/pdf' && !document.storage_path.toLowerCase().endsWith('.pdf')) {
             return NextResponse.json<ApiResponse>({ success: false, error: 'This file is not a PDF and cannot be viewed directly.' }, { status: 400 });
        }

        // 3. Create a signed URL using the Admin client
        const { data, error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET_NAME)
            .createSignedUrl(document.storage_path, SIGNED_URL_EXPIRES_IN);

        if (error) {
            console.error(`Error creating signed URL for ${document.storage_path}:`, error);
            throw new Error(`Could not create viewable link: ${error.message}`);
        }

        // 4. Return the signed URL
        return NextResponse.json<ApiResponse<{ signedUrl: string }>>({
            success: true,
            data: {
                signedUrl: data.signedUrl,
            },
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors
        console.error(`Error fetching signed URL for doc ${params.documentId}:`, error);
        
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Document ID format.' }, { status: 400 });
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch document URL';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}