import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { content, title } = body;

    if (!content || content.length < 10) {
      return NextResponse.json({ error: "Content too short" }, { status: 400 });
    }

    // Transaction: Doc + Jobs
    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.documents.create({
        data: {
          user_id: user.id,
          file_name: title || "Pasted Note",
          file_type: "txt",
          extracted_text: content,
          file_size: BigInt(Buffer.byteLength(content)),
          storage_path: "pasted_text",
          processing_status: 'processing'
        }
      });

      // Create Jobs
      await tx.generation_jobs.createMany({
        data: ['note', 'quiz', 'flashcard'].map(type => ({
          user_id: user.id,
          document_id: doc.id,
          job_type: type,
          status: 'pending'
        }))
      });

      return doc;
    });

    // Trigger Worker
    const workerUrl = new URL('/api/generation-jobs/start', req.url);
    fetch(workerUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') || '' },
      body: JSON.stringify({ documentId: result.id })
    }).catch(console.error);

    return NextResponse.json({ 
      success: true, 
      documentId: result.id 
    });

  } catch (error: any) {
    console.error("Text Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}