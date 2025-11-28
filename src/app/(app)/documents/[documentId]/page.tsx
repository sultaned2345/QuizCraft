// src/app/(app)/documents/[documentId]/page.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2,
  ArrowLeft,
  FileText,
  Star,
  Target,
  Zap,
  ChevronRight,
  Lightbulb,
  MoreVertical,
  Download,
  Share2,
  BookOpen,
  HelpCircle,
  MessageCircle // <-- Added Icon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInterface, ChatInterfaceHandle } from '@/components/ChatInterface';
import { usePageContext, PageContextType } from '@/contexts/PageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const PopQuizModal = dynamic(
  () => import('@/components/PopQuizModal').then((mod) => mod.PopQuizModal),
  {
    ssr: false,
    loading: () => <div className="hidden" />,
  }
);

const safeRender = (content: any): string => {
  if (typeof content === 'string') return content;
  if (typeof content === 'number') return String(content);
  if (typeof content === 'object' && content !== null) {
    return (
      content.text ||
      content.name ||
      content.value ||
      content.title ||
      JSON.stringify(content)
    );
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

// --- UPDATED: Added 'ask' action ---
type MenuAction = 'explain' | 'summarize' | 'question' | 'ask';

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
        {/* --- NEW: Ask Button --- */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('ask')}
          className="h-7 px-2 text-xs font-medium hover:bg-primary/10 hover:text-primary"
        >
          <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Ask AI
        </Button>
        <div className="w-px h-4 bg-border" />
        
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('explain')}
          className="h-7 px-2 text-xs font-medium"
        >
          <Star className="w-3.5 h-3.5 mr-1.5 text-sky-500" /> Explain
        </Button>
        <div className="w-px h-4 bg-border" />
        
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('summarize')}
          className="h-7 px-2 text-xs font-medium"
        >
          <FileText className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />{' '}
          Summarize
        </Button>
        <div className="w-px h-4 bg-border" />
        
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('question')}
          className="h-7 px-2 text-xs font-medium"
        >
          <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> Quiz
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
  const [menu, setMenu] = useState<MenuState>({
    visible: false,
    x: 0,
    y: 0,
    text: '',
  });

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
    // Prevent menu from appearing if clicking inside the chat panel
    const chatPanel = (e.target as HTMLElement).closest(
      'div[data-chat-panel="true"]',
    );
    if (chatPanel) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';

    // Only show menu for valid text length
    if (selectedText.length > 2 && selectedText.length < 3000) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();

      if (rect) {
        // Adjust for scroll offset if inside scrolling container
        setMenu({
          visible: true,
          x: rect.left + rect.width / 2,
          y: rect.top,
          text: selectedText,
        });
      }
    } else {
      // Hide menu if clicked without selection
      setMenu(prev => ({ ...prev, visible: false }));
    }
  };

  const handleMenuAction = (action: MenuAction) => {
    let prompt = '';
    
    switch(action) {
        case 'ask':
            prompt = `I have a question about this text: "${menu.text}"\n\n[Your Question Here]`;
            // Optional: If you want it to just start the chat context without sending immediately:
            // You might need a method on chatRef to set input value, but standard sendMessage works fine.
            // For now, let's ask for an explanation if they just click "Ask", or you can prompt them.
            prompt = `Context: "${menu.text}"\n\nCan you explain this part?`;
            break;
        case 'explain':
            prompt = `Explain this simply: "${menu.text}"`;
            break;
        case 'summarize':
            prompt = `Summarize this section: "${menu.text}"`;
            break;
        case 'question':
            prompt = `Quiz me on this specific text: "${menu.text}"`;
            break;
    }

    chatRef.current?.sendMessage(prompt);
    setMenu({ ...menu, visible: false });
    
    // Clear selection after action
    window.getSelection()?.removeAllRanges();
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
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0 bg-background/95 backdrop-blur z-10">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/documents')}
              className="h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-semibold truncate max-w-[200px] sm:max-w-md">
                {contentData?.data?.file_name}
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
              {isPopQuizLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              <span>Pop Quiz</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Download className="w-4 h-4 mr-2" /> Export PDF
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Share2 className="w-4 h-4 mr-2" /> Share Document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ResizablePanelGroup direction="horizontal" className="flex-1 h-full">
          <ResizablePanel
            defaultSize={60}
            minSize={30}
            className="bg-muted/5 relative flex flex-col"
          >
            <Tabs
              defaultValue="document"
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              <div className="px-4 border-b bg-background flex justify-center shrink-0">
                <TabsList className="h-9 bg-transparent w-full max-w-md justify-center">
                  <TabsTrigger
                    value="document"
                    className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 pb-2 pt-1.5 text-xs flex items-center justify-center gap-2"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Document
                  </TabsTrigger>
                  <TabsTrigger
                    value="analysis"
                    className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 pb-2 pt-1.5 text-xs flex items-center justify-center gap-2"
                  >
                    <Star className="w-3.5 h-3.5" /> Smart Analysis
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 relative overflow-hidden">
                <TabsContent
                  value="document"
                  className="h-full m-0 border-0 data-[state=inactive]:hidden"
                >
                  {urlData?.data?.signedUrl ? (
                    <div className="h-full w-full bg-zinc-100 dark:bg-zinc-950">
                      <div className="h-full w-full overflow-hidden">
                        <PdfViewer
                          url={urlData.data.signedUrl}
                          onTextSelect={handleMouseUpCapture}
                        />
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="h-full w-full bg-zinc-50 dark:bg-zinc-950">
                      <div
                        className="min-h-full py-8 px-4 flex justify-center"
                        onMouseUp={handleMouseUpCapture}
                      >
                        <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 shadow-sm border rounded-xl p-8 md:p-12 min-h-[80vh]">
                          <MarkdownViewer
                            content={contentData?.data?.extracted_text || ''}
                          />
                        </div>
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent
                  value="analysis"
                  className="h-full m-0 overflow-y-auto data-[state=inactive]:hidden bg-zinc-50 dark:bg-zinc-950"
                >
                  <div className="max-w-4xl mx-auto p-6 space-y-8">
                    <div className="flex flex-col gap-2">
                      <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
                        <Star className="w-6 h-6 text-primary" /> 
                        Document Intelligence
                      </h2>
                      <p className="text-muted-foreground">
                        AI-generated insights, key takeaways, and study materials based on this file.
                      </p>
                    </div>

                    {!insightsData?.data ? (
                      <div className="grid gap-4">
                         <div className="h-32 w-full bg-muted/50 rounded-xl animate-pulse" />
                         <div className="grid grid-cols-2 gap-4">
                            <div className="h-24 w-full bg-muted/50 rounded-xl animate-pulse" />
                            <div className="h-24 w-full bg-muted/50 rounded-xl animate-pulse" />
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Card className="border-none shadow-md bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-zinc-900">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                              <Target className="w-5 h-5" /> Executive Summary
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-3">
                              {(insightsData.data.mainArguments || []).map((arg, i) => (
                                <li key={i} className="flex gap-3 text-sm text-foreground/80">
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="leading-relaxed">{safeRender(arg)}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>

                        <div>
                          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-yellow-500" /> Key Concepts
                          </h3>
                          <div className="flex flex-wrap gap-2 p-6 bg-white dark:bg-zinc-900 border rounded-xl shadow-sm">
                            {(insightsData.data.keyConcepts || []).map((c, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="px-3 py-1.5 text-sm font-normal cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all border-primary/20"
                                onClick={() => chatRef.current?.sendMessage(`Tell me more about "${safeRender(c)}" in the context of this document.`)}
                              >
                                {safeRender(c)}
                              </Badge>
                            ))}
                            {(!insightsData.data.keyConcepts || insightsData.data.keyConcepts.length === 0) && (
                               <span className="text-muted-foreground text-sm">No concepts extracted.</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <HelpCircle className="w-5 h-5 text-blue-500" /> Practice Questions
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(insightsData.data.examQuestions || []).map((q, i) => (
                              <div
                                key={i}
                                onClick={() => chatRef.current?.sendMessage(`I want to answer this question: "${safeRender(q)}". Please grade my answer.`)}
                                className="group relative p-5 rounded-xl border bg-card hover:shadow-md hover:border-primary/50 cursor-pointer transition-all"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="space-y-1">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                      Question {i + 1}
                                    </span>
                                    <p className="text-sm font-medium leading-snug line-clamp-3 text-foreground/90">
                                      {safeRender(q)}
                                    </p>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
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

          <ResizableHandle withHandle />

          <ResizablePanel
            defaultSize={40}
            minSize={25}
            className="bg-background flex flex-col"
            data-chat-panel="true"
          >
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