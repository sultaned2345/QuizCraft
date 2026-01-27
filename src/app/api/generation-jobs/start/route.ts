// src/app/api/generation-jobs/start/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/getServerSession';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    // 1. Authentication Check
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Request Body
    const body = await req.json();
    let { documentId, jobType } = body;

    // 3. Validation
    if (!documentId || !jobType) {
      return NextResponse.json(
        { error: 'Missing required fields: documentId, jobType' }, 
        { status: 400 }
      );
    }

    if (typeof documentId === 'string') {
        documentId = documentId.trim();
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (typeof documentId !== 'string' || !uuidRegex.test(documentId)) {
       return NextResponse.json(
        { error: 'Invalid documentId format. Must be a valid UUID.' }, 
        { status: 400 }
      );
    }

    // ✅ UPDATE: Added 'podcast' and 'embedding' to this list
    const validJobTypes = ['quiz', 'flashcard', 'note', 'podcast', 'embedding'];
    
    if (!validJobTypes.includes(jobType)) {
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

    console.log(`[Job Started] User ${session.user.id} requested '${jobType}' for Doc ${documentId} (Job ID: ${job.id})`);

    // 6. Trigger the Processing Endpoint
    // We must invoke the process route so the AI generation actually starts.
    // We forward the Cookie header so the process route (which requires auth) accepts the request.
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const processUrl = `${protocol}://${host}/api/generation-jobs/process`;
    const cookieHeader = req.headers.get('cookie') || '';

    // Fire and forget (don't await the full result to keep UI snappy, 
    // but catch errors to log them).
    fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({ jobId: job.id })
    }).catch(err => {
      console.error(`[Job Trigger Failed] Could not trigger process for Job ${job.id}:`, err);
    });

    // 7. Return Success
    return NextResponse.json({ 
      success: true, 
      jobId: job.id,
      message: 'Job queued and processing started.' 
    });

  } catch (error: any) {
    console.error('Start Job Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}