// src/lib/file-parser.server.ts
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { DOMParser } from 'xmldom';
import pdfParse from 'pdf-parse-fork';

export const runtime = 'nodejs';

/**
 * Helper: Clean up text artifacts (null bytes, weird spacing)
 */
function cleanExtractedText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ') // Remove control characters
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ') // Standardize spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Helper: Extract text from PDF Buffer
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err: any) {
    console.error("PDF Parsing Error:", err);
    throw new Error(`Failed to parse PDF: ${err.message}. The file might be encrypted, corrupted, or scanned.`);
  }
}

/**
 * Helper: Extract text from PPTX Buffer
 */
async function extractTextFromPPTX(buffer: Buffer): Promise<string> {
  try {
    const zip = new JSZip();
    await zip.loadAsync(buffer);
    const aNamespace = 'http://schemas.openxmlformats.org/drawingml/2006/main';
    let fullText = '';
    let slideIndex = 1;
    const MAX_SLIDES = 200; // Safety limit

    while (slideIndex <= MAX_SLIDES) {
      // PPTX slides are usually named slide1.xml, slide2.xml, etc.
      const slideFile = zip.file(`ppt/slides/slide${slideIndex}.xml`);
      
      if (!slideFile) {
        // If slide 1 is missing, it's likely not a standard PPTX structure.
        // If later slides are missing, we likely reached the end.
        if (slideIndex === 1) break; 
        break;
      }

      const slideXmlStr = await slideFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(slideXmlStr, 'application/xml');

      // Extract text from <a:t> nodes
      const textNodes = xmlDoc.getElementsByTagNameNS(aNamespace, 't');
      for (let i = 0; i < textNodes.length; i++) {
        if (textNodes[i].textContent) {
          fullText += textNodes[i].textContent + ' ';
        }
      }
      fullText += '\n';
      slideIndex++;
    }
    return fullText.trim();
  } catch (err: any) {
    console.error('PPTX Extraction Error:', err);
    throw new Error(`Failed to parse PPTX: ${err.message}`);
  }
}

/**
 * Main Extraction Function
 */
export async function extractTextFromServerFile(
  file: File,
  buffer: Buffer
): Promise<string> {
  let rawText = '';
  const fileType = file.type || '';
  const fileNameLower = file.name.toLowerCase();

  console.log(`[FileParser] Processing: ${file.name} (${fileType})`);

  try {
    if (fileType === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
      rawText = await extractTextFromPDF(buffer);

    } else if (fileType === 'text/plain' || fileNameLower.endsWith('.txt')) {
      rawText = buffer.toString('utf8');

    } else if (
      fileType.includes('wordprocessingml') || 
      fileNameLower.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      if (result.messages?.length) {
        console.warn("Mammoth warnings:", result.messages);
      }
      rawText = result.value || '';

    } else if (
      fileType.includes('presentationml') || 
      fileNameLower.endsWith('.pptx')
    ) {
      rawText = await extractTextFromPPTX(buffer);

    } else {
      throw new Error(`Unsupported file type: ${fileType}. Please upload PDF, DOCX, PPTX, or TXT.`);
    }

    // Validation
    const cleanText = cleanExtractedText(rawText);
    
    if (!cleanText || cleanText.length < 20) {
      // Specific error for PDFs that are likely scanned images
      if (fileNameLower.endsWith('.pdf')) {
         throw new Error('No text found. This PDF appears to be a scanned image or empty. Please use a file with selectable text.');
      }
      throw new Error('File content is empty or unreadable.');
    }
      
    return cleanText;

  } catch (error: any) {
    console.error(`[FileParser] Failed to process ${file.name}:`, error);
    throw error;
  }
}