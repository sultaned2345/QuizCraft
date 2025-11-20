// src/app/(app)/documents/[documentId]/page.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2,
  ArrowLeft,
  FileText,
  Sparkles,
  Brain,
  Target,
  Zap,
  BookOpen,
  Pencil,
  ChevronRight,
  Lightbulb,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInterface, ChatInterfaceHandle } from '@/components/ChatInterface';
import { usePageContext, PageContextType } from '@/contexts/PageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ApiResponse, Message, Question } from '@/types/database';
import dynamic from 'next/dynamic';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { PdfViewer } from '@/components/PdfViewer';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const PopQuizModal = dynamic(
  () => import('@/components/PopQuizModal').then((mod) => mod.PopQuizModal),
  {
    loading: () => (
      <div className="p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    ),
  },
);

// --- Interfaces ---
interface AIDocumentInsights {
  keyConcepts: string[];
  examQuestions: string[];
  mainArguments: string[];
}
interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
}
type MenuAction = 'explain' | 'summarize' | 'question';

// --- Selection Menu Component (Floating Tooltip) ---
function SelectionMenu({
  menu,
  onClose,
  onAction,
}: {
  menu: MenuState;
  onClose: () => void;
  onAction: (action: MenuAction) => void;
}) {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    // We listen on the window to catch clicks anywhere
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  if (!menu.visible) return null;

  return (
    <div
      style={{ top: `${menu.y}px`, left: `${menu.x}px` }}
      className="fixed z-50 flex flex-col gap-1 p-1 bg-popover text-popover-foreground border rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-150 -translate-y-full -translate-x-1/2 mt-[-10px]"
      onMouseDown={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 p-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('explain')}
          className="h-8 px-2 text-xs font-medium"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5 text-sky-500" />
          Explain
        </Button>
        <div className="w-px h-4 bg-border" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('summarize')}
          className="h-8 px-2 text-xs font-medium"
        >
          <BookOpen className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
          Summarize
        </Button>
        <div className="w-px h-4 bg-border" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('question')}
          className="h-8 px-2 text-xs font-medium"
        >
          <Pencil className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
          Quiz Me
        </Button>
      </div>
      {/* Little arrow pointing down */}
      <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-popover border-r border-b rotate-45" />
    </div>
  );
}

const swrOptions = { revalidateOnFocus: false };

export default function DocumentViewPage() {
  const [isPopQuizOpen, setIsPopQuizOpen] = useState(false);
  const [popQuizQuestions, setPopQuizQuestions] = useState<Question[]>([]);
  const [isPopQuizLoading, setIsPopQuizLoading] = useState(false);
  const [menu, setMenu] = useState<MenuState>({
    visible: false,
    x: 0,
    y: 0,
    text: '',
  });

  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;
  const { toast } = useToast();
  const chatRef = useRef<ChatInterfaceHandle>(null);
  const { setPageContext } = usePageContext();

  const pageContext = useMemo<PageContextType>(
    () => ({ type: 'document', id: documentId }),
    [documentId],
  );

  useEffect(() => {
    setPageContext(pageContext);
    return () => setPageContext(null);
  }, [setPageContext, pageContext]);

  // --- Data Fetching ---
  const { data: contentData } = useSWR<
    ApiResponse<{ extracted_text: string; file_name: string }>
  >(
    session ? `/api/documents/${documentId}/content` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions,
  );

  const { data: historyData } = useSWR<ApiResponse<Message[]>>(
    session ? `/api/chat/history?context_id=${documentId}` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions,
  );

  const { data: insightsData } = useSWR<ApiResponse<AIDocumentInsights>>(
    session ? `/api/documents/${documentId}/insights` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions,
  );

  const isPdf =
    contentData?.data?.file_name.toLowerCase().endsWith('.pdf') ?? false;

  const { data: urlData } = useSWR<ApiResponse<{ signedUrl: string }>>(
    session && isPdf ? `/api/documents/${documentId}/url` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions,
  );

  const isLoading = !contentData;

  // --- Handlers ---
  const handleStartPopQuiz = async () => {
    if (!session || isPopQuizLoading) return;
    setIsPopQuizLoading(true);
    toast({ title: 'Creating Quiz...', description: 'Analyzing document...' });
    try {
      const res = await fetch('/api/generate-pop-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ documentId }),
      });
      const data = await res.json();
      if (data.success) {
        setPopQuizQuestions(data.data.questions);
        setIsPopQuizOpen(true);
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsPopQuizLoading(false);
    }
  };

  const handleMouseUpCapture = (e: React.MouseEvent) => {
    // Don't trigger if clicking inside the chat panel
    const chatPanel = (e.target as HTMLElement).closest(
      'div[data-chat-panel="true"]',
    );
    if (chatPanel) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';

    if (selectedText.length > 2 && selectedText.length < 2000) {
      // Calculate position relative to viewport
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      
      if (rect) {
        setMenu({
          visible: true,
          x: rect.left + rect.width / 2,
          y: rect.top,
          text: selectedText,
        });
      }
    } else {
       // Let the click-outside handler deal with closing
    }
  };

  const handleMenuAction = (action: MenuAction) => {
    const prompt =
      action === 'explain'
        ? `Explain this concept simply: "${menu.text}"`
        : action === 'summarize'
          ? `Summarize this section: "${menu.text}"`
          : `Ask me a question based on this text: "${menu.text}"`;
    
    chatRef.current?.sendMessage(prompt);
    setMenu({ ...menu, visible: false });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-muted/10">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-medium">Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SelectionMenu
        menu={menu}
        onClose={() => setMenu({ ...menu, visible: false })}
        onAction={handleMenuAction}
      />

      {/* Full viewport container: "The Desktop App Feel" */}
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        
        <ResizablePanelGroup direction="horizontal" className="flex-1 h-full">
          
          {/* LEFT PANEL: Document Content */}
          <ResizablePanel defaultSize={60} minSize={30} className="flex flex-col bg-muted/5 relative">
            
            {/* Floating/Sticky Header within the document panel */}
            <header className="absolute top-0 left-0 right-0 z-20 px-6 py-3 flex items-center justify-between bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b shadow-sm transition-all">
                 <div className="flex items-center gap-4 overflow-hidden">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push('/documents')}
                      className="h-8 w-8 rounded-full hover:bg-muted"
                      title="Back to Documents"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    
                    <div className="flex flex-col overflow-hidden">
                        <h1 className="text-sm font-semibold truncate text-foreground flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        {contentData?.data?.file_name}
                        </h1>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartPopQuiz}
                        disabled={isPopQuizLoading}
                        className="h-8 text-xs font-medium bg-white dark:bg-zinc-800 hover:bg-zinc-50 border-zinc-200 shadow-sm"
                      >
                        {isPopQuizLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 mr-2 text-amber-500 fill-amber-500" />
                        )}
                        Generate Quiz
                      </Button>
                  </div>
            </header>

            <Tabs defaultValue="document" className="flex-1 flex flex-col h-full pt-[3.5rem]"> 
              {/* Tabs are now overlaid on the bottom or integrated subtly, or just standard tabs below header. 
                  Let's put them in the "Study Guide" toggle area or keep simple tabs. */}
              
              <div className="flex-1 relative overflow-hidden">
                <TabsContent value="document" className="h-full m-0 border-none">
                  {urlData?.data?.signedUrl ? (
                    // PDF View
                    <div className="h-full w-full bg-zinc-100 dark:bg-zinc-900">
                      <PdfViewer
                        url={urlData.data.signedUrl}
                        onTextSelect={handleMouseUpCapture}
                        className="h-full w-full"
                      />
                    </div>
                  ) : (
                    // Markdown View - "Paper on Desk" Effect
                    <ScrollArea className="h-full w-full bg-zinc-100/50 dark:bg-zinc-950">
                      <div 
                        className="min-h-full w-full py-8 px-4 md:px-8 flex justify-center"
                        onMouseUp={handleMouseUpCapture}
                      >
                         <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 rounded-xl min-h-[80vh] p-8 md:p-12">
                            <MarkdownViewer
                              content={contentData?.data?.extracted_text || ''}
                              className="font-serif" 
                            />
                         </div>
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="guide" className="h-full m-0 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
                   <div className="max-w-4xl mx-auto p-8 space-y-8">
                    {!insightsData?.data ? (
                      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <Brain className="w-12 h-12 mb-4 opacity-20 animate-pulse" />
                        <p className="text-sm font-medium">Analyzing document structure...</p>
                      </div>
                    ) : (
                      <div className="space-y-10 animate-in fade-in duration-500 slide-in-from-bottom-4">
                        
                        {/* Key Concepts */}
                        <section>
                           <div className="flex items-center gap-2 mb-4 text-zinc-800 dark:text-zinc-200">
                             <Lightbulb className="w-5 h-5 text-amber-500" />
                             <h3 className="text-lg font-bold tracking-tight">Key Concepts</h3>
                           </div>
                           <div className="flex flex-wrap gap-2">
                             {insightsData.data.keyConcepts?.map((concept, i) => (
                               <Badge 
                                 key={i} 
                                 variant="secondary" 
                                 className="px-3 py-1.5 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
                               >
                                 {concept}
                               </Badge>
                             ))}
                           </div>
                        </section>

                        {/* Practice Questions */}
                        <section>
                          <div className="flex items-center gap-2 mb-4 text-zinc-800 dark:text-zinc-200">
                             <GraduationCap className="w-5 h-5 text-indigo-500" />
                             <h3 className="text-lg font-bold tracking-tight">Knowledge Check</h3>
                           </div>
                           <div className="grid grid-cols-1 gap-3">
                             {insightsData.data.examQuestions?.map((q, i) => (
                               <div 
                                 key={i}
                                 className="group p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900 transition-all cursor-pointer flex gap-4"
                                 onClick={() => chatRef.current?.sendMessage(`Quiz me on this: "${q}"`)}
                               >
                                 <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold">
                                   {i + 1}
                                 </div>
                                 <div className="flex-1 pt-1">
                                   <p className="text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                     {q}
                                   </p>
                                 </div>
                                 <ChevronRight className="w-5 h-5 text-zinc-300 mt-1 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                               </div>
                             ))}
                           </div>
                        </section>

                        {/* Summary */}
                        <section>
                           <div className="flex items-center gap-2 mb-4 text-zinc-800 dark:text-zinc-200">
                             <Target className="w-5 h-5 text-emerald-500" />
                             <h3 className="text-lg font-bold tracking-tight">Core Takeaways</h3>
                           </div>
                           <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl p-6 space-y-4">
                              {insightsData.data.mainArguments?.map((arg, i) => (
                                <div key={i} className="flex gap-3 items-start">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2.5 flex-shrink-0" />
                                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{arg}</p>
                                </div>
                              ))}
                           </div>
                        </section>
                      </div>
                    )}
                   </div>
                </TabsContent>
              </div>

              {/* Bottom Navigation for Tabs (Clean Toggle) */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
                 <div className="bg-zinc-900/90 dark:bg-zinc-800/90 backdrop-blur-md p-1 rounded-full shadow-lg border border-white/10 flex gap-1">
                    <TabsList className="bg-transparent h-9 p-0">
                      <TabsTrigger 
                        value="document" 
                        className="rounded-full px-4 py-1.5 h-full text-xs font-medium text-zinc-400 data-[state=active]:bg-white data-[state=active]:text-zinc-900 transition-all"
                      >
                        Document
                      </TabsTrigger>
                      <TabsTrigger 
                        value="guide" 
                        className="rounded-full px-4 py-1.5 h-full text-xs font-medium text-zinc-400 data-[state=active]:bg-white data-[state=active]:text-zinc-900 transition-all"
                      >
                        Study Guide
                      </TabsTrigger>
                    </TabsList>
                 </div>
              </div>

            </Tabs>
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-border hover:bg-primary/50 transition-colors w-1.5" />

          {/* RIGHT PANEL: Chat Interface */}
          <ResizablePanel defaultSize={40} minSize={25} maxSize={50} className="bg-background" data-chat-panel="true">
             <ChatInterface
              ref={chatRef}
              context={pageContext}
              initialMessages={historyData?.data}
              isLoadingHistory={!historyData}
              className="h-full" // ChatInterface needs to support taking full height
            />
          </ResizablePanel>
        </ResizablePanelGroup>

        {isPopQuizOpen && (
          <PopQuizModal
            isOpen={isPopQuizOpen}
            onOpenChange={setIsPopQuizOpen}
            questions={popQuizQuestions}
          />
        )}
      </div>
    </>
  );
}