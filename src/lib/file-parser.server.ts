// src/lib/file-parser.server.ts
import pdfParse from 'pdf-parse-fork';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { DOMParser } from 'xmldom';

export const runtime = 'nodejs';

// --- Helper: Clean Text to prevent UI Freezes ---
function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove binary control characters
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .trim();
}

// --- PPTX Extraction Logic ---
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

    // Safety limit: Max 50 slides to prevent server timeout
    while (slideIndex <= 50) {
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
 * Includes a timeout race to prevent server hanging.
 */
export async function extractTextFromServerFile(
  file: File,
  buffer: Buffer
): Promise<string> {
  const fileType = file.type || '';
  const fileNameLower = file.name.toLowerCase();

  // 1. Define the parsing task
  const parseTask = async (): Promise<string> => {
    try {
      if (fileType === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
        const data = await pdfParse(buffer);
        return data.text || '';
      } else if (fileType === 'text/plain' || fileNameLower.endsWith('.txt')) {
        return buffer.toString('utf8');
      } else if (
        fileType ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileNameLower.endsWith('.docx')
      ) {
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
      } else if (
        fileType ===
          'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        fileNameLower.endsWith('.pptx')
      ) {
        return await extractTextFromPPTX(buffer);
      } else {
        throw new Error(
          `Unsupported type: ${fileType || 'unknown'} for file ${file.name}`
        );
      }
    } catch (error: any) {
      throw new Error(`Parsing failed: ${error.message}`);
    }
  };

  // 2. Define the timeout (10 seconds)
  const timeoutTask = new Promise<string>((_, reject) => {
    setTimeout(() => reject(new Error("File parsing timed out (10s limit)")), 10000);
  });

  try {
    // 3. Race them
    const rawText = await Promise.race([parseTask(), timeoutTask]);

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('No text found in file.');
    }

    // 4. Clean and limit text size (max ~50k chars to prevent crash)
    const cleaned = cleanText(rawText);
    return cleaned.slice(0, 50000); 

  } catch (error: any) {
    console.error("File processing error:", error);
    throw new Error(`Text extraction failed: ${error.message}`);
  }
}