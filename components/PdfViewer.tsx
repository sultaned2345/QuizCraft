// components/PdfViewer.tsx
'use client';

import * as React from 'react';
import * as pdfjs from 'pdfjs-dist';
import { cn } from '@/lib/utils';

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
        
        const textContent = await page.getTextContent();
        if (textLayerRef.current) {
           textLayerRef.current.style.height = `${viewport.height}px`;
           textLayerRef.current.style.width = `${viewport.width}px`;
           textLayerRef.current.innerHTML = '';
           // Ensure highlight color matches globals.css
           textLayerRef.current.style.setProperty('--pdf-highlight-color', 'rgba(59, 130, 246, 0.3)');

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

  const aspectRatio = page.view[3] / page.view[2];
  
  return (
    <div
      className="relative shadow-md mb-4 bg-white"
      style={{ width: width, minHeight: width * aspectRatio }}
    >
      <canvas ref={canvasRef} className="block" />
      {/* FIX: Added 'z-10' here. 
          This forces the text layer to sit ON TOP of the canvas so you can select it. 
      */}
      <div 
        ref={textLayerRef} 
        className="textLayer absolute inset-0 z-10 mix-blend-multiply" 
        onMouseUpCapture={onTextSelect} 
      />
    </div>
  );
}

export function PdfViewer({ url, onTextSelect, className }: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = React.useState<pdfjs.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState<number>(0);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        // Subtract padding (e.g., 32px for py-8 px-4)
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
        <div className="flex h-full items-center justify-center text-primary">
            {/* Standard SVG Spinner to avoid Error #130 */}
            <svg className="animate-spin h-8 w-8 mr-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm font-medium">Loading Document...</span>
        </div>
    );
  }

  if (error) {
    return (
        <div className="p-8 flex flex-col items-center justify-center h-full text-destructive">
            <div className="max-w-md border border-destructive/20 bg-destructive/10 p-4 rounded-md text-center">
                <div className="font-semibold mb-2">Unable to load document</div>
                <div className="text-sm opacity-80">{error}</div>
            </div>
        </div>
    );
  }

  const numPages = pdfDoc ? pdfDoc.numPages : 0;
  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div className={cn("h-full w-full bg-zinc-100 dark:bg-zinc-900/50 flex flex-col", className)}>
        {/* Standard div for scrolling (Fixes Error #130) */}
        <div className="flex-1 w-full overflow-y-auto" ref={containerRef}>
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
        </div>
    </div>
  );
}