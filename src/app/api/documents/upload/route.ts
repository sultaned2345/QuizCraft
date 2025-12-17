// src/app/api/documents/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractTextFromFile } from '@/lib/file-parser.server'; // Ensure you have this or similar logic

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // 1. Extract Text
    const text = await extractTextFromFile(file);
    if (!text) return NextResponse.json({ error: 'Failed to extract text' }, { status: 400 });

    // 2. Save to DB
    // Note: For production, you should also upload the binary 'file' to Supabase Storage here
    // and save the returned path to `storage_path`.
    const doc = await prisma.documents.create({
      data: {
        user_id: user.id,
        file_name: file.name,
        file_type: file.name.split('.').pop() || 'txt',
        file_size: BigInt(file.size),
        extracted_text: text,
        storage_path: `uploads/${user.id}/${Date.now()}_${file.name}`, // Placeholder path
      }
    });

    return NextResponse.json({ success: true, data: doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}