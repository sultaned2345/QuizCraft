// src/app/api/generation-jobs/start/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/getServerSession';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  console.log("---------------------------------------------------------");
  console.log("[API] Incoming Request: POST /api/generation-jobs/start");

  try {
    // 1. Authentication Check
    const session = await getServerSession();
    if (!session?.user) {
      console.log("❌ [API] Auth Failed: No user session.");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Request Body
    const body = await req.json();
    
    // FIX: Default jobType to 'quiz' if missing to prevent 400 errors on simple calls
    let { documentId, jobType = 'quiz' } = body;

    // DEBUG: Log Source Page and Payload to trace "undefined" errors
    const referer = req.headers.get('referer') || 'Unknown Source';
    console.log(`📝 [API] Source: ${referer}`);
    console.log(`📝 [API] Payload:`, JSON.stringify({ documentId, jobType }));

    // 3. Validation
    const missingFields = [];
    if (!documentId) missingFields.push('documentId');
    // Note: jobType is no longer checked for "existence" here because it has a default
    
    if (missingFields.length > 0) {
      console.error(`❌ [API] Validation Failed: Missing ${missingFields.join(', ')}`);
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` }, 
        { status: 400 }
      );
    }

    // Clean and Validate UUID
    if (typeof documentId === 'string') {
        documentId = documentId.trim();
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof documentId !== 'string' || !uuidRegex.test(documentId)) {
       console.log(`❌ [API] Validation Failed: Invalid UUID format '${documentId}'`);
       return NextResponse.json(
        { error: 'Invalid documentId format. Must be a valid UUID.' }, 
        { status: 400 }
      );
    }

    const validJobTypes = ['quiz', 'flashcard', 'note', 'podcast', 'embedding'];
    if (!validJobTypes.includes(jobType)) {
      console.log(`❌ [API] Validation Failed: Invalid jobType '${jobType}'`);
      return NextResponse.json(
        { error: `Invalid jobType. Must be one of: ${validJobTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 4. Verify Document Ownership
    const doc = await prisma.documents.findUnique({
      where: { 
        id: documentId,
        user_id: session.user.id 
      }
    });

    if (!doc) {
      console.log(`❌ [API] Document not found or access denied: ${documentId}`);
      return NextResponse.json(
        { error: 'Document not found or access denied.' },
        { status: 404 }
      );
    }

    // 5. Create the Job Record
    const job = await prisma.generation_jobs.create({
      data: {
        user_id: session.user.id,
        document_id: documentId,
        job_type: jobType,
        status: 'pending' 
      }
    });

    console.log(`🚀 [API] Job Created: ${job.id} (${jobType}). Triggering process...`);

    // 6. Trigger the Processing Endpoint (Fire and Forget)
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const processUrl = `${protocol}://${host}/api/generation-jobs/process`;
    const cookieHeader = req.headers.get('cookie') || '';

    fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({ jobId: job.id })
    }).catch(err => {
      console.error(`⚠️ [API] Process Trigger Failed:`, err);
    });

    return NextResponse.json({ 
      success: true, 
      jobId: job.id,
      message: 'Job queued successfully.' 
    });

  } catch (error: any) {
    console.error('💥 [API] Critical Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}