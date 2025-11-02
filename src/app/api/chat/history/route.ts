// src/app/api/chat/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatHistoryMessage {
  role: 'user' | 'model';
  text: string;
}

/**
 * @route GET /api/chat/history
 * @description Fetches the user's general chat history (last 20 messages).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const history = await prisma.chat_history.findMany({
      where: {
        user_id: user.id,
      },
      orderBy: {
        created_at: 'asc',
      },
      take: 20, // Get last 20 messages
    });

    const formattedHistory: ChatHistoryMessage[] = history.map(h => ({
      role: h.role as 'user' | 'model',
      text: h.content,
    }));

    return NextResponse.json<ApiResponse<ChatHistoryMessage[]>>({
      success: true,
      data: formattedHistory,
    });

  } catch (error: any) {
    if (error instanceof Response) return error; // Handle requireAuth errors
    console.error('[API /api/chat/history] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch chat history.' },
      { status: 500 }
    );
  }
}