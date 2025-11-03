// src/app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth';
// --- MODIFIED: Import specific validator ---
import { USAGE_LIMITS, validateDocumentUpload } from '@/lib/usage-limits';
import { ApiResponse, DocumentMetadata } from '@/types/database'; // Updated type
import { Prisma } from '@prisma/client';
import { generateEmbeddingsForContent } from '@/lib/embedding';
// --- DYNAMIC: Import the new server-side helper ---
import { extractTextFromServerFile } from '@/lib/file-parser.server';
// --- NEW: Import Google AI ---
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = 'nodejs';

// --- NEW: AI Config ---
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.5-flash-lite";

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
const FREE_DOCUMENT_LIMIT = 5; // Keep consistent

// --- MODIFIED: Interface now includes ai_summary ---
interface PaginatedDocumentsResponse { documents: DocumentMetadata[]; count: number; limit: number | typeof Infinity; totalPages: number; currentPage: number; }

// ... (getSupabaseClientForUser helper remains the same) ...
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

// --- REMOVED: validateDocumentLimit (now in usage-limits.ts) ---

// --- NEW HELPER: Generate AI Summary ---
async function generateAISummary(text: string): Promise<string | null> {
    if (!API_KEY) {
        console.error("Missing GOOGLE_AI_API_KEY for summary.");
        return null;
    }
    // Take first ~3000 chars for a fast summary
    const textSnippet = text.substring(0, 3000); 

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: AI_MODEL_NAME,
            generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
        });
        const prompt = `Generate a 1-2 sentence summary for the following text. Return ONLY valid JSON in this exact shape: {"summary": "..."}\n\nText:\n"""\n${textSnippet}\n"""`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const content = response.text();
        
        const parsed: { summary: string } = JSON.parse(content);
        return parsed.summary || null;
    } catch (error) {
        console.error("Failed to generate AI summary:", error);
        return null; // Return null on error, don't fail the upload
    }
}
// --- END NEW HELPER ---

// --- 1. ADD NEW HELPER for Insights ---
interface AIDocumentInsights {
  keyConcepts: string[];
  examQuestions: string[];
  mainArguments: string[];
}

async function generateAIDocumentInsights(text: string): Promise<AIDocumentInsights | null> {
    if (!API_KEY) {
        console.error("Missing GOOGLE_AI_API_KEY for insights.");
        return null;
    }
    const textSnippet = text.substring(0, 4000); // Use a larger snippet for insights

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: AI_MODEL_NAME,
            generationConfig: { temperature: 0.5, responseMimeType: "application/json" }
        });
        const prompt = `Based on the following text, extract:
1.  'keyConcepts': An array of 5-7 core terms or ideas.
2.  'examQuestions': An array of 3-5 potential exam questions.
3.  'mainArguments': An array of 2-3 main arguments or theses.
Return ONLY valid JSON in this exact shape: {"keyConcepts": ["...", "..."], "examQuestions": ["...", "..."], "mainArguments": ["...", "..."]}

Text:
"""
${textSnippet}
"""`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const content = response.text();
        
        const parsed: AIDocumentInsights = JSON.parse(content);
        if (!parsed.keyConcepts || !parsed.examQuestions || !parsed.mainArguments) {
          throw new Error("AI response missing required insight fields.");
        }
        return parsed;
    } catch (error) {
        console.error("Failed to generate AI insights:", error);
        return null; // Return null on error, don't fail the upload
    }
}
// --- END NEW HELPER ---


// --- 2. MODIFY POST Handler ---
export async function POST(request: NextRequest) {
    let user;
    let storagePath: string | null = null;
    let supabaseForUser: any;

    try {
        user = await requireAuth(request); //
        supabaseForUser = getSupabaseClientForUser(request); //

        // --- MODIFIED: Use new validator ---
        const limitCheck = await validateDocumentUpload(user.id); //
        if (!limitCheck.isValid) {
            return NextResponse.json<ApiResponse>({ 
                success: false, 
                error: limitCheck.error, // This will be "limit_exceeded"
                message: limitCheck.message 
            }, { status: 403 }); //
        }
        // --- END MODIFICATION ---

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

        // --- DYNAMIC: Generate summary AND insights in parallel ---
        const summaryPromise = generateAISummary(extractedText);
        const insightsPromise = generateAIDocumentInsights(extractedText); // <-- ADD THIS
        // --- END DYNAMIC ---

        storagePath = `${user.id}/${Date.now()}-${file.name}`; //
        const { data: uploadData, error: uploadError } = await supabaseForUser.storage
            .from(STORAGE_BUCKET_NAME)
            .upload(storagePath, fileBuffer, { contentType: probableType || file.type || undefined, upsert: false }); //

        if (uploadError) {
            throw new Error(`Failed to upload file to storage: ${uploadError.message}`); //
        }
        if (!uploadData?.path) { throw new Error('File uploaded but no path returned from storage.'); } //

        // --- DYNAMIC: Wait for both summary and insights ---
        const [aiSummary, aiInsights] = await Promise.all([
          summaryPromise,
          insightsPromise
        ]);
        // --- END DYNAMIC ---

        const newDocumentData = await prisma.documents.create({
            data: {
                user_id: user.id,
                file_name: file.name,
                file_type: probableType || file.type || 'unknown',
                file_size: file.size,
                storage_path: uploadData.path,
                extracted_text: extractedText,
                ai_summary: aiSummary, // <-- Save the summary
                ai_insights: aiInsights as Prisma.JsonValue | undefined, // <-- SAVE INSIGHTS
            },
            select: { id: true, file_name: true, file_type: true, file_size: true, created_at: true, storage_path: true, ai_summary: true, ai_insights: true } // <-- Select insights
        }); //

        // --- NEW: Asynchronously generate embeddings ---
        generateEmbeddingsForContent(newDocumentData.id, 'document', extractedText, user.id)
          .catch(err => {
            console.error(`Failed to generate embeddings for document ${newDocumentData.id}:`, err);
          });
        // --- END NEW ---

        const newDocument: DocumentMetadata = {
            ...newDocumentData,
            user_id: user.id, // Add user_id for type consistency
            ai_summary: newDocumentData.ai_summary || null, // Ensure it's null, not undefined
            ai_insights: newDocumentData.ai_insights || null, // <-- ADD TO RESPONSE
            created_at: newDocumentData.created_at?.toISOString() || '',
            file_size: Number(newDocumentData.file_size) // Ensure file_size is number
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

// --- 3. MODIFY GET Handler ---
export async function GET(request: NextRequest) {
     try {
        const user = await requireAuth(request);

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '9', 10);
        const skip = (page - 1) * limit;

        // --- MODIFIED: Use new validator just to get the limit ---
        // We don't block GET, just report the limit.
        const profile = await prisma.profiles.findUnique({
            where: { id: user.id },
            select: { subscription_plan: true }
        });
        const plan = profile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const usageLimit = plan === 'pro' ? Infinity : FREE_DOCUMENT_LIMIT;
        // ---

        const [documentsData, totalCount] = await prisma.$transaction([
             prisma.documents.findMany({
                where: { user_id: user.id },
                // --- MODIFIED: Select ai_summary and ai_insights ---
                select: { id: true, file_name: true, file_type: true, file_size: true, created_at: true, storage_path: true, ai_summary: true, ai_insights: true },
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
             user_id: user.id, // Add user_id
             ai_summary: doc.ai_summary || null, // Ensure null
             ai_insights: doc.ai_insights || null, // <-- ADD THIS
             created_at: doc.created_at?.toISOString() || '',
             file_size: Number(doc.file_size) // Ensure number
         }));

        const responseData: PaginatedDocumentsResponse = {
            documents: formattedDocuments,
            count: totalCount,
            limit: usageLimit ?? Infinity, // Use the fetched limit
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