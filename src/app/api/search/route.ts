// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { generateQueryEmbedding } from '@/lib/embedding';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [] });
    }

    // 1. Generate Embedding for the query
    const queryEmbedding = await generateQueryEmbedding(query);

    // 2. Format vector for Postgres pgvector
    // pgvector expects a string like '[0.1, 0.2, ...]'
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // 3. Call the RPC function defined in database-setup.sql
    // match_content_chunks(query_embedding, match_threshold, match_count, p_user_id)
    const threshold = 0.5; // Tune this value (0.0 to 1.0)
    const matchCount = 5;

    const results = await prisma.$queryRaw`
      SELECT * FROM match_content_chunks(
        ${vectorString}::vector, 
        ${threshold}::float, 
        ${matchCount}::int, 
        ${user.id}::uuid
      )
    `;

    return NextResponse.json({ results });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error("Smart search error:", error);
    return NextResponse.json({ error: "Failed to perform search" }, { status: 500 });
  }
}