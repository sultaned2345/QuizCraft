// components/PdfViewer.tsx
'use client';

import * as React from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

// Initialize worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

const CHUNK_SIZE = 30; // Number of slides to show at once

interface PdfViewerProps {
  url: string;
  onTextSelect?: (e: React.MouseEvent) => void;
  className?: string;
}

interface PdfPageProps {
  doc: pdfjs.PDFDocumentProxy;
  pageNum: number;
  width: number;
  scale: number;
  enableText: boolean;
  onTextSelect?: (e: React.MouseEvent) => void;
}

// Individual Page Component (Lazy Loaded for Safety)
function PdfPage({ doc, pageNum, width, scale, enableText, onTextSelect }: PdfPageProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const textLayerRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);
  const [pageHeight, setPageHeight] = React.useState<number>(width * 1.41); // Default A4 ratio

  // 1. Lazy Load: Only render when scrolled into view
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Keep it rendered once loaded
        }
      },
      { rootMargin: '50% 0px' } // Pre-load when within 50% of viewport
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. Render Content
  React.useEffect(() => {
    if (!isVisible || !canvasRef.current || !doc) return;

    let renderTask: any = null;

    const render = async () => {
      try {
        const page = await doc.getPage(pageNum);
        
        // Calculate Viewport
        const unscaledViewport = page.getViewport({ scale: 1 });
        const fitScale = width / unscaledViewport.width;
        const finalScale = fitScale * scale;
        const viewport = page.getViewport({ scale: finalScale });

        setPageHeight(viewport.height);

        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render Canvas
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;

        // Render Text (Optional)
        if (enableText && textLayerRef.current) {
          textLayerRef.current.innerHTML = '';
          textLayerRef.current.style.height = `${viewport.height}px`;
          textLayerRef.current.style.width = `${viewport.width}px`;
          textLayerRef.current.style.setProperty('--pdf-highlight-color', 'rgba(255, 226, 143, 0.5)');

          const textContent = await page.getTextContent();
          pdfjs.renderTextLayer({
            textContentSource: textContent,
            container: textLayerRef.current,
            viewport: viewport,
            textDivs: [],
          });
        }
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') console.error(err);
      }
    };

    render();
    return () => { if (renderTask) renderTask.cancel(); };
  }, [doc, pageNum, width, scale, isVisible, enableText]);

  return (
    <div 
      ref={containerRef}
      className="relative shadow-md bg-white mb-6 transition-all"
      style={{ width, minHeight: pageHeight }}
    >
      {isVisible ? (
        <>
          <canvas ref={canvasRef} className="block" />
          {enableText && (
            <div ref={textLayerRef} className="textLayer absolute inset-0 mix-blend-multiply" onMouseUpCapture={onTextSelect} />
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100">
          <span className="text-xs text-muted-foreground">Loading Page {pageNum}...</span>
        </div>
      )}
    </div>
  );
}

export function PdfViewer({ url, onTextSelect, className }: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = React.useState<pdfjs.PDFDocumentProxy | null>(null);
  const [chunkIndex, setChunkIndex] = React.useState(0); // 0 = pages 1-30, 1 = pages 31-60
  const [scale, setScale] = React.useState(1.0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [enableText, setEnableText] = React.useState(false);
  
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState<number>(0);

  // Measure Container
  React.useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => setContainerWidth(containerRef.current!.clientWidth - 48); // minus padding
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isLoading]);

  // Load PDF
  React.useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      try {
        const loadingTask = pdfjs.getDocument(url);
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setChunkIndex(0);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    if (url) loadPdf();
  }, [url]);

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return <div className="p-4 text-red-500 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>;

  const numPages = pdfDoc ? pdfDoc.numPages : 0;
  const startPage = chunkIndex * CHUNK_SIZE + 1;
  const endPage = Math.min((chunkIndex + 1) * CHUNK_SIZE, numPages);
  
  // Create array of page numbers for current chunk
  const pages = Array.from(
    { length: endPage - startPage + 1 }, 
    (_, i) => startPage + i
  );

  return (
    <div className={cn("h-full w-full bg-zinc-100 dark:bg-zinc-900/50 flex flex-col", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b shrink-0 flex-wrap gap-2">
        
        {/* Pagination Controls */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setChunkIndex(prev => Math.max(0, prev - 1))}
            disabled={chunkIndex === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Prev {CHUNK_SIZE}
          </Button>
          
          <span className="text-xs font-medium whitespace-nowrap min-w-[100px] text-center">
            Pages {startPage} - {endPage} of {numPages}
          </span>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setChunkIndex(prev => prev + 1)}
            disabled={endPage >= numPages}
            className="gap-1"
          >
            Next {CHUNK_SIZE} <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
           <Button 
                size="sm" 
                variant={enableText ? "secondary" : "ghost"} 
                onClick={() => setEnableText(!enableText)}
                className="h-8 text-xs gap-2"
                title="Enable text selection (Uses more memory)"
            >
                <Type className="h-3 w-3" /> {enableText ? "Text On" : "Text Off"}
            </Button>
            <div className="h-4 w-px bg-border mx-1" />
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(0.5, s - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
            <span className="text-xs text-muted-foreground w-8 text-center">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(2.0, s + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <ScrollArea className="flex-1 w-full" ref={containerRef}>
        <div className="flex flex-col items-center py-8 px-4 min-h-full">
            {containerWidth > 0 && pages.map((pageNum) => (
                <PdfPage 
                    key={pageNum}
                    doc={pdfDoc!}
                    pageNum={pageNum}
                    width={containerWidth}
                    scale={scale}
                    enableText={enableText}
                    onTextSelect={onTextSelect}
                />
            ))}
            
            {/* Bottom Navigation for convenience */}
            <div className="flex items-center gap-4 py-8 opacity-50 hover:opacity-100 transition-opacity">
                 <Button 
                    variant="ghost" 
                    onClick={() => setChunkIndex(prev => Math.max(0, prev - 1))}
                    disabled={chunkIndex === 0}
                 >
                    Previous Set
                 </Button>
                 <Button 
                    variant="ghost" 
                    onClick={() => setChunkIndex(prev => prev + 1)}
                    disabled={endPage >= numPages}
                 >
                    Next Set
                 </Button>
            </div>
        </div>
      </ScrollArea>
    </div>
  );
}