// src/app/api/documents/[documentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
const STORAGE_BUCKET_NAME = 'user_documents';

// Helper: Get authenticated Supabase client for storage ops
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

// --- GET Handler: Retrieve document metadata ---
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
            select: {
                id: true,
                file_name: true,
                file_type: true,
                file_size: true,
                created_at: true,
                processing_status: true,
                ai_summary: true,
                storage_path: true, // Needed for public URL generation
            }
        });

        if (!doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // 1. Serialize BigInt (file_size) to string
        // 2. Generate Public URL for frontend PDF viewer
        const safeDoc = {
            ...doc,
            file_size: doc.file_size?.toString(), 
            publicUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET_NAME}/${doc.storage_path}`
        };

        return NextResponse.json({ success: true, data: safeDoc });

    } catch (error: any) {
        console.error("GET Document Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// --- DELETE Handler: Remove document from DB and Storage ---
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

        // 1. Find document to get storage path
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

        // 2. Delete file from Storage
        if (documentToDelete.storage_path) {
            const { error: storageError } = await supabaseForUser.storage
                .from(STORAGE_BUCKET_NAME)
                .remove([documentToDelete.storage_path]);

            if (storageError) {
                console.error(`Storage delete error:`, storageError);
                throw new Error(`Storage delete failed: ${storageError.message}`);
            }
        }

        // 3. Delete DB record and related embeddings
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
             return NextResponse.json<ApiResponse>({ success: false, error: 'Database error occurred.' }, { status: 500 });
        }

        console.error(`Unexpected error deleting document:`, error);
        return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
    }
}