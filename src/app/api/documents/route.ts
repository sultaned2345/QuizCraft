import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase'; // Import global Supabase client for storage
import { requireAuth } from '@/lib/auth';
import { USAGE_LIMITS } from '@/lib/usage-limits'; // Import limits
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';
import pdfParse from 'pdf-parse-fork'; // For PDF text extraction
import { cleanExtractedText } from '@/lib/file-parser'; // Text cleaning utility

export const runtime = 'nodejs'; // Required for Node.js APIs like Buffer

// --- Configuration ---
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB limit
const ALLOWED_MIME_TYPES = ['application/pdf', 'text/plain'];
const ALLOWED_EXTENSIONS = ['.pdf', '.txt'];
const STORAGE_BUCKET_NAME = 'user_documents'; // Ensure this matches your bucket name
const FREE_DOCUMENT_LIMIT = 5; // Define the free limit here or import from usage-limits

// --- Helper to validate document count limit ---
async function validateDocumentLimit(userId: string): Promise<{
    isValid: boolean;
    error?: string;
    message?: string;
    limit?: number | typeof Infinity;
    count?: number;
}> {
    try {
        const userProfile = await prisma.profiles.findUnique({
            where: { id: userId },
            select: { subscription_plan: true }
        });
        const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
        // Define DOCUMENT limit - Added FREE_DOCUMENTS constant above for clarity
        const limit = plan === 'pro' ? Infinity : FREE_DOCUMENT_LIMIT;

        if (plan !== 'pro') {
            const currentCount = await prisma.documents.count({ where: { user_id: userId } });
            if (currentCount >= limit) {
                return {
                    isValid: false,
                    limit,
                    count: currentCount,
                    error: 'Document limit reached',
                    message: `You have reached the maximum number of documents (${limit}) for free users.`
                };
            }
            return { isValid: true, limit, count: currentCount };
        }
        return { isValid: true, limit, count: undefined }; // Pro users are valid
    } catch (error) {
        console.error("Error validating document limit:", error);
        return { isValid: true }; // Be permissive on error
    }
}


// --- Helper to extract text ---
async function extractTextFromFile(file: File, buffer: Buffer): Promise<string> {
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

        if (!rawText || rawText.trim().length === 0) {
            throw new Error("File contains no extractable text.");
        }

        return cleanExtractedText(rawText);

    } catch (error: any) {
        console.error("Error during text extraction:", error);
        throw new Error(`Failed to extract text: ${error.message}`);
    }
}


// --- POST Handler: Upload a new document ---
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        // 1. Check document count limit
        const limitCheck = await validateDocumentLimit(user.id);
        if (!limitCheck.isValid) {
            return NextResponse.json<ApiResponse>({ success: false, error: limitCheck.error, message: limitCheck.message }, { status: 403 });
        }

        // 2. Get file from FormData
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'No file provided.' }, { status: 400 });
        }

        // 3. Validate file type and size
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        // Use endsWith for extension check and include MIME type check
        if (!ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext)) || (file.type && !ALLOWED_MIME_TYPES.includes(file.type))) {
             // More robust check
             const probableType = file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : (file.name.toLowerCase().endsWith('.txt') ? 'text/plain' : file.type);
             if (!probableType || !ALLOWED_MIME_TYPES.includes(probableType)){
                 console.warn(`Invalid file type detected: name=${file.name}, reported type=${file.type}, probable type=${probableType}`);
                 return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid file type. Only PDF and TXT allowed.' }, { status: 400 });
             }
        }
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json<ApiResponse>({ success: false, error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` }, { status: 400 });
        }

        // 4. Read file buffer and extract text
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        let extractedText: string;
        try {
            extractedText = await extractTextFromFile(file, fileBuffer);
             if (!extractedText || extractedText.length < 50) { // Add minimum length check
                throw new Error("Extracted text is too short (minimum 50 characters required).");
            }
        } catch (textError: any) {
             return NextResponse.json<ApiResponse>({ success: false, error: textError.message || 'Failed to process file content.' }, { status: 400 });
        }


        // 5. Upload file to Supabase Storage
        const storagePath = `${user.id}/${Date.now()}-${file.name}`; // Unique path within user's folder
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET_NAME)
            .upload(storagePath, fileBuffer, {
                contentType: file.type || undefined,
                upsert: false,
            });

        if (uploadError) {
            console.error('Supabase Storage Error:', uploadError);
            throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
        }
        if (!uploadData?.path) {
             throw new Error('File uploaded but no path returned from storage.');
        }

        // 6. Save metadata (including text) to database using Prisma
        const newDocument = await prisma.documents.create({
            data: {
                user_id: user.id,
                file_name: file.name,
                file_type: file.type || 'unknown',
                file_size: file.size,
                storage_path: uploadData.path, // Use path returned by Supabase
                extracted_text: extractedText,
            },
            // Select only necessary fields for the response
            select: {
                id: true,
                file_name: true,
                file_type: true,
                file_size: true,
                created_at: true,
            }
        });

        // 7. Return success response
        return NextResponse.json<ApiResponse<typeof newDocument>>({
            success: true,
            data: newDocument,
            message: 'Document uploaded successfully.',
        }, { status: 201 });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors

        console.error('Error uploading document:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             console.error('Prisma Error creating document record:', { code: error.code, meta: error.meta });
             return NextResponse.json<ApiResponse>({ success: false, error: 'Database error saving document metadata.' }, { status: 500 });
        }

        const errorMessage = error.message || 'Failed to upload document';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}


// --- GET Handler: List documents for the user ---
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        const documents = await prisma.documents.findMany({
            where: { user_id: user.id },
            // Exclude the potentially large extracted_text field
            select: {
                id: true,
                file_name: true,
                file_type: true,
                file_size: true,
                created_at: true,
                storage_path: true, // Keep path if needed for download links
            },
            orderBy: { created_at: 'desc' },
        });

        // Fetch count and limit for context
         const limitCheck = await validateDocumentLimit(user.id);

        return NextResponse.json<ApiResponse<{
            documents: typeof documents;
            count: number | undefined;
            limit: number | typeof Infinity | undefined;
        }>>({
            success: true,
            data: {
                documents,
                count: limitCheck.count,
                limit: limitCheck.limit,
            }
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors
        console.error('Error fetching documents:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch documents';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}