'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { 
  ArrowLeft, 
  MessageSquare, 
  BookOpen, 
  CheckCircle2, 
  Layers, 
  MoreVertical,
  Share2,
  Trash2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { ChatInterface } from '@/components/ChatInterface';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { PdfViewer } from '@/components/PdfViewer';
import { TurboLoading } from '@/components/TurboLoading';
import { useAuth } from '@/contexts/AuthContext';
import { fetcher } from '@/lib/fetcher';

// --- Sub-Components for Tab Content ---

const QuizView = ({ quiz }: { quiz: any }) => (
  <div className="p-6 space-y-8 max-w-3xl mx-auto animate-fade-in-up">
    <div className="flex items-center justify-between">
      <h3 className="text-2xl font-bold tracking-tight">{quiz.title}</h3>
      <Badge variant="outline">{quiz.questions.length} Questions</Badge>
    </div>
    <div className="space-y-6">
      {quiz.questions.map((q: any, i: number) => (
        <div key={i} className="p-6 border rounded-xl bg-card/50 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
          <p className="font-medium text-lg mb-4 flex gap-3">
             <span className="text-muted-foreground font-mono text-sm pt-1">0{i+1}</span>
             {q.question_text}
          </p>
          <div className="grid gap-3 pl-8">
             {q.options?.map((opt: string, j: number) => (
               <div key={j} className="text-sm p-3 rounded-md bg-muted/40 border border-transparent hover:border-primary/20 hover:bg-muted/60 transition-colors cursor-pointer">
                 {opt}
               </div>
             ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const FlashcardView = ({ deck }: { deck: any }) => (
  <div className="p-6 max-w-5xl mx-auto animate-fade-in-up">
    <div className="flex items-center justify-between mb-8">
      <h3 className="text-2xl font-bold tracking-tight">{deck.title}</h3>
      <Badge variant="outline">{deck.flashcards.length} Cards</Badge>
    </div>
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {deck.flashcards.map((card: any, i: number) => (
        <div key={i} className="group relative h-64 perspective-1000">
          <div className="absolute inset-0 w-full h-full duration-500 preserve-3d group-hover:rotate-y-180">
            {/* Front */}
            <div className="absolute inset-0 backface-hidden p-6 bg-card border rounded-xl flex items-center justify-center text-center shadow-sm">
              <p className="font-medium text-lg line-clamp-6">{card.front_content}</p>
              <div className="absolute bottom-4 right-4 text-xs text-muted-foreground font-mono">FRONT</div>
            </div>
            {/* Back */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 p-6 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-center text-center shadow-inner">
              <p className="text-sm leading-relaxed">{card.back_content}</p>
              <div className="absolute bottom-4 right-4 text-xs text-primary font-mono">BACK</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function DocumentWorkspace() {
  const { session } = useAuth();
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;
  
  // --- 1. Data Fetching ---
  
  // Fetch Document Metadata & Content
  const { data: contentData, error: contentError } = useSWR(
    session ? `/api/documents/${documentId}/content` : null,
    (url) => fetcher(url, session!.access_token)
  );

  // Fetch Signed URL (for PDFs)
  const { data: urlData } = useSWR(
    session && contentData?.data?.file_type === 'application/pdf' 
      ? `/api/documents/${documentId}/url` 
      : null,
    (url) => fetcher(url, session!.access_token)
  );

  // Fetch Generated Study Set (Poll every 3s if incomplete)
  const { data: studySet, isLoading: isSetLoading } = useSWR(
    session ? `/api/documents/${documentId}/study-set` : null,
    (url) => fetcher(url, session!.access_token),
    { 
      refreshInterval: (data) => {
        // If we are missing any core component, keep polling
        const isComplete = data?.data?.note && data?.data?.quiz && data?.data?.deck;
        return isComplete ? 0 : 3000;
      }
    }
  );

  // --- 2. Derived State ---
  
  const fileName = contentData?.data?.file_name || "Document";
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const signedUrl = urlData?.data?.signedUrl;
  const extractedText = contentData?.data?.extracted_text || '';
  
  // --- 3. Loading Logic (The "Turbo" Screen) ---

  // Show full loader if we have NO data yet for the study set (initial generation)
  // or if we are still fetching the base document content
  if (!contentData || (!studySet && isSetLoading)) {
     return <TurboLoading status="INITIALIZING_WORKSPACE..." />;
  }
  
  // If the document is processing (based on DB status or missing children), we can keep showing loader
  // OR show the workspace with "Generating..." placeholders. 
  // Let's use the loader if EVERYTHING is missing.
  const isEverythingMissing = !studySet?.data?.note && !studySet?.data?.quiz && !studySet?.data?.deck;
  
  if (isEverythingMissing) {
      return <TurboLoading status="GENERATING_STUDY_ASSETS..." />;
  }

  // --- 4. Workspace Render ---

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-background/80 backdrop-blur-md z-10 h-14">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/documents')} className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex flex-col">
             <h1 className="font-medium text-sm truncate max-w-[200px] sm:max-w-md" title={fileName}>
               {fileName}
             </h1>
             <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
               Workspace Active
             </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden sm:flex gap-2 h-8 text-xs">
                <Share2 className="w-3.5 h-3.5" /> Share
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete Document
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        
        {/* LEFT PANEL: Source Material */}
        <ResizablePanel defaultSize={45} minSize={30} className="bg-muted/10">
          {isPdf && signedUrl ? (
             <PdfViewer 
               url={signedUrl} 
               onTextSelect={() => {}} // Could add highlighter logic here later
               className="h-full"
             />
          ) : (
             <ScrollArea className="h-full">
               <div className="p-8 max-w-3xl mx-auto">
                 {extractedText ? (
                    <MarkdownViewer content={extractedText} />
                 ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                        No preview available.
                    </div>
                 )}
               </div>
             </ScrollArea>
          )}
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-border/50 hover:bg-primary/50 transition-colors" />

        {/* RIGHT PANEL: Study Tools */}
        <ResizablePanel defaultSize={55} minSize={30} className="bg-background">
          <Tabs defaultValue="notes" className="h-full flex flex-col">
            
            <div className="border-b border-border/40 px-4 bg-muted/5">
              <TabsList className="bg-transparent w-full justify-start h-12 gap-6 p-0">
                <TabsTrigger 
                  value="chat" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-2 gap-2"
                >
                  <MessageSquare className="w-4 h-4"/> Chat
                </TabsTrigger>
                
                <TabsTrigger 
                  value="notes" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none h-full px-2 gap-2"
                >
                  <BookOpen className="w-4 h-4"/> Notes
                  {studySet?.data?.note && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                </TabsTrigger>
                
                <TabsTrigger 
                  value="quiz" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none h-full px-2 gap-2"
                >
                  <CheckCircle2 className="w-4 h-4"/> Quiz
                  {studySet?.data?.quiz && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                </TabsTrigger>
                
                <TabsTrigger 
                  value="flashcards" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none h-full px-2 gap-2"
                >
                  <Layers className="w-4 h-4"/> Cards
                  {studySet?.data?.deck && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden relative bg-muted/5">
              
              <TabsContent value="chat" className="h-full m-0 border-0 flex flex-col">
                <div className="flex-1 overflow-hidden">
                   <ChatInterface 
                      documentId={documentId} 
                      initialMessage={`I've analyzed **${fileName}**. Ask me anything about it!`}
                   />
                </div>
              </TabsContent>
              
              <TabsContent value="notes" className="h-full m-0 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1">
                  {studySet?.data?.note ? (
                    <div className="p-8 max-w-3xl mx-auto animate-fade-in-up">
                      <MarkdownViewer content={studySet.data.note.content} />
                    </div>
                  ) : (
                     <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <TurboLoading status="SUMMARIZING_CONTENT..." className="min-h-[200px] bg-transparent" />
                     </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="quiz" className="h-full m-0 overflow-y-auto">
                {studySet?.data?.quiz ? (
                  <QuizView quiz={studySet.data.quiz} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                     <TurboLoading status="GENERATING_QUESTIONS..." className="min-h-[200px] bg-transparent" />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="flashcards" className="h-full m-0 overflow-y-auto">
                {studySet?.data?.deck ? (
                  <FlashcardView deck={studySet.data.deck} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                     <TurboLoading status="OPTIMIZING_DECKS..." className="min-h-[200px] bg-transparent" />
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </ResizablePanel>

      </ResizablePanelGroup>
    </div>
  );
}