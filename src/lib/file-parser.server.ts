// src/lib/file-parser.server.ts
import pdfParse from 'pdf-parse-fork';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { DOMParser } from 'xmldom';
import { cleanExtractedText } from '@/lib/file-parser'; 

export const runtime = 'nodejs';

// --- Text Extraction Helpers ---

function getTextFromPPTXNodes(
  node: Node,
  tagName: string,
  namespaceURI: string
): string {
  let text = '';
  const textNodes = (node as Element).getElementsByTagNameNS(namespaceURI, tagName);
  for (let i = 0; i < textNodes.length; i++) {
    if (textNodes[i].textContent) {
      text += textNodes[i].textContent + ' ';
    }
  }
  return text.trim();
}

async function extractTextFromPPTX(buffer: Buffer): Promise<string> {
  try {
    const zip = new JSZip();
    await zip.loadAsync(buffer);
    const aNamespace = 'http://schemas.openxmlformats.org/drawingml/2006/main';
    let fullText = '';
    let slideIndex = 1;
    
    // Safety break to prevent infinite loops on corrupted files
    const MAX_SLIDES = 500; 

    while (slideIndex <= MAX_SLIDES) {
      const fileName = `ppt/slides/slide${slideIndex}.xml`;
      const slideFile = zip.file(fileName);
      
      if (!slideFile) {
        // Check if we skipped a number or if we are truly done.
        // Some PPTX might skip numbers, but usually sequential. 
        // Try one more ahead just in case, otherwise break.
        const nextFile = zip.file(`ppt/slides/slide${slideIndex + 1}.xml`);
        if(!nextFile) break;
        slideIndex++;
        continue;
      }

      const slideXmlStr = await slideFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(slideXmlStr, 'application/xml');

      const slideText = getTextFromPPTXNodes(xmlDoc, 't', aNamespace);
      if (slideText) {
          fullText += slideText + ' \n';
      }
      slideIndex++;
    }
    return fullText.trim();
  } catch (err: any) {
    console.error('Error extracting text from PPTX:', err);
    throw new Error(`Failed to parse PPTX file: ${err.message || 'Unknown error'}`);
  }
}

/**
 * Extracts text from various file types using server-side libraries.
 */
export async function extractTextFromServerFile(
  file: File,
  buffer: Buffer
): Promise<string> {
  let rawText = '';
  const fileType = file.type || '';
  const fileNameLower = file.name.toLowerCase();

  try {
    if (fileType === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
      // Wrap pdf-parse in a promise with timeout to prevent server hanging
      const pdfPromise = pdfParse(buffer);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("PDF parsing timed out")), 10000)
      );

      const result: any = await Promise.race([pdfPromise, timeoutPromise]);
      rawText = result.text || '';

    } else if (fileType === 'text/plain' || fileNameLower.endsWith('.txt')) {
      rawText = buffer.toString('utf8');

    } else if (
      fileType.includes('wordprocessingml') || 
      fileNameLower.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value || '';

    } else if (
      fileType.includes('presentationml') || 
      fileNameLower.endsWith('.pptx')
    ) {
      rawText = await extractTextFromPPTX(buffer);

    } else {
      throw new Error(
        `Unsupported file type: ${fileType}. Please upload PDF, DOCX, PPTX, or TXT.`
      );
    }

    // CLEANUP & VALIDATION
    if (!rawText || rawText.trim().length < 50) {
      // Specific error for "Scanned" PDFs
      if (fileNameLower.endsWith('.pdf') && rawText.trim().length === 0) {
         throw new Error('No text found. This PDF appears to be a scanned image. Please use a text-based PDF.');
      }
      throw new Error('File contains insufficient text for analysis.');
    }
      
    return cleanExtractedText(rawText);

  } catch (error: any) {
    // Preserve specific error messages
    throw new Error(error.message || `Text extraction failed`);
  }
}