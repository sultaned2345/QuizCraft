// src/app/(app)/documents/[documentId]/page.tsx
'use client';

import { useState, useEffect, useMemo, Fragment, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2,
  ArrowLeft,
  FileText,
  StickyNote,
  FileQuestion,
  Layers,
  Sparkles,
  Brain,
  HelpCircle,
  Target,
  Zap,
  BookOpen,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInterface, ChatInterfaceHandle } from '@/components/ChatInterface';
import { usePageContext, PageContextType } from '@/contexts/PageContext';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ApiResponse, Message, Question } from '@/types/database';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const PopQuizModal = dynamic(
  () => import('@/components/PopQuizModal').then((mod) => mod.PopQuizModal),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    ),
  },
);

interface ViewingContentState {
  title: string;
  text: string | null;
  pdfUrl: string | null;
}
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
    const handleClickOutside = () => {
      onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  if (!menu.visible) return null;

  return (
    <Card
      style={{
        top: `${menu.y + 10}px`,
        left: `${menu.x}px`,
      }}
      className="fixed z-50 p-1 flex gap-1 shadow-lg bg-background border"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onAction('explain')}
        className="h-8"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Explain
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onAction('summarize')}
        className="h-8"
      >
        <BookOpen className="w-4 h-4 mr-2" />
        Summarize
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onAction('question')}
        className="h-8"
      >
        <Pencil className="w-4 h-4 mr-2" />
        Make Question
      </Button>
    </Card>
  );
}

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
  const pageContext = useMemo(
    (): PageContextType => ({
      type: 'document',
      id: documentId,
    }),
    [documentId],
  );

  useEffect(() => {
    setPageContext(pageContext);
    return () => setPageContext(null);
  }, [setPageContext, pageContext]);

  const swrOptions = {
    revalidateOnFocus: false,
    onError: (error: any) => {
      toast({
        title: 'Error Loading Document',
        description: error.message || 'Failed to fetch data.',
        variant: 'destructive',
      });
      // router.push('/documents'); // Optional: Uncomment if you want strict redirection
    },
  };

  const { data: contentResult, error: contentError } = useSWR<
    ApiResponse<{
      extracted_text: string | null;
      file_name: string;
    }>
  >(
    session ? `/api/documents/${documentId}/content` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions,
  );

  const { data: historyResult, error: historyError } = useSWR<
    ApiResponse<Message[]>
  >(
    session ? `/api/chat/history?context_id=${documentId}` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions,
  );

  const { data: insightsResult, error: insightsError } = useSWR<
    ApiResponse<AIDocumentInsights | null>
  >(
    session ? `/api/documents/${documentId}/insights` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions,
  );

  const isPdf =
    contentResult?.data?.file_name.toLowerCase().endsWith('.pdf') ?? false;

  const { data: urlResult, error: urlError } = useSWR<
    ApiResponse<{ signedUrl: string }>
  >(
    session && isPdf ? `/api/documents/${documentId}/url` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions,
  );

  const isLoadingContent = !contentResult && !contentError;
  const isHistoryLoading = !historyResult && !historyError;
  const isLoadingInsights = !insightsResult && !insightsError;

  const viewingContent = useMemo((): ViewingContentState => {
    return {
      title: contentResult?.data?.file_name || 'Loading...',
      text: contentResult?.data?.extracted_text || null,
      pdfUrl: urlResult?.data?.signedUrl || null,
    };
  }, [contentResult, urlResult]);

  const chatHistory = historyResult?.data || [];
  const insights = insightsResult?.data || null;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const handleStartPopQuiz = async () => {
    if (!session || isPopQuizLoading) return;
    setIsPopQuizLoading(true);
    toast({
      title: 'Generating Pop Quiz...',
      description: 'Please wait, the AI is creating questions.',
    });
    try {
      const response = await fetch('/api/generate-pop-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ documentId: documentId }),
      });
      const result: ApiResponse<{ questions: Question[] }> =
        await response.json();
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Failed to generate pop quiz.');
      }
      setPopQuizQuestions(result.data.questions);
      setIsPopQuizOpen(true);
    } catch (err: any) {
      toast({
        title: 'Pop Quiz Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsPopQuizLoading(false);
    }
  };

  const handleMouseUpCapture = (e: React.MouseEvent) => {
    const chatPanel = (e.target as HTMLElement).closest(
      'div[data-chat-panel="true"]',
    );
    if (chatPanel) {
      setMenu({ visible: false, x: 0, y: 0, text: '' });
      return;
    }
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';
    if (selectedText.length > 5 && selectedText.length < 1000) {
      setMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        text: selectedText,
      });
    } else {
      setMenu({ visible: false, x: 0, y: 0, text: '' });
    }
  };

  const handleMenuAction = (action: MenuAction) => {
    const prompt =
      action === 'explain'
        ? `Explain this concept in simple terms:\n\n"${menu.text}"`
        : action === 'summarize'
          ? `Summarize this text in one paragraph:\n\n"${menu.text}"`
          : `Create a single, challenging practice question (with an answer) based on this text:\n\n"${menu.text}"`;
    chatRef.current?.sendMessage(prompt);
    setMenu({ visible: false, x: 0, y: 0, text: '' });
  };

  if (authLoading || isLoadingContent) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
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

      {/* LAYOUT FIX: 
        1. h-[calc(100vh-4rem)] ensures it takes exactly the viewport height minus header (approx).
        2. overflow-hidden prevents the entire page from scrolling.
      */}
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b shrink-0 bg-background z-10">
          <Button variant="ghost" onClick={() => router.push('/documents')} className="shrink-0">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1
            className="text-lg font-semibold truncate text-center px-4"
            title={viewingContent.title}
          >
            {viewingContent.title}
          </h1>
          {/* Empty div for header balance */}
          <div className="w-20"></div>
        </div>

        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 overflow-hidden"
        >
          <ResizablePanel defaultSize={60} minSize={30}>
            <Card className="flex flex-col h-full border-0 rounded-none shadow-none">
              <Tabs
                defaultValue="document"
                className="flex-1 flex flex-col h-full overflow-hidden"
              >
                <div className="px-4 pt-2 shrink-0">
                  <TabsList className="grid w-full grid-cols-2 mb-2">
                    <TabsTrigger value="document">
                      <FileText className="w-4 h-4 mr-2" />
                      Document
                    </TabsTrigger>
                    <TabsTrigger value="insights">
                      <Brain className="w-4 h-4 mr-2" />
                      AI Insights
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent
                  value="document"
                  className="flex-1 overflow-hidden mt-0 h-full"
                >
                  {/* ZOOM FIX: 
                     The `max-w-5xl mx-auto` constraint prevents content from becoming too wide 
                     on large monitors, which gives the "zoomed in" feeling.
                  */}
                  <div className="h-full overflow-auto bg-muted/10">
                    <div className="h-full max-w-5xl mx-auto bg-background shadow-sm min-h-full border-x">
                      {isLoadingContent ? (
                        <div className="flex justify-center items-center h-full">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : viewingContent.pdfUrl ? (
                        <PdfViewer
                          url={viewingContent.pdfUrl}
                          onTextSelect={handleMouseUpCapture}
                          className="h-full"
                        />
                      ) : (
                        <div className="p-8 h-full">
                          <MarkdownViewer
                            content={
                              viewingContent.text ||
                              'No text extracted or file is empty.'
                            }
                            className="prose dark:prose-invert max-w-none"
                            onMouseUpCapture={handleMouseUpCapture}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent
                  value="insights"
                  className="flex-1 overflow-auto mt-0 p-4 bg-muted/5"
                >
                  <div className="max-w-3xl mx-auto">
                    {isLoadingInsights ? (
                      <div className="space-y-4">
                        <Skeleton className="h-8 w-1/3" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-8 w-1/3 mt-8" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    ) : !insights ? (
                      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <Brain className="w-16 h-16 mb-4 opacity-20" />
                        <p>No AI Insights Generated</p>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <InsightSection
                          icon={<HelpCircle className="w-5 h-5 text-blue-500" />}
                          title="Exam Prep Questions"
                        >
                          {insights.examQuestions.length > 0 ? (
                            <div className="space-y-4">
                               <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                                {insights.examQuestions.map((q, i) => (
                                  <li key={i}>{q}</li>
                                ))}
                              </ul>
                              <Button
                                onClick={handleStartPopQuiz}
                                disabled={isPopQuizLoading}
                                className="w-full sm:w-auto"
                              >
                                {isPopQuizLoading ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Zap className="w-4 h-4 mr-2" />
                                )}
                                Generate Practice Quiz
                              </Button>
                            </div>
                          ) : (
                            <p className="italic text-muted-foreground">No exam questions generated.</p>
                          )}
                        </InsightSection>

                        <InsightSection
                          icon={<Target className="w-5 h-5 text-primary" />}
                          title="Key Arguments"
                        >
                          <ul className="space-y-2">
                            {insights.mainArguments.map((arg, i) => (
                              <li key={i} className="flex gap-3 text-muted-foreground bg-card p-3 rounded-lg border">
                                <span className="font-bold text-primary/50">{(i + 1).toString().padStart(2, '0')}</span>
                                <span>{arg}</span>
                              </li>
                            ))}
                          </ul>
                        </InsightSection>

                        <InsightSection
                          icon={<Sparkles className="w-5 h-5 text-yellow-500" />}
                          title="Core Concepts"
                        >
                           <div className="flex flex-wrap gap-2">
                              {insights.keyConcepts.map((concept, i) => (
                                <span key={i} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium border border-primary/20">
                                  {concept}
                                </span>
                              ))}
                           </div>
                        </InsightSection>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={40} minSize={30}>
            <Card
              className="flex flex-col h-full border-0 rounded-none border-l"
              data-chat-panel="true"
            >
              <CardHeader className="py-3 border-b shrink-0 bg-muted/30">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI Study Tutor
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0 bg-background">
                <ChatInterface
                  ref={chatRef}
                  context={pageContext}
                  initialMessages={chatHistory}
                  isLoadingHistory={isHistoryLoading}
                  className="h-full"
                />
              </CardContent>
            </Card>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {isPopQuizOpen && (
        <PopQuizModal
          isOpen={isPopQuizOpen}
          onOpenChange={setIsPopQuizOpen}
          questions={popQuizQuestions}
        />
      )}
    </>
  );
}

const InsightSection = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Card className="border shadow-sm overflow-hidden">
    <div className="bg-muted/30 px-4 py-3 border-b flex items-center gap-2 font-semibold">
      {icon}
      {title}
    </div>
    <div className="p-4">
      {children}
    </div>
  </Card>
);