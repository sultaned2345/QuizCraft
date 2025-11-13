// src/app/api/generate-from-youtube/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import {
  checkAIGenerationUsageLimit,
  incrementAIGenerationUsage,
} from '@/lib/usage-limits';
import { callAIToGenerateQuiz } from '@/lib/aiGeneration';
import { ApiResponse, Quiz } from '@/types/database';
import { Prisma } from '@prisma/client';

//
// -----------------------------------------------------------------------------
// ⚠️ IMPORTANT: Replace this with your actual YouTube tool import
// -----------------------------------------------------------------------------
// This is a placeholder for whatever tool or library you use to get transcripts.
// You will need to replace `youtube.get_video_information` with your
// actual implementation.
const youtube = {
  get_video_information: async (options: {
    url: string;
    fetch_audio_video_tokens?: boolean;
  }): Promise<{ transcript?: string[] }> => {
    // -------------------------------------------------------------------------
    // --- THIS IS A MOCK. REPLACE THIS BLOCK. ---
    // In a real implementation, you'd call your YouTube API/tool here.
    // We mock the error you saw to ensure our handler works.
    if (options.url.includes('ad79nYk2keg')) {
      throw new Error(
        'Transcript is disabled on this video (https://www.youtube.com/watch?v=ad79nYk2keg)'
      );
    }
    // Mock a successful response
    return {
      transcript: [
        'This is the first line of the mock transcript.',
        'This is the second line.',
        'It needs to be long enough to pass the 100 character check.',
        'So we will add a few more lines of text to ensure that it works correctly.',
      ],
    };
    // --- END OF MOCK BLOCK ---
    // -------------------------------------------------------------------------
  },
};
// -----------------------------------------------------------------------------
//

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing videoUrl' },
        { status: 400 }
      );
    }

    // 1. Check Usage Limit
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'limit_exceeded',
          message: usageCheck.message,
        },
        { status: 403 }
      );
    }

    // 2. Fetch Video Info
    let videoInfo;
    try {
      videoInfo = await youtube.get_video_information({
        url: videoUrl,
        fetch_audio_video_tokens: false, // We don't need audio/video
      });
    } catch (toolError: any) {
      // This is the key change: Catch errors from the tool itself
      console.warn(`YouTube tool error for URL ${videoUrl}:`, toolError.message);

      // Check for the specific error message
      if (toolError.message.includes('Transcript is disabled')) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: 'transcript_disabled',
            message:
              'Quiz generation failed. The owner of this video has disabled transcripts.',
          },
          { status: 400 } // Bad Request
        );
      }

      // Handle other potential tool errors
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'youtube_tool_failed',
          message: `Could not fetch video data: ${toolError.message}`,
        },
        { status: 502 } // Bad Gateway
      );
    }

    // 3. Check for empty transcript
    const transcript = videoInfo.transcript?.join(' ');
    if (!transcript || transcript.trim().length < 100) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'transcript_unavailable',
          message:
            'This video does not have a transcript available or it is too short to generate a quiz.',
        },
        { status: 400 }
      );
    }

    // 4. Proceed with Quiz Generation (from aiGeneration.ts)
    // We'll use hardcoded settings for now, but you could pass these from the client
    const quizData = await callAIToGenerateQuiz(
      transcript,
      10, // numQuestions
      'medium', // difficulty
      'MIXED' // questionType
    );

    // 5. Save quiz to database
    const questionsToCreate = quizData.questions.map((q: any) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      correct_answer: q.correct_answer,
      options: Array.isArray(q.options) ? q.options : Prisma.JsonNull,
      prompts: Array.isArray(q.prompts) ? q.prompts : Prisma.JsonNull,
      explanation: q.explanation || '',
    }));

    const savedQuiz = await prisma.quiz.create({
      data: {
        title: quizData.title || 'Quiz from YouTube Video',
        is_public: false,
        immediate_feedback: true,
        userId: user.id,
        questions: {
          create: questionsToCreate,
        },
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });

    // 6. Increment usage
    await incrementAIGenerationUsage(user.id, 1);

    // 7. Return the created quiz data (This line fixes the build error)
    return NextResponse.json<ApiResponse<Quiz>>({
      success: true,
      data: savedQuiz as Quiz,
    });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('Error in generate-from-youtube route:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}