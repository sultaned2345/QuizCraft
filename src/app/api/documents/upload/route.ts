import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractTextFromFile } from '@/lib/file-parser.server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // 1. Upload to Supabase Storage
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `uploads/${user.id}/${Date.now()}_${safeName}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) throw new Error("Storage upload failed");

    // 2. Extract Text
    const text = await extractTextFromFile(file, buffer);
    if (!text) {
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
          processing_status: 'processing' // Mark as processing
        }
      });

      // Create Jobs (Note, Quiz, Flashcards)
      // This tells the backend worker what to do
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

    // 4. Trigger Background Worker (Fire and Forget)
    // We send a request to our own API to start processing the jobs we just created.
    const workerUrl = new URL('/api/generation-jobs/start', req.url);
    fetch(workerUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') || '' },
      body: JSON.stringify({ documentId: result.id })
    }).catch(err => console.error("Worker trigger failed:", err));

    // 5. Return ID immediately so frontend can redirect
    return NextResponse.json({ 
      success: true, 
      documentId: result.id, // Flat ID for easy frontend access
      message: "Upload successful. Processing started." 
    });

  } catch (e: any) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: e.message || "Server Error" }, { status: 500 });
  }
}