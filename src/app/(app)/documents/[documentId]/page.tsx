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
// --- FIX: Import SWR and our fetcher ---
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
// --- END FIX ---

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

// (Interfaces and SelectionMenu component are unchanged)
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
      // --- THIS IS THE FIX ---
      document.removeEventListener('mousedown', handleClickOutside);
      // --- END FIX ---
    };
  }, [onClose]);

  if (!menu.visible) return null;

  return (
    <Card
      style={{
        top: `${menu.y + 10}px`,
        left: `${menu.x}px`,
      }}
      className="fixed z-50 p-1 flex gap-1 shadow-lg"
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
  // --- REFACTORED STATE ---
  // We no longer need useState for data or loading. SWR handles it.
  const [isPopQuizOpen, setIsPopQuizOpen] = useState(false);
  const [popQuizQuestions, setPopQuizQuestions] = useState<Question[]>([]);
  const [isPopQuizLoading, setIsPopQuizLoading] = useState(false);
  const [menu, setMenu] = useState<MenuState>({
    visible: false,
    x: 0,
    y: 0,
    text: '',
  });
  // --- END REFACTORED STATE ---

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

  // --- FIX: Data fetching refactored to useSWR ---
  const swrOptions = {
    revalidateOnFocus: false, // <-- THIS IS THE CORE FIX
    onError: (error: any) => {
      toast({
        title: 'Error Loading Document',
        description: error.message || 'Failed to fetch data.',
        variant: 'destructive',
      });
      router.push('/documents');
    },
  };

  // 1. Fetch Document Content
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

  // 2. Fetch Chat History
  const { data: historyResult, error: historyError } = useSWR<
    ApiResponse<Message[]>
  >(
    session ? `/api/chat/history?context_id=${documentId}` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions,
  );

  // 3. Fetch AI Insights
  const { data: insightsResult, error: insightsError } = useSWR<
    ApiResponse<AIDocumentInsights | null>
  >(
    session ? `/api/documents/${documentId}/insights` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions,
  );

  // 4. Conditionally Fetch PDF URL
  const isPdf =
    contentResult?.data?.file_name.toLowerCase().endsWith('.pdf') ?? false;

  const { data: urlResult, error: urlError } = useSWR<
    ApiResponse<{ signedUrl: string }>
  >(
    session && isPdf ? `/api/documents/${documentId}/url` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions,
  );
  // --- END FIX ---

  // --- DERIVED STATE (from SWR) ---
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
  // --- END DERIVED STATE ---

  // Redirect if auth fails (no change)
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Pop Quiz handler (no change, this is a POST mutation)
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

  // Selection handlers (no change)
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

  // --- FIX: Updated loading state ---
  if (authLoading || isLoadingContent) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  // --- END FIX ---

  return (
    <>
      <SelectionMenu
        menu={menu}
        onClose={() => setMenu({ ...menu, visible: false })}
        onAction={handleMenuAction}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => router.push('/documents')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Documents
          </Button>
          <h1
            className="text-xl font-semibold truncate text-center"
            title={viewingContent.title}
          >
            {viewingContent.title}
          </h1>
          <div className="w-32"></div>
        </div>
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 rounded-lg border overflow-hidden"
        >
          <ResizablePanel defaultSize={50} minSize={30}>
            <Card className="flex flex-col h-full overflow-hidden border-0 rounded-none">
              <Tabs
                defaultValue="document"
                className="flex-1 flex flex-col h-full overflow-hidden"
              >
                <CardHeader className="pb-0 pt-4 px-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="document">
                      <FileText className="w-4 h-4 mr-2" />
                      Document
                    </TabsTrigger>
                    <TabsTrigger value="insights">
                      <Brain className="w-4 h-4 mr-2" />
                      AI Insights
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <TabsContent
                  value="document"
                  className="flex-1 overflow-auto mt-0"
                >
                  <CardContent className="h-full p-0">
                    {/* --- FIX: Loading state simplified --- */}
                    {isLoadingContent ? (
                      <div className="flex justify-center items-center h-full min-h-[60vh]">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : viewingContent.pdfUrl ? (
                      <PdfViewer
                        url={viewingContent.pdfUrl}
                        onTextSelect={handleMouseUpCapture}
                        className="h-full max-h-[65vh]"
                      />
                    ) : (
                      <ScrollArea className="h-full max-h-[65vh] pr-0">
                        <MarkdownViewer
                          content={
                            viewingContent.text ||
                            'No text extracted or file is empty.'
                          }
                          className="p-4"
                          onMouseUpCapture={handleMouseUpCapture}
                        />
                      </ScrollArea>
                    )}
                    {/* --- END FIX --- */}
                  </CardContent>
                </TabsContent>
                <TabsContent
                  value="insights"
                  className="flex-1 overflow-auto mt-0"
                >
                  <CardContent className="p-4">
                    {/* --- FIX: Loading state simplified --- */}
                    {isLoadingInsights ? (
                      <div className="space-y-4 p-4">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-6 w-1/3 mt-4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    ) : !insights ? (
                      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-muted-foreground text-center">
                        <Brain className="w-12 h-12 mb-4" />
                        <p className="font-medium">
                          No AI Insights Generated
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6 p-1">
                        <InsightSection
                          icon={
                            <HelpCircle className="w-4 h-4 text-blue-500" />
                          }
                          title="Potential Exam Questions"
                        >
                          {insights.examQuestions.length > 0 ? (
                            <>
                              <ul className="list-disc pl-0 space-y-1 text-sm text-muted-foreground">
                                {insights.examQuestions.map((q, i) => (
                                  <li key={i}>{q}</li>
                                ))}
                              </ul>
                              <Button
                                size="sm"
                                className="mt-4"
                                onClick={handleStartPopQuiz}
                                disabled={isPopQuizLoading}
                              >
                                {isPopQuizLoading ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Zap className="w-4 h-4 mr-2" />
                                )}
                                Start Pop Quiz
                              </Button>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              No specific exam questions were generated.
                            </p>
                          )}
                        </InsightSection>
                        <InsightSection
                          icon={
                            <Target className="w-4 h-4 text-primary" />
                          }
                          title="Main Arguments"
                        >
                          {insights.mainArguments.length > 0 ? (
                            <ul className="list-disc pl-0 space-y-1 text-sm text-muted-foreground">
                              {insights.mainArguments.map((arg, i) => (
                                <li key={i}>{arg}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              No main arguments extracted.
                            </p>
                          )}
                        </InsightSection>
                        <InsightSection
                          icon={
                            <Sparkles className="w-4 h-4 text-yellow-500" />
                          }
                          title="Key Concepts"
                        >
                          {insights.keyConcepts.length > 0 ? (
                            <ul className="list-disc pl-0 space-y-1 text-sm text-muted-foreground">
                              {insights.keyConcepts.map((concept, i) => (
                                <li key={i}>{concept}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              No key concepts extracted.
                            </p>
                          )}
                        </InsightSection>
                      </div>
                    )}
                    {/* --- END FIX --- */}
                  </CardContent>
                </TabsContent>
              </Tabs>
            </Card>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50} minSize={30}>
            <Card
              className="flex flex-col h-full overflow-hidden border-0 rounded-none"
              data-chat-panel="true"
            >
              <CardHeader className="pt-4 pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  AI Tutor
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden h-full p-0">
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
  <div className="space-y-2">
    <h3 className="flex items-center gap-2 font-semibold">
      {icon}
      <span>{title}</span>
    </h3>
    <div className="pl-6">{children}</div>
  </div>
);