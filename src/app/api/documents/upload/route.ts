// src/app/api/documents/upload/route.ts
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
    // Convert File to Buffer for server-side processing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Pass both file metadata and the raw buffer
    const text = await extractTextFromFile(file, buffer);
    
    if (!text) return NextResponse.json({ error: 'Failed to extract text' }, { status: 400 });

    // 2. Save to DB
    const doc = await prisma.documents.create({
      data: {
        user_id: user.id,
        file_name: file.name,
        file_type: file.name.split('.').pop() || 'txt',
        file_size: BigInt(file.size),
        extracted_text: text,
        storage_path: `uploads/${user.id}/${Date.now()}_${file.name}`,
        processing_status: 'completed' // Mark as completed since we extracted text inline
      }
    });

    // --- FIX IS HERE: Convert BigInt to string before JSON serialization ---
    return NextResponse.json({ 
      success: true, 
      data: {
        ...doc,
        file_size: doc.file_size?.toString() // Convert BigInt to string
      }
    });
    // -----------------------------------------------------------------------

  } catch (e: any) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}