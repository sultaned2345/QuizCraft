'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  MessageSquare, 
  BrainCircuit, 
  StickyNote, 
  Layers, 
  ChevronLeft, 
  FileText,
  Share2,
  MoreVertical,
  Maximize2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// --- Imported Components ---
// Ensure these paths match your project structure
import { ChatInterface } from '@/components/ChatInterface';
import { PdfViewer } from '@/components/PdfViewer'; 

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ActiveTool = 'chat' | 'quiz' | 'notes' | 'flashcards';

export default function DocumentWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as string;
  
  // State
  const [activeTool, setActiveTool] = useState<ActiveTool>('chat');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // 1. Fetch Document Data
  const { data: docData, isLoading: docLoading } = useSWR(
    documentId ? `/api/documents/${documentId}` : null, 
    fetcher
  );

  // 2. Fetch Related Content (Quiz, Notes, Flashcards IDs)
  const { data: relatedData, isLoading: relatedLoading } = useSWR(
    documentId ? `/api/documents/${documentId}/related` : null,
    fetcher
  );

  const document = docData?.data;
  const fileUrl = document?.storage_path ? `/api/files/${document.storage_path}` : null;

  // --- Loading State ---
  if (docLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center space-y-4 bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground animate-pulse">Loading workspace...</p>
      </div>
    );
  }

  if (!document && !docLoading) {
     return <div className="p-8 text-center">Document not found</div>;
  }

  // --- Tool Rail Button Component ---
  const ToolButton = ({ tool, icon: Icon, label }: { tool: ActiveTool; icon: any; label: string }) => (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveTool(tool)}
            className={cn(
              "rounded-xl w-10 h-10 transition-all duration-200",
              activeTool === tool 
                ? "bg-primary text-primary-foreground shadow-md scale-105" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="sr-only">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      
      {/* --- Header --- */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur z-10 shrink-0">
        <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} className="h-8 w-8 text-muted-foreground">
                <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex flex-col">
                <h1 className="text-sm font-semibold truncate max-w-[300px] leading-tight">
                    {document?.title || 'Untitled Document'}
                </h1>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                    {document?.file_type || 'DOC'}
                </span>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-2 hidden sm:flex">
                <Share2 className="w-3.5 h-3.5" /> Share
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
            </Button>
        </div>
      </header>

      {/* --- Main Workspace (Split View) --- */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        
        {/* LEFT PANEL: Document Viewer */}
        <ResizablePanel defaultSize={50} minSize={30} className="bg-muted/30 relative">
           <div className="h-full w-full flex flex-col">
              {document?.file_type === 'pdf' ? (
                 <PdfViewer url={fileUrl} />
              ) : (
                 <ScrollArea className="flex-1 p-8 md:p-12">
                    <div className="max-w-3xl mx-auto prose dark:prose-invert prose-headings:font-bold prose-p:leading-relaxed">
                        {/* If text-only, show extracted text nicely */}
                        <h1>{document?.title}</h1>
                        <div className="whitespace-pre-wrap font-serif text-lg text-foreground/80">
                            {document?.extracted_text || "No text content available."}
                        </div>
                    </div>
                 </ScrollArea>
              )}
           </div>
           {/* Expand Button Overlay (Optional) */}
           <div className="absolute top-4 right-4 z-10 opacity-0 hover:opacity-100 transition-opacity">
               <Button size="icon" variant="secondary" className="shadow-lg rounded-full h-8 w-8">
                   <Maximize2 className="w-4 h-4" />
               </Button>
           </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-border/50 hover:bg-primary/50 transition-colors w-1" />

        {/* RIGHT PANEL: The "Turbo AI" Workspace */}
        <ResizablePanel defaultSize={50} minSize={35} maxSize={70} className="bg-background flex flex-row">
            
            {/* 1. THE SIDEBAR RAIL */}
            <div className="w-16 border-r flex flex-col items-center py-4 gap-4 bg-muted/10 shrink-0 z-20">
                <ToolButton tool="chat" icon={MessageSquare} label="AI Chat" />
                <ToolButton tool="quiz" icon={BrainCircuit} label="Quiz" />
                <ToolButton tool="notes" icon={StickyNote} label="Smart Notes" />
                <ToolButton tool="flashcards" icon={Layers} label="Flashcards" />
            </div>

            {/* 2. THE TOOL CONTENT AREA */}
            <div className="flex-1 h-full overflow-hidden relative bg-background">
                
                {/* Mode: CHAT */}
                <div className={cn("h-full w-full absolute inset-0 transition-opacity duration-300", activeTool === 'chat' ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none")}>
                    <ChatInterface 
                        documentId={documentId} 
                        initialMessage={`I've analyzed **${document?.title}**. Ask me anything or try generating a summary!`}
                    />
                </div>

                {/* Mode: QUIZ */}
                {activeTool === 'quiz' && (
                    <div className="h-full w-full p-6 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                        {relatedLoading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-32 w-full rounded-xl" />
                                <Skeleton className="h-32 w-full rounded-xl" />
                            </div>
                        ) : relatedData?.quizId ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-6 text-center max-w-sm mx-auto">
                                <div className="p-4 bg-primary/10 rounded-full">
                                    <BrainCircuit className="w-12 h-12 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Quiz Ready</h3>
                                    <p className="text-muted-foreground mt-2">Challenge yourself with questions generated from this document.</p>
                                </div>
                                <Button size="lg" className="w-full" asChild>
                                    <Link href={`/quiz/${relatedData.quizId}`}>Start Quiz</Link>
                                </Button>
                            </div>
                        ) : (
                             <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                <p className="text-muted-foreground">No quiz generated yet.</p>
                                <Button variant="outline">Generate Quiz</Button>
                             </div>
                        )}
                    </div>
                )}

                {/* Mode: NOTES */}
                {activeTool === 'notes' && (
                    <div className="h-full w-full overflow-y-auto bg-card animate-in fade-in zoom-in-95 duration-200">
                        {relatedLoading ? (
                             <div className="p-8 space-y-4">
                                <Skeleton className="h-10 w-1/2" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                             </div>
                        ) : relatedData?.noteId ? (
                             <div className="prose dark:prose-invert max-w-none p-8">
                                {/* If you have a dedicated Note Viewer component, use it here. 
                                    Otherwise, render HTML safely */}
                                <div dangerouslySetInnerHTML={{ __html: relatedData.noteContent }} />
                             </div>
                        ) : (
                             <div className="flex flex-col items-center justify-center h-full text-center p-6">
                                <StickyNote className="w-12 h-12 text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">No notes found.</p>
                             </div>
                        )}
                    </div>
                )}

                {/* Mode: FLASHCARDS */}
                {activeTool === 'flashcards' && (
                    <div className="h-full w-full p-6 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                         {relatedLoading ? (
                            <div className="grid grid-cols-2 gap-4">
                                <Skeleton className="aspect-[4/3] rounded-xl" />
                                <Skeleton className="aspect-[4/3] rounded-xl" />
                            </div>
                         ) : relatedData?.deckId ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-6 text-center max-w-sm mx-auto">
                                <div className="p-4 bg-orange-500/10 rounded-full">
                                    <Layers className="w-12 h-12 text-orange-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Flashcards</h3>
                                    <p className="text-muted-foreground mt-2">Review key concepts with active recall.</p>
                                </div>
                                <Button size="lg" variant="secondary" className="w-full" asChild>
                                    <Link href={`/flashcards/${relatedData.deckId}`}>Practice Deck</Link>
                                </Button>
                            </div>
                         ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <p className="text-muted-foreground">No flashcards available.</p>
                            </div>
                         )}
                    </div>
                )}

            </div>
        </ResizablePanel>

      </ResizablePanelGroup>
    </div>
  );
}