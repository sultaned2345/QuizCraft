// components/PdfViewer.tsx
'use client';

import * as React from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FixedSizeList as List, ListChildComponentProps, areEqual } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

// Initialize worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

interface PdfViewerProps {
  url: string;
  onTextSelect: (e: React.MouseEvent) => void;
  className?: string;
}

// Data passed to every row
interface RowData {
  pdfDoc: pdfjs.PDFDocumentProxy;
  width: number;
  onTextSelect: (e: React.MouseEvent) => void;
}

// --- The Row Component (One Page) ---
// We use memoization to prevent unnecessary re-renders of pages
const PdfPageRow = React.memo(({ index, style, data }: ListChildComponentProps<RowData>) => {
  const { pdfDoc, width, onTextSelect } = data;
  const pageNum = index + 1; // 0-based index to 1-based page number
  
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const textLayerRef = React.useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (!active) return;

        // Calculate scale to fit width
        const viewportUnscaled = page.getViewport({ scale: 1 });
        const scale = width / viewportUnscaled.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (canvas) {
          const context = canvas.getContext('2d');
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Render PDF to Canvas
            renderTask = page.render({ canvasContext: context, viewport });
            await renderTask.promise;
          }
        }

        if (!active) return;

        // Render Text Layer (for selection)
        const textContent = await page.getTextContent();
        if (textLayerRef.current && active) {
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
          setIsRendered(true);
        }

      } catch (error: any) {
        if (error.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNum}:`, error);
        }
      }
    };

    renderPage();

    return () => {
      active = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNum, width]);

  return (
    <div style={style} className="flex justify-center bg-zinc-100 dark:bg-zinc-900/50 pb-4 px-4">
      <div 
        className={cn("relative bg-white shadow-md transition-opacity duration-200", isRendered ? "opacity-100" : "opacity-50")}
        style={{ width: width, height: style.height as number - 16 }} // Subtract padding-bottom
      >
        {!isRendered && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20">
             <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}
        <canvas ref={canvasRef} className="block" />
        <div ref={textLayerRef} className="textLayer absolute inset-0 mix-blend-multiply" onMouseUpCapture={onTextSelect} />
      </div>
    </div>
  );
}, areEqual);

PdfPageRow.displayName = 'PdfPageRow';


// --- Main Component ---
export function PdfViewer({ url, onTextSelect, className }: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = React.useState<pdfjs.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pageAspectRatio, setPageAspectRatio] = React.useState<number>(1.414); // Default to A4

  // 1. Load Document & Get Metadata
  React.useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loadingTask = pdfjs.getDocument(url);
        const doc = await loadingTask.promise;
        setPdfDoc(doc);

        // Fetch first page to determine dimensions/aspect ratio for the list
        const firstPage = await doc.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });
        // Aspect Ratio = Height / Width
        setPageAspectRatio(viewport.height / viewport.width);

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
      <div className="flex h-full items-center justify-center bg-zinc-100 dark:bg-zinc-900/50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading Document...</span>
      </div>
    );
  }

  if (error || !pdfDoc) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-destructive bg-zinc-100 dark:bg-zinc-900/50">
        <Alert variant="destructive" className="max-w-md bg-white">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Unable to load this document.
            <br />
            <span className="text-xs opacity-70 mt-2 block">{error}</span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={cn("h-full w-full bg-zinc-100 dark:bg-zinc-900/50", className)}>
      <AutoSizer>
        {({ height, width }) => {
          // Calculate content width (subtract padding if needed, here we use full width minus margins inside row)
          // We apply padding inside the row component, so we pass full width here
          const contentWidth = width - 48; // 24px padding on each side roughly
          const itemHeight = contentWidth * pageAspectRatio + 16; // +16 for bottom margin

          return (
            <List
              height={height}
              width={width}
              itemCount={pdfDoc.numPages}
              itemSize={itemHeight}
              itemData={{
                pdfDoc,
                width: contentWidth,
                onTextSelect
              }}
              overscanCount={2} // Render 2 pages above/below view to prevent flicker
            >
              {PdfPageRow}
            </List>
          );
        }}
      </AutoSizer>
    </div>
  );
}