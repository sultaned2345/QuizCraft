// src/app/api/documents/[documentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabaseClient'; // <-- FIX: Changed from '@/lib/supabase'
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
const STORAGE_BUCKET_NAME = 'user_documents';

// --- DELETE Handler: Delete a document record and its file from storage ---
export async function DELETE(
    request: NextRequest,
    { params }: { params: { documentId: string } }
) {
    try {
        const user = await requireAuth(request); ///route.ts]
        const { documentId } = params; ///route.ts]

        if (!documentId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document ID is required.' }, { status: 400 }); ///route.ts]
        }

        // 1. Find the document record to get the storage path and verify ownership
        const documentToDelete = await prisma.documents.findUnique({
            where: {
                id: documentId,
                user_id: user.id, // Verify ownership/route.ts]
            },
            select: {
                storage_path: true, // Need the path to delete the file/route.ts]
            },
        });

        if (!documentToDelete) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found or access denied.' }, { status: 404 }); ///route.ts]
        }

        // 2. Delete the file from Supabase Storage
        if (documentToDelete.storage_path) {
            // Use the standard client which respects RLS (user can delete their own files)
            const { error: storageError } = await supabase.storage
                .from(STORAGE_BUCKET_NAME)
                .remove([documentToDelete.storage_path]); ///route.ts]

            if (storageError) {
                console.error(`Supabase storage error deleting file ${documentToDelete.storage_path}:`, storageError); ///route.ts]
            } else {
                 console.log(`Successfully deleted file from storage: ${documentToDelete.storage_path}`); ///route.ts]
            }
        }

        // 3. Delete the document record and embeddings in a transaction
        await prisma.$transaction([
            // Delete embeddings
            prisma.content_embeddings.deleteMany({
                where: {
                    content_id: documentId,
                    user_id: user.id
                }
            }),
            // Delete the document itself
            prisma.documents.delete({
                where: {
                    id: documentId,
                },
            }) ///route.ts]
        ]);

        // 4. Return success response
        return NextResponse.json<ApiResponse>({
            success: true,
            message: 'Document deleted successfully.',
        }); ///route.ts]

    } catch (error: any) {
        // ... (error handling remains the same) .../route.ts]
        if (error instanceof Response) return error; 

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             if (error.code === 'P2025') { 
                return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found.' }, { status: 404 });
             }
             if (error.code === 'P2023') { 
                 return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Document ID format.' }, { status: 400 });
             }
             console.error('Prisma Error deleting document:', { code: error.code, meta: error.meta });
             return NextResponse.json<ApiResponse>({ success: false, error: 'Database error occurred while deleting document.' }, { status: 500 });
        }

        console.error(`Unexpected error deleting document ${params.documentId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete document';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}