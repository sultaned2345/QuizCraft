// src/app/(app)/documents/[documentId]/page.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2, ArrowLeft, FileText, Sparkles, Target, Zap,
  ChevronRight, Lightbulb, MoreVertical, Download, Share2,
  BrainCircuit, BookOpen, ListChecks, GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInterface, ChatInterfaceHandle } from '@/components/ChatInterface';
import { usePageContext, PageContextType } from '@/contexts/PageContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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

const safeRender = (content: any): string => {
  if (typeof content === 'string') return content;
  if (typeof content === 'number') return String(content);
  if (typeof content === 'object' && content !== null) {
    return content.text || content.name || content.value || content.title || JSON.stringify(content);
  }
  return '';
};

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
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleClickOutside, true); 
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleClickOutside, true);
    };
  }, [onClose]);

  if (!menu.visible) return null;

  return (
    <div
      style={{ top: `${menu.y - 10}px`, left: `${menu.x}px` }}
      className="fixed z-50 flex items-center p-1.5 gap-1 bg-zinc-900/90 text-white backdrop-blur-md rounded-full shadow-2xl animate-in fade-in zoom-in-95 duration-200 slide-in-from-bottom-2 -translate-x-1/2 -translate-y-full"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onAction('explain')}
        className="h-8 px-3 text-xs font-medium text-zinc-100 hover:bg-white/20 hover:text-white rounded-full transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-400" /> Explain
      </Button>
      <div className="w-px h-4 bg-white/20" />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onAction('summarize')}
        className="h-8 px-3 text-xs font-medium text-zinc-100 hover:bg-white/20 hover:text-white rounded-full transition-colors"
      >
        <FileText className="w-3.5 h-3.5 mr-1.5 text-blue-400" /> Summarize
      </Button>
      <div className="w-px h-4 bg-white/20" />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onAction('question')}
        className="h-8 px-3 text-xs font-medium text-zinc-100 hover:bg-white/20 hover:text-white rounded-full transition-colors"
      >
        <Zap className="w-3.5 h-3.5 mr-1.5 text-yellow-400" /> Quiz
      </Button>
      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-900/90 rotate-45 rounded-[1px]" />
    </div>
  );
}

const swrOptions = { revalidateOnFocus: false };

export default function DocumentViewPage() {
  const [isPopQuizOpen, setIsPopQuizOpen] = useState(false);
  const [popQuizQuestions, setPopQuizQuestions] = useState<Question[]>([]);
  const [isPopQuizLoading, setIsPopQuizLoading] = useState(false);
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

  // --- Data Fetching ---
  const { data: contentData } = useSWR<ApiResponse<{ extracted_text: string; file_name: string }>>(
    session ? `/api/documents/${documentId}/content` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions
  );

  const { data: historyData } = useSWR<ApiResponse<Message[]>>(
    session ? `/api/chat/history?context_id=${documentId}` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions
  );

  const { data: insightsData } = useSWR<ApiResponse<AIDocumentInsights>>(
    session ? `/api/documents/${documentId}/insights` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions
  );

  const isPdf = contentData?.data?.file_name.toLowerCase().endsWith('.pdf') ?? false;

  const { data: urlData } = useSWR<ApiResponse<{ signedUrl: string }>>(
    session && isPdf ? `/api/documents/${documentId}/url` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
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
    } else {
        setMenu({ ...menu, visible: false });
    }
  };

  const handleMenuAction = (action: MenuAction) => {
    const prompt = action === 'explain' ? `Explain this simply: "${menu.text}"`
        : action === 'summarize' ? `Summarize: "${menu.text}"`
        : `Quiz me on: "${menu.text}"`;

    chatRef.current?.sendMessage(prompt);
    setMenu({ ...menu, visible: false });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
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
        
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 border-b shrink-0 bg-background/80 backdrop-blur-md z-20 sticky top-0">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.push('/documents')} className="h-8 w-8 rounded-full hover:bg-muted">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-semibold truncate max-w-[200px] sm:max-w-md text-foreground">
                {contentData?.data?.file_name}
              </h1>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="h-4 px-1 text-[9px] rounded-sm font-normal">
                    {isPdf ? 'PDF' : 'NOTE'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleStartPopQuiz}
              disabled={isPopQuizLoading}
              className="h-8 hidden sm:flex gap-2 rounded-full shadow-sm hover:shadow-md transition-all"
            >
              {isPopQuizLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-current" />}
              <span>Pop Quiz</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg">
                <DropdownMenuItem className="cursor-pointer">
                  <Download className="w-4 h-4 mr-2" /> Export PDF
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Share2 className="w-4 h-4 mr-2" /> Share Document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <ResizablePanelGroup direction="horizontal" className="flex-1 h-full">
          {/* Left Panel: Content */}
          <ResizablePanel defaultSize={60} minSize={30} className="bg-zinc-50/50 dark:bg-zinc-950/50 relative flex flex-col group">
            <Tabs defaultValue="document" className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Floating Tab Switcher */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
                 <TabsList className="h-10 bg-zinc-900/90 dark:bg-zinc-100/90 text-zinc-400 backdrop-blur-md border border-zinc-700/50 dark:border-zinc-300/50 shadow-2xl rounded-full p-1">
                  <TabsTrigger
                    value="document"
                    className="rounded-full px-4 py-1.5 text-xs data-[state=active]:bg-zinc-700 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-black transition-all"
                  >
                    <BookOpen className="w-3.5 h-3.5 mr-2" /> Reader
                  </TabsTrigger>
                  <TabsTrigger
                    value="analysis"
                    className="rounded-full px-4 py-1.5 text-xs data-[state=active]:bg-zinc-700 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-black transition-all"
                  >
                    <BrainCircuit className="w-3.5 h-3.5 mr-2" /> Insights
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 relative overflow-hidden h-full">
                <TabsContent value="document" className="h-full m-0 border-0 data-[state=inactive]:hidden">
                  {urlData?.data?.signedUrl ? (
                    <div className="h-full w-full bg-zinc-100/50 dark:bg-zinc-950/50">
                      <div className="h-full w-full overflow-hidden">
                        <PdfViewer url={urlData.data.signedUrl} onTextSelect={handleMouseUpCapture} />
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="h-full w-full bg-white dark:bg-zinc-950">
                      <div className="min-h-full py-12 px-4 flex justify-center" onMouseUp={handleMouseUpCapture}>
                        <div className="w-full max-w-3xl">
                          <MarkdownViewer content={contentData?.data?.extracted_text || ''} />
                        </div>
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                {/* Analysis View (Bento Grid) */}
                <TabsContent value="analysis" className="h-full m-0 overflow-y-auto data-[state=inactive]:hidden bg-zinc-50 dark:bg-zinc-950">
                  <div className="max-w-5xl mx-auto p-8 pb-24 space-y-8">
                    <div className="flex flex-col gap-2 mb-8">
                      <h2 className="text-3xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
                        Smart Insights
                      </h2>
                      <p className="text-zinc-500 dark:text-zinc-400 text-lg">
                        AI-generated synthesis of your document.
                      </p>
                    </div>

                    {!insightsData?.data ? (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="h-48 rounded-3xl bg-zinc-200 dark:bg-zinc-800 animate-pulse col-span-2" />
                         <div className="h-48 rounded-3xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                         <div className="h-48 rounded-3xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                       </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        
                        {/* Executive Summary */}
                        <div className="col-span-1 md:col-span-12">
                            <Card className="border-none shadow-sm bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-zinc-900 overflow-hidden rounded-3xl">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-full">
                                            <Target className="w-4 h-4" /> 
                                        </div>
                                        <span className="font-semibold text-sm uppercase tracking-wider">Executive Summary</span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(insightsData.data.mainArguments || []).map((arg, i) => (
                                        <li key={i} className="flex gap-3 text-sm text-zinc-700 dark:text-zinc-300 p-3 bg-white/50 dark:bg-black/20 rounded-xl">
                                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                            <span className="leading-relaxed">{safeRender(arg)}</span>
                                        </li>
                                    ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Key Concepts */}
                        <div className="col-span-1 md:col-span-7">
                            <Card className="h-full border-none shadow-sm bg-white dark:bg-zinc-900 rounded-3xl flex flex-col">
                                <CardHeader>
                                     <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                                        <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full">
                                            <Lightbulb className="w-4 h-4" /> 
                                        </div>
                                        <span className="font-semibold text-sm uppercase tracking-wider">Key Concepts</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="flex flex-wrap gap-2">
                                        {(insightsData.data.keyConcepts || []).map((c, i) => (
                                        <button
                                            key={i}
                                            className="px-4 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-300 border border-zinc-100 dark:border-zinc-800 rounded-xl transition-all duration-200 text-left"
                                            onClick={() => chatRef.current?.sendMessage(`Tell me more about "${safeRender(c)}"`)}
                                        >
                                            {safeRender(c)}
                                        </button>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Pop Quiz CTA */}
                         <div className="col-span-1 md:col-span-5 flex flex-col gap-6">
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden group cursor-pointer" onClick={handleStartPopQuiz}>
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                    <GraduationCap className="w-24 h-24" />
                                </div>
                                <h3 className="text-2xl font-bold mb-1 relative z-10">Test Yourself</h3>
                                <p className="text-emerald-100 text-sm mb-4 relative z-10 max-w-[80%]">Generate an instant quiz based on these insights.</p>
                                <Button size="sm" variant="secondary" className="rounded-full relative z-10 font-semibold text-emerald-700">
                                    Start Quiz <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        </div>

                        {/* Practice Questions */}
                        <div className="col-span-1 md:col-span-12">
                             <div className="flex items-center gap-2 text-zinc-400 mb-4 px-2">
                                <ListChecks className="w-4 h-4" /> 
                                <span className="text-xs font-semibold uppercase tracking-wider">Suggested Questions</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(insightsData.data.examQuestions || []).map((q, i) => (
                                <div
                                    key={i}
                                    onClick={() => chatRef.current?.sendMessage(`Help me answer: "${safeRender(q)}"`)}
                                    className="group p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:shadow-md hover:border-zinc-200 dark:hover:border-zinc-700 cursor-pointer transition-all duration-300"
                                >
                                    <div className="flex gap-4">
                                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-400 group-hover:bg-primary group-hover:text-white transition-colors">
                                            {i + 1}
                                        </span>
                                        <div className="flex-1">
                                            <p className="text-base font-medium text-zinc-700 dark:text-zinc-200 leading-relaxed group-hover:text-primary transition-colors">
                                                {safeRender(q)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
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

          <ResizableHandle withHandle className="bg-transparent border-l border-zinc-200 dark:border-zinc-800 w-[1px]" />

          {/* Right Panel: Chat - UPGRADE: Transparent background */}
          <ResizablePanel defaultSize={40} minSize={25} className="bg-transparent flex flex-col" data-chat-panel="true">
            <ChatInterface
              ref={chatRef}
              context={pageContext}
              initialMessages={historyData?.data}
              isLoadingHistory={!historyData}
            />
          </ResizablePanel>
        </ResizablePanelGroup>

        {isPopQuizOpen && (
          <PopQuizModal isOpen={isPopQuizOpen} onOpenChange={setIsPopQuizOpen} questions={popQuizQuestions} />
        )}
      </div>
    </>
  );
}