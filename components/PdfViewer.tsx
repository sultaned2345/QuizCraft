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

// --- Custom Hook for Visibility (Lazy Rendering) ---
function useInView(options: IntersectionObserverInit = {}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return { ref, isInView };
}

function PdfPage({ doc, pageNum, width, onTextSelect }: PdfPageProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const textLayerRef = React.useRef<HTMLDivElement>(null);
  const [page, setPage] = React.useState<pdfjs.PDFPageProxy | null>(null);

  // Load content when within 200px of viewport
  const { ref, isInView } = useInView({ rootMargin: '200px' });

  // 1. Always fetch the page proxy (lightweight) to get dimensions/rotation
  React.useEffect(() => {
    let isMounted = true;
    doc.getPage(pageNum).then((p) => {
      if (isMounted) setPage(p);
    }).catch(console.error);
    return () => { isMounted = false; };
  }, [doc, pageNum]);

  // 2. Only render the heavy Canvas/Text Layer when "isInView" is true
  React.useEffect(() => {
    if (!page || !isInView || !canvasRef.current || width === 0) return;

    // Calculate scale based on desired width vs original viewport width
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = width / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    let renderTask: any = null;

    const render = async () => {
      try {
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        
        // Render Text Layer (if available)
        const pdfJsAny = pdfjs as any;
        if (typeof pdfJsAny.renderTextLayer === 'function' && textLayerRef.current) {
            const textContent = await page.getTextContent();
            
            // Check ref again before modifying
            if (textLayerRef.current) {
                textLayerRef.current.style.height = `${viewport.height}px`;
                textLayerRef.current.style.width = `${viewport.width}px`;
                textLayerRef.current.innerHTML = '';
                textLayerRef.current.style.setProperty('--pdf-highlight-color', 'rgba(255, 226, 143, 0.5)');

                await pdfJsAny.renderTextLayer({
                    textContentSource: textContent,
                    container: textLayerRef.current,
                    viewport: viewport,
                    textDivs: [],
                }).promise;
            }
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
      // Optional: Clear canvas when scrolling away to save memory
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
  }, [page, width, isInView]);

  // Loading State / Placeholder
  if (!page) return <div className="w-full aspect-[1/1.4] bg-muted/20 animate-pulse rounded-md mb-4" />;

  const aspectRatio = page.view[3] / page.view[2];
  const calculatedHeight = width * aspectRatio;
  
  return (
    <div
      ref={ref}
      className="relative shadow-md mb-4 bg-white"
      style={{ width: width, minHeight: calculatedHeight }}
    >
      {isInView ? (
        <>
          <canvas ref={canvasRef} className="block" />
          <div ref={textLayerRef} className="textLayer absolute inset-0 mix-blend-multiply" onMouseUpCapture={onTextSelect} />
        </>
      ) : (
        // Placeholder to maintain scroll height when off-screen
        <div style={{ height: calculatedHeight, width: '100%' }} />
      )}
    </div>
  );
}

export function PdfViewer({ url, onTextSelect, className }: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = React.useState<pdfjs.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Responsive Width
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState<number>(0);

  // 1. Handle Window Resize
  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 48);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [isLoading]);

  // 2. Load PDF Document (Robust Fix)
  React.useEffect(() => {
    const loadPdf = async () => {
      // Guard: Ensure url is a valid string.
      // This prevents "Invalid parameter" crash if url is null/undefined/object.
      if (!url || typeof url !== 'string') {
        return; 
      }

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

    loadPdf();
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