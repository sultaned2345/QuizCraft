// components/PdfViewer.tsx
'use client';

import * as React from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// Force usage of the local worker to stop external CDN requests and CORS errors
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

interface PdfViewerProps {
  url: string;
  onTextSelect: (e: React.MouseEvent) => void;
  className?: string;
}

interface PdfPageProps {
  doc: pdfjs.PDFDocumentProxy;
  pageNum: number;
  scale: number;
  onTextSelect: (e: React.MouseEvent) => void;
}

function PdfPage({ doc, pageNum, scale, onTextSelect }: PdfPageProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const textLayerRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [page, setPage] = React.useState<pdfjs.PDFPageProxy | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  // 1. Load page dimensions/metadata immediately
  React.useEffect(() => {
    let isActive = true;
    doc.getPage(pageNum).then((p) => {
      if (isActive) setPage(p);
    }).catch(console.error);
    return () => { isActive = false; };
  }, [doc, pageNum]);

  // 2. Lazy Load: Only trigger render when the element is in the viewport
  React.useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Once rendered, stay rendered
        }
      },
      { rootMargin: '200px' } // Start rendering 200px before it comes into view
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 3. Render Content (Canvas + Text) only if visible
  React.useEffect(() => {
    if (!page || !isVisible || !canvasRef.current || !textLayerRef.current) return;

    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    // High DPI support
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.height = viewport.height * pixelRatio;
    canvas.width = viewport.width * pixelRatio;
    canvas.style.height = `${viewport.height}px`;
    canvas.style.width = `${viewport.width}px`;
    context.scale(pixelRatio, pixelRatio);

    let renderTask: any = null;

    const render = async () => {
      try {
        // Render visual page
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        
        // Render text layer
        const textContent = await page.getTextContent();
        if (textLayerRef.current) {
           textLayerRef.current.style.height = `${viewport.height}px`;
           textLayerRef.current.style.width = `${viewport.width}px`;
           textLayerRef.current.innerHTML = ''; 

           pdfjs.renderTextLayer({
            textContentSource: textContent,
            container: textLayerRef.current,
            viewport: viewport,
            textDivs: [],
           });
        }
      } catch (err: any) {
        // Ignore rendering cancelled errors
        if (err.name !== 'RenderingCancelledException') {
           console.error("Error rendering PDF page:", err);
        }
      }
    };

    render();

    return () => {
      if (renderTask) renderTask.cancel();
    };
  }, [page, scale, isVisible]);

  // SKELETON: If page metadata isn't loaded yet
  if (!page) {
    return (
        <div ref={containerRef} className="w-full aspect-[1/1.4] bg-muted/20 animate-pulse rounded-md mb-8" />
    );
  }

  const viewport = page.getViewport({ scale });
  
  return (
    <div
      ref={containerRef}
      className="relative shadow-lg mb-8 transition-transform origin-top bg-white"
      style={{ width: viewport.width, height: viewport.height }}
    >
      {isVisible ? (
        <>
          <canvas ref={canvasRef} className="rounded-sm block" />
          <div ref={textLayerRef} className="textLayer absolute inset-0" onMouseUpCapture={onTextSelect} />
        </>
      ) : (
        // Placeholder while waiting to scroll into view
        <div className="w-full h-full bg-zinc-100 animate-pulse" />
      )}
    </div>
  );
}

export function PdfViewer({ url, onTextSelect, className }: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = React.useState<pdfjs.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const scale = 1.2; 

  React.useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Ensure worker is set before loading
        if (typeof window !== 'undefined') {
            pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
        }
        
        const loadingTask = pdfjs.getDocument(url);
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
      } catch (e: any) {
        console.error("PDF Load Error:", e);
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    if (url) loadPdf();
  }, [url]);

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <div className="p-4 text-destructive">Error loading PDF: {error}</div>;

  const numPages = pdfDoc ? pdfDoc.numPages : 0;
  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <ScrollArea className={cn("h-full w-full bg-zinc-100 dark:bg-zinc-900/50", className)}>
      <div className="flex flex-col items-center py-8 px-4">
        {pages.map((pageNum) => (
          <PdfPage key={pageNum} doc={pdfDoc!} pageNum={pageNum} scale={scale} onTextSelect={onTextSelect} />
        ))}
      </div>
    </ScrollArea>
  );
}