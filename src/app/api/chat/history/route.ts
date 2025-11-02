// src/app/api/chat/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { Prisma } from '@prisma/client'; // Import Prisma

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatHistoryMessage {
  role: 'user' | 'model';
  text: string;
}

/**
 * @route GET /api/chat/history
 * @description Fetches the user's chat history.
 * @param ?context_id (optional) - The ID of the context (document, quiz, etc.) to fetch history for.
 * @description If no context_id is provided, fetches the general (null context) chat history.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const contextId = searchParams.get('context_id');

    let whereClause: Prisma.chat_historyWhereInput;

    if (contextId) {
      // Fetch history for a specific context
      whereClause = {
        user_id: user.id,
        context_id: contextId,
      };
    } else {
      // Fetch general (null context) history
      whereClause = {
        user_id: user.id,
        context_id: null,
      };
    }

    const history = await prisma.chat_history.findMany({
      where: whereClause,
      orderBy: {
        created_at: 'asc',
      },
      take: 20, // Get last 20 messages for this context
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