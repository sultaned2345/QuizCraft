// src/app/api/documents/[documentId]/content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { createClient } from "@supabase/supabase-js";
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: { params: { documentId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { documentId } = params;
        
        const url = new URL(request.url);
        const includeText = url.searchParams.get('text') !== 'false';
        const mode = url.searchParams.get('mode');

        if (!documentId) {
            return NextResponse.json({ success: false, error: 'Document ID required.' }, { status: 400 });
        }

        const document = await prisma.documents.findFirst({
            where: { id: documentId, user_id: user.id },
            select: { extracted_text: true, file_name: true, storage_path: true },
        });

        if (!document) {
            return NextResponse.json({ success: false, error: 'Document not found.' }, { status: 404 });
        }

        // --- SERVE BINARY FILE ---
        if (mode === 'binary') {
            if (!document.storage_path) {
                return new NextResponse('No storage path found', { status: 404 });
            }

            // [FIX] Use SERVICE_ROLE_KEY to bypass RLS for the download.
            // We already verified the user owns the document via Prisma above.
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY! // Ensure this env var exists
            );

            const { data, error } = await supabaseAdmin.storage
                .from('documents')
                .download(document.storage_path);

            if (error || !data) {
                console.error("Storage download error:", error);
                return new NextResponse('Failed to download file from storage', { status: 500 });
            }

            return new NextResponse(data, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `inline; filename="${document.file_name}"`,
                    'Content-Length': data.size.toString() // [Optional] Good practice
                }
            });
        }

        // Default: Return JSON Metadata
        return NextResponse.json<ApiResponse<{ extracted_text: string | null; file_name: string }>>({
            success: true,
            data: {
                extracted_text: includeText ? document.extracted_text : null,
                file_name: document.file_name,
            },
        });

    } catch (error: any) {
        console.error(`Error fetching content:`, error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}