// components/PdfViewer.tsx
'use client';

import * as React from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Ensure worker is loaded from public folder or CDN
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
}

interface PdfViewerProps {
  url: string;
  onTextSelect?: (e: React.MouseEvent) => void;
  className?: string;
}

export function PdfViewer({ url, onTextSelect, className }: PdfViewerProps) {
  const [numPages, setNumPages] = React.useState<number>(0);
  const [containerWidth, setContainerWidth] = React.useState<number>(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 1. Dynamic Resize Logic
  React.useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  return (
    <div className={cn("h-full w-full bg-gray-100 dark:bg-gray-900 flex flex-col", className)}>
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 md:p-8"
      >
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>Loading PDF...</p>
            </div>
          }
          error={
            <div className="flex items-center justify-center h-64 text-destructive">
              Failed to load PDF. Please check the file.
            </div>
          }
          className="flex flex-col items-center gap-6"
        >
          {Array.from(new Array(numPages), (_, index) => (
            <div 
              key={`page_${index + 1}`} 
              className="shadow-md border rounded-sm overflow-hidden bg-white"
              onMouseUp={onTextSelect}
            >
              <Page 
                pageNumber={index + 1} 
                // 2. Fit width minus padding (48px total padding approx)
                width={containerWidth ? Math.min(containerWidth - 48, 1000) : undefined}
                renderAnnotationLayer={true}
                renderTextLayer={true}
                className="bg-white"
                loading={
                    <div className="w-full aspect-[1/1.4] bg-white animate-pulse" />
                }
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}