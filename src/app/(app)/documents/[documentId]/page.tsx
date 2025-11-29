// src/app/(app)/documents/[documentId]/page.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2, ArrowLeft, FileText, Sparkles, Target, Zap, ChevronRight,
  Lightbulb, MoreVertical, Download, Share2, BrainCircuit, BookOpen, ListChecks,
  Layers, GraduationCap, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInterface, ChatInterfaceHandle } from '@/components/ChatInterface';
import { usePageContext, PageContextType } from '@/contexts/PageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ApiResponse, Message, Question } from '@/types/database';
import dynamic from 'next/dynamic';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { PdfViewer } from '@/components/PdfViewer';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// --- Dynamic Imports ---
const PopQuizModal = dynamic(
  () => import('@/components/PopQuizModal').then((mod) => mod.PopQuizModal),
  { ssr: false, loading: () => <div className="hidden" /> }
);

// --- Helpers ---
const safeRender = (content: any): string => {
  if (typeof content === 'string') return content;
  if (typeof content === 'number') return String(content);
  if (typeof content === 'object' && content !== null) {
    return content.text || content.name || content.value || content.title || JSON.stringify(content);
  }
  return '';
};

// --- Interfaces ---
interface AIDocumentInsights {
  keyConcepts: any[];
  examQuestions: any[];
  mainArguments: any[];
}

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
}

type MenuAction = 'explain' | 'summarize' | 'question';

// --- Selection Menu Component ---
function SelectionMenu({ menu, onClose, onAction }: { menu: MenuState; onClose: () => void; onAction: (action: MenuAction) => void; }) {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  if (!menu.visible) return null;

  return (
    <div
      style={{ top: `${menu.y}px`, left: `${menu.x}px` }}
      className="fixed z-50 flex flex-col gap-1 p-1 bg-popover text-popover-foreground border rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-150 -translate-y-full -translate-x-1/2 mt-[-10px]"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 p-1">
        <Button size="sm" variant="ghost" onClick={() => onAction('explain')} className="h-7 px-2 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 mr-1.5 text-sky-500" /> Explain
        </Button>
        <div className="w-px h-4 bg-border" />
        <Button size="sm" variant="ghost" onClick={() => onAction('summarize')} className="h-7 px-2 text-xs font-medium">
          <FileText className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> Summarize
        </Button>
        <div className="w-px h-4 bg-border" />
        <Button size="sm" variant="ghost" onClick={() => onAction('question')} className="h-7 px-2 text-xs font-medium">
          <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> Quiz Me
        </Button>
      </div>
      <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-popover border-r border-b rotate-45" />
    </div>
  );
}

const swrOptions = { revalidateOnFocus: false };

export default function DocumentViewPage() {
  const [isPopQuizOpen, setIsPopQuizOpen] = useState(false);
  const [popQuizQuestions, setPopQuizQuestions] = useState<Question[]>([]);
  const [isPopQuizLoading, setIsPopQuizLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, text: '' });

  const { session, loading: authLoading } = useAuth();
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

  // --- DATA FETCHING ---
  // 1. Metadata (Fast)
  const { data: metaData } = useSWR<ApiResponse<{ file_name: string }>>(
    session ? `/api/documents/${documentId}/content?text=false` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions
  );

  const isPdf = metaData?.data?.file_name.toLowerCase().endsWith('.pdf') ?? false;

  // 2. Full Text (Lazy)
  const { data: fullContentData } = useSWR<ApiResponse<{ extracted_text: string }>>(
    session && !isPdf ? `/api/documents/${documentId}/content` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions
  );

  const { data: historyData } = useSWR<ApiResponse<Message[]>>(
    session ? `/api/chat/history?context_id=${documentId}` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions
  );

  // 3. AI Insights (The "Understanding" part)
  const { data: insightsData } = useSWR<ApiResponse<AIDocumentInsights>>(
    session ? `/api/documents/${documentId}/insights` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions
  );

  const { data: urlData } = useSWR<ApiResponse<{ signedUrl: string }>>(
    session && isPdf ? `/api/documents/${documentId}/url` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions
  );

  const isLoading = !metaData;

  // --- ACTIONS ---

  // 1. Quiz Generation
  const handleStartPopQuiz = async () => {
    if (!session || isPopQuizLoading) return;
    setIsPopQuizLoading(true);
    toast({ title: 'Preparing Quiz', description: 'Generating questions from document...' });
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

  // 2. Notes Generation
  const handleGenerateNotes = async () => {
    if (!session || isGenerating) return;
    setIsGenerating(true);
    toast({ title: 'Creating Notes', description: 'Summarizing document content...' });

    try {
        // Need full text for notes generation if we don't have it yet
        let text = fullContentData?.data?.extracted_text;
        
        if (!text) {
             const cRes = await fetch(`/api/documents/${documentId}/content`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
             });
             const cResult = await cRes.json();
             if (cResult.success) text = cResult.data.extracted_text;
        }

        if (!text) throw new Error("Could not retrieve document text");

        const res = await fetch(`/api/generate-notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text }),
        });
        
        const data = await res.json();
        if (data.success) {
            toast({ title: 'Success', description: 'Notes generated successfully!' });
            router.push('/notes');
        } else {
            throw new Error(data.error);
        }
    } catch(e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
        setIsGenerating(false);
    }
  };

  // 3. Flashcards Generation
  const handleGenerateFlashcards = async () => {
    if (!session || isGenerating) return;
    setIsGenerating(true);
    toast({ title: 'Creating Deck', description: 'Extracting key terms...' });
    try {
        const res = await fetch(`/api/generate-flashcards`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            documentId: documentId,
            numberOfCards: 15,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast({ title: 'Success', description: `Deck "${data.data.title}" created.` });
          router.push(`/flashcards/${data.data.id}`);
        } else throw new Error(data.error);
    } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
        setIsGenerating(false);
    }
  };

  const handleMouseUpCapture = (e: React.MouseEvent) => {
    const chatPanel = (e.target as HTMLElement).closest('div[data-chat-panel="true"]');
    if (chatPanel) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';

    if (selectedText.length > 2 && selectedText.length < 2000) {
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
    }
  };

  const handleMenuAction = (action: MenuAction) => {
    const prompt =
      action === 'explain'
        ? `Explain this simply: "${menu.text}"`
        : action === 'summarize'
          ? `Summarize: "${menu.text}"`
          : `Quiz me on: "${menu.text}"`;

    chatRef.current?.sendMessage(prompt);
    setMenu({ ...menu, visible: false });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {/* Toolbar Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0 bg-background/95 backdrop-blur z-10">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.push('/documents')} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-semibold truncate max-w-[200px] sm:max-w-md">
                {metaData?.data?.file_name}
              </h1>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                {isPdf ? 'PDF Document' : 'Note'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartPopQuiz}
              disabled={isPopQuizLoading}
              className="h-8 hidden sm:flex gap-2 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900"
            >
              {isPopQuizLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>Pop Quiz</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem><Download className="w-4 h-4 mr-2" /> Export PDF</DropdownMenuItem>
                <DropdownMenuItem><Share2 className="w-4 h-4 mr-2" /> Share Document</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Resizable Content Area */}
        <ResizablePanelGroup direction="horizontal" className="flex-1 h-full">
          {/* Left Panel: Content */}
          <ResizablePanel defaultSize={60} minSize={30} className="bg-muted/5 relative flex flex-col">
            <Tabs defaultValue="document" className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="px-4 border-b bg-background flex justify-center shrink-0">
                <TabsList className="h-9 bg-transparent w-full max-w-md justify-center">
                  <TabsTrigger value="document" className="flex-1 text-xs"><BookOpen className="w-3.5 h-3.5 mr-2" /> Document</TabsTrigger>
                  <TabsTrigger value="analysis" className="flex-1 text-xs"><BrainCircuit className="w-3.5 h-3.5 mr-2" /> Analysis</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 relative overflow-hidden">
                <TabsContent value="document" className="h-full m-0 border-0 data-[state=inactive]:hidden">
                  {urlData?.data?.signedUrl ? (
                    <div className="h-full w-full bg-zinc-100 dark:bg-zinc-950">
                        <PdfViewer url={urlData.data.signedUrl} onTextSelect={handleMouseUpCapture} />
                    </div>
                  ) : (
                    <ScrollArea className="h-full w-full bg-zinc-50 dark:bg-zinc-950">
                      <div className="min-h-full py-8 px-4 flex justify-center" onMouseUp={handleMouseUpCapture}>
                        <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 shadow-sm border rounded-xl p-8 md:p-12 min-h-[80vh]">
                          <MarkdownViewer content={fullContentData?.data?.extracted_text || 'Loading content...'} />
                        </div>
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                {/* --- SMART ANALYSIS TAB --- */}
                <TabsContent value="analysis" className="h-full m-0 overflow-y-auto data-[state=inactive]:hidden bg-zinc-50 dark:bg-zinc-950">
                  <div className="max-w-4xl mx-auto p-6 space-y-8">
                    
                    {/* Header */}
                    <div className="flex flex-col gap-2">
                      <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
                        <Sparkles className="w-6 h-6 text-primary" /> 
                        AI Study Center
                      </h2>
                      <p className="text-muted-foreground">
                        We've analyzed your document. What would you like to create?
                      </p>
                    </div>

                    {!insightsData?.data ? (
                       <div className="grid gap-6">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[1,2,3].map(i => <div key={i} className="h-40 bg-muted/50 rounded-xl animate-pulse" />)}
                         </div>
                         <div className="h-48 w-full bg-muted/50 rounded-xl animate-pulse" />
                       </div>
                    ) : (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        {/* 1. ACTION CARDS (The Turbo AI Style Dashboard) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            
                            {/* Card: Notes */}
                            <Card className="hover:shadow-lg transition-all border-l-4 border-l-emerald-500 cursor-pointer group" onClick={handleGenerateNotes}>
                                <CardHeader className="pb-3">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                        <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <CardTitle className="text-base">Study Notes</CardTitle>
                                    <CardDescription className="text-xs">
                                        Summaries & bullet points
                                    </CardDescription>
                                </CardHeader>
                                <CardFooter className="pt-0">
                                    <Button size="sm" variant="ghost" className="w-full justify-between text-xs group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20" disabled={isGenerating}>
                                        Generate <ArrowRight className="w-3 h-3 ml-2 opacity-50" />
                                    </Button>
                                </CardFooter>
                            </Card>

                            {/* Card: Flashcards */}
                            <Card className="hover:shadow-lg transition-all border-l-4 border-l-orange-500 cursor-pointer group" onClick={handleGenerateFlashcards}>
                                <CardHeader className="pb-3">
                                    <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                        <Layers className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <CardTitle className="text-base">Flashcards</CardTitle>
                                    <CardDescription className="text-xs">
                                        Active recall deck
                                    </CardDescription>
                                </CardHeader>
                                <CardFooter className="pt-0">
                                    <Button size="sm" variant="ghost" className="w-full justify-between text-xs group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20" disabled={isGenerating}>
                                        Create Deck <ArrowRight className="w-3 h-3 ml-2 opacity-50" />
                                    </Button>
                                </CardFooter>
                            </Card>

                             {/* Card: Quiz */}
                             <Card className="hover:shadow-lg transition-all border-l-4 border-l-amber-500 cursor-pointer group" onClick={handleStartPopQuiz}>
                                <CardHeader className="pb-3">
                                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                        <GraduationCap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <CardTitle className="text-base">Pop Quiz</CardTitle>
                                    <CardDescription className="text-xs">
                                        Test your knowledge
                                    </CardDescription>
                                </CardHeader>
                                <CardFooter className="pt-0">
                                    <Button size="sm" variant="ghost" className="w-full justify-between text-xs group-hover:bg-amber-50 dark:group-hover:bg-amber-900/20" disabled={isPopQuizLoading}>
                                        Start Quiz <ArrowRight className="w-3 h-3 ml-2 opacity-50" />
                                    </Button>
                                </CardFooter>
                            </Card>

                        </div>

                        {/* 2. Executive Summary (Proof of Understanding) */}
                        <Card className="border-none shadow-sm bg-zinc-50 dark:bg-zinc-900/50">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base font-semibold">
                              <Target className="w-4 h-4 text-primary" /> Key Takeaways
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-3">
                              {(insightsData.data.mainArguments || []).map((arg, i) => (
                                <li key={i} className="flex gap-3 text-sm text-foreground/80">
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                  <span className="leading-relaxed">{safeRender(arg)}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>

                        {/* 3. Concepts */}
                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                             Detected Concepts
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {(insightsData.data.keyConcepts || []).map((c, i) => (
                              <Badge key={i} variant="secondary" className="px-3 py-1 font-normal bg-white dark:bg-zinc-900 border cursor-default">
                                {safeRender(c)}
                              </Badge>
                            ))}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={40} minSize={25} className="bg-background flex flex-col" data-chat-panel="true">
            <div className="h-full flex flex-col border-l border-border/50">
              <ChatInterface
                ref={chatRef}
                context={pageContext}
                initialMessages={historyData?.data}
                isLoadingHistory={!historyData}
              />
            </div>
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