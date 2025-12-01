// src/app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth';
import { validateDocumentUpload } from '@/lib/usage-limits';
import { ApiResponse, DocumentMetadata } from '@/types/database';
import { Prisma } from '@prisma/client';
import { generateEmbeddingsForContent } from '@/lib/embedding';
import { extractTextFromServerFile } from '@/lib/file-parser.server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = 'nodejs';

// --- Configuration ---
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.5-flash-lite";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (Reference only for server-side path)
const STORAGE_BUCKET_NAME = 'user_documents';
const FREE_DOCUMENT_LIMIT = 5;

const ALLOWED_MIME_TYPES = [
    'application/pdf', 
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation' // .pptx
];
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.docx', '.pptx'];

// --- Helper Interfaces ---
interface PaginatedDocumentsResponse { 
    documents: DocumentMetadata[]; 
    count: number; 
    limit: number | typeof Infinity; 
    totalPages: number; 
    currentPage: number; 
}

interface AIDocumentInsights {
  keyConcepts: string[];
  examQuestions: string[];
  mainArguments: string[];
}

// --- Helpers ---

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
        return null; 
    }
}

async function generateAIDocumentInsights(text: string): Promise<AIDocumentInsights | null> {
    if (!API_KEY) {
        console.error("Missing GOOGLE_AI_API_KEY for insights.");
        return null;
    }
    const textSnippet = text.substring(0, 4000);

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
        return null; 
    }
}

// --- POST Handler ---
export async function POST(request: NextRequest) {
    let user;
    let storagePath: string | null = null;
    let supabaseForUser: any;
    
    // Variables to be populated by either upload method
    let fileBuffer: Buffer;
    let fileName: string;
    let fileType: string;
    let fileSize: number;

    try {
        user = await requireAuth(request);
        supabaseForUser = getSupabaseClientForUser(request);

        // Check Upload Limits
        const limitCheck = await validateDocumentUpload(user.id);
        if (!limitCheck.isValid) {
            return NextResponse.json<ApiResponse>({ 
                success: false, 
                error: limitCheck.error, 
                message: limitCheck.message 
            }, { status: 403 });
        }

        const contentType = request.headers.get('content-type') || '';

        // ============================================================
        // BRANCH 1: CLIENT-SIDE UPLOAD (JSON Payload with Storage Path)
        // ============================================================
        // Use this for large files (>4.5MB) to bypass Vercel limits.
        if (contentType.includes('application/json')) {
            const body = await request.json();
            storagePath = body.storagePath;
            fileName = body.fileName;
            fileType = body.fileType;
            fileSize = body.fileSize;

            if (!storagePath || !fileName) {
                return NextResponse.json<ApiResponse>({ success: false, error: 'Missing storagePath or metadata.' }, { status: 400 });
            }

            // We must download the file back from Supabase to process it (extract text/generate AI)
            // This works because the Vercel *Response* limit (download) is higher than the *Request* limit (upload)
            const { data: downloadedData, error: downloadError } = await supabaseForUser.storage
                .from(STORAGE_BUCKET_NAME)
                .download(storagePath);

            if (downloadError || !downloadedData) {
                throw new Error(`Failed to retrieve uploaded file from storage: ${downloadError?.message}`);
            }
            
            fileBuffer = Buffer.from(await downloadedData.arrayBuffer());
        } 
        // ============================================================
        // BRANCH 2: SERVER-SIDE UPLOAD (Multipart Form Data)
        // ============================================================
        // Legacy method. Limited to ~4.5MB on Vercel.
        else {
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            if (!file) return NextResponse.json<ApiResponse>({ success: false, error: 'No file provided.' }, { status: 400 });

            fileName = file.name;
            fileType = file.type;
            fileSize = file.size;
            
            // Validate extension/mime
            const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));
            const hasValidMime = fileType && ALLOWED_MIME_TYPES.includes(fileType);
            
            let probableType = fileType;
            if (!hasValidMime && hasValidExtension) {
                if (fileName.toLowerCase().endsWith('.docx')) probableType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                else if (fileName.toLowerCase().endsWith('.pptx')) probableType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                else if (fileName.toLowerCase().endsWith('.pdf')) probableType = 'application/pdf';
                else if (fileName.toLowerCase().endsWith('.txt')) probableType = 'text/plain';
            }

            if (!ALLOWED_MIME_TYPES.includes(probableType) && !hasValidExtension) {
                 return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid file type.' }, { status: 400 });
            }
            if (fileSize > MAX_FILE_SIZE) {
                return NextResponse.json<ApiResponse>({ success: false, error: `File exceeds limit.` }, { status: 400 });
            }

            fileBuffer = Buffer.from(await file.arrayBuffer());
            
            // Upload to Supabase
            storagePath = `${user.id}/${Date.now()}-${fileName}`;
            const { data: uploadData, error: uploadError } = await supabaseForUser.storage
                .from(STORAGE_BUCKET_NAME)
                .upload(storagePath, fileBuffer, { contentType: probableType || fileType, upsert: false });

            if (uploadError) throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
            if (!uploadData?.path) throw new Error('File uploaded but no path returned.');
        }

        // ============================================================
        // SHARED PROCESSING (Text Extraction & AI)
        // ============================================================
        
        let extractedText: string;
        try {
            // Reconstruct a File object for the parser (which expects name/type)
            const dummyFile = new File([fileBuffer], fileName, { type: fileType });
            extractedText = await extractTextFromServerFile(dummyFile, fileBuffer); 
            
            if (!extractedText || extractedText.length < 50) {
                throw new Error("Extracted text is too short (minimum 50 characters required).");
            }
        } catch (textError: any) {
             // Cleanup storage if text extraction fails
             if (storagePath) {
                 try { await supabaseForUser.storage.from(STORAGE_BUCKET_NAME).remove([storagePath]); } catch(e) {}
             }
             return NextResponse.json<ApiResponse>({ success: false, error: textError.message || 'Failed to process file content.' }, { status: 400 });
        }

        // Run AI tasks (Non-blocking usually preferred, but here we await them to populate the DB)
        // We use Promise.allSettled so one failure doesn't stop the upload
        const [summaryResult, insightsResult] = await Promise.allSettled([
            generateAISummary(extractedText),
            generateAIDocumentInsights(extractedText)
        ]);
        
        const aiSummary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
        const aiInsights = insightsResult.status === 'fulfilled' ? insightsResult.value : null;

        // Save Metadata to Database
        const newDocumentData = await prisma.documents.create({
            data: {
                user_id: user.id,
                file_name: fileName,
                file_type: fileType || 'unknown',
                file_size: fileSize,
                storage_path: storagePath!,
                extracted_text: extractedText,
                ai_summary: aiSummary,
                ai_insights: aiInsights as Prisma.JsonValue | undefined,
            },
            select: { 
                id: true, file_name: true, file_type: true, file_size: true, 
                created_at: true, storage_path: true, ai_summary: true, ai_insights: true 
            }
        });

        // Generate Embeddings (Fire and forget)
        generateEmbeddingsForContent(newDocumentData.id, 'document', extractedText, user.id)
          .catch(err => {
            console.error(`Failed to generate embeddings for document ${newDocumentData.id}:`, err);
          });

        const newDocument: DocumentMetadata = {
            ...newDocumentData,
            user_id: user.id,
            ai_summary: newDocumentData.ai_summary || null,
            ai_insights: newDocumentData.ai_insights || null,
            created_at: newDocumentData.created_at?.toISOString() || '',
            file_size: Number(newDocumentData.file_size)
        };

        return NextResponse.json<ApiResponse<DocumentMetadata>>({
            success: true, data: newDocument, message: 'Document uploaded successfully.'
        }, { status: 201 });

    } catch (error: any) {
        if (error instanceof Response) return error;
        console.error('Error uploading document:', error);
        
        // Cleanup if DB insert failed
        if (storagePath && supabaseForUser && error instanceof Prisma.PrismaClientKnownRequestError) {
             try { await supabaseForUser.storage.from(STORAGE_BUCKET_NAME).remove([storagePath]); } catch (e) {}
        }
        
        const status = error.message.includes('Storage security') ? 403 : 500;
        return NextResponse.json<ApiResponse>({ success: false, error: error.message || 'Failed to upload document' }, { status });
    }
}

// --- GET Handler ---
export async function GET(request: NextRequest) {
     try {
        const user = await requireAuth(request);
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '9', 10);
        const skip = (page - 1) * limit;

        // Check plan for display purposes
        const profile = await prisma.profiles.findUnique({
            where: { id: user.id },
            select: { subscription_plan: true }
        });
        const plan = profile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const usageLimit = plan === 'pro' ? Infinity : FREE_DOCUMENT_LIMIT;

        const [documentsData, totalCount] = await prisma.$transaction([
             prisma.documents.findMany({
                where: { user_id: user.id },
                select: { 
                    id: true, file_name: true, file_type: true, file_size: true, 
                    created_at: true, storage_path: true, ai_summary: true, ai_insights: true 
                },
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
             user_id: user.id,
             ai_summary: doc.ai_summary || null,
             ai_insights: doc.ai_insights || null,
             created_at: doc.created_at?.toISOString() || '',
             file_size: Number(doc.file_size)
         }));

        const responseData: PaginatedDocumentsResponse = {
            documents: formattedDocuments,
            count: totalCount,
            limit: usageLimit ?? Infinity,
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
        return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to fetch documents' }, { status: 500 });
    }
}