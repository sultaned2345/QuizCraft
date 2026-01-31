import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/getServerSession';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // 1. Authentication
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Request
    const body = await req.json();
    let { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
    }

    // 3. Verify Document Ownership
    // Ensure the user actually owns the document they are trying to process
    const doc = await prisma.documents.findUnique({
      where: { 
        id: documentId,
        user_id: session.user.id 
      }
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    // 4. Find Pending Jobs
    // We look for any jobs created by the Upload route that haven't started yet
    const pendingJobs = await prisma.generation_jobs.findMany({
      where: { 
        document_id: documentId, 
        status: 'pending' 
      }
    });

    console.log(`[Job Start] Found ${pendingJobs.length} pending jobs for doc ${documentId}`);

    if (pendingJobs.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No pending jobs found.', 
        count: 0 
      });
    }

    // 5. Trigger Processing (Fire and Forget)
    // We construct the absolute URL to the process endpoint
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const processUrl = `${protocol}://${host}/api/generation-jobs/process`;
    
    // We forward the cookie so the Process route can verify auth if needed
    const cookieHeader = req.headers.get('cookie') || '';

    // Loop through all pending jobs and fire off a request for each.
    // We do NOT await these fetches because we don't want to hold up the response.
    pendingJobs.forEach(job => {
      fetch(processUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Cookie': cookieHeader 
        },
        body: JSON.stringify({ jobId: job.id })
      }).catch(err => console.error(`Failed to trigger job ${job.id}:`, err));
    });

    // 6. Return Immediately
    return NextResponse.json({ 
      success: true, 
      count: pendingJobs.length,
      message: `Triggered ${pendingJobs.length} jobs.` 
    });

  } catch (error: any) {
    console.error('[Job Start] Error:', error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}