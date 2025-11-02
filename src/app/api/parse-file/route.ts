// src/app/api/parse-file/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client';
import pdfParse from 'pdf-parse-fork';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { DOMParser } from 'xmldom';
import { cleanExtractedText } from '@/lib/file-parser'; // We will move this helper here

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
];
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.docx', '.pptx'];

// --- Text Extraction Helpers ---
// (Copied from api/documents/route.ts and file-parser.ts)

function getTextFromPPTXNodes(
  node: Node,
  tagName: string,
  namespaceURI: string
): string {
  let text = '';
  const textNodes = (node as Element).getElementsByTagNameNS(namespaceURI, tagName);
  for (let i = 0; i < textNodes.length; i++) {
    if (textNodes[i].textContent) {
      text += textNodes[i].textContent + ' ';
    }
  }
  return text.trim();
}

async function extractTextFromPPTX(buffer: Buffer): Promise<string> {
  try {
    const zip = new JSZip();
    await zip.loadAsync(buffer);
    const aNamespace = 'http://schemas.openxmlformats.org/drawingml/2006/main';
    let fullText = '';
    let slideIndex = 1;

    while (true) {
      const slideFile = zip.file(`ppt/slides/slide${slideIndex}.xml`);
      if (!slideFile) break;

      const slideXmlStr = await slideFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(slideXmlStr, 'application/xml');

      fullText += getTextFromPPTXNodes(xmlDoc, 't', aNamespace) + ' \n';
      slideIndex++;
    }
    return fullText.trim();
  } catch (err: any) {
    console.error('Error extracting text from PPTX:', err);
    throw new Error(`Failed to parse PPTX file: ${err.message || 'Unknown error'}`);
  }
}

async function extractTextFromFile(
  file: File,
  buffer: Buffer
): Promise<string> {
  let rawText = '';
  const fileType = file.type || '';
  const fileNameLower = file.name.toLowerCase();
  try {
    if (fileType === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
      rawText = (await pdfParse(buffer)).text || '';
    } else if (fileType === 'text/plain' || fileNameLower.endsWith('.txt')) {
      rawText = buffer.toString('utf8');
    } else if (
      fileType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileNameLower.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value || '';
    } else if (
      fileType ===
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      fileNameLower.endsWith('.pptx')
    ) {
      rawText = await extractTextFromPPTX(buffer);
    } else {
      throw new Error(
        `Unsupported type: ${fileType || 'unknown'} for file ${file.name}`
      );
    }

    if (!rawText || rawText.trim().length === 0)
      throw new Error('No text found in file.');
    // We can't use the imported cleanExtractedText, so we duplicate it.
    // In a real refactor, this would be in a shared server-side util.
    return rawText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error: any) {
    throw new Error(`Text extraction failed: ${error.message}`);
  }
}

// --- POST Handler ---
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request); // Protect route

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No file provided.' },
        { status: 400 }
      );
    }

    // Validate file type
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    if (!hasValidExtension) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid file type. Only PDF, TXT, DOCX, and PPTX allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let extractedText: string;
    try {
      extractedText = await extractTextFromFile(file, fileBuffer);
      if (!extractedText || extractedText.length < 50) {
        throw new Error(
          'Extracted text is too short (minimum 50 characters required).'
        );
      }
    } catch (textError: any) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: textError.message || 'Failed to process file content.' },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse<{ text: string }>>({
      success: true,
      data: { text: extractedText },
    });
  } catch (error: any) {
    if (error instanceof Response) return error; // Auth error
    console.error('Error in /api/parse-file:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}