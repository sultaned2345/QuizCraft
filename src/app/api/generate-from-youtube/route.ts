import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { fetchYoutubeTranscript } from '@/lib/youtube'; // Ensure you have this helper

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { url } = body; // Frontend sends 'url', not 'videoUrl'

    if (!url) {
      return NextResponse.json({ success: false, error: 'Missing YouTube URL' }, { status: 400 });
    }

    // 1. Fetch Transcript (Fast operation)
    let transcriptText = '';
    let videoTitle = 'YouTube Video';
    
    try {
      const videoData = await fetchYoutubeTranscript(url);
      transcriptText = videoData.transcript;
      videoTitle = videoData.title;
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `YouTube Error: ${e.message}` },
        { status: 400 }
      );
    }

    if (!transcriptText || transcriptText.length < 50) {
      return NextResponse.json(
        { success: false, error: 'Transcript too short or unavailable.' },
        { status: 400 }
      );
    }

    // 2. Transaction: Create Document + Jobs
    const result = await prisma.$transaction(async (tx) => {
      // A. Create Document Record
      const doc = await tx.documents.create({
        data: {
          user_id: user.id,
          file_name: videoTitle,
          file_type: 'youtube',
          extracted_text: transcriptText,
          storage_path: url, // Store URL as path for reference
          processing_status: 'processing'
        }
      });

      // B. Queue Background Jobs
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

    // 3. Trigger Background Worker (Fire and Forget)
    const workerUrl = new URL('/api/generation-jobs/start', request.url);
    fetch(workerUrl.toString(), {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '' 
      },
      body: JSON.stringify({ documentId: result.id })
    }).catch(console.error);

    // 4. Return ID for Frontend Redirect
    return NextResponse.json({
      success: true,
      documentId: result.id,
      message: 'Video processing started.'
    });

  } catch (error: any) {
    console.error('YouTube Route Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server Error' },
      { status: 500 }
    );
  }
}