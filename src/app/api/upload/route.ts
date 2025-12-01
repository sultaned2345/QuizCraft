// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cleanExtractedText } from "@/lib/file-parser";
import { requireAuth } from "@/lib/auth";
import pdfParse from "pdf-parse-fork";

export const runtime = "nodejs";

const MAX_BYTES = 3 * 1024 * 1024; // 3MB
const SUPPORTED_TYPES = ["application/pdf", "text/plain"]; // pdf, txt
const SUPPORTED_EXTENSIONS = [".pdf", ".txt"];

async function getCleanTextFromFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Enhanced file size validation
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error(`File exceeds 3MB limit. Current size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
  }

  // Enhanced file type validation
  const nameLower = file.name.toLowerCase();
  const hasValidExtension = SUPPORTED_EXTENSIONS.some(ext => nameLower.endsWith(ext));
  const type = file.type || (nameLower.endsWith(".pdf") ? "application/pdf" : nameLower.endsWith(".txt") ? "text/plain" : "");

  if (!SUPPORTED_TYPES.includes(type) || !hasValidExtension) {
    throw new Error(`Unsupported file type. Only PDF and TXT files are allowed. Received: ${file.type || 'unknown type'}`);
  }

  // Enhanced text extraction with better error handling
  let rawText = "";
  try {
    if (type === "application/pdf") {
      // Use pdf-parse-fork directly in server-side context
      const result = await pdfParse(buffer, {
        max: 0, // No page limit
        version: 'v1.10.100', // Use specific version for stability
      });
      
      rawText = result.text || "";
      if (!rawText || rawText.trim().length === 0) {
        throw new Error("PDF file appears to be empty or contains no extractable text");
      }
    } else if (type === "text/plain") {
      rawText = buffer.toString("utf8");
      if (!rawText || rawText.trim().length === 0) {
        throw new Error("Text file appears to be empty");
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to extract text from file: ${error.message}`);
    }
    throw new Error("Failed to extract text from file");
  }

  const cleanedText = cleanExtractedText(rawText);
  
  // Validate that we have meaningful content
  if (!cleanedText || cleanedText.trim().length < 50) {
    throw new Error("File contains insufficient text content for quiz generation. Please ensure the file has at least 50 characters of readable text.");
  }

  return cleanedText;
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);
    
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
        error: "No file provided. Please select a PDF or TXT file to upload." 
      }, { status: 400 });
    }

    // Enhanced file processing with detailed error messages
    let cleanedText: string;
    try {
      cleanedText = await getCleanTextFromFile(file);
    } catch (fileError: any) {
      return NextResponse.json({ 
        success: false,
        error: fileError.message || "Failed to process uploaded file",
        fileName: file.name,
        fileSize: file.size
      }, { status: 400 });
    }

    // Forward to quiz generation API with authentication
    const url = new URL("/api/generate-quiz", request.url);
    const numQuestions = form.get("numQuestions")?.toString();
    const difficulty = form.get("difficulty")?.toString();
    if (numQuestions) url.searchParams.set("numQuestions", numQuestions);
    if (difficulty) url.searchParams.set("difficulty", difficulty);

    // Get the authorization header from the original request
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
    if (!resp.ok) {
      return NextResponse.json({ 
        success: false,
        error: data?.error || "Failed to generate quiz from uploaded file",
        fileName: file.name,
        fileSize: file.size
      }, { status: resp.status });
    }

    // Enhanced success response with file metadata
    return NextResponse.json({ 
      success: true,
      ...data,
      fileMetadata: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        textLength: cleanedText.length,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    // Handle authentication errors
    if (error instanceof Response) {
      return error;
    }
    
    const message = error?.message || "Internal server error during file upload";
    return NextResponse.json({ 
      success: false,
      error: message 
    }, { status: 500 });
  }
}