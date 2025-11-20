// src/app/(app)/documents/[documentId]/page.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2, ArrowLeft, FileText, Sparkles, Target, Zap, ChevronRight, Lightbulb, GraduationCap,
  MoreVertical, Download, Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInterface, ChatInterfaceHandle } from '@/components/ChatInterface';
import { usePageContext, PageContextType } from '@/contexts/PageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const PopQuizModal = dynamic(
  () => import('@/components/PopQuizModal').then((mod) => mod.PopQuizModal),
  { loading: () => <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div> }
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

  const isPdf = contentData?.data?.file_name.toLowerCase().endsWith('.pdf') ?? false;
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
        setMenu({ visible: true, x: rect.left + rect.width / 2, y: rect.top, text: selectedText });
      }
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
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <SelectionMenu menu={menu} onClose={() => setMenu({ ...menu, visible: false })} onAction={handleMenuAction} />

      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
        {/* Toolbar Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
           <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.push('/documents')} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-semibold truncate max-w-[200px] sm:max-w-md">{contentData?.data?.file_name}</h1>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                {isPdf ? 'PDF Document' : 'Note'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <Button 
                variant="outline" size="sm" onClick={handleStartPopQuiz} disabled={isPopQuizLoading}
                className="h-8 hidden sm:flex gap-2 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900"
              >
               <Zap className="w-3.5 h-3.5" /> <span>Quiz Me</span>
             </Button>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem><Download className="w-4 h-4 mr-2" /> Export</DropdownMenuItem>
                  <DropdownMenuItem><Share2 className="w-4 h-4 mr-2" /> Share</DropdownMenuItem>
                </DropdownMenuContent>
             </DropdownMenu>
          </div>
        </div>

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Panel: Content */}
          <ResizablePanel defaultSize={60} minSize={30} className="bg-muted/5 relative flex flex-col">
             <Tabs defaultValue="document" className="flex-1 flex flex-col h-full">
                <div className="px-4 border-b bg-background flex justify-center">
                  <TabsList className="h-9 bg-transparent w-full max-w-md justify-center">
                    <TabsTrigger value="document" className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 pb-2 pt-1.5 text-xs">Document</TabsTrigger>
                    <TabsTrigger value="guide" className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 pb-2 pt-1.5 text-xs">AI Study Guide</TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 relative overflow-hidden">
                  <TabsContent value="document" className="h-full m-0 border-0 data-[state=inactive]:hidden">
                     {urlData?.data?.signedUrl ? (
                        <div className="h-full w-full bg-zinc-100 dark:bg-zinc-950 p-0 sm:p-4">
                           <div className="h-full w-full shadow-sm rounded-lg overflow-hidden border bg-white dark:bg-zinc-900">
                             <PdfViewer url={urlData.data.signedUrl} onTextSelect={handleMouseUpCapture} />
                           </div>
                        </div>
                     ) : (
                        <ScrollArea className="h-full w-full bg-zinc-50 dark:bg-zinc-950">
                          <div className="min-h-full py-8 px-4 flex justify-center" onMouseUp={handleMouseUpCapture}>
                             <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 shadow-sm border rounded-xl p-8 md:p-12 min-h-[80vh]">
                                <MarkdownViewer content={contentData?.data?.extracted_text || ''} />
                             </div>
                          </div>
                        </ScrollArea>
                     )}
                  </TabsContent>

                  <TabsContent value="guide" className="h-full m-0 overflow-y-auto data-[state=inactive]:hidden bg-zinc-50 dark:bg-zinc-950">
                    <div className="max-w-4xl mx-auto p-6 space-y-6">
                        <div className="p-6 rounded-xl bg-gradient-to-r from-primary/5 to-transparent border">
                          <h2 className="text-lg font-bold flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" /> AI Insights
                          </h2>
                          <p className="text-sm text-muted-foreground mt-1">Generated automatically from your document content.</p>
                        </div>

                        {!insightsData?.data ? (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="h-40 rounded-xl border border-dashed flex flex-col items-center justify-center text-muted-foreground bg-muted/50">
                                 <Loader2 className="w-6 h-6 animate-spin mb-2" /> <span className="text-xs">Extracting key concepts...</span>
                              </div>
                              <div className="h-40 rounded-xl border border-dashed flex flex-col items-center justify-center text-muted-foreground bg-muted/50">
                                 <Loader2 className="w-6 h-6 animate-spin mb-2" /> <span className="text-xs">Generating questions...</span>
                              </div>
                           </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             {/* Key Concepts */}
                             <Card>
                               <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-500"/> Core Concepts</CardTitle></CardHeader>
                               <CardContent>
                                 <div className="flex flex-wrap gap-2">
                                   {insightsData.data.keyConcepts.map((c, i) => (
                                     <Badge key={i} variant="secondary" className="px-2 py-1 text-xs font-normal">{c}</Badge>
                                   ))}
                                 </div>
                               </CardContent>
                             </Card>

                             {/* Questions Grid */}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {insightsData.data.examQuestions.map((q, i) => (
                                  <div key={i} onClick={() => chatRef.current?.sendMessage(`Quiz me on: ${q}`)} 
                                       className="p-4 rounded-lg border hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all flex items-start gap-3 group bg-card">
                                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium text-muted-foreground group-hover:border-primary group-hover:text-primary">
                                        {i+1}
                                      </span>
                                      <p className="text-sm font-medium leading-snug pt-0.5">{q}</p>
                                      <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                ))}
                             </div>
                             
                             {/* Summary Section */}
                             <Card className="border-l-4 border-l-emerald-500">
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Target className="w-4 h-4 text-emerald-500"/> Key Takeaways</CardTitle></CardHeader>
                                <CardContent className="space-y-3">
                                  {insightsData.data.mainArguments.map((arg, i) => (
                                    <div key={i} className="flex gap-3">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0"/>
                                      <p className="text-sm text-muted-foreground leading-relaxed">{arg}</p>
                                    </div>
                                  ))}
                                </CardContent>
                             </Card>
                          </div>
                        )}
                    </div>
                  </TabsContent>
                </div>
             </Tabs>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel: Chat */}
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