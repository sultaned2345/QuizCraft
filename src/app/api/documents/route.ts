// src/app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Bucket name must match what you use in other routes (e.g., [documentId]/route.ts)
const STORAGE_BUCKET_NAME = 'user_documents';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    
    // Parse JSON body from AddDocumentDialog
    const body = await req.json();
    const { title, content, fileType } = body;

    if (!title || !content) {
        return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    // 1. Upload content to Supabase Storage
    // We create a file even for text/youtube to satisfy 'storage_path' unique constraint
    // and to have a source of truth file.
    const cleanFileName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const extension = fileType === 'application/pdf' ? 'pdf' : 'txt';
    const filePath = `uploads/${user.id}/${Date.now()}_${cleanFileName}.${extension}`;

    // Convert string content to Buffer for upload
    const fileBuffer = Buffer.from(content, 'utf-8');

    const { error: uploadError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET_NAME)
        .upload(filePath, fileBuffer, {
            contentType: fileType || 'text/plain',
            upsert: false
        });

    if (uploadError) {
        console.error("Storage Upload Error:", uploadError);
        throw new Error("Failed to upload content to storage.");
    }

    // 2. Create Document Record in Database
    const doc = await prisma.documents.create({
        data: {
            user_id: user.id,
            file_name: title,
            file_type: fileType || 'text/plain',
            // Rough size estimation for text
            file_size: BigInt(Buffer.byteLength(content)),
            extracted_text: content, // We already have the text
            storage_path: filePath,
            processing_status: 'completed', // Text is already ready
            ai_summary: null, // To be generated later
        }
    });

    // 3. Return the Document ID (and other info)
    return NextResponse.json({
        success: true,
        data: {
            id: doc.id,
            file_name: doc.file_name,
            file_type: doc.file_type
        }
    });

  } catch (error: any) {
    console.error("Create Document Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create document" }, { status: 500 });
  }
}