// src/lib/embedding.ts
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai"; 
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from './supabaseAdmin';

// Use 'text-embedding-004' which is Google's new standard (768 dimensions)
const EMBEDDING_MODEL = "text-embedding-004";
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * IMPROVED: Recursive Character Text Splitter
 * Recursively splits text into chunks respecting semantic boundaries.
 * Priority: Paragraphs (\n\n) -> Newlines (\n) -> Sentences (. ) -> Spaces ( ) -> Characters
 */
function chunkText(text: string, chunkSize = 2000, chunkOverlap = 200): string[] {
    if (!text) return [];

    const separators = ["\n\n", "\n", ". ", " ", ""];

    function splitRecursively(textToSplit: string, separatorIndex: number): string[] {
        // 1. Base Case: If text fits, return it
        if (textToSplit.length <= chunkSize) {
            return [textToSplit];
        }

        // 2. Fallback: If no separators left, hard split by character
        if (separatorIndex >= separators.length) {
             const chunks: string[] = [];
             let i = 0;
             while (i < textToSplit.length) {
                 // Hard slice
                 const end = Math.min(i + chunkSize, textToSplit.length);
                 chunks.push(textToSplit.substring(i, end));
                 // Move forward by stride (size - overlap)
                 i += (chunkSize - chunkOverlap);
             }
             return chunks;
        }

        const separator = separators[separatorIndex];
        // Split text by the current separator
        // If separator is present, split. If not, this returns [textToSplit] and we recurse to next separator.
        const parts = textToSplit.split(separator);
        
        // If splitting didn't actually split anything (only 1 part), 
        // implies this separator doesn't exist here. Move to next separator immediately.
        if (parts.length === 1) {
            return splitRecursively(textToSplit, separatorIndex + 1);
        }

        const finalChunks: string[] = [];
        let currentChunk: string[] = [];
        let currentLen = 0;
        const sepLen = separator.length;

        for (const part of parts) {
            const partLen = part.length;

            // Edge Case: If a single part is HUGE (larger than chunk size),
            // we must process it recursively with the *next* separator.
            if (partLen > chunkSize) {
                // 1. Flush whatever we have accumulated so far
                if (currentChunk.length > 0) {
                    finalChunks.push(currentChunk.join(separator));
                    currentChunk = [];
                    currentLen = 0;
                }
                // 2. Recurse on the huge part
                const subChunks = splitRecursively(part, separatorIndex + 1);
                finalChunks.push(...subChunks);
                continue;
            }

            // Normal Case: Accumulate parts
            if (currentLen + partLen + (currentChunk.length > 0 ? sepLen : 0) <= chunkSize) {
                currentChunk.push(part);
                currentLen += partLen + (currentChunk.length > 0 ? sepLen : 0);
            } else {
                // Chunk is full. Push it.
                if (currentChunk.length > 0) {
                    finalChunks.push(currentChunk.join(separator));
                    
                    // Handle Overlap: Keep the last few parts that fit within chunkOverlap
                    // We backtrack from the end of currentChunk
                    const overlapBuffer: string[] = [];
                    let overlapLen = 0;
                    for (let k = currentChunk.length - 1; k >= 0; k--) {
                        const item = currentChunk[k];
                        if (overlapLen + item.length + sepLen <= chunkOverlap) {
                            overlapBuffer.unshift(item); // Prepend
                            overlapLen += item.length + sepLen;
                        } else {
                            break; // Stop if we exceed overlap size
                        }
                    }
                    currentChunk = overlapBuffer;
                    currentLen = overlapLen;
                }
                // Add the new part to the (now emptied or overlapped) chunk
                currentChunk.push(part);
                currentLen += partLen + (currentChunk.length > 0 ? sepLen : 0);
            }
        }

        // Flush remaining
        if (currentChunk.length > 0) {
            finalChunks.push(currentChunk.join(separator));
        }

        return finalChunks;
    }

    return splitRecursively(text, 0);
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
    
    // 1. Chunk the text using the improved recursive splitter
    const textChunks = chunkText(textContent);
    console.log(`Split text into ${textChunks.length} semantic chunks.`);
    
    // 2. Get embeddings for all chunks
    // Note: batchEmbedContents has a limit (often 100 items). We batch carefully.
    const BATCH_SIZE = 90; 
    const allEmbeddings = [];

    for (let i = 0; i < textChunks.length; i += BATCH_SIZE) {
        const batch = textChunks.slice(i, i + BATCH_SIZE);
        const result = await model.batchEmbedContents({
            requests: batch.map(chunk => ({
                // FIX: Added role: 'user' to meet Content interface requirements
                content: { role: 'user', parts: [{ text: chunk }] }, 
                // FIX: Use Enum instead of string literal
                taskType: TaskType.RETRIEVAL_DOCUMENT
            }))
        });
        if (result.embeddings) {
            allEmbeddings.push(...result.embeddings);
        }
    }

    if (!allEmbeddings || allEmbeddings.length !== textChunks.length) {
        throw new Error(`Mismatch: ${textChunks.length} chunks vs ${allEmbeddings.length} embeddings.`);
    }

    // 3. Prepare raw insert operations
    // We cannot use createMany with Unsupported("vector") types in Prisma.
    // We must use executeRaw and cast the vector string properly.
    const insertOperations = allEmbeddings.map((embedding, index) => {
      const chunkText = textChunks[index];
      // Format array as string: "[0.123, 0.456, ...]"
      const vectorString = `[${embedding.values.join(',')}]`;
      
      return prisma.$executeRaw`
        INSERT INTO "content_embeddings" (
          "id", 
          "user_id", 
          "content_id", 
          "content_type", 
          "content_chunk", 
          "embedding", 
          "created_at"
        )
        VALUES (
          gen_random_uuid(), 
          ${userId}::uuid, 
          ${contentId}::uuid, 
          ${contentType}, 
          ${chunkText}, 
          ${vectorString}::vector, 
          now()
        )
      `;
    });

    // 4. Delete old embeddings and save new ones in a transaction
    await prisma.$transaction([
        // Delete any existing chunks for this content
        prisma.content_embeddings.deleteMany({
            where: {
                content_id: contentId,
                user_id: userId
            }
        }),
        // Execute individual raw inserts
        ...insertOperations
    ]);

    console.log(`Successfully generated and saved ${allEmbeddings.length} embeddings for ${contentType} ${contentId}.`);

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
        // FIX: Added role: 'user' here as well for consistency
        content: { role: 'user', parts: [{ text }] },
        // FIX: Use Enum instead of string literal
        taskType: TaskType.RETRIEVAL_QUERY
    });
    
    return result.embedding.values;
}