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
  // Use a specific version matching package.json to avoid version mismatch errors
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
  width: number; // Changed from scale to width
  onTextSelect: (e: React.MouseEvent) => void;
}

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
        
        // Render text layer
        const textContent = await page.getTextContent();
        if (textLayerRef.current) {
           textLayerRef.current.style.height = `${viewport.height}px`;
           textLayerRef.current.style.width = `${viewport.width}px`;
           textLayerRef.current.innerHTML = '';
           // CSS custom property for text selection color if needed
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

  if (!page) return <div className="w-full aspect-[1/1.4] bg-muted/20 animate-pulse rounded-md mb-4" />;

  // Use calculated height for placeholder to prevent layout shift
  const aspectRatio = page.view[3] / page.view[2];
  
  return (
    <div
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
  
  // Responsive width state
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState<number>(0);

  // 1. Handle Window Resize
  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        // Subtract padding (e.g., 32px for py-8 px-4)
        setContainerWidth(containerRef.current.clientWidth - 48);
      }
    };

    // Initial measure
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
                    Unable to load this document. It might be corrupted or password protected.
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
        {/* We use a ref on this div to measure available width */}
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