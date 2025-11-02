// src/lib/file-parser.server.ts
import pdfParse from 'pdf-parse-fork';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { DOMParser } from 'xmldom';
import { cleanExtractedText } from '@/lib/file-parser'; // Assuming this is server-safe

export const runtime = 'nodejs';

// --- Text Extraction Helpers (Moved from api/documents/route.ts) ---

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

    while (true) {
      const slideFile = zip.file(`ppt/slides/slide${slideIndex}.xml`);
      if (!slideFile) break;

      const slideXmlStr = await slideFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(slideXmlStr, 'application/xml');

      fullText += getTextFromPPTXNodes(xmlDoc, 't', aNamespace) + ' \n';
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
      rawText = (await pdfParse(buffer)).text || '';
    } else if (fileType === 'text/plain' || fileNameLower.endsWith('.txt')) {
      rawText = buffer.toString('utf8');
    } else if (
      fileType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileNameLower.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value || '';
    } else if (
      fileType ===
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      fileNameLower.endsWith('.pptx')
    ) {
      rawText = await extractTextFromPPTX(buffer);
    } else {
      throw new Error(
        `Unsupported type: ${fileType || 'unknown'} for file ${file.name}`
      );
    }

    if (!rawText || rawText.trim().length === 0)
      throw new Error('No text found in file.');
      
    // Use the client-safe cleanExtractedText function
    return cleanExtractedText(rawText);
  } catch (error: any) {
    throw new Error(`Text extraction failed: ${error.message}`);
  }
}