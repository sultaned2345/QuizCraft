// src/app/api/generation-jobs/start/route.ts
// NEW FILE

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';

interface StartJobRequestBody {
  documentId: string;
  jobType: 'quiz' | 'note' | 'flashcard';
}

/**
 * @route POST /api/generation-jobs/start
 * @description Starts a new generation job for a document (Quiz, Note, or Flashcards)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { documentId, jobType }: StartJobRequestBody = await request.json();

    if (!documentId || !jobType) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing documentId or jobType.' }, { status: 400 });
    }

    if (!['quiz', 'note', 'flashcard'].includes(jobType)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid jobType.' }, { status: 400 });
    }

    // 1. Check AI Usage Limit before starting
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid || !usageCheck.canGenerate) {
      return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: usageCheck.error, // "limit_exceeded"
          message: usageCheck.message 
      }, { status: 403 });
    }

    // 2. Check for an existing pending/processing job for this exact doc+type
    const existingJob = await prisma.generation_jobs.findFirst({
      where: {
        document_id: documentId,
        user_id: user.id,
        job_type: jobType,
        status: { in: ['pending', 'processing'] }
      }
    });

    if (existingJob) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'A job for this document and type is already in progress.' 
      }, { status: 400 });
    }
    
    // 3. Create the new job
    const newJob = await prisma.generation_jobs.create({
      data: {
        user_id: user.id,
        document_id: documentId,
        job_type: jobType,
        status: 'pending',
      }
    });

    // 4. Increment AI usage count (reserves the spot)
    await incrementAIGenerationUsage(user.id, 1);

    // 202 Accepted: The request has been accepted for processing, but is not complete.
    return NextResponse.json<ApiResponse>({
      success: true,
      data: newJob,
      message: 'Generation job has been queued successfully.'
    }, { status: 202 });

  } catch (error: any) {
    if (error instanceof Response) return error; // Handle requireAuth errors
    console.error('[API /api/generation-jobs/start] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to start generation job.' },
      { status: 500 }
    );
  }
}