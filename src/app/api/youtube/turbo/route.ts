// src/app/api/youtube/turbo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { generateFromYoutube } from '@/lib/aiGeneration'; // Imported from our updated file

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { videoUrl } = await request.json();

    if (!videoUrl) return NextResponse.json({ error: 'Missing videoUrl' }, { status: 400 });

    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid) {
      return NextResponse.json({ error: 'limit_exceeded', message: usageCheck.message }, { status: 403 });
    }

    // Call the master orchestrator
    const data = await generateFromYoutube(videoUrl);

    await incrementAIGenerationUsage(user.id, 1);

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        transcript: data.fullText // Ensure mapping matches frontend expectations
      }
    });

  } catch (error: any) {
    console.error('Turbo Route Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}