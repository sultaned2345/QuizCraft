// components/PdfViewer.tsx
'use client';

import * as React from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Initialize worker
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
  width: number;
  onTextSelect: (e: React.MouseEvent) => void;
}

function PdfPage({ doc, pageNum, width, onTextSelect }: PdfPageProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const textLayerRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  const [page, setPage] = React.useState<pdfjs.PDFPageProxy | null>(null);
  const [isInView, setIsInView] = React.useState(false);
  const [aspectRatio, setAspectRatio] = React.useState<number>(1.4); // Default aspect ratio

  // 1. Lazy Load: Only fetch/render when the element is near the viewport
  React.useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect(); // Once loaded, stay loaded
        }
      },
      { rootMargin: '200px' } // Load 200px before it comes into view
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. Fetch Page Data (only if in view)
  React.useEffect(() => {
    if (!isInView) return;

    let isMounted = true;
    doc.getPage(pageNum).then((p) => {
      if (isMounted) {
        setPage(p);
        // Calculate aspect ratio immediately to set correct height
        const view = p.view;
        setAspectRatio(view[3] / view[2]);
      }
    }).catch(console.error);
    return () => { isMounted = false; };
  }, [doc, pageNum, isInView]);

  // 3. Render Canvas & Text (only if page data exists and width is set)
  React.useEffect(() => {
    if (!page || !canvasRef.current || !textLayerRef.current || width === 0) return;

    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = width / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Set dimensions to avoid blurry canvas on high-DPI screens
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = Math.floor(viewport.width) + "px";
    canvas.style.height = Math.floor(viewport.height) + "px";

    const transform = outputScale !== 1 
      ? [outputScale, 0, 0, outputScale, 0, 0] 
      : null;

    let renderTask: any = null;

    const render = async () => {
      try {
        renderTask = page.render({ 
            canvasContext: context, 
            viewport,
            transform: transform as any
        });
        await renderTask.promise;
        
        // Render text layer
        const textContent = await page.getTextContent();
        if (textLayerRef.current) {
           textLayerRef.current.style.height = `${viewport.height}px`;
           textLayerRef.current.style.width = `${viewport.width}px`;
           textLayerRef.current.innerHTML = '';
           textLayerRef.current.style.setProperty('--pdf-highlight-color', 'rgba(255, 226, 143, 0.5)');

           pdfjs.renderTextLayer({
            textContentSource: textContent,
            container: textLayerRef.current,
            viewport: viewport,
            textDivs: [],
           });
        }
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
            console.error("Error rendering PDF page:", err);
        }
      }
    };

    render();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [page, width]);

  // Placeholder while out of view or loading
  if (!isInView || !page) {
    return (
      <div 
        ref={containerRef}
        className="w-full bg-muted/20 animate-pulse rounded-md mb-4 shadow-sm"
        style={{ height: width * aspectRatio || 500 }} // Approximate height to preserve scrollbar
      >
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Page {pageNum}
        </div>
      </div>
    );
  }
  
  return (
    <div
      ref={containerRef}
      className="relative shadow-md mb-4 bg-white"
      style={{ width: width, minHeight: width * aspectRatio }}
    >
      <canvas ref={canvasRef} className="block" />
      <div ref={textLayerRef} className="textLayer absolute inset-0 mix-blend-multiply" onMouseUpCapture={onTextSelect} />
    </div>
  );
}

export function PdfViewer({ url, onTextSelect, className }: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = React.useState<pdfjs.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState<number>(0);

  // 1. Handle Window Resize
  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 48); // Padding adjustment
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [isLoading]);

  // 2. Load PDF Document
  React.useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loadingTask = pdfjs.getDocument(url);
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
      } catch (e: any) {
        console.error("PDF Load Error:", e);
        setError(e.message || "Failed to load PDF");
      } finally {
        setIsLoading(false);
      }
    };
    if (url) loadPdf();
  }, [url]);

  if (isLoading) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading Document...</span>
        </div>
    );
  }

  if (error) {
    return (
        <div className="p-8 flex flex-col items-center justify-center h-full text-destructive">
            <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    Unable to load this document.
                    <br/>
                    <span className="text-xs opacity-70 mt-2 block">{error}</span>
                </AlertDescription>
            </Alert>
        </div>
    );
  }

  const numPages = pdfDoc ? pdfDoc.numPages : 0;
  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div className={cn("h-full w-full bg-zinc-100 dark:bg-zinc-900/50 flex flex-col", className)}>
        <ScrollArea className="flex-1 w-full" ref={containerRef}>
            <div className="flex flex-col items-center py-8 px-4 min-h-full">
                {containerWidth > 0 && pages.map((pageNum) => (
                <PdfPage 
                    key={pageNum} 
                    doc={pdfDoc!} 
                    pageNum={pageNum} 
                    width={containerWidth} 
                    onTextSelect={onTextSelect} 
                />
                ))}
            </div>
        </ScrollArea>
    </div>
  );
}