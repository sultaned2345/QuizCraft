// src/app/api/documents/[documentId]/url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const STORAGE_BUCKET_NAME = 'user_documents';
const SIGNED_URL_EXPIRES_IN = 60 * 5; 

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

        const document = await prisma.documents.findUnique({
            where: {
                id: documentId,
                user_id: user.id,
            },
            select: {
                storage_path: true,
                file_type: true,
                file_name: true,
            },
        });

        if (!document) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found or access denied.' }, { status: 404 });
        }
        
        // --- FIX: More robust PDF check ---
        // Allow if mime is pdf, OR extension is pdf, OR mime is octet-stream (common for uploads)
        const isPdf = 
            document.file_type === 'application/pdf' || 
            document.storage_path.toLowerCase().endsWith('.pdf') ||
            document.file_name?.toLowerCase().endsWith('.pdf');

        if (!isPdf) {
             console.warn(`Blocked view request for non-PDF: ${document.file_name} (${document.file_type})`);
             return NextResponse.json<ApiResponse>({ success: false, error: 'This file is not recognized as a PDF.' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET_NAME)
            .createSignedUrl(document.storage_path, SIGNED_URL_EXPIRES_IN);

        if (error) {
            console.error(`Error creating signed URL for ${document.storage_path}:`, error);
            throw new Error(`Could not create viewable link: ${error.message}`);
        }

        return NextResponse.json<ApiResponse<{ signedUrl: string }>>({
            success: true,
            data: {
                signedUrl: data.signedUrl,
            },
        });

    } catch (error: any) {
        if (error instanceof Response) return error;
        console.error(`Error fetching signed URL for doc ${params.documentId}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch document URL';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}