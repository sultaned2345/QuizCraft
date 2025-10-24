import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase'; // Import Supabase client for storage
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
const STORAGE_BUCKET_NAME = 'user_documents'; // Ensure consistency

// --- DELETE Handler: Delete a document record and its file from storage ---
export async function DELETE(
    request: NextRequest,
    { params }: { params: { documentId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { documentId } = params;

        if (!documentId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document ID is required.' }, { status: 400 });
        }

        // 1. Find the document record to get the storage path and verify ownership
        const documentToDelete = await prisma.documents.findUnique({
            where: {
                id: documentId,
                user_id: user.id, // Verify ownership
            },
            select: {
                storage_path: true, // Need the path to delete the file
            },
        });

        if (!documentToDelete) {
             console.warn(`User ${user.id} attempt to delete document ${documentId} denied (not found or not owner).`);
            // Return 404 whether it doesn't exist or isn't owned by user
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found or access denied.' }, { status: 404 });
        }

        // 2. Delete the file from Supabase Storage
        if (documentToDelete.storage_path) {
            const { error: storageError } = await supabase.storage
                .from(STORAGE_BUCKET_NAME)
                .remove([documentToDelete.storage_path]); // Pass path in an array

            if (storageError) {
                // Log the error but proceed to delete the DB record anyway
                console.error(`Supabase storage error deleting file ${documentToDelete.storage_path}:`, storageError);
                // Depending on requirements, you might choose to return an error here instead
                // return NextResponse.json<ApiResponse>({ success: false, error: `Failed to delete file from storage: ${storageError.message}` }, { status: 500 });
            } else {
                 console.log(`Successfully deleted file from storage: ${documentToDelete.storage_path}`);
            }
        } else {
            console.warn(`Document record ${documentId} had no storage_path, skipping storage deletion.`);
        }


        // 3. Delete the document record from the database
        await prisma.documents.delete({
            where: {
                id: documentId,
                // user_id: user.id // Ownership already confirmed above
            },
        });

        // 4. Return success response
        return NextResponse.json<ApiResponse>({
            success: true,
            message: 'Document deleted successfully.',
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors

        // Handle specific Prisma errors
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             if (error.code === 'P2025') { // Record to delete not found (should be caught by the initial findUnique)
                return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found.' }, { status: 404 });
             }
             if (error.code === 'P2023') { // Invalid UUID format
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

// Note: We might add GET (fetch specific document metadata) or PUT (update metadata like file_name) handlers here later if needed.