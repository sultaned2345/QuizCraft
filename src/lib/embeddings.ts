import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Embeddings usually require OpenAI proper, not Groq
});

export async function generateEmbeddings(text: string, contentId: string, contentType: string, userId: string) {
  // 1. Chunk the text (Approx 1000 chars per chunk)
  const chunks = text.match(/[\s\S]{1,1000}/g) || [];

  console.log(`Generating embeddings for ${chunks.length} chunks...`);

  // 2. Generate Embeddings in Batch
  const embeddings = await Promise.all(
    chunks.map(async (chunk) => {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small", // Cheap and fast
        input: chunk,
      });
      
      return {
        content: chunk,
        vector: response.data[0].embedding
      };
    })
  );

  // 3. Save to Database (Using raw SQL for pgvector)
  for (const item of embeddings) {
    await prisma.$executeRaw`
      INSERT INTO "content_embeddings" (
        id, user_id, content_id, content_type, content_chunk, embedding
      )
      VALUES (
        gen_random_uuid(), 
        ${userId}::uuid, 
        ${contentId}::uuid, 
        ${contentType}, 
        ${item.content}, 
        ${item.vector}::vector
      )
    `;
  }

  console.log(`Saved ${embeddings.length} embeddings.`);
}