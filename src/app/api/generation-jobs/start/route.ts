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
    const { documentId, jobType } = body;

    // 3. Validation
    if (!documentId || !jobType) {
      return NextResponse.json(
        { error: 'Missing required fields: documentId, jobType' }, 
        { status: 400 }
      );
    }

    // Fix: Use a more permissive UUID regex (ignores specific version/variant bits)
    // This allows v7 UUIDs and other valid formats that Supabase might use
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(documentId)) {
       console.error(`[Job Validation] Invalid UUID received: ${documentId}`);
       return NextResponse.json(
        { error: 'Invalid documentId format. Must be a valid UUID.' }, 
        { status: 400 }
      );
    }

    // Enforce valid job types to prevent bad data
    const validJobTypes = ['quiz', 'flashcard', 'summary', 'note'];
    if (!validJobTypes.includes(jobType)) {
      return NextResponse.json(
        { error: `Invalid jobType. Must be one of: ${validJobTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 4. Verify Document Ownership
    // Ensure the user actually owns the document they are trying to process
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
    // The 'status' defaults to 'pending' in the schema
    const job = await prisma.generation_jobs.create({
      data: {
        user_id: session.user.id,
        document_id: documentId,
        job_type: jobType,
        status: 'pending' 
      }
    });

    console.log(`[Job Started] User ${session.user.id} requested '${jobType}' for Doc ${documentId}`);

    // 6. Return Success
    return NextResponse.json({ 
      success: true, 
      jobId: job.id,
      message: 'Job queued successfully.' 
    });

  } catch (error: any) {
    console.error('Start Job Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}