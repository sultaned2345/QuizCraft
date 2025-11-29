// components/PdfViewer.tsx
'use client';

import * as React from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

// Initialize worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

interface PdfViewerProps {
  url: string;
  onTextSelect: (e: React.MouseEvent) => void;
  className?: string;
}

export function PdfViewer({ url, onTextSelect, className }: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = React.useState<pdfjs.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = React.useState(1);
  const [scale, setScale] = React.useState(1.0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  // New: Toggle text layer to prevent DOM overload
  const [enableTextLayer, setEnableTextLayer] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const textLayerRef = React.useRef<HTMLDivElement>(null);
  const renderTaskRef = React.useRef<any>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 1. Load Document
  React.useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loadingTask = pdfjs.getDocument(url);
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setPageNum(1);
      } catch (e: any) {
        console.error("PDF Load Error:", e);
        setError(e.message || "Failed to load PDF");
      } finally {
        setIsLoading(false);
      }
    };
    if (url) loadPdf();
  }, [url]);

  // 2. Render Page
  React.useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(pageNum);
        
        // Auto-fit width if scale is 1.0
        let viewport = page.getViewport({ scale: 1 });
        let currentScale = scale;
        
        if (scale === 1.0) {
            const containerWidth = containerRef.current?.clientWidth || 800;
            const availableWidth = containerWidth - 48; 
            currentScale = availableWidth / viewport.width;
        }

        viewport = page.getViewport({ scale: currentScale });

        const canvas = canvasRef.current;
        const context = canvas!.getContext('2d');
        if (!context) return;

        canvas!.height = viewport.height;
        canvas!.width = viewport.width;

        // Render Canvas (The visual part)
        const renderTask = page.render({
          canvasContext: context,
          viewport: viewport,
        });
        
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        // Render Text Layer (The heavy DOM part) - Only if enabled
        if (textLayerRef.current) {
           textLayerRef.current.innerHTML = ''; // Clear previous
           if (enableTextLayer) {
              const textContent = await page.getTextContent();
              textLayerRef.current.style.height = `${viewport.height}px`;
              textLayerRef.current.style.width = `${viewport.width}px`;
              textLayerRef.current.style.setProperty('--pdf-highlight-color', 'rgba(255, 226, 143, 0.5)');

              await pdfjs.renderTextLayer({
                  textContentSource: textContent,
                  container: textLayerRef.current,
                  viewport: viewport,
                  textDivs: [],
              }).promise;
           }
        }

      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
            console.error("Render Error:", err);
        }
      }
    };

    renderPage();

    return () => {
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
        }
    };
  }, [pdfDoc, pageNum, scale, enableTextLayer]);

  // Navigation Handlers
  const changePage = (offset: number) => {
    if (!pdfDoc) return;
    const newPage = Math.min(Math.max(pageNum + offset, 1), pdfDoc.numPages);
    setPageNum(newPage);
  };

  const handleZoom = (delta: number) => {
    setScale(prev => Math.max(0.5, Math.min(prev + delta, 3.0)));
  };

  if (isLoading) {
    return (
        <div className="flex h-full items-center justify-center flex-col gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading PDF...</span>
        </div>
    );
  }

  if (error) {
    return (
        <div className="p-8 flex items-center justify-center h-full">
            <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        </div>
    );
  }

  return (
    <div className={cn("h-full w-full bg-zinc-100 dark:bg-zinc-900/50 flex flex-col", className)}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => changePage(-1)} disabled={pageNum <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium whitespace-nowrap">
                    Page {pageNum} / {pdfDoc?.numPages}
                </span>
                <Button variant="outline" size="icon" onClick={() => changePage(1)} disabled={pageNum >= (pdfDoc?.numPages || 0)}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex items-center gap-2">
               <Button 
                 variant={enableTextLayer ? "secondary" : "ghost"} 
                 size="sm" 
                 onClick={() => setEnableTextLayer(!enableTextLayer)}
                 className="hidden sm:flex gap-2"
                 title="Toggle Text Selection (High Memory)"
               >
                 <Type className="h-4 w-4" />
                 <span className="text-xs">{enableTextLayer ? 'Text On' : 'Text Off'}</span>
               </Button>

                <Button variant="ghost" size="icon" onClick={() => handleZoom(-0.25)}>
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-8 text-center">
                    {Math.round(scale * 100)}%
                </span>
                <Button variant="ghost" size="icon" onClick={() => handleZoom(0.25)}>
                    <ZoomIn className="h-4 w-4" />
                </Button>
            </div>
        </div>

        {/* Viewer Area */}
        <div className="flex-1 overflow-auto relative flex justify-center p-4" ref={containerRef}>
            <div className="relative shadow-lg bg-white" style={{ alignSelf: 'flex-start' }}>
                <canvas ref={canvasRef} className="block" />
                {/* Text Layer Container */}
                <div 
                  ref={textLayerRef} 
                  className={cn(
                    "textLayer absolute inset-0 mix-blend-multiply",
                    !enableTextLayer && "pointer-events-none"
                  )} 
                  onMouseUpCapture={enableTextLayer ? onTextSelect : undefined} 
                />
            </div>
        </div>
    </div>
  );
}