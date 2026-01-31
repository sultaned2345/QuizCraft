// src/app/api/upload/ocr/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { cleanExtractedText } from "@/lib/file-parser";
import Tesseract from "tesseract.js";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB limit for OCR as well

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    // 1. Get File
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: "File exceeds 10MB limit." }, { status: 400 });
    }

    // 2. Perform OCR
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("Starting OCR processing for:", file.name);

    // Tesseract.recognize accepts a Buffer directly in Node.js
    const { data: { text } } = await Tesseract.recognize(
      buffer,
      'eng',
      { logger: m => console.log(m) } // Optional: logs progress to server console
    );

    const cleanedText = cleanExtractedText(text);

    if (!cleanedText || cleanedText.length < 50) {
      return NextResponse.json({ 
        success: false, 
        error: "OCR failed to extract readable text. The image might be too blurry or contain handwriting." 
      }, { status: 400 });
    }

    // 3. Pass to Quiz Generator (same as standard upload)
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
    console.error("OCR API Error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "OCR processing failed" 
    }, { status: 500 });
  }
}