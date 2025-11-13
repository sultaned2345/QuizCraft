// Example for a hypothetical API route
// src/app/api/generate-from-youtube/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { youtube } from '@/lib/youtubeTool'; // Assuming we have a wrapper
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit } from '@/lib/usage-limits';
import { callAIToGenerateQuiz } from '@/lib/aiGeneration';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { videoUrl } = await request.json();

    // 1. Check Usage Limit (as we do elsewhere)
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid) {
      return NextResponse.json(
        { success: false, error: 'limit_exceeded', message: usageCheck.message },
        { status: 403 }
      );
    }

    // 2. Fetch Video Info
    let videoInfo;
    try {
      videoInfo = await youtube.get_video_information({
        url: videoUrl,
        // We only need the transcript
        fetch_audio_video_tokens: false, 
      });
    } catch (toolError: any) {
      // This is the key change: Catch errors from the tool itself
      console.warn(`YouTube tool error for URL ${videoUrl}:`, toolError.message);

      // Check for the specific error message
      if (toolError.message.includes('Transcript is disabled')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'transcript_disabled',
            message: 'Quiz generation failed. The owner of this video has disabled transcripts.' 
          },
          { status: 400 } // Bad Request - the user's input is valid but can't be processed
        );
      }
      
      // Handle other potential tool errors
      return NextResponse.json(
        { success: false, error: 'youtube_tool_failed', message: 'Could not fetch video data.' },
        { status: 502 } // Bad Gateway
      );
    }

    // 3. Check for empty transcript
    const transcript = videoInfo.transcript?.join(' ');
    if (!transcript || transcript.trim().length < 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'transcript_unavailable',
          message: 'This video does not have a transcript available or it is too short to generate a quiz.' 
        },
        { status: 400 }
      );
    }

    // 4. Proceed with Quiz Generation (from aiGeneration.ts)
    const quizData = await callAIToGenerateQuiz(transcript, 10, 'medium', 'MIXED');

    // 5. Save quiz, increment usage, and return response...
    // ... (omitted for brevity) ...

    return NextResponse.json({ success: true, data: { ... } });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('Error in generate-from-youtube route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}