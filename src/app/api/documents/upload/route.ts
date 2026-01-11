import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractTextFromFile } from '@/lib/file-parser.server';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // 1. Extract Text
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = await extractTextFromFile(file, buffer); // Ensure this returns string
    
    if (!text) return NextResponse.json({ error: 'Failed to extract text' }, { status: 400 });

    // 2. Transaction: Save Doc + Create Jobs
    const result = await prisma.$transaction(async (tx) => {
      // A. Create Document
      const doc = await tx.documents.create({
        data: {
          user_id: user.id,
          file_name: file.name,
          file_type: file.name.split('.').pop() || 'txt',
          file_size: BigInt(file.size),
          extracted_text: text,
          storage_path: `uploads/${user.id}/${Date.now()}_${file.name}`,
          processing_status: 'processing' // Set to processing initially
        }
      });

      // B. Create Generation Jobs
      // We schedule 4 jobs: Summary/Note, Flashcards, Quiz, Embeddings (for Chat)
      const jobTypes = ['note', 'flashcard', 'quiz', 'embedding'];
      
      await tx.generation_jobs.createMany({
        data: jobTypes.map(type => ({
          user_id: user.id,
          document_id: doc.id,
          job_type: type,
          status: 'pending'
        }))
      });

      // Fetch the created jobs to return to client
      const jobs = await tx.generation_jobs.findMany({
        where: { document_id: doc.id }
      });

      return { doc, jobs };
    });

    // 3. Return Data
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}