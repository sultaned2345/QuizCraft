// src/app/api/documents/[documentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// --- FIX: Import createClient, not the singleton browser client ---
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
const STORAGE_BUCKET_NAME = 'user_documents';

// --- FIX: Add this helper function (copied from /api/documents/route.ts) ---
// This creates a Supabase client authenticated as the user making the request.
function getSupabaseClientForUser(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) throw new Error("Missing auth token for storage operation");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });
}
// --- END FIX ---


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

        // --- FIX: Create and use an authenticated client for storage operations ---
        const supabaseForUser = getSupabaseClientForUser(request);
        // --- END FIX ---

        // 2. Delete the file from Supabase Storage
        if (documentToDelete.storage_path) {
            // --- FIX: Use the authenticated client (supabaseForUser) ---
            const { error: storageError } = await supabaseForUser.storage
                .from(STORAGE_BUCKET_NAME)
                .remove([documentToDelete.storage_path]); ///route.ts]

            if (storageError) {
                console.error(`Supabase storage error deleting file ${documentToDelete.storage_path}:`, storageError); ///route.ts]
                // Throw an error to stop the transaction
                throw new Error(`Storage delete failed: ${storageError.message}`);
            } else {
                 console.log(`Successfully deleted file from storage: ${documentToDelete.storage_path}`); ///route.ts]
            }
        }

        // 3. Delete the document record and embeddings in a transaction
        // This part will now work because 'content_embeddings' is in the schema
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