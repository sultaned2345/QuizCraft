// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma"; // ✅ Import Prisma

// Force Node.js runtime for reliable file handling (Edge has 1MB limits in some cases)
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB Limit
const ALLOWED_TYPES = [
  "application/pdf", 
  "text/plain", 
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation" // .pptx
];

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate User
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse FormData
    let formData;
    try {
      formData = await request.formData();
    } catch (e) {
      console.error("Error parsing form data:", e);
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 3. Validate File
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });
    }
    
    // Strict type check + Extension fallback
    if (!ALLOWED_TYPES.includes(file.type)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const validExts = ['pdf', 'txt', 'docx', 'pptx'];
      if (!ext || !validExts.includes(ext)) {
         return NextResponse.json({ error: "Invalid file type. Allowed: PDF, DOCX, PPTX, TXT" }, { status: 400 });
      }
    }

    // 4. Initialize Supabase Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: request.headers.get('Authorization') || '',
        },
      },
    });

    // 5. Upload to Supabase Storage
    const fileExt = file.name.split(".").pop();
    // Path structure: user_id/timestamp.ext to prevent collisions
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents") // ✅ Ensure this bucket exists and is public/authenticated
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase Storage Upload Error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // 6. Get Public URL (Optional, but useful)
    const { data: { publicUrl } } = supabase.storage
      .from("documents")
      .getPublicUrl(filePath);

    // 7. ✅ INSERT INTO DATABASE (Fixes the redirection issue)
    const document = await prisma.documents.create({
      data: {
        user_id: user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: BigInt(file.size), // Prisma uses BigInt for file_size
        storage_path: uploadData.path, // Store the internal path for secure access later
        processing_status: 'pending', // Mark as pending so the UI can poll for updates
        created_at: new Date(),
      }
    });

    // 8. Return Success with Document ID
    return NextResponse.json({
      success: true,
      documentId: document.id, // ✅ This is what the frontend needs for the redirect
      file: {
        name: file.name,
        path: uploadData.path,
        url: publicUrl,
        size: file.size,
        type: file.type
      }
    });

  } catch (error: any) {
    console.error("Upload Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}