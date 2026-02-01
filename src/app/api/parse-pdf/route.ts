import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse-fork";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ 
        success: false,
        error: "Expected multipart/form-data content type" 
      }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ 
        success: false,
        error: "No file provided. Please select a PDF file to parse." 
      }, { status: 400 });
    }

    // 1. Strict File Type Validation
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ 
        success: false,
        error: "Invalid file type. Only PDF files are supported." 
      }, { status: 400 });
    }

    // 2. Size Limit (10MB)
    const maxSize = 10 * 1024 * 1024; 
    if (file.size > maxSize) {
      return NextResponse.json({ 
        success: false,
        error: `File exceeds 10MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB` 
      }, { status: 400 });
    }

    // Convert file to buffer
    let buffer: Buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (bufferError) {
      console.error("Buffer conversion error:", bufferError);
      return NextResponse.json({ 
        success: false,
        error: "Failed to read file. Please try another PDF file." 
      }, { status: 400 });
    }

    // 3. Parsing
    let extractedText: string;
    try {
      const result = await pdfParse(buffer, {
        max: 0, 
        version: 'v1.10.100', 
      });
      
      extractedText = result.text || "";
      
      // Check: Scanned Document Detection
      if (!extractedText || extractedText.trim().length < 50) {
        return NextResponse.json({ 
          success: false,
          error: "No text detected. This document appears to be a scanned image. Please use a text-based PDF or OCR tool." 
        }, { status: 422 });
      }

    } catch (error: any) {
      console.error("PDF parsing internal error:", error.message || error);
      return NextResponse.json({ 
        success: false,
        error: "This PDF might be locked, corrupted, or unreadable. Try another file." 
      }, { status: 400 });
    }

    // Return the extracted text - FIXED STRUCTURE
    return NextResponse.json({ 
      success: true,
      // Wrap in 'data' object to match client expectation
      data: {
        text: extractedText,
        fileName: file.name,
        fileSize: file.size,
        textLength: extractedText.length
      }
    });

  } catch (error: any) {
    console.error("PDF parsing API fatal error:", error);
    return NextResponse.json({ 
      success: false,
      error: "Internal server error during PDF parsing" 
    }, { status: 500 });
  }
}