// components/PdfViewer.tsx
'use client';

import * as React from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Initialize worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

interface PdfViewerProps {
  url: string;
  onTextSelect?: (e: React.MouseEvent) => void;
  className?: string;
}

export function PdfViewer({ url, onTextSelect, className }: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = React.useState<pdfjs.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = React.useState(1);
  const [scale, setScale] = React.useState(1.0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [enableText, setEnableText] = React.useState(false); // Default false for performance

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const textLayerRef = React.useRef<HTMLDivElement>(null);
  const renderTaskRef = React.useRef<any>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 1. Load PDF
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
        setError("Failed to load PDF. " + (e.message || ""));
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
        
        // Auto-fit logic
        let currentScale = scale;
        const viewportRaw = page.getViewport({ scale: 1 });
        if (scale === 1.0) {
            const containerWidth = containerRef.current?.clientWidth || 800;
            currentScale = (containerWidth - 48) / viewportRaw.width;
        }

        const viewport = page.getViewport({ scale: currentScale });
        const canvas = canvasRef.current;
        const context = canvas!.getContext('2d');
        if (!context) return;

        canvas!.height = viewport.height;
        canvas!.width = viewport.width;

        // Render Image (Fast)
        const renderTask = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        // Render Text (Slow - Only if enabled)
        if (textLayerRef.current) {
            textLayerRef.current.innerHTML = '';
            textLayerRef.current.style.height = `${viewport.height}px`;
            textLayerRef.current.style.width = `${viewport.width}px`;
            
            if (enableText) {
                const textContent = await page.getTextContent();
                pdfjs.renderTextLayer({
                    textContentSource: textContent,
                    container: textLayerRef.current,
                    viewport: viewport,
                    textDivs: []
                });
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
        if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, [pdfDoc, pageNum, scale, enableText]);

  // Navigation
  const changePage = (delta: number) => {
    if (!pdfDoc) return;
    setPageNum(prev => Math.min(Math.max(prev + delta, 1), pdfDoc.numPages));
  };

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  
  if (error) return (
    <div className="flex h-full items-center justify-center p-6 text-red-500">
        <AlertCircle className="h-5 w-5 mr-2" /> {error}
    </div>
  );

  return (
    <div className={cn("h-full w-full bg-zinc-100 dark:bg-zinc-900/50 flex flex-col", className)}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => changePage(-1)} disabled={pageNum <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-mono w-16 text-center">
                    {pageNum} / {pdfDoc?.numPages}
                </span>
                <Button variant="ghost" size="icon" onClick={() => changePage(1)} disabled={pageNum >= (pdfDoc?.numPages || 0)}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex items-center gap-2">
                <Button 
                    size="sm" 
                    variant={enableText ? "secondary" : "outline"} 
                    onClick={() => setEnableText(!enableText)}
                    className="h-8 text-xs gap-2"
                >
                    <Type className="h-3 w-3" /> {enableText ? "Text On" : "Text Off"}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(0.5, s - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(3.0, s + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
            </div>
        </div>

        {/* Viewer */}
        <div className="flex-1 overflow-auto p-4 flex justify-center" ref={containerRef}>
            <div className="relative shadow-xl bg-white self-start">
                <canvas ref={canvasRef} className="block" />
                <div ref={textLayerRef} className="absolute inset-0 mix-blend-multiply textLayer" onMouseUpCapture={onTextSelect} />
            </div>
        </div>
    </div>
  );
}