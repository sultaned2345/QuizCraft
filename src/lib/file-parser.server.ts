// src/lib/file-parser.server.ts
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { DOMParser } from 'xmldom';
import pdfParse from 'pdf-parse-fork';

// Helper to clean text (inline if @/lib/file-parser is missing, otherwise keep import)
function cleanExtractedText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const runtime = 'nodejs';

/**
 * Helper: Extract text from PDF Buffer
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err: any) {
    console.error("PDF Parsing Error Details:", err);
    throw new Error(`Failed to parse PDF. If this file is encrypted or scanned, it cannot be read. Error: ${err.message}`);
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
    // Safety break to prevent infinite loops on corrupt files
    const MAX_SLIDES = 200; 

    while (slideIndex <= MAX_SLIDES) {
      // Try multiple slide naming conventions
      const possibleNames = [
        `ppt/slides/slide${slideIndex}.xml`,
        `ppt/slides/slide${slideIndex}.xml.rels` // sometimes needed to verify existence
      ];
      
      const slideFile = zip.file(`ppt/slides/slide${slideIndex}.xml`);
      
      if (!slideFile) {
        // If we miss slide 1, it's an error. If we miss slide 10, maybe end of deck.
        if (slideIndex === 1) { 
           // Check if it's a template or different structure? 
           break; 
        }
        break;
      }

      const slideXmlStr = await slideFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(slideXmlStr, 'application/xml');

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
      if (result.messages && result.messages.length > 0) {
        console.warn("Mammoth messages:", result.messages);
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
      // Lowered threshold to 20 to allow small test files
      if (fileNameLower.endsWith('.pdf')) {
         throw new Error('No text found. This PDF appears to be a scanned image or empty. Please use OCR.');
      }
      throw new Error('File content is empty or unreadable.');
    }
      
    return cleanText;

  } catch (error: any) {
    console.error(`[FileParser] Failed to process ${file.name}:`, error);
    throw error;
  }
}