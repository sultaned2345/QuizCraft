import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" });

export async function POST(req: Request) {
  try {
    const { projectId, essayContent } = await req.json();

    // 1. Fetch Project Context (Limit to 5000 chars to save tokens)
    // In a real app, use RAG here. For now, fetch first doc.
    const project = await prisma.projects.findUnique({
      where: { id: projectId },
      include: {
        links: {
            where: { content_type: 'document' },
            include: { /* Prisma doesn't do deep poly-include easily, do separate query */ }
        }
      }
    });

    // Quick fetch of text (Optimization)
    const docs = await prisma.documents.findMany({
        where: { id: { in: (await prisma.project_content_links.findMany({ 
            where: { project_id: projectId, content_type: 'document' } 
        })).map(l => l.content_id) }}
    });
    
    const contextText = docs.map(d => d.extracted_text).join("\n").slice(0, 5000);

    // 2. Grade with AI
    const completion = await openai.chat.completions.create({
        model: "llama3-70b-8192",
        messages: [
            {
                role: "system",
                content: `You are a strict professor. Grade the user's essay based ONLY on the provided Context.
                Return JSON format: { "score": number, "strengths": "string", "weaknesses": "string", "suggestion": "string" }
                
                CONTEXT: ${contextText}`
            },
            { role: "user", content: essayContent }
        ],
        response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    // 3. Save Record (Optional)
    // await prisma.graded_essays.create(...)

    return NextResponse.json(result);

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}