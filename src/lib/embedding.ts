// src/lib/embedding.ts
import { GoogleGenerativeAI } from "@google/generative-ai"; // <-- FIX: Changed hyphen to slash
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from './supabaseAdmin'; // Use admin client for DB operations

// Use 'text-embedding-004' which is Google's new standard (768 dimensions)
const EMBEDDING_MODEL = "text-embedding-004";
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Splits text into simple chunks.
 * A more advanced implementation would use token-based splitting
 * and overlapping chunks.
 */
function chunkText(text: string, chunkSize = 1000, chunkOverlap = 100): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
        const end = Math.min(i + chunkSize, text.length);
        chunks.push(text.substring(i, end));
        i += (chunkSize - chunkOverlap);
    }
    return chunks;
}

/**
 * Generates embeddings for text chunks and saves them to the database.
 * This function is designed to run in the background (fire-and-forget).
 */
export async function generateEmbeddingsForContent(
  contentId: string,
  contentType: 'note' | 'document',
  textContent: string,
  userId: string
) {
  if (!API_KEY) {
    console.error("Missing GOOGLE_AI_API_KEY for embeddings.");
    return;
  }
  if (!textContent || textContent.trim().length < 50) {
    console.log(`Skipping embeddings for ${contentType} ${contentId}: content too short.`);
    return;
  }

  console.log(`Generating embeddings for ${contentType} ${contentId}...`);

  try {
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    
    // 1. Chunk the text
    const textChunks = chunkText(textContent);
    
    // 2. Get embeddings for all chunks
    const result = await model.batchEmbedContents({
      requests: textChunks.map(chunk => ({
        content: { parts: [{ text: chunk }] },
        taskType: "RETRIEVAL_DOCUMENT"
      }))
    });

    const embeddings = result.embeddings;

    if (!embeddings || embeddings.length !== textChunks.length) {
        throw new Error("Mismatch between chunks and returned embeddings.");
    }

    // 3. Prepare data for Prisma
    const embeddingsToSave = embeddings.map((embedding, index) => ({
      user_id: userId,
      content_id: contentId,
      content_type: contentType,
      content_chunk: textChunks[index],
      embedding: embedding.values, // This is the vector
    }));

    // 4. Delete old embeddings and save new ones in a transaction
    // Use supabaseAdmin's prisma client for background tasks
    await prisma.$transaction([
        // Delete any existing chunks for this content
        prisma.content_embeddings.deleteMany({
            where: {
                content_id: contentId,
                user_id: userId
            }
        }),
        // Create new chunks
        prisma.content_embeddings.createMany({
            data: embeddingsToSave
        })
    ]);

    console.log(`Successfully generated and saved ${embeddings.length} embeddings for ${contentType} ${contentId}.`);

  } catch (error) {
    console.error(`Error in generateEmbeddingsForContent for ${contentType} ${contentId}:`, error);
    // Handle or log the error appropriately
  }
}

/**
 * Generates an embedding for a single query.
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
    if (!API_KEY) throw new Error("Missing GOOGLE_AI_API_KEY for embeddings.");
    
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent({
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_QUERY"
    });
    
    return result.embedding.values;
}