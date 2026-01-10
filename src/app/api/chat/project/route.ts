import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/getServerSession';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

// Use Groq for the Chat response (Fast/Smart)
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY, 
  baseURL: "https://api.groq.com/openai/v1" 
});

// Use OpenAI for generating the query embedding
const embedder = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, documentId, projectId } = await req.json();

    // 1. Embed the User's Question
    const embeddingResponse = await embedder.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
    });
    const queryVector = embeddingResponse.data[0].embedding;

    // 2. Search Vector DB (RAG)
    // Find chunks similar to the question belonging to this document
    const vectorQuery = `
      SELECT content_chunk
      FROM content_embeddings
      WHERE content_id = '${documentId}'::uuid
      ORDER BY embedding <-> '${JSON.stringify(queryVector)}'
      LIMIT 5;
    `;
    
    const similarChunks: any[] = await prisma.$queryRawUnsafe(vectorQuery);
    const contextText = similarChunks.map(c => c.content_chunk).join("\n---\n");

    // 3. Ask the LLM
    const completion = await openai.chat.completions.create({
      model: "llama3-70b-8192", // Smart model
      messages: [
        {
          role: "system",
          content: `You are an AI Tutor for the user's study project.
          Use the following CONTEXT from the user's document to answer their question.
          If the answer isn't in the context, say "I don't see that in the document, but generally..."
          
          CONTEXT:
          ${contextText}`
        },
        { role: "user", content: message }
      ],
      temperature: 0.5,
    });

    const responseText = completion.choices[0].message.content;

    // 4. Save Chat History (Optional)
    await prisma.chat_history.create({
      data: {
        user_id: session.user.id,
        role: 'user',
        content: message,
        context_id: documentId,
        context_type: 'document'
      }
    });
    
    await prisma.chat_history.create({
      data: {
        user_id: session.user.id,
        role: 'model',
        content: responseText || "Error",
        context_id: documentId,
        context_type: 'document'
      }
    });

    return NextResponse.json({ response: responseText });

  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}