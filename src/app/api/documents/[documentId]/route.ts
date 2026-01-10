// src/app/api/documents/[documentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
const STORAGE_BUCKET_NAME = 'user_documents';

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

// --- FIX: Add GET Handler ---
export async function GET(
    request: NextRequest,
    { params }: { params: { documentId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { documentId } = params;

        const doc = await prisma.documents.findUnique({
            where: {
                id: documentId,
                user_id: user.id,
            },
            // Select fields to return (exclude large extracted_text if not needed for list view)
            select: {
                id: true,
                file_name: true,
                file_type: true,
                file_size: true,
                created_at: true,
                processing_status: true,
                ai_summary: true,
                // storage_path: true, // usually internal only
            }
        });

        if (!doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Convert BigInt for JSON serialization
        const safeDoc = {
            ...doc,
            file_size: doc.file_size?.toString(), 
        };

        return NextResponse.json({ success: true, data: safeDoc });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
// --- END FIX ---

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

        const documentToDelete = await prisma.documents.findUnique({
            where: {
                id: documentId,
                user_id: user.id,
            },
            select: {
                storage_path: true,
            },
        });

        if (!documentToDelete) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document not found or access denied.' }, { status: 404 });
        }

        const supabaseForUser = getSupabaseClientForUser(request);

        if (documentToDelete.storage_path) {
            const { error: storageError } = await supabaseForUser.storage
                .from(STORAGE_BUCKET_NAME)
                .remove([documentToDelete.storage_path]);

            if (storageError) {
                console.error(`Supabase storage error deleting file ${documentToDelete.storage_path}:`, storageError);
                throw new Error(`Storage delete failed: ${storageError.message}`);
            }
        }

        await prisma.$transaction([
            prisma.content_embeddings.deleteMany({
                where: {
                    content_id: documentId,
                    user_id: user.id
                }
            }),
            prisma.documents.delete({
                where: {
                    id: documentId,
                },
            })
        ]);

        return NextResponse.json<ApiResponse>({
            success: true,
            message: 'Document deleted successfully.',
        });

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