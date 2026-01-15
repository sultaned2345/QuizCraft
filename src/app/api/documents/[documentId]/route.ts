// src/app/api/documents/[documentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';

// Force dynamic to ensure auth headers are read correctly
export const dynamic = 'force-dynamic';

const STORAGE_BUCKET_NAME = 'user_documents';

// Helper: Get authenticated Supabase client for storage ops
function getSupabaseClientForUser(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Fallback: If no Bearer token, we cannot perform storage ops on behalf of user easily
    // In a real app, you might use a service role key if the backend is trusted, 
    // but here we stick to the user's context if provided.
    if (!token) {
        // Warning: This might fail if the request comes from a cookie-based session 
        // without an Authorization header. For server-side ops, usually Service Role is safer 
        // for deletion, but let's keep your logic for now.
        throw new Error("Missing auth token for storage operation");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });
}

// --- GET Handler: Retrieve document metadata ---
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ documentId: string }> }
) {
    try {
        // 1. Safe Param Access (Next.js 15 compatible)
        const params = await props.params;
        const { documentId } = params;

        if (!documentId) {
             return NextResponse.json({ error: 'Document ID missing' }, { status: 400 });
        }

        // 2. Auth Check
        const user = await requireAuth(request);

        // 3. Database Query
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
                storage_path: true, 
                extracted_text: true, // Required for Workspace/Chat
            }
        });

        if (!doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // 4. Data Transformation
        // - Serialize BigInt (file_size)
        // - Generate Public URL
        // - Map file_name -> title
        const safeDoc = {
            ...doc,
            title: doc.file_name,
            file_size: doc.file_size?.toString() || "0", 
            publicUrl: doc.storage_path 
                ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET_NAME}/${doc.storage_path}`
                : null
        };

        return NextResponse.json({ success: true, data: safeDoc });

    } catch (error: any) {
        // Handle Auth Response throw
        if (error instanceof Response) return error;

        console.error(`[GET /api/documents/${(await props.params).documentId}] Error:`, error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

// --- DELETE Handler: Remove document from DB and Storage ---
export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ documentId: string }> }
) {
    try {
        const params = await props.params;
        const { documentId } = params;

        if (!documentId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Document ID is required.' }, { status: 400 });
        }

        const user = await requireAuth(request);

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

        // 2. Delete file from Storage
        if (documentToDelete.storage_path) {
            try {
                const supabaseForUser = getSupabaseClientForUser(request);
                const { error: storageError } = await supabaseForUser.storage
                    .from(STORAGE_BUCKET_NAME)
                    .remove([documentToDelete.storage_path]);

                if (storageError) {
                    console.error(`Storage delete error:`, storageError);
                    // Continue to delete DB record to prevent orphans, but log the error
                }
            } catch (storageException) {
                 console.warn("Could not initialize storage client (likely cookie auth), skipping storage delete:", storageException);
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