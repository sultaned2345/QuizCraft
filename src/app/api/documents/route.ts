// src/app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js'; // Keep for scoped client in POST
import { requireAuth } from '@/lib/auth';
import { USAGE_LIMITS } from '@/lib/usage-limits';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';
import pdfParse from 'pdf-parse-fork';
import { cleanExtractedText } from '@/lib/file-parser';

export const runtime = 'nodejs';

// Config remains the same
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf', 'text/plain'];
const ALLOWED_EXTENSIONS = ['.pdf', '.txt'];
const STORAGE_BUCKET_NAME = 'user_documents';
const FREE_DOCUMENT_LIMIT = 5; // Keep or adjust as needed

// Document type for API response
interface DocumentMetadata {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    created_at: string; // Use string for ISO date format
    storage_path: string;
}

// Define a type for the paginated response data structure
interface PaginatedDocumentsResponse {
    documents: DocumentMetadata[];
    count: number; // Total count of documents for the user
    limit: number | typeof Infinity; // Usage limit for the plan
    totalPages: number;
    currentPage: number;
}


// --- Helpers (getSupabaseClientForUser, validateDocumentLimit, extractTextFromFile) remain the same ---
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
        // Use FREE_DOCUMENT_LIMIT constant defined above
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
async function extractTextFromFile(file: File, buffer: Buffer): Promise<string> {
    let rawText = '';
    const fileType = file.type || '';
    const fileNameLower = file.name.toLowerCase();
    try {
        if (fileType === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
            rawText = (await pdfParse(buffer)).text || '';
        } else if (fileType === 'text/plain' || fileNameLower.endsWith('.txt')) {
            rawText = buffer.toString('utf8');
        } else { throw new Error(`Unsupported type: ${fileType || 'unknown'}`); }
        if (!rawText || rawText.trim().length === 0) throw new Error("No text found.");
        return cleanExtractedText(rawText);
    } catch (error: any) { throw new Error(`Text extraction failed: ${error.message}`); }
}


// --- POST Handler (remains the same) ---
export async function POST(request: NextRequest) {
    let user;
    let storagePath: string | null = null;
    let supabaseForUser: any;

    try {
        user = await requireAuth(request);
        supabaseForUser = getSupabaseClientForUser(request);

        const limitCheck = await validateDocumentLimit(user.id);
        if (!limitCheck.isValid) {
            return NextResponse.json<ApiResponse>({ success: false, error: limitCheck.error, message: limitCheck.message }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (!file) return NextResponse.json<ApiResponse>({ success: false, error: 'No file provided.' }, { status: 400 });

        // File type/size validation...
         const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
         if (!ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext)) || (file.type && !ALLOWED_MIME_TYPES.includes(file.type))) {
              const probableType = file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : (file.name.toLowerCase().endsWith('.txt') ? 'text/plain' : file.type);
             if (!probableType || !ALLOWED_MIME_TYPES.includes(probableType)){
                 console.warn(`Invalid file type detected: name=${file.name}, reported type=${file.type}, probable type=${probableType}`);
                 return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid file type. Only PDF and TXT allowed.' }, { status: 400 });
             }
        }
        if (file.size > MAX_FILE_SIZE) return NextResponse.json<ApiResponse>({ success: false, error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` }, { status: 400 });

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        let extractedText: string;
        try {
            extractedText = await extractTextFromFile(file, fileBuffer);
            if (!extractedText || extractedText.length < 50) throw new Error("Extracted text is too short (minimum 50 characters required).");
        } catch (textError: any) {
             return NextResponse.json<ApiResponse>({ success: false, error: textError.message || 'Failed to process file content.' }, { status: 400 });
        }

        // Upload file to Supabase Storage --- USING SCOPED CLIENT ---
        storagePath = `${user.id}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabaseForUser.storage
            .from(STORAGE_BUCKET_NAME)
            .upload(storagePath, fileBuffer, { contentType: file.type || undefined, upsert: false });

        if (uploadError) {
             if (uploadError.message.includes('security policy')) { throw new Error(`Storage security policy violation: ${uploadError.message}`); }
            throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
        }
        if (!uploadData?.path) { throw new Error('File uploaded but no path returned from storage.'); }

        // Save metadata to database using Prisma
        const newDocumentData = await prisma.documents.create({
            data: {
                user_id: user.id,
                file_name: file.name,
                file_type: file.type || 'unknown',
                file_size: file.size,
                storage_path: uploadData.path,
                extracted_text: extractedText,
            },
            select: { id: true, file_name: true, file_type: true, file_size: true, created_at: true, storage_path: true } // Include storage_path
        });

         // Serialize dates for response
        const newDocument = {
            ...newDocumentData,
            created_at: newDocumentData.created_at?.toISOString() || '',
        };


        return NextResponse.json<ApiResponse<DocumentMetadata>>({ // Use DocumentMetadata type
            success: true, data: newDocument, message: 'Document uploaded successfully.'
        }, { status: 201 });

    } catch (error: any) {
        if (error instanceof Response) return error;
        console.error('Error uploading document:', error);
        // Optional Cleanup...
        if (storagePath && user && supabaseForUser && error instanceof Prisma.PrismaClientKnownRequestError) {
             console.warn(`Database insert failed after storage upload for path: ${storagePath}. Attempting cleanup.`);
             try { await supabaseForUser.storage.from(STORAGE_BUCKET_NAME).remove([storagePath]); console.log(`Cleaned up: ${storagePath}`); } catch (cleanupError) { console.error(`Cleanup failed for ${storagePath}:`, cleanupError); }
         }
        // Error Handling...
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


// --- UPDATED GET Handler: List documents for the user with Pagination ---
export async function GET(request: NextRequest) {
     try {
        const user = await requireAuth(request);

        // --- Pagination Parameters ---
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '9', 10); // Default 9 per page
        const skip = (page - 1) * limit;

        // Fetch limit info separately (using Prisma-based validator)
        const limitCheck = await validateDocumentLimit(user.id);

        // Fetch documents and total count using Prisma in a transaction
        const [documentsData, totalCount] = await prisma.$transaction([
             prisma.documents.findMany({
                where: { user_id: user.id },
                // Select only necessary fields for the list view
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

         // Map created_at to string ISO format for serialization
         const formattedDocuments: DocumentMetadata[] = documentsData.map(doc => ({
             ...doc,
             created_at: doc.created_at?.toISOString() || '', // Ensure it's a string
         }));

        const responseData: PaginatedDocumentsResponse = {
            documents: formattedDocuments,
            count: totalCount, // Use the count from the transaction
            limit: limitCheck.limit ?? Infinity, // Use the limit from validation
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
         // Handle Prisma specific error for invalid UUID format if applicable
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid User ID format somehow?' }, { status: 400 });
        }
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch documents';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}