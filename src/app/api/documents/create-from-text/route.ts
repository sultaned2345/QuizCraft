import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { content, title } = body;

    if (!content || content.length < 10) {
      return NextResponse.json({ error: "Content too short" }, { status: 400 });
    }

    // Transaction: Create Doc + Jobs
    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.documents.create({
        data: {
          user_id: user.id,
          file_name: title || "Pasted Note",
          file_type: "txt",
          extracted_text: content,
          file_size: BigInt(Buffer.byteLength(content)),
          storage_path: "pasted_text",
          processing_status: "processing"
        }
      });

      // Create Jobs
      await tx.generation_jobs.createMany({
        data: ["note", "flashcard", "quiz", "embedding"].map(type => ({
          user_id: user.id,
          document_id: doc.id,
          job_type: type,
          status: "pending"
        }))
      });
      
      return doc;
    });

    return NextResponse.json({ 
      success: true, 
      data: { document: { id: result.id } } 
    });

  } catch (error: any) {
    console.error("Create Text API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}