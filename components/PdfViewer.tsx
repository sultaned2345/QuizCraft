// components/PdfViewer.tsx
'use client';

import *d React from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils'; // <-- THIS WAS THE FIX (@lib/utils -> @/lib/utils)
import { ScrollArea } from '@/components/ui/scroll-area';

// --- CONFIGURE THE WORKER ---
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

interface PdfViewerProps {
  url: string;
  onTextSelect: (e: React.MouseEvent) => void;
  className?: string;
}

// --- MODIFIED PROPS FOR PdfPage ---
interface PdfPageProps {
  doc: pdfjs.PDFDocumentProxy; // Pass the document
  pageNum: number; // Pass the page number
  scale: number;
  onTextSelect: (e: React.MouseEvent) => void;
}

/**
 * Renders a single page of the PDF.
 * This component now fetches its own page object asynchronously.
 */
function PdfPage({ doc, pageNum, scale, onTextSelect }: PdfPageProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const textLayerRef = React.useRef<HTMLDivElement>(null);
  const [page, setPage] = React.useState<pdfjs.PDFPageProxy | null>(null);

  // Effect 1: Fetch the specific page object from the doc
  React.useEffect(() => {
    doc.getPage(pageNum).then(setPage);
    // When the page is set, the effect below will trigger
  }, [doc, pageNum]);

  // Effect 2: Render the page (canvas + text layer)
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const textLayer = textLayerRef.current;

    // --- GUARD CLAUSE ---
    // Wait until the page is fetched and refs are available
    if (!page || !canvas || !textLayer) return;

    // --- SAFE TO CALL ---
    // 'page' is now guaranteed to be a PDFPageProxy object
    const viewport = page.getViewport({ scale });
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    let renderTask: pdfjs.RenderTask | null = null;
    let textRenderTask: ReturnType<typeof pdfjs.renderTextLayer> | null = null;

    const render = async () => {
      // 1. Render the visual page to the canvas
      renderTask = page.render({ canvasContext: context, viewport });
      await renderTask.promise;

      // 2. Get text content and render the invisible text layer
      const textContent = await page.getTextContent();

      textLayer.style.height = `${viewport.height}px`;
      textLayer.style.width = `${viewport.width}px`;

      textRenderTask = pdfjs.renderTextLayer({
        textContentSource: textContent,
        container: textLayer,
        viewport: viewport,
        textDivs: [],
      });
    };

    render();

    return () => {
      // Cleanup on unmount
      renderTask?.cancel();
      textRenderTask?.cancel();
    };
    // This effect now correctly depends on the 'page' state
  }, [page, scale]);

  // --- GUARD CLAUSE ---
  // Don't render the div structure until the page is fetched.
  // This prevents layout errors.
  if (!page) {
    return null;
  }

  // Get viewport for the container div
  const viewport = page.getViewport({ scale });
  return (
    <div
      className="relative shadow-md"
      style={{
        width: viewport.width,
        height: viewport.height,
      }}
    >
      <canvas ref={canvasRef} />
      {/* --- This is the key: The text layer where selection happens --- */}
      <div
        ref={textLayerRef}
        className="textLayer" // pdf.js uses this class
        onMouseUpCapture={onTextSelect} // Attach our selection handler
      />
    </div>
  );
}

/**
 * Main PDF Viewer component that loads the document
 * and renders a list of <PdfPage> components.
 */
export function PdfViewer({ url, onTextSelect, className }: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] =
    React.useState<pdfjs.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const scale = 1.5; // You can make this dynamic later

  React.useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      setPdfDoc(null);
      setNumPages(0);

      try {
        const loadingTask = pdfjs.getDocument(url);
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (e: any) {
        setError(`Failed to load PDF: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (url) {
      loadPdf();
    }
  }, [url]);

  const pages = React.useMemo(() => {
    if (!pdfDoc) return [];
    // Create an array [1, 2, 3, ..., numPages]
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }, [pdfDoc, numPages]);

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center',
          className,
        )}
      >
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="ml-2">Loading PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center text-destructive',
          className,
        )}
      >
        <p>{error}</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn('h-full bg-muted/50', className)}>
      <div className="flex flex-col items-center p-4 gap-4">
        {/* --- THIS MAPPING IS THE KEY FIX --- */}
        {pages.map((pageNum) => (
          <PdfPage
            key={pageNum}
            doc={pdfDoc!} // Pass the whole doc
            pageNum={pageNum} // Pass the page number
            scale={scale}
            onTextSelect={onTextSelect}
          />
        ))}
      </div>
    </ScrollArea>
  );
}