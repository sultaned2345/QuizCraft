/* sultanedfdes/quizcraft/QuizCraft-299c50df67d8e1c14520128a0d0d8414fbf33d1b/src/lib/file-parser.ts */
// Client-side file parser utilities
// PDF parsing is now handled server-side via API route

export async function extractPdfText(file: File): Promise<string> {
  try {
    // Create FormData to send file to API
    const formData = new FormData();
    formData.append('file', file);

    // Call the server-side PDF parsing API
    const response = await fetch('/api/parse-pdf', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to parse PDF file');
    }

    return result.text;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
    throw new Error('PDF parsing failed due to unknown error');
  }
}

export function cleanExtractedText(input: string): string {
  if (!input) return "";
  
  // Step 1: Remove non-printable characters except common whitespace
  const withoutControl = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ");
  
  // Step 2: Normalize unicode spaces and special characters
  const normalized = withoutControl
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ") // Unicode spaces
    .replace(/[\u2018\u2019]/g, "'") // Smart quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/[\u2013\u2014]/g, "-") // En/em dashes
    .replace(/[\u2026]/g, "...") // Ellipsis
    .replace(/[\u00B7]/g, " "); // Middle dot
  
  // Step 3: Collapse multiple whitespace characters
  const collapsedWhitespace = normalized.replace(/\s+/g, " ");
  
  // Step 4: Remove excessive line breaks and normalize paragraphs
  const normalizedParagraphs = collapsedWhitespace
    .replace(/\n\s*\n\s*\n+/g, "\n\n") // Max 2 consecutive line breaks
    .replace(/^\s+|\s+$/g, ""); // Trim start and end
  
  // Step 5: Final cleanup - ensure minimum content quality
  const finalText = normalizedParagraphs.trim();
  
  // Validate minimum content length
  if (finalText.length < 10) {
    throw new Error("Extracted text is too short to be meaningful");
  }
  
  return finalText;
}

// Additional utility functions for file processing
export function validateFileType(fileName: string, mimeType?: string): boolean {
  const nameLower = fileName.toLowerCase();
  const validExtensions = ['.pdf', '.txt'];
  const validMimeTypes = ['application/pdf', 'text/plain'];
  
  const hasValidExtension = validExtensions.some(ext => nameLower.endsWith(ext));
  const hasValidMimeType = !mimeType || validMimeTypes.includes(mimeType);
  
  return hasValidExtension && hasValidMimeType;
}

export function formatFileSize(bytes: number | bigint): string {
  // --- FIX IS HERE ---
  // Convert bigint or number to a number for Math operations
  const bytesAsNumber = Number(bytes);
  
  if (bytesAsNumber === 0) return '0 Bytes';
  // --- END OF FIX ---
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  // Use the converted number
  const i = Math.floor(Math.log(bytesAsNumber) / Math.log(k)); 
  
  // Use the converted number
  return parseFloat((bytesAsNumber / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function estimateProcessingTime(fileSize: number, fileType: string): number {
  // Rough estimation in seconds
  const baseTime = fileType === 'application/pdf' ? 2 : 0.5; // PDF takes longer
  const sizeFactor = Math.log(fileSize / 1024) / Math.log(1024); // Logarithmic scaling
  return Math.max(baseTime, baseTime + sizeFactor);
}