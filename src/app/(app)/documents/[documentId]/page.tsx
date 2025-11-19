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
  HelpCircle,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!menu.visible) return null;
  return (
    <div
      style={{ top: `${menu.y + 10}px`, left: `${menu.x}px` }}
      className="fixed z-50 flex flex-col gap-1 p-1 bg-background/95 backdrop-blur-sm border rounded-lg shadow-xl animate-in fade-in zoom-in duration-200"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onAction('explain')}
        className="h-8 justify-start text-xs"
      >
        <Sparkles className="w-3 h-3 mr-2 text-blue-500" />
        Explain
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onAction('summarize')}
        className="h-8 justify-start text-xs"
      >
        <BookOpen className="w-3 h-3 mr-2 text-green-500" />
        Summarize
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onAction('question')}
        className="h-8 justify-start text-xs"
      >
        <Pencil className="w-3 h-3 mr-2 text-orange-500" />
        Quiz Me
      </Button>
    </div>
  );
}

// --- Main Page Component ---
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
        ? `Explain: "${menu.text}"`
        : action === 'summarize'
          ? `Summarize: "${menu.text}"`
          : `Quiz me on: "${menu.text}"`;
    chatRef.current?.sendMessage(prompt);
    setMenu({ visible: false, x: 0, y: 0, text: '' });
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

      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
        {/* Modern Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b shrink-0 bg-background/80 backdrop-blur-md z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/documents')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-sm font-medium truncate max-w-md flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {contentData?.data?.file_name}
            </h1>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={handleStartPopQuiz}
            disabled={isPopQuizLoading}
            className="shadow-sm hover:shadow-md transition-all"
          >
            {isPopQuizLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
            ) : (
              <Zap className="w-3.5 h-3.5 mr-2 fill-current" />
            )}
            Pop Quiz
          </Button>
        </div>

        {/* Main Content Layout */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Document & Study Guide Panel */}
          <ResizablePanel defaultSize={65} minSize={30}>
            <div className="h-full overflow-hidden flex flex-col bg-muted/5">
              <Tabs
                defaultValue="document"
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="px-6 border-b bg-background">
                  <TabsList className="h-10 -mb-px bg-transparent p-0 space-x-4">
                    <TabsTrigger
                      value="document"
                      className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary px-2 bg-transparent shadow-none transition-all"
                    >
                      Document View
                    </TabsTrigger>
                    <TabsTrigger
                      value="guide"
                      className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary px-2 bg-transparent shadow-none transition-all"
                    >
                      Study Guide
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent
                  value="document"
                  className="flex-1 overflow-hidden mt-0 relative"
                >
                  {urlData?.data?.signedUrl ? (
                    // FIX: Full width PDF viewer
                    <div className="h-full w-full">
                      <PdfViewer
                        url={urlData.data.signedUrl}
                        onTextSelect={handleMouseUpCapture}
                        className="h-full w-full"
                      />
                    </div>
                  ) : (
                    // Markdown view with nice centering but readable width
                    <div
                      className="h-full overflow-y-auto p-8 pb-20"
                      onMouseUp={handleMouseUpCapture}
                    >
                      <div className="max-w-4xl mx-auto bg-card shadow-sm border rounded-xl p-8 min-h-full">
                        <MarkdownViewer
                          content={contentData?.data?.extracted_text || ''}
                          className="prose prose-slate dark:prose-invert max-w-none"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent
                  value="guide"
                  className="flex-1 overflow-y-auto mt-0 p-6 lg:p-10"
                >
                  <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
                    {!insightsData?.data ? (
                      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <Brain className="w-16 h-16 mb-6 opacity-10 animate-pulse" />
                        <p className="text-lg font-medium">Analyzing document structure...</p>
                      </div>
                    ) : (
                      <>
                        {/* 1. Key Concepts Section (Visual Tags) */}
                        <section>
                          <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Lightbulb className="w-5 h-5 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold">
                              Core Concepts
                            </h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {insightsData.data.keyConcepts?.map(
                              (concept, i) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="px-3 py-1.5 text-sm font-medium hover:bg-primary/20 transition-colors cursor-default"
                                >
                                  {concept}
                                </Badge>
                              ),
                            )}
                          </div>
                        </section>

                        {/* 2. Practice Questions (Interactive Cards) */}
                        <section>
                          <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                              <GraduationCap className="w-5 h-5 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-semibold">
                              Knowledge Check
                            </h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {insightsData.data.examQuestions?.map(
                              (q, i) => (
                                <Card
                                  key={i}
                                  className="group hover:shadow-md transition-all border-muted-foreground/10 hover:border-primary/30 cursor-pointer"
                                  onClick={() => {
                                    chatRef.current?.sendMessage(
                                      `Quiz me on this question: "${q}"`,
                                    );
                                  }}
                                >
                                  <CardContent className="p-5 flex justify-between items-start gap-4">
                                    <div className="space-y-2">
                                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        Question {i + 1}
                                      </div>
                                      <p className="font-medium leading-snug group-hover:text-primary transition-colors">
                                        {q}
                                      </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform mt-1" />
                                  </CardContent>
                                </Card>
                              ),
                            )}
                          </div>
                        </section>
                        
                        {/* 3. Main Arguments (Summary Card) */}
                        <section>
                           <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-orange-500/10 rounded-lg">
                              <Target className="w-5 h-5 text-orange-500" />
                            </div>
                            <h3 className="text-lg font-semibold">
                              Key Takeaways
                            </h3>
                          </div>
                          <Card className="bg-orange-50/50 dark:bg-orange-950/10 border-orange-100 dark:border-orange-900/20">
                            <CardContent className="p-6 space-y-4">
                                {insightsData.data.mainArguments?.map((arg, i) => (
                                  <div key={i} className="flex gap-3 items-start">
                                    <div className="min-w-[24px] h-6 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xs font-bold mt-0.5">
                                      {i + 1}
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{arg}</p>
                                  </div>
                                ))}
                            </CardContent>
                          </Card>
                        </section>
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Chat Panel */}
          <ResizablePanel defaultSize={35} minSize={25}>
            <ChatInterface
              ref={chatRef}
              context={pageContext}
              initialMessages={historyData?.data}
              isLoadingHistory={!historyData}
              className="h-full border-l"
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