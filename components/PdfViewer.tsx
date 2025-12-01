'use client';

import * as React from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

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

// --- 1. Sub-Component: Individual Page (Preserved from your original) ---
function PdfPage({ doc, pageNum, width, onTextSelect }: PdfPageProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const textLayerRef = React.useRef<HTMLDivElement>(null);
  const [page, setPage] = React.useState<pdfjs.PDFPageProxy | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    doc.getPage(pageNum).then((p) => {
      if (isMounted) setPage(p);
    }).catch(console.error);
    return () => { isMounted = false; };
  }, [doc, pageNum]);

  React.useEffect(() => {
    if (!page || !canvasRef.current || !textLayerRef.current || width === 0) return;

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
      if (renderTask) renderTask.cancel();
    };
  }, [page, width]);

  if (!page) return <div className="w-full aspect-[1/1.4] bg-muted/20 animate-pulse rounded-md mb-4" />;

  const aspectRatio = page.view[3] / page.view[2];
  
  return (
    <div
      className="relative shadow-md mb-4 bg-white"
      style={{ width: width, minHeight: width * aspectRatio }}
    >
      <canvas ref={canvasRef} className="block" />
      <div 
        ref={textLayerRef} 
        className="textLayer absolute inset-0 mix-blend-multiply" 
        onMouseUpCapture={onTextSelect} 
      />
    </div>
  );
}

// --- 2. Main Component (Added Chunking Logic) ---
const PAGES_PER_CHUNK = 20;

export function PdfViewer({ url, onTextSelect, className }: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = React.useState<pdfjs.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // Chunk State
  const [currentChunk, setCurrentChunk] = React.useState<number>(0);

  // Responsive width
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState<number>(0);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

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

  React.useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      setCurrentChunk(0); // Reset chunk on new URL
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

  // --- Chunk Navigation Helpers ---
  const numPages = pdfDoc ? pdfDoc.numPages : 0;
  const startPage = currentChunk * PAGES_PER_CHUNK + 1;
  const endPage = Math.min(startPage + PAGES_PER_CHUNK - 1, numPages);

  const pagesToRender = React.useMemo(() => {
    if (!pdfDoc) return [];
    // Create array [startPage ... endPage]
    return Array.from(
      { length: (endPage - startPage) + 1 }, 
      (_, i) => startPage + i
    );
  }, [startPage, endPage, pdfDoc]);

  const scrollToTop = () => {
    // Attempt to scroll the ScrollArea viewport to top
    const viewport = containerRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTo({ top: 0 });
  };

  const handlePrev = () => {
    setCurrentChunk((prev) => Math.max(0, prev - 1));
    scrollToTop();
  };

  const handleNext = () => {
    const maxChunk = Math.ceil(numPages / PAGES_PER_CHUNK) - 1;
    setCurrentChunk((prev) => Math.min(maxChunk, prev + 1));
    scrollToTop();
  };

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
                    Unable to load this document. <br/>
                    <span className="text-xs opacity-70 mt-2 block">{error}</span>
                </AlertDescription>
            </Alert>
        </div>
    );
  }

  return (
    <div className={cn("h-full w-full bg-zinc-100 dark:bg-zinc-900/50 flex flex-col relative", className)}>
        
        {/* Navigation Header (Sticky) */}
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-800 border-b z-10 shadow-sm shrink-0">
           <span className="text-sm font-medium text-muted-foreground">
             Pages {startPage} - {endPage} of {numPages}
           </span>
           <div className="flex gap-2">
             <Button variant="outline" size="sm" onClick={handlePrev} disabled={currentChunk === 0}>
               <ChevronLeft className="h-4 w-4" />
             </Button>
             <Button variant="outline" size="sm" onClick={handleNext} disabled={endPage >= numPages}>
               <ChevronRight className="h-4 w-4" />
             </Button>
           </div>
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 w-full" ref={containerRef}>
            <div className="flex flex-col items-center py-8 px-4 min-h-full">
                {containerWidth > 0 && pagesToRender.map((pageNum) => (
                    <PdfPage 
                        key={pageNum} 
                        doc={pdfDoc!} 
                        pageNum={pageNum} 
                        width={containerWidth} 
                        onTextSelect={onTextSelect} 
                    />
                ))}
                
                {/* Bottom Navigation for convenience */}
                <div className="flex gap-4 mt-8 pb-8">
                    <Button variant="outline" onClick={handlePrev} disabled={currentChunk === 0}>
                        Previous 20 Pages
                    </Button>
                    <Button variant="default" onClick={handleNext} disabled={endPage >= numPages}>
                        Next 20 Pages
                    </Button>
                </div>
            </div>
        </ScrollArea>
    </div>
  );
}