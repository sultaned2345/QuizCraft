import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractTextFromFile } from '@/lib/file-parser.server';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; // ✅ Import Supabase Admin

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // 1. Prepare File & Path
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // ✅ Sanitize filename to prevent issues with special characters
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `uploads/${user.id}/${Date.now()}_${safeName}`;

    // 2. Upload to Supabase Storage (The missing step!)
    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('documents') // Ensure this bucket exists in your Supabase project
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error("Supabase Storage Upload Error:", uploadError);
      throw new Error("Failed to upload file to storage");
    }

    // 3. Extract Text (for AI processing)
    const text = await extractTextFromFile(file, buffer);
    
    if (!text) {
      // Optional: Clean up storage if extraction fails
      await supabaseAdmin.storage.from('documents').remove([storagePath]);
      return NextResponse.json({ error: 'Failed to extract text from file' }, { status: 400 });
    }

    // 4. Transaction: Save Doc Metadata + Create Jobs
    const result = await prisma.$transaction(async (tx) => {
      // A. Create Document Record
      const doc = await tx.documents.create({
        data: {
          user_id: user.id,
          file_name: file.name,
          file_type: file.name.split('.').pop() || 'txt',
          file_size: BigInt(file.size),
          extracted_text: text,
          storage_path: storagePath, // Save the path we just uploaded to
          processing_status: 'processing'
        }
      });

      // B. Create Generation Jobs
      const jobTypes = ['note', 'flashcard', 'quiz', 'embedding'];
      
      await tx.generation_jobs.createMany({
        data: jobTypes.map(type => ({
          user_id: user.id,
          document_id: doc.id,
          job_type: type,
          status: 'pending'
        }))
      });

      const jobs = await tx.generation_jobs.findMany({
        where: { document_id: doc.id }
      });

      return { doc, jobs };
    });

    // 5. Return Success
    return NextResponse.json({ 
      success: true, 
      data: {
        document: {
          ...result.doc,
          file_size: result.doc.file_size?.toString()
        },
        jobs: result.jobs
      }
    });

  } catch (e: any) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
  }
}