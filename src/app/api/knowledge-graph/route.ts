import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/auth"; // Assuming auth helper exists
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getUserSession();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const userId = session.user.id;

  // 1. Fetch Nodes (Documents, Notes, Quizzes)
  const [docs, notes, quizzes] = await Promise.all([
    prisma.documents.findMany({ where: { user_id: userId }, select: { id: true, file_name: true } }),
    prisma.notes.findMany({ where: { user_id: userId }, select: { id: true, title: true } }),
    prisma.quiz.findMany({ where: { userId: userId }, select: { id: true, title: true } }),
  ]);

  const nodes = [
    ...docs.map(d => ({ id: d.id, name: d.file_name, group: "Document", val: 20 })),
    ...notes.map(n => ({ id: n.id, name: n.title, group: "Note", val: 15 })),
    ...quizzes.map(q => ({ id: q.id, name: q.title, group: "Quiz", val: 10 })),
  ];

  // 2. Fetch Edges (Semantic Similarity)
  // This query finds pairs of content with high cosine similarity (> 0.8)
  // Note: This requires the pgvector extension and `content_embeddings` table
  const similarityThreshold = 0.8;
  const links = await prisma.$queryRaw`
    SELECT 
      a.content_id as source, 
      b.content_id as target
    FROM content_embeddings a
    JOIN content_embeddings b ON a.user_id = b.user_id AND a.id != b.id
    WHERE a.user_id = ${userId}::uuid
      AND (a.embedding <=> b.embedding) < ${1 - similarityThreshold}
    LIMIT 100;
  `;

  return NextResponse.json({ nodes, links });
}