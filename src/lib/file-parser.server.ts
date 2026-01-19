// src/lib/file-parser.server.ts
// ✅ REFACTOR: Using pdfjs-dist directly for better stability
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'; 
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { DOMParser } from 'xmldom';
import { cleanExtractedText } from '@/lib/file-parser'; 

export const runtime = 'nodejs';

// --- Text Extraction Helpers ---

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Convert Buffer to Uint8Array for pdfjs-dist
  const data = new Uint8Array(buffer);
  
  const loadingTask = getDocument({
    data,
    useSystemFonts: true, // Reduces font errors
    disableFontFace: true, // Disables font loading to prevent "TT: undefined" warnings
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

function getTextFromPPTXNodes(node: Node, tagName: string, namespaceURI: string): string {
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
    const MAX_SLIDES = 500; 

    while (slideIndex <= MAX_SLIDES) {
      const fileName = `ppt/slides/slide${slideIndex}.xml`;
      const slideFile = zip.file(fileName);
      
      if (!slideFile) {
        const nextFile = zip.file(`ppt/slides/slide${slideIndex + 1}.xml`);
        if(!nextFile) break;
        slideIndex++;
        continue;
      }

      const slideXmlStr = await slideFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(slideXmlStr, 'application/xml');

      const slideText = getTextFromPPTXNodes(xmlDoc, 't', aNamespace);
      if (slideText) fullText += slideText + ' \n';
      slideIndex++;
    }
    return fullText.trim();
  } catch (err: any) {
    console.error('Error extracting text from PPTX:', err);
    throw new Error(`Failed to parse PPTX: ${err.message}`);
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
      // Use the new pdfjs-dist helper
      rawText = await extractTextFromPDF(buffer);

    } else if (fileType === 'text/plain' || fileNameLower.endsWith('.txt')) {
      rawText = buffer.toString('utf8');

    } else if (fileType.includes('wordprocessingml') || fileNameLower.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value || '';

    } else if (fileType.includes('presentationml') || fileNameLower.endsWith('.pptx')) {
      rawText = await extractTextFromPPTX(buffer);

    } else {
      throw new Error(`Unsupported file type: ${fileType}. Please upload PDF, DOCX, PPTX, or TXT.`);
    }

    if (!rawText || rawText.trim().length < 50) {
      if ((fileNameLower.endsWith('.pdf') || fileType === 'application/pdf') && rawText.trim().length === 0) {
         throw new Error('No text found. This PDF appears to be a scanned image. Please use OCR.');
      }
      throw new Error('File contains insufficient text for analysis.');
    }
      
    return cleanExtractedText(rawText);

  } catch (error: any) {
    console.error("Extraction Logic Error:", error);
    throw new Error(error.message || `Text extraction failed`);
  }
}

export const extractTextFromFile = extractTextFromServerFile;