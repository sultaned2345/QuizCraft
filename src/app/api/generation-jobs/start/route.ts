// src/app/api/generation-jobs/start/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/getServerSession';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  // 1. Entry Log (Check your server console for this!)
  console.log("---------------------------------------------------------");
  console.log("[API] Incoming Request: POST /api/generation-jobs/start");

  try {
    // 2. Authentication Check
    const session = await getServerSession();
    if (!session?.user) {
      console.log("❌ [API] Unauthorized - No session found");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Parse Request Body
    const body = await req.json();
    let { documentId, jobType } = body;

    // 4. Validation
    if (!documentId || !jobType) {
      return NextResponse.json(
        { error: 'Missing required fields: documentId, jobType' }, 
        { status: 400 }
      );
    }

    if (typeof documentId === 'string') {
        documentId = documentId.trim();
    }

    // UUID Validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof documentId !== 'string' || !uuidRegex.test(documentId)) {
       return NextResponse.json(
        { error: 'Invalid documentId format. Must be a valid UUID.' }, 
        { status: 400 }
      );
    }

    // Allowed Job Types
    const validJobTypes = ['quiz', 'flashcard', 'note', 'podcast', 'embedding'];
    if (!validJobTypes.includes(jobType)) {
      return NextResponse.json(
        { error: `Invalid jobType. Must be one of: ${validJobTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 5. Verify Document Ownership
    const doc = await prisma.documents.findUnique({
      where: { 
        id: documentId,
        user_id: session.user.id 
      }
    });

    if (!doc) {
      console.log(`❌ [API] Document ${documentId} not found or access denied.`);
      return NextResponse.json(
        { error: 'Document not found or access denied.' },
        { status: 404 }
      );
    }

    // 6. Create the Job Record (Pending)
    const job = await prisma.generation_jobs.create({
      data: {
        user_id: session.user.id,
        document_id: documentId,
        job_type: jobType,
        status: 'pending' 
      }
    });

    console.log(`✅ [API] Job Created: ${job.id} (Type: ${jobType}). Triggering process...`);

    // 7. 🔥 KEY FIX: Trigger the Processing Endpoint Immediately 🔥
    // We construct the URL dynamically to work on localhost or production.
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const processUrl = `${protocol}://${host}/api/generation-jobs/process`;
    
    // We MUST pass the auth cookie so the /process endpoint accepts the request.
    const cookieHeader = req.headers.get('cookie') || '';

    // Fire and forget (don't await) so the UI returns immediately.
    // The catch block logs any trigger failures.
    fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader 
      },
      body: JSON.stringify({ jobId: job.id })
    }).catch(err => {
      console.error(`⚠️ [API] Failed to trigger process endpoint:`, err);
    });

    // 8. Return Success to Client
    return NextResponse.json({ 
      success: true, 
      jobId: job.id,
      message: 'Job queued and processing started.' 
    });

  } catch (error: any) {
    console.error('❌ [API] Start Job Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}