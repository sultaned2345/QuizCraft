// components/PdfViewer.tsx
'use client';

import * as React from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';

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
        setPageNum(1); // Reset to page 1 on new doc
      } catch (e: any) {
        console.error("PDF Load Error:", e);
        setError(e.message || "Failed to load PDF");
      } finally {
        setIsLoading(false);
      }
    };
    if (url) loadPdf();
  }, [url]);

  // 2. Render Page (Whenever pageNum, pdfDoc, or scale changes)
  React.useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    const renderPage = async () => {
      try {
        // Cancel previous render if active
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(pageNum);
        
        // Auto-calculate scale to fit container width if scale is 1.0 (default)
        // Otherwise use manual zoom level
        let viewport = page.getViewport({ scale: 1 });
        let currentScale = scale;
        
        if (scale === 1.0) {
            const containerWidth = containerRef.current?.clientWidth || 800;
            // Subtract padding
            const availableWidth = containerWidth - 48; 
            currentScale = availableWidth / viewport.width;
        }

        viewport = page.getViewport({ scale: currentScale });

        const canvas = canvasRef.current;
        const context = canvas!.getContext('2d');
        if (!context) return;

        canvas!.height = viewport.height;
        canvas!.width = viewport.width;

        // Render Canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        
        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        // Render Text Layer
        if (textLayerRef.current) {
            const textContent = await page.getTextContent();
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
  }, [pdfDoc, pageNum, scale]);

  // Navigation Handlers
  const changePage = (offset: number) => {
    if (!pdfDoc) return;
    setPageNum(prev => Math.min(Math.max(prev + offset, 1), pdfDoc.numPages));
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
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b shrink-0">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => changePage(-1)} disabled={pageNum <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1 text-sm font-medium">
                    <span>Page</span>
                    <Input 
                        value={pageNum}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val > 0 && val <= (pdfDoc?.numPages || 0)) setPageNum(val);
                        }}
                        className="w-12 h-8 text-center p-0"
                    />
                    <span className="text-muted-foreground">of {pdfDoc?.numPages}</span>
                </div>
                <Button variant="outline" size="icon" onClick={() => changePage(1)} disabled={pageNum >= (pdfDoc?.numPages || 0)}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleZoom(-0.25)}>
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-12 text-center">
                    {Math.round(scale * 100)}%
                </span>
                <Button variant="ghost" size="icon" onClick={() => handleZoom(0.25)}>
                    <ZoomIn className="h-4 w-4" />
                </Button>
            </div>
        </div>

        {/* Viewer Area */}
        <div className="flex-1 overflow-auto relative flex justify-center p-4" ref={containerRef}>
            <div className="relative shadow-lg bg-white">
                <canvas ref={canvasRef} className="block" />
                <div ref={textLayerRef} className="textLayer absolute inset-0 mix-blend-multiply" onMouseUpCapture={onTextSelect} />
            </div>
        </div>
    </div>
  );
}