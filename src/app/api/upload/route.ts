// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cleanExtractedText } from "@/lib/file-parser";
import { requireAuth } from "@/lib/auth";
import pdfParse from "pdf-parse-fork";

export const runtime = "nodejs";

// Synchronized with frontend 10MB limit
const MAX_BYTES = 10 * 1024 * 1024; 
const SUPPORTED_TYPES = ["application/pdf", "text/plain"];
const SUPPORTED_EXTENSIONS = [".pdf", ".txt"];

async function getCleanTextFromFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.byteLength > MAX_BYTES) {
    throw new Error(`File exceeds 10MB limit. Current size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
  }

  const nameLower = file.name.toLowerCase();
  const hasValidExtension = SUPPORTED_EXTENSIONS.some(ext => nameLower.endsWith(ext));
  const type = file.type || (nameLower.endsWith(".pdf") ? "application/pdf" : "text/plain");

  if (!SUPPORTED_TYPES.includes(type) || !hasValidExtension) {
    throw new Error(`Unsupported file type. Only PDF and TXT files are allowed.`);
  }

  let rawText = "";
  try {
    if (type === "application/pdf") {
      const result = await pdfParse(buffer, { max: 0, version: 'v1.10.100' });
      rawText = result.text || "";
    } else {
      rawText = buffer.toString("utf8");
    }
  } catch (error: any) {
    throw new Error(`Failed to extract text: ${error.message}`);
  }

  const cleanedText = cleanExtractedText(rawText);
  if (!cleanedText || cleanedText.trim().length < 50) {
    throw new Error("File contains insufficient text content (minimum 50 characters).");
  }

  return cleanedText;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request); //
    
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ success: false, error: "Expected multipart/form-data" }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
    }

    const cleanedText = await getCleanTextFromFile(file);
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
    // Always return JSON to prevent frontend parsing errors
    return NextResponse.json({ 
      success: false, 
      error: error?.message || "Internal server error during upload" 
    }, { status: error instanceof Response ? error.status : 500 });
  }
}