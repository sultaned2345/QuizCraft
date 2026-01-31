import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { extractTextFromServerFile } from "@/lib/file-parser.server"; // Consolidated parser

export const runtime = "nodejs";

// Synchronized with frontend 10MB limit
const MAX_BYTES = 10 * 1024 * 1024; 

// Expanded to support DOCX and PPTX
const SUPPORTED_TYPES = [
  "application/pdf", 
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation" // .pptx
];
const SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".docx", ".pptx"];

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request); 
    
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ success: false, error: "Expected multipart/form-data" }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
    }

    // 1. Validate Size
    if (file.size > MAX_BYTES) {
       return NextResponse.json({ success: false, error: `File exceeds 10MB limit.` }, { status: 400 });
    }

    // 2. Validate Extension
    const nameLower = file.name.toLowerCase();
    const hasValidExtension = SUPPORTED_EXTENSIONS.some(ext => nameLower.endsWith(ext));
    
    if (!hasValidExtension) {
      return NextResponse.json({ 
        success: false, 
        error: "Unsupported file type. Please upload PDF, DOCX, PPTX, or TXT." 
      }, { status: 400 });
    }

    // 3. Extract Text (with OCR Fallback Detection)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let cleanedText = "";

    try {
      // Uses `file-parser.server.ts` logic for PDF, DOCX, PPTX, TXT
      cleanedText = await extractTextFromServerFile(file, buffer);
    } catch (error: any) {
      console.error("Text Extraction Error:", error.message);
      
      // OCR Fallback: Detect if the error indicates a scanned/empty PDF
      if (
        error.message.includes("scanned image") || 
        error.message.includes("No text found")
      ) {
        return NextResponse.json({ 
          success: false, 
          error: "This PDF appears to be a scanned image (no text found).", 
          code: "SCANNED_PDF_DETECTED",
          requiresOcr: true, // Signal to frontend to show "Use OCR" button
          suggestion: "Try using our OCR tool for scanned documents."
        }, { status: 422 });
      }

      return NextResponse.json({ 
        success: false, 
        error: `Failed to extract text: ${error.message}` 
      }, { status: 400 });
    }

    // 4. Pass Cleaned Text to Generator
    const url = new URL("/api/generate-quiz", request.url);
    const authHeader = request.headers.get("authorization");
    
    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: { 
        "content-type": "text/plain",
        ...(authHeader && { "authorization": authHeader }),
      },
      body: cleanedText,
    });

    const data = await resp.json();
    return NextResponse.json({ success: resp.ok, ...data }, { status: resp.status });

  } catch (error: any) {
    // Handle Auth or System errors
    return NextResponse.json({ 
      success: false, 
      error: error?.message || "Internal server error during upload" 
    }, { status: error instanceof Response ? error.status : 500 });
  }
}