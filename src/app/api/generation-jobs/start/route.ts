// src/app/api/generation-jobs/start/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/getServerSession';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  console.log("---------------------------------------------------------");
  console.log("Incoming Request: POST /api/generation-jobs/start"); // 1. ENTRY LOG
  
  try {
    // 1. Authentication Check
    const session = await getServerSession();
    
    if (!session?.user) {
      console.log("❌ [Auth Fail] No user session found in cookies.");
      return NextResponse.json({ error: 'Unauthorized - No Session' }, { status: 401 });
    }

    console.log(`✅ [Auth Success] User: ${session.user.id}`);

    // 2. Parse Request Body
    const body = await req.json();
    let { documentId, jobType } = body;

    console.log(`📝 [Payload] Type: ${jobType}, DocID: ${documentId}`);

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
       console.log("❌ [Validation] Invalid UUID");
       return NextResponse.json(
        { error: 'Invalid documentId format. Must be a valid UUID.' }, 
        { status: 400 }
      );
    }

    const validJobTypes = ['quiz', 'flashcard', 'note', 'podcast', 'embedding'];
    
    if (!validJobTypes.includes(jobType)) {
      console.log(`❌ [Validation] Invalid jobType: ${jobType}`);
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
      console.log(`❌ [DB] Document not found for user.`);
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

    console.log(`🚀 [Job Started] Created Job ${job.id}. Triggering process...`);

    // 6. Trigger the Processing Endpoint
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
      console.error(`⚠️ [Trigger Fail] Could not trigger process:`, err);
    });

    return NextResponse.json({ 
      success: true, 
      jobId: job.id,
      message: 'Job queued successfully.' 
    });

  } catch (error: any) {
    console.error('💥 [Critical Error] Start Job Failed:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}