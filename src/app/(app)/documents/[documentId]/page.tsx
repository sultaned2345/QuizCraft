// src/app/(app)/documents/[documentId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MessageSquare, 
  BrainCircuit, 
  StickyNote, 
  Layers, 
  FileText, 
  ChevronLeft 
} from 'lucide-react';
import Link from 'next/link';

// Components
import { ChatInterface } from '@/components/ChatInterface'; // Ensure this exists
import { PdfViewer } from '@/components/PdfViewer'; // Ensure this exists

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DocumentWorkspacePage() {
  const params = useParams();
  const documentId = params.documentId as string;
  const [activeTab, setActiveTab] = useState('chat');

  // 1. Fetch Document Data
  const { data: docData, isLoading: docLoading } = useSWR(
    documentId ? `/api/documents/${documentId}` : null, 
    fetcher
  );

  // 2. Fetch Related Content (Quiz, Notes, Flashcards) linked to this doc
  const { data: relatedData, isLoading: relatedLoading } = useSWR(
    documentId ? `/api/documents/${documentId}/related` : null,
    fetcher
  );

  // Helper to safely get the file URL
  const fileUrl = docData?.data?.storage_path 
    ? `/api/files/${docData.data.storage_path}` // Adjust based on your actual file serving route
    : null;

  if (docLoading) {
    return <div className="h-screen flex items-center justify-center">Loading Workspace...</div>;
  }

  const document = docData?.data;

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Top Bar for Context */}
      <div className="h-12 border-b flex items-center px-4 justify-between bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-5 h-5" />
            </Link>
            <span className="font-medium truncate max-w-[200px]">{document?.title || 'Untitled Document'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider font-mono">
                {document?.file_type || 'DOC'}
            </span>
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" className="h-[calc(100%-3rem)]">
        
        {/* --- LEFT PANEL: DOCUMENT VIEWER --- */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full bg-muted/30 p-2 md:p-4">
             <Card className="h-full border-none shadow-sm overflow-hidden bg-white/50 dark:bg-black/20">
                {document?.file_type === 'pdf' ? (
                    <PdfViewer url={fileUrl} /> 
                ) : (
                    <ScrollArea className="h-full p-6 whitespace-pre-wrap font-serif text-lg leading-relaxed text-foreground/80">
                        {document?.extracted_text || "No text content available."}
                    </ScrollArea>
                )}
             </Card>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* --- RIGHT PANEL: AI TOOLS --- */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col bg-background">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              
              {/* Tab Navigation */}
              <div className="border-b px-4 bg-muted/10">
                <TabsList className="w-full justify-start h-12 bg-transparent p-0 gap-6">
                   <TabsTrigger value="chat" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 pt-2 gap-2">
                      <MessageSquare className="w-4 h-4" /> Chat
                   </TabsTrigger>
                   <TabsTrigger value="quiz" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 pt-2 gap-2">
                      <BrainCircuit className="w-4 h-4" /> Quiz
                   </TabsTrigger>
                   <TabsTrigger value="notes" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 pt-2 gap-2">
                      <StickyNote className="w-4 h-4" /> Notes
                   </TabsTrigger>
                   <TabsTrigger value="flashcards" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 pt-2 gap-2">
                      <Layers className="w-4 h-4" /> Flashcards
                   </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab Content Areas */}
              <div className="flex-1 overflow-hidden relative">
                
                {/* 1. Chat Tab */}
                <TabsContent value="chat" className="h-full m-0 data-[state=active]:flex flex-col">
                   <ChatInterface documentId={documentId} initialContext={document?.extracted_text} />
                </TabsContent>

                {/* 2. Quiz Tab */}
                <TabsContent value="quiz" className="h-full m-0 p-4 overflow-y-auto">
                   {relatedLoading ? <Skeleton className="h-40 w-full" /> : (
                      relatedData?.quizId ? (
                         // Embed the Quiz Component here directly instead of an iframe
                         // For now, linking to it or embedding logic is best.
                         <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
                            <BrainCircuit className="w-12 h-12 text-primary/50" />
                            <h3 className="text-lg font-semibold">Quiz Ready</h3>
                            <p className="text-muted-foreground max-w-xs">Test your knowledge on this document.</p>
                            <Button asChild>
                                <Link href={`/quiz/${relatedData.quizId}`}>Start Full Quiz</Link>
                            </Button>
                         </div>
                      ) : (
                         <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <p>Generating Quiz...</p>
                         </div>
                      )
                   )}
                </TabsContent>

                {/* 3. Notes Tab */}
                <TabsContent value="notes" className="h-full m-0 p-6 overflow-y-auto prose dark:prose-invert max-w-none">
                   {relatedLoading ? <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /></div> : (
                      relatedData?.noteId ? (
                         <div dangerouslySetInnerHTML={{ __html: relatedData.noteContent }} />
                      ) : <p className="text-muted-foreground text-center mt-10">Generating Notes...</p>
                   )}
                </TabsContent>

                {/* 4. Flashcards Tab */}
                <TabsContent value="flashcards" className="h-full m-0 p-4 overflow-y-auto">
                    {/* Placeholder for Flashcard Component */}
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                        <Layers className="w-12 h-12 text-primary/50" />
                        <h3 className="text-lg font-semibold">Flashcards</h3>
                        {relatedData?.deckId && (
                           <Button asChild variant="secondary">
                              <Link href={`/flashcards/${relatedData.deckId}`}>Review Deck</Link>
                           </Button>
                        )}
                    </div>
                </TabsContent>

              </div>
            </Tabs>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}