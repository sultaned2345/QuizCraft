'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2, ArrowLeft, FileText, Sparkles, Brain, HelpCircle,
  Target, Zap, BookOpen, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInterface, ChatInterfaceHandle } from '@/components/ChatInterface';
import { usePageContext, PageContextType } from '@/contexts/PageContext';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ApiResponse, Message, Question } from '@/types/database';
import dynamic from 'next/dynamic';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { PdfViewer } from '@/components/PdfViewer';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const PopQuizModal = dynamic(() => import('@/components/PopQuizModal').then((mod) => mod.PopQuizModal), {
  loading: () => <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>,
});

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
function SelectionMenu({ menu, onClose, onAction }: { menu: MenuState; onClose: () => void; onAction: (action: MenuAction) => void; }) {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!menu.visible) return null;
  return (
    <Card style={{ top: `${menu.y + 10}px`, left: `${menu.x}px` }} className="fixed z-50 p-1 flex gap-1 shadow-lg bg-background border" onMouseDown={(e) => e.stopPropagation()}>
      <Button size="sm" variant="ghost" onClick={() => onAction('explain')} className="h-8"><Sparkles className="w-4 h-4 mr-2" />Explain</Button>
      <Button size="sm" variant="ghost" onClick={() => onAction('summarize')} className="h-8"><BookOpen className="w-4 h-4 mr-2" />Summarize</Button>
      <Button size="sm" variant="ghost" onClick={() => onAction('question')} className="h-8"><Pencil className="w-4 h-4 mr-2" />Quiz Me</Button>
    </Card>
  );
}

// --- Main Page Component ---
export default function DocumentViewPage() {
  const [isPopQuizOpen, setIsPopQuizOpen] = useState(false);
  const [popQuizQuestions, setPopQuizQuestions] = useState<Question[]>([]);
  const [isPopQuizLoading, setIsPopQuizLoading] = useState(false);
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, text: '' });

  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;
  const { toast } = useToast();
  const chatRef = useRef<ChatInterfaceHandle>(null);
  const { setPageContext } = usePageContext();

  const pageContext = useMemo<PageContextType>(() => ({ type: 'document', id: documentId }), [documentId]);

  useEffect(() => {
    setPageContext(pageContext);
    return () => setPageContext(null);
  }, [setPageContext, pageContext]);

  // --- Data Fetching (Replaces 100+ lines of useEffect) ---
  const swrOptions = { revalidateOnFocus: false };

  const { data: contentData } = useSWR<ApiResponse<{ extracted_text: string; file_name: string }>>(
    session ? `/api/documents/${documentId}/content` : null, (url) => fetcher(url, session!.access_token), swrOptions
  );

  const { data: historyData } = useSWR<ApiResponse<Message[]>>(
    session ? `/api/chat/history?context_id=${documentId}` : null, (url) => fetcher(url, session!.access_token), swrOptions
  );

  const { data: insightsData } = useSWR<ApiResponse<AIDocumentInsights>>(
    session ? `/api/documents/${documentId}/insights` : null, (url) => fetcher(url, session!.access_token), swrOptions
  );

  const isPdf = contentData?.data?.file_name.toLowerCase().endsWith('.pdf') ?? false;
  const { data: urlData } = useSWR<ApiResponse<{ signedUrl: string }>>(
    session && isPdf ? `/api/documents/${documentId}/url` : null, (url) => fetcher(url, session!.access_token), swrOptions
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
    if (chatPanel) { setMenu({ visible: false, x: 0, y: 0, text: '' }); return; }
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';
    if (selectedText.length > 5 && selectedText.length < 1000) {
      setMenu({ visible: true, x: e.clientX, y: e.clientY, text: selectedText });
    } else {
      setMenu({ visible: false, x: 0, y: 0, text: '' });
    }
  };

  const handleMenuAction = (action: MenuAction) => {
    const prompt = action === 'explain' ? `Explain: "${menu.text}"` : action === 'summarize' ? `Summarize: "${menu.text}"` : `Quiz me on: "${menu.text}"`;
    chatRef.current?.sendMessage(prompt);
    setMenu({ visible: false, x: 0, y: 0, text: '' });
  };

  if (authLoading || isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <SelectionMenu menu={menu} onClose={() => setMenu({ ...menu, visible: false })} onAction={handleMenuAction} />
      
      {/* Layout Fix: Full height minus header */}
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-background/95 backdrop-blur z-10">
          <Button variant="ghost" size="sm" onClick={() => router.push('/documents')} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h1 className="text-sm font-medium truncate max-w-md">{contentData?.data?.file_name}</h1>
          <Button variant="outline" size="sm" onClick={handleStartPopQuiz} disabled={isPopQuizLoading}>
            {isPopQuizLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-2 text-yellow-500" />}
            Pop Quiz
          </Button>
        </div>

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Document Panel */}
          <ResizablePanel defaultSize={65} minSize={30}>
            <div className="h-full overflow-hidden flex flex-col">
              <Tabs defaultValue="document" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 border-b bg-muted/20">
                  <TabsList className="h-9 -mb-px bg-transparent p-0">
                    <TabsTrigger value="document" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 shadow-none">
                      Document
                    </TabsTrigger>
                    <TabsTrigger value="guide" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 shadow-none">
                      Study Guide
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="document" className="flex-1 overflow-y-auto mt-0 bg-muted/10">
                  {/* Zoom Fix: max-w-3xl container */}
                  <div className="min-h-full max-w-3xl mx-auto bg-background shadow-sm border-x">
                    {urlData?.data?.signedUrl ? (
                      <PdfViewer url={urlData.data.signedUrl} onTextSelect={handleMouseUpCapture} className="h-full" />
                    ) : (
                      <div className="p-8 pb-20" onMouseUp={handleMouseUpCapture}>
                        <MarkdownViewer content={contentData?.data?.extracted_text || ''} className="prose prose-slate dark:prose-invert max-w-none" />
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="guide" className="flex-1 overflow-y-auto mt-0 bg-background p-6">
                  <div className="max-w-3xl mx-auto space-y-8">
                    {!insightsData?.data ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Brain className="w-12 h-12 mb-4 opacity-20" />
                        <p>Generating insights...</p>
                      </div>
                    ) : (
                      <>
                        <InsightSection icon={<Target className="w-5 h-5 text-primary" />} title="Key Concepts">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {insightsData.data.keyConcepts?.map((c: string, i: number) => (
                              <div key={i} className="px-3 py-2 bg-muted/30 rounded-lg border text-sm">{c}</div>
                            ))}
                          </div>
                        </InsightSection>

                        <InsightSection icon={<HelpCircle className="w-5 h-5 text-blue-500" />} title="Review Questions">
                          <Accordion type="single" collapsible className="w-full">
                            {insightsData.data.examQuestions?.map((q: string, i: number) => (
                              <AccordionItem key={i} value={`item-${i}`}>
                                <AccordionTrigger className="text-sm text-left hover:no-underline py-3">{q}</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">
                                  Ask the AI tutor to explain this answer!
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </InsightSection>
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

// --- Helper Component ---
const InsightSection = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <section>
    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
      {icon} {title}
    </h3>
    {children}
  </section>
);