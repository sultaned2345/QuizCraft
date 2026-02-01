// src/app/api/parse-file/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { extractTextFromServerFile } from '@/lib/file-parser.server';

export const runtime = 'nodejs';

// Increase max duration for processing large files (if platform allows)
export const maxDuration = 60; 

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.docx', '.pptx'];

export async function POST(request: NextRequest) {
  try {
    // 1. Auth Check
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Form Data Parsing
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided.' },
        { status: 400 }
      );
    }

    // 3. Validation
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidExtension) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only PDF, TXT, DOCX, and PPTX allowed.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File exceeds 10MB limit.' },
        { status: 400 }
      );
    }

    // 4. Processing
    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = await extractTextFromServerFile(file, buffer);

    // 5. Success Response
    return NextResponse.json({
      success: true,
      data: { text: extractedText },
    });

  } catch (error: any) {
    console.error('API Error /api/parse-file:', error);
    
    // Return appropriate status codes
    const status = error.message.includes('scanned image') ? 422 : 500;

    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status }
    );
  }
}