import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// Import createClient specifically for scoped clients
import { createClient } from '@supabase/supabase-js';
// Keep the global client import if needed elsewhere, or remove if unused
import { supabase as globalSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { USAGE_LIMITS } from '@/lib/usage-limits';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';
import pdfParse from 'pdf-parse-fork';
import { cleanExtractedText } from '@/lib/file-parser';

export const runtime = 'nodejs';

// --- Configuration ---
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB limit
const ALLOWED_MIME_TYPES = ['application/pdf', 'text/plain'];
const ALLOWED_EXTENSIONS = ['.pdf', '.txt'];
const STORAGE_BUCKET_NAME = 'user_documents';
const FREE_DOCUMENT_LIMIT = 5;

// --- Helper to get scoped Supabase client ---
function getSupabaseClientForUser(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
        throw new Error("Missing auth token for scoped client creation");
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    // Create a new client instance for this request
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: `Bearer ${token}` }
        }
    });
}


// --- Helper to validate document count limit ---
async function validateDocumentLimit(userId: string): Promise<{
    isValid: boolean; error?: string; message?: string; limit?: number | typeof Infinity; count?: number;
}> {
    // ... (logic remains the same)
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
                return { isValid: false, limit, count: currentCount, error: 'Document limit reached', message: `You have reached the maximum number of documents (${limit}) for free users.` };
            }
            return { isValid: true, limit, count: currentCount };
        }
        return { isValid: true, limit, count: undefined };
    } catch (error) {
        console.error("Error validating document limit:", error);
        return { isValid: true };
    }
}


// --- Helper to extract text ---
async function extractTextFromFile(file: File, buffer: Buffer): Promise<string> {
    // ... (logic remains the same)
    let rawText = '';
    const fileType = file.type || '';
    const fileNameLower = file.name.toLowerCase();

    try {
        if (fileType === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
            const pdfData = await pdfParse(buffer);
            rawText = pdfData.text || '';
        } else if (fileType === 'text/plain' || fileNameLower.endsWith('.txt')) {
            rawText = buffer.toString('utf8');
        } else {
            throw new Error(`Unsupported file type: ${fileType || 'unknown'}`);
        }
        if (!rawText || rawText.trim().length === 0) throw new Error("File contains no extractable text.");
        return cleanExtractedText(rawText);
    } catch (error: any) {
        console.error("Error during text extraction:", error);
        throw new Error(`Failed to extract text: ${error.message}`);
    }
}


// --- POST Handler: Upload a new document ---
export async function POST(request: NextRequest) {
    let user; // Define user here to be accessible in finally block if needed for cleanup
    let storagePath: string | null = null; // Track storage path for potential cleanup
    let supabaseForUser: any; // Define scoped client here

    try {
        user = await requireAuth(request);

        // --- Create scoped client for this request ---
        supabaseForUser = getSupabaseClientForUser(request);

        // 1. Check document count limit
        const limitCheck = await validateDocumentLimit(user.id);
        if (!limitCheck.isValid) {
            return NextResponse.json<ApiResponse>({ success: false, error: limitCheck.error, message: limitCheck.message }, { status: 403 });
        }

        // 2. Get file from FormData
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (!file) return NextResponse.json<ApiResponse>({ success: false, error: 'No file provided.' }, { status: 400 });

        // 3. Validate file type and size (remains the same)
         const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
         if (!ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext)) || (file.type && !ALLOWED_MIME_TYPES.includes(file.type))) {
             const probableType = file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : (file.name.toLowerCase().endsWith('.txt') ? 'text/plain' : file.type);
             if (!probableType || !ALLOWED_MIME_TYPES.includes(probableType)){
                 console.warn(`Invalid file type detected: name=${file.name}, reported type=${file.type}, probable type=${probableType}`);
                 return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid file type. Only PDF and TXT allowed.' }, { status: 400 });
             }
        }
        if (file.size > MAX_FILE_SIZE) return NextResponse.json<ApiResponse>({ success: false, error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` }, { status: 400 });


        // 4. Read file buffer and extract text (remains the same)
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        let extractedText: string;
        try {
            extractedText = await extractTextFromFile(file, fileBuffer);
            if (!extractedText || extractedText.length < 50) throw new Error("Extracted text is too short (minimum 50 characters required).");
        } catch (textError: any) {
             return NextResponse.json<ApiResponse>({ success: false, error: textError.message || 'Failed to process file content.' }, { status: 400 });
        }


        // 5. Upload file to Supabase Storage --- USING SCOPED CLIENT ---
        storagePath = `${user.id}/${Date.now()}-${file.name}`; // Assign to outer scope var
        // Use the request-scoped client here
        const { data: uploadData, error: uploadError } = await supabaseForUser.storage
            .from(STORAGE_BUCKET_NAME)
            .upload(storagePath, fileBuffer, {
                contentType: file.type || undefined,
                upsert: false,
            });

        if (uploadError) {
            // Error could be RLS policy failure
            console.error('Supabase Storage Error:', uploadError);
            // Provide a slightly more specific error message if it's an RLS violation
            if (uploadError.message.includes('security policy')) {
                 throw new Error(`Storage security policy violation: ${uploadError.message}`);
            }
            throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
        }
        if (!uploadData?.path) {
             throw new Error('File uploaded but no path returned from storage.');
        }

        // 6. Save metadata to database using Prisma (remains the same)
        const newDocument = await prisma.documents.create({
            data: { /* ... data ... */
                user_id: user.id,
                file_name: file.name,
                file_type: file.type || 'unknown',
                file_size: file.size,
                storage_path: uploadData.path,
                extracted_text: extractedText,
            },
            select: { /* ... select fields ... */
                id: true,
                file_name: true,
                file_type: true,
                file_size: true,
                created_at: true,
            }
        });

        // 7. Return success response (remains the same)
        return NextResponse.json<ApiResponse<typeof newDocument>>({
            success: true, data: newDocument, message: 'Document uploaded successfully.'
        }, { status: 201 });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth or scoped client creation errors

        console.error('Error uploading document:', error);

        // --- Optional Cleanup: Attempt to delete orphaned storage file if DB insert failed ---
        if (storagePath && user && supabaseForUser && error instanceof Prisma.PrismaClientKnownRequestError) {
            console.warn(`Database insert failed after storage upload for path: ${storagePath}. Attempting cleanup.`);
            try {
                // Use the scoped client to attempt deletion based on RLS
                await supabaseForUser.storage.from(STORAGE_BUCKET_NAME).remove([storagePath]);
                console.log(`Successfully cleaned up orphaned storage file: ${storagePath}`);
            } catch (cleanupError) {
                console.error(`Failed to clean up orphaned storage file ${storagePath}:`, cleanupError);
            }
        }
        // --- End Optional Cleanup ---

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             console.error('Prisma Error creating document record:', { code: error.code, meta: error.meta });
             return NextResponse.json<ApiResponse>({ success: false, error: 'Database error saving document metadata.' }, { status: 500 });
        }
        // Handle specific error from getSupabaseClientForUser
        if (error.message.includes("Missing auth token")) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication token issue during scoped client creation.' }, { status: 401 });
        }

        const errorMessage = error.message || 'Failed to upload document';
        // Adjust status code if it was a storage RLS error
        const status = error.message.includes('Storage security policy violation') ? 403 : 500;
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status });
    }
}


// --- GET Handler: List documents for the user ---
export async function GET(request: NextRequest) {
    // ... (GET Handler remains the same - doesn't interact with storage RLS)
     try {
        const user = await requireAuth(request);

        const documents = await prisma.documents.findMany({
            where: { user_id: user.id },
            select: { id: true, file_name: true, file_type: true, file_size: true, created_at: true, storage_path: true },
            orderBy: { created_at: 'desc' },
        });

         const limitCheck = await validateDocumentLimit(user.id);

        return NextResponse.json<ApiResponse<{ documents: typeof documents; count: number | undefined; limit: number | typeof Infinity | undefined;}>>({
            success: true,
            data: { documents, count: limitCheck.count, limit: limitCheck.limit }
        });

    } catch (error: any) {
        if (error instanceof Response) return error;
        console.error('Error fetching documents:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch documents';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}