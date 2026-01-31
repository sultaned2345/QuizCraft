// src/components/PdfViewer.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  MessageSquarePlus, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';

// CSS imports are required for react-pdf to render text layers correctly
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// --- Worker Configuration ---
// [FIX] Use dynamic CDN to match the exact version of pdfjs-dist running in the bundle.
// This prevents "Version Mismatch" errors (e.g., API v5.x vs Worker v4.x).
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  documentId?: string | null;
  url?: string | null;
  onAskAI?: (text: string) => void;
}

export function PdfViewer({ documentId, url, onAskAI }: PdfViewerProps) {
  // --- State ---
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [loadError, setLoadError] = useState<Error | null>(null);
  
  // Selection State for "Highlight to Ask"
  const [selection, setSelection] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  // --- Layout & Sizing ---
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useContainerWidth(containerRef);

  // Determine the source URL
  // We append mode=binary to ensure our API returns the raw PDF stream
  const fileUrl = url || (documentId ? `/api/documents/${documentId}/content?mode=binary` : null);

  // --- Handlers ---
  
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setLoadError(null);
  }

  function onDocumentLoadError(error: Error) {
    console.error('[PdfViewer] Load Error:', error);
    setLoadError(error);
  }

  // Handle Text Selection
  useEffect(() => {
    const handleSelection = () => {
      const activeSelection = window.getSelection();
      
      if (!activeSelection || activeSelection.isCollapsed) {
        setSelection(null);
        return;
      }

      const text = activeSelection.toString().trim();
      if (!text || text.length < 3) return; // Ignore accidental small clicks

      // Ensure the selection happened INSIDE our PDF container
      if (
        containerRef.current && 
        containerRef.current.contains(activeSelection.anchorNode?.parentElement || null)
      ) {
         const range = activeSelection.getRangeAt(0);
         const rect = range.getBoundingClientRect();
         
         // Position logic: Center horizontally over selection, slightly above
         setSelection({
           text,
           x: rect.left + (rect.width / 2),
           y: rect.top - 10 
         });
      } else {
        setSelection(null);
      }
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, []);

  // Controls
  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const rotate = () => setRotation(prev => (prev + 90) % 360);

  // --- Render ---

  // High-DPI Scaling Logic:
  const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

  return (
    <div className="flex flex-col h-full bg-muted/20 relative w-full" ref={containerRef}>
      
      {/* 1. Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-background/95 backdrop-blur z-20 shadow-sm sticky top-0">
        <div className="flex items-center gap-2">
           <Button 
             variant="ghost" 
             size="sm" 
             onClick={() => setPageNumber(p => Math.max(p - 1, 1))} 
             disabled={pageNumber <= 1}
           >
             <ChevronLeft className="w-4 h-4" />
           </Button>
           
           <span className="text-sm font-medium w-20 text-center font-mono">
             {pageNumber} / {numPages || '--'}
           </span>
           
           <Button 
             variant="ghost" 
             size="sm" 
             onClick={() => setPageNumber(p => Math.min(p + 1, numPages))} 
             disabled={pageNumber >= numPages}
           >
             <ChevronRight className="w-4 h-4" />
           </Button>
        </div>

        <div className="flex items-center gap-1">
           <Button variant="ghost" size="icon" onClick={zoomOut} title="Zoom Out">
             <ZoomOut className="w-4 h-4" />
           </Button>
           <span className="text-xs w-10 text-center text-muted-foreground tabular-nums">
             {Math.round(scale * 100)}%
           </span>
           <Button variant="ghost" size="icon" onClick={zoomIn} title="Zoom In">
             <ZoomIn className="w-4 h-4" />
           </Button>
           <div className="w-px h-4 bg-border mx-1" />
           <Button variant="ghost" size="icon" onClick={rotate} title="Rotate">
             <RotateCw className="w-4 h-4" />
           </Button>
        </div>
      </div>

      {/* 2. PDF Content Area */}
      <div className="flex-1 overflow-auto flex justify-center p-4 md:p-8 relative">
        {fileUrl ? (
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center gap-2 mt-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading Document...</p>
              </div>
            }
            error={
               <div className="mt-20 flex flex-col items-center text-destructive max-w-sm text-center gap-2 p-4">
                 <AlertCircle className="w-8 h-8" />
                 <p className="font-medium">Failed to load PDF</p>
                 <p className="text-xs text-muted-foreground">
                   {loadError?.message || "The file might be corrupted or missing."}
                 </p>
               </div>
            }
            className="shadow-2xl"
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale} 
              rotate={rotation}
              devicePixelRatio={pixelRatio} 
              width={width ? Math.min(width * 0.95, 1000) : undefined} 
              className="bg-white shadow-lg"
              renderTextLayer={true}
              renderAnnotationLayer={true}
              loading={
                <div className="h-[800px] w-[600px] bg-white animate-pulse rounded shadow-lg" />
              }
            />
          </Document>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
             <p>Select a document to view</p>
          </div>
        )}
      </div>

      {/* 3. "Ask AI" Floating Button */}
      {selection && (
        <div 
          className="fixed z-50 animate-in fade-in zoom-in duration-200"
          style={{ 
            left: selection.x, 
            top: selection.y - 50,
            transform: 'translateX(-50%)' 
          }}
        >
          <Button 
            size="sm" 
            onClick={() => {
              if (onAskAI) onAskAI(selection.text);
              setSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="rounded-full shadow-xl bg-primary text-primary-foreground hover:scale-105 transition-all gap-2"
          >
            <MessageSquarePlus className="w-4 h-4" />
            Ask AI
          </Button>
          
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary" />
        </div>
      )}

    </div>
  );
}

// --- Internal Helper Hook ---
function useContainerWidth(ref: React.RefObject<HTMLDivElement>) {
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      setWidth(entries[0].contentRect.width);
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return { width };
}