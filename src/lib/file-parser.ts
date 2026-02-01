// src/lib/file-parser.ts
// Client-side file parser utilities

/**
 * Extracts text from a file (PDF, TXT, DOCX, PPTX) by calling the server-side API.
 * Routes PDFs to the specialized /api/parse-pdf endpoint and others to /api/parse-file.
 */
export async function extractTextFromFile(
  file: File,
  token: string,
): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    // --- MODIFICATION: Deterministic Routing ---
    // Check if the file is a PDF based on MIME type or extension
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    
    // Route to the appropriate endpoint
    const endpoint = isPdf ? '/api/parse-pdf' : '/api/parse-file';
    // -------------------------------------------

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      if (response.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error(result.error || 'Failed to parse file');
    }

    // Validate response structure (expects { success: true, data: { text: "..." } })
    if (!result.data || typeof result.data.text !== 'string') {
       // Fallback: Check if the API returned text at the root level (legacy support)
       if (result.text && typeof result.text === 'string') {
         return result.text;
       }
       throw new Error("Invalid response format from parsing service");
    }

    return result.data.text;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`File parsing failed: ${error.message}`);
    }
    throw new Error('File parsing failed due to unknown error');
  }
}

/**
 * Cleans extracted text while PRESERVING paragraphs/newlines.
 */
export function cleanExtractedText(input: string): string {
  if (!input) return '';

  // 1. Remove control characters (keep newlines \n, \r and tabs \t)
  let text = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  // 2. Normalize varied line endings (\r\n or \r becomes \n)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Normalize special unicode spaces to standard spaces
  text = text.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
             .replace(/[\u2018\u2019]/g, "'") // Smart quotes
             .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
             .replace(/[\u2013\u2014]/g, '-') // Dashes
             .replace(/[\u2026]/g, '...');    // Ellipsis

  // 4. Collapse multiple horizontal spaces (tabs/spaces) into one, 
  //    BUT ignore newlines so paragraphs aren't merged.
  text = text.replace(/[ \t]+/g, ' ');

  // 5. Fix paragraph breaks:
  //    - Ensure 3+ newlines become 2 (standard paragraph gap)
  //    - Ensure 2 newlines are preserved
  text = text.replace(/\n{3,}/g, '\n\n');

  // 6. Trim start/end whitespace
  const finalText = text.trim();

  // Validate minimum content length (relaxed to 5 chars to allow short valid inputs)
  if (finalText.length < 5) {
    throw new Error('Extracted text is too short to be meaningful');
  }

  return finalText;
}

// Additional utility functions for file processing
export function validateFileType(fileName: string, mimeType?: string): boolean {
  const nameLower = fileName.toLowerCase();
  
  const validExtensions = ['.pdf', '.txt', '.docx', '.pptx'];
  const validMimeTypes = [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];

  const hasValidExtension = validExtensions.some((ext) =>
    nameLower.endsWith(ext)
  );
  const hasValidMimeType = !mimeType || validMimeTypes.includes(mimeType);

  return hasValidExtension || hasValidMimeType; 
}

export function formatFileSize(bytes: number | bigint): string {
  // Convert bigint or number to a number for Math operations
  const bytesAsNumber = Number(bytes);

  if (bytesAsNumber === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytesAsNumber) / Math.log(k));

  return parseFloat((bytesAsNumber / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function estimateProcessingTime(
  fileSize: number,
  fileType: string
): number {
  // Rough estimation in seconds
  const baseTime =
    fileType === 'application/pdf' ||
    fileType.includes('openxmlformats-officedocument')
      ? 3
      : 0.5; // Office docs/PDFs take longer
  const sizeFactor = Math.log(fileSize / 1024) / Math.log(1024); // Logarithmic scaling
  return Math.max(baseTime, baseTime + sizeFactor);
}