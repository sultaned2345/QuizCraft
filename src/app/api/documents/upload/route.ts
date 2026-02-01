// src/app/api/documents/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractTextFromServerFile } from '@/lib/file-parser.server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // 1. Upload to Supabase Storage
    // Sanitize filename to prevent storage issues
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `uploads/${user.id}/${Date.now()}_${safeName}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) throw new Error("Storage upload failed");

    // 2. Extract Text (Using the robust server parser)
    const text = await extractTextFromServerFile(file, buffer);
    
    if (!text) {
      // Clean up storage if text extraction fails to avoid orphan files
      await supabaseAdmin.storage.from('documents').remove([storagePath]);
      return NextResponse.json({ error: 'Failed to extract text' }, { status: 400 });
    }

    // 3. Transaction: Create Document + Jobs
    const result = await prisma.$transaction(async (tx) => {
      // Create Document
      const doc = await tx.documents.create({
        data: {
          user_id: user.id,
          file_name: file.name,
          file_type: file.name.split('.').pop() || 'txt',
          file_size: BigInt(file.size),
          extracted_text: text,
          storage_path: storagePath,
          processing_status: 'processing'
        }
      });

      // Create Jobs (Note, Quiz, Flashcard)
      // Uses singular 'flashcard' which matches the DB/Worker expectation
      await tx.generation_jobs.createMany({
        data: ['note', 'quiz', 'flashcard'].map(type => ({
          user_id: user.id,
          document_id: doc.id,
          job_type: type,
          status: 'pending'
        }))
      });

      return doc;
    });

    // 4. Trigger Background Worker
    // [FIX] Construct absolute URL using headers for reliability in production (matches start/route.ts pattern)
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const workerUrl = `${protocol}://${host}/api/generation-jobs/start`;
    
    fetch(workerUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Cookie': req.headers.get('cookie') || '' 
      },
      body: JSON.stringify({ documentId: result.id })
    }).catch(err => console.error("Worker trigger failed:", err));

    // 5. Return ID
    return NextResponse.json({ 
      success: true, 
      documentId: result.id, 
      message: "Upload successful. Processing started." 
    });

  } catch (e: any) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: e.message || "Server Error" }, { status: 500 });
  }
}