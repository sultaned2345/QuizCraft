// file: src/app/api/content/find-related/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateQueryEmbedding } from '@/lib/embedding';
import { ApiResponse } from '@/types/database';

export const runtime = 'nodejs';

interface RequestBody {
  contentId: string;
  contentType: 'note' | 'document';
  textContent: string;
}

interface RelatedItem {
  content_id: string;
  content_type: 'note' | 'document';
  content_title: string;
  similarity: number;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { contentId, contentType, textContent }: RequestBody = await request.json();

    if (!contentId || !contentType || !textContent) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing required fields: contentId, contentType, textContent' }, { status: 400 });
    }

    if (textContent.length < 50) {
        return NextResponse.json<ApiResponse<RelatedItem[]>>({ success: true, data: [] }); // Not an error, just no results
    }

    // 1. Generate embedding for the *source* content
    const queryEmbedding = await generateQueryEmbedding(textContent);

    // 2. Call the new RPC function
    // Fix: Cast arguments to 'any' to bypass strict type checking for missing RPC definition
    const { data: relatedItems, error: rpcError } = await supabaseAdmin.rpc('match_related_content', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7, // Adjust as needed
        match_count: 5,       // Get top 5 related items
        p_user_id: user.id,
        exclude_content_id: contentId // Exclude the item itself
    } as any);

    if (rpcError) {
        console.error("Error matching related content:", rpcError);
        throw new Error(`Failed to retrieve related materials: ${rpcError.message}`);
    }

    return NextResponse.json<ApiResponse<RelatedItem[]>>({
        success: true,
        data: relatedItems || []
    });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error("Error in /api/content/find-related:", error);
    return NextResponse.json(
      { success: false, error: error.message || "An internal server error occurred." },
      { status: 500 }
    );
  }
}