// src/app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth';
import { USAGE_LIMITS } from '@/lib/usage-limits';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';
import { generateEmbeddingsForContent } from '@/lib/embedding';
// --- DYNAMIC: Import the new server-side helper ---
import { extractTextFromServerFile } from '@/lib/file-parser.server';

export const runtime = 'nodejs';

// ... (Constants and Interfaces remain the same) ...
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
    'application/pdf', 
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation' // .pptx
];
const ALLOWED_EXTENSIONS = [
    '.pdf', 
    '.txt',
    '.docx',
    '.pptx'
];
const STORAGE_BUCKET_NAME = 'user_documents';
const FREE_DOCUMENT_LIMIT = 5;

interface DocumentMetadata { id: string; file_name: string; file_type: string; file_size: number; created_at: string; storage_path: string; }
interface PaginatedDocumentsResponse { documents: DocumentMetadata[]; count: number; limit: number | typeof Infinity; totalPages: number; currentPage: number; }

// ... (getSupabaseClientForUser, validateDocumentLimit helpers remain the same) ...
function getSupabaseClientForUser(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) throw new Error("Missing auth token");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });
}
async function validateDocumentLimit(userId: string): Promise<{
    isValid: boolean; error?: string; message?: string; limit?: number | typeof Infinity; count?: number;
}> {
    try {
        const userProfile = await prisma.profiles.findUnique({
            where: { id: userId },
            select: { subscription_plan: true }
        });
        const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const limit = plan === 'pro' ? Infinity : FREE_DOCUMENT_LIMIT;

        if (plan !== 'pro') {
            const currentCount = await prisma.documents.count({ where: { user_id: userId } });
            if (currentCount >= limit) {
                return { isValid: false, limit, count: currentCount, error: 'Document limit reached', message: `Max ${limit} docs for free users.` };
            }
            return { isValid: true, limit, count: currentCount };
        }
        return { isValid: true, limit, count: undefined };
    } catch (error) {
        console.error("Error validating document limit:", error);
        return { isValid: true }; // Permissive on error
    }
}

// --- DYNAMIC: All local text extraction helpers are REMOVED ---
// (getTextFromPPTXNodes, extractTextFromPPTX, extractTextFromFile)


// --- POST Handler (Refactored) ---
export async function POST(request: NextRequest) {
    let user;
    let storagePath: string | null = null;
    let supabaseForUser: any;

    try {
        user = await requireAuth(request); //
        supabaseForUser = getSupabaseClientForUser(request); //

        const limitCheck = await validateDocumentLimit(user.id); //
        if (!limitCheck.isValid) {
            return NextResponse.json<ApiResponse>({ success: false, error: limitCheck.error, message: limitCheck.message }, { status: 403 }); //
        }

        const formData = await request.formData(); //
        const file = formData.get('file') as File | null;
        if (!file) return NextResponse.json<ApiResponse>({ success: false, error: 'No file provided.' }, { status: 400 }); //

        // ... (File validation logic remains the same) ...
         const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
         const hasValidMime = file.type && ALLOWED_MIME_TYPES.includes(file.type);
         let probableType = file.type;
         if (!hasValidMime && hasValidExtension) {
             if (file.name.toLowerCase().endsWith('.docx')) probableType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
             else if (file.name.toLowerCase().endsWith('.pptx')) probableType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
             else if (file.name.toLowerCase().endsWith('.pdf')) probableType = 'application/pdf';
             else if (file.name.toLowerCase().endsWith('.txt')) probableType = 'text/plain';
         }
         if (!ALLOWED_MIME_TYPES.includes(probableType) && !hasValidExtension) {
             console.warn(`Invalid file type: name=${file.name}, type=${file.type}, probable=${probableType}`);
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid file type. Only PDF, TXT, DOCX, and PPTX allowed.' }, { status: 400 });
         }
        if (file.size > MAX_FILE_SIZE) return NextResponse.json<ApiResponse>({ success: false, error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` }, { status: 400 }); //

        const fileBuffer = Buffer.from(await file.arrayBuffer()); //
        let extractedText: string;
        try {
            // --- DYNAMIC: Use the centralized helper ---
            extractedText = await extractTextFromServerFile(file, fileBuffer); 
            if (!extractedText || extractedText.length < 50) throw new Error("Extracted text is too short (minimum 50 characters required)."); //
        } catch (textError: any) {
             return NextResponse.json<ApiResponse>({ success: false, error: textError.message || 'Failed to process file content.' }, { status: 400 }); //
        }

        storagePath = `${user.id}/${Date.now()}-${file.name}`; //
        const { data: uploadData, error: uploadError } = await supabaseForUser.storage
            .from(STORAGE_BUCKET_NAME)
            .upload(storagePath, fileBuffer, { contentType: probableType || file.type || undefined, upsert: false }); //

        if (uploadError) {
            throw new Error(`Failed to upload file to storage: ${uploadError.message}`); //
        }
        if (!uploadData?.path) { throw new Error('File uploaded but no path returned from storage.'); } //

        const newDocumentData = await prisma.documents.create({
            data: {
                user_id: user.id,
                file_name: file.name,
                file_type: probableType || file.type || 'unknown',
                file_size: file.size,
                storage_path: uploadData.path,
                extracted_text: extractedText,
            },
            select: { id: true, file_name: true, file_type: true, file_size: true, created_at: true, storage_path: true }
        }); //

        // --- NEW: Asynchronously generate embeddings ---
        generateEmbeddingsForContent(newDocumentData.id, 'document', extractedText, user.id)
          .catch(err => {
            console.error(`Failed to generate embeddings for document ${newDocumentData.id}:`, err);
          });
        // --- END NEW ---

        const newDocument = {
            ...newDocumentData,
            created_at: newDocumentData.created_at?.toISOString() || '',
        }; //

        return NextResponse.json<ApiResponse<DocumentMetadata>>({
            success: true, data: newDocument, message: 'Document uploaded successfully.'
        }, { status: 201 }); //

    } catch (error: any) {
        // ... (error handling remains the same) ...
        if (error instanceof Response) return error;
        console.error('Error uploading document:', error);
        if (storagePath && user && supabaseForUser && error instanceof Prisma.PrismaClientKnownRequestError) {
             console.warn(`Database insert failed after storage upload for path: ${storagePath}. Attempting cleanup.`);
             try { await supabaseForUser.storage.from(STORAGE_BUCKET_NAME).remove([storagePath]); console.log(`Cleaned up: ${storagePath}`); } catch (cleanupError) { console.error(`Cleanup failed for ${storagePath}:`, cleanupError); }
         }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             console.error('Prisma Error creating document record:', { code: error.code, meta: error.meta });
             return NextResponse.json<ApiResponse>({ success: false, error: 'Database error saving document metadata.' }, { status: 500 });
        }
        if (error.message.includes("Missing auth token")) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication token issue.' }, { status: 401 });
        }
        const status = error.message.includes('Storage security policy violation') ? 403 : 500;
        return NextResponse.json<ApiResponse>({ success: false, error: error.message || 'Failed to upload document' }, { status });
    }
}

// --- DYNAMIC: Original GET Handler (Restored) ---
export async function GET(request: NextRequest) {
     try {
        const user = await requireAuth(request);

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '9', 10);
        const skip = (page - 1) * limit;

        const limitCheck = await validateDocumentLimit(user.id);

        const [documentsData, totalCount] = await prisma.$transaction([
             prisma.documents.findMany({
                where: { user_id: user.id },
                select: { id: true, file_name: true, file_type: true, file_size: true, created_at: true, storage_path: true },
                orderBy: { created_at: 'desc' },
                take: limit,
                skip: skip,
            }),
            prisma.documents.count({
                 where: { user_id: user.id },
            }),
        ]);

        const totalPages = Math.ceil(totalCount / limit);

         const formattedDocuments: DocumentMetadata[] = documentsData.map(doc => ({
             ...doc,
             created_at: doc.created_at?.toISOString() || '',
         }));

        const responseData: PaginatedDocumentsResponse = {
            documents: formattedDocuments,
            count: totalCount,
            limit: limitCheck.limit ?? Infinity,
            totalPages,
            currentPage: page,
        };

        return NextResponse.json<ApiResponse<PaginatedDocumentsResponse>>({
            success: true,
            data: responseData
        });

    } catch (error: any) {
        if (error instanceof Response) return error;
        console.error('Error fetching documents:', error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid User ID format somehow?' }, { status: 400 });
        }
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch documents';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}