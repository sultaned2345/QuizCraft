// src/app/(app)/documents/[documentId]/page.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2,
  ArrowLeft,
  FileText,
  Sparkles,
  Target,
  Zap,
  ChevronRight,
  Lightbulb,
  MoreVertical,
  Download,
  Share2,
  BrainCircuit,
  BookOpen,
  ListChecks,
  EyeOff,
  Youtube,
  Cpu,
  ScanLine
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { PdfViewer } from '@/components/PdfViewer';
import { FilePreviewFallback } from '@/components/FilePreviewFallback';
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

// --- Dynamic Imports ---
const PopQuizModal = dynamic(
  () => import('@/components/PopQuizModal').then((mod) => mod.PopQuizModal),
  {
    ssr: false,
    loading: () => <div className="hidden" />,
  }
);

// --- Helpers ---
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

// --- YouTube Embed Component ---
const YouTubeEmbed = ({ videoUrl }: { videoUrl: string }) => {
  let videoId = null;
  if (videoUrl.includes('youtu.be/')) {
      videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
  } else if (videoUrl.includes('v=')) {
      videoId = videoUrl.split('v=')[1]?.split('&')[0];
  }

  if (!videoId) return (
    <div className="p-8 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-white/10 font-mono text-xs">
       <Youtube className="w-10 h-10 mx-auto mb-2 opacity-50" />
       <p>SIGNAL LOST / INVALID URL</p>
    </div>
  );

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden shadow-[0_0_30px_-5px_rgba(0,0,0,0.5)] border border-white/10 bg-black relative group">
      <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-white/10 group-hover:ring-primary/50 transition-all z-10" />
      <iframe
        width="100%"
        height="100%"
        src={`https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
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

// --- Selection Menu Component (Cyber HUD Style) ---
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
      className="fixed z-50 flex flex-col gap-1 p-1.5 bg-zinc-950/90 backdrop-blur-md text-foreground border border-primary/30 rounded-lg shadow-[0_0_20px_-5px_var(--primary)] animate-in fade-in zoom-in-95 duration-150 -translate-y-full -translate-x-1/2 mt-[-15px]"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('explain')}
          className="h-8 px-3 text-xs font-mono hover:bg-primary/20 hover:text-primary"
        >
          <Sparkles className="w-3.5 h-3.5 mr-2" /> ANALYZE
        </Button>
        <div className="w-px h-4 bg-white/10" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('summarize')}
          className="h-8 px-3 text-xs font-mono hover:bg-emerald-500/20 hover:text-emerald-500"
        >
          <FileText className="w-3.5 h-3.5 mr-2" /> TL;DR
        </Button>
        <div className="w-px h-4 bg-white/10" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('question')}
          className="h-8 px-3 text-xs font-mono hover:bg-amber-500/20 hover:text-amber-500"
        >
          <Zap className="w-3.5 h-3.5 mr-2" /> QUIZ
        </Button>
      </div>
      {/* Decorative Arrow */}
      <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-zinc-950 border-r border-b border-primary/30 rotate-45" />
    </div>
  );
}

const swrOptions = { revalidateOnFocus: false };

export default function DocumentViewPage() {
  const [isPopQuizOpen, setIsPopQuizOpen] = useState(false);
  const [popQuizQuestions, setPopQuizQuestions] = useState<Question[]>([]);
  const [isPopQuizLoading, setIsPopQuizLoading] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
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
    ApiResponse<{ extracted_text: string; file_name: string; file_type?: string }>
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

  const { data: urlData } = useSWR<ApiResponse<{ signedUrl: string }>>(
    session ? `/api/documents/${documentId}/url` : null,
    (url) => fetcher(url, session!.access_token),
    swrOptions,
  );

  const fileName = contentData?.data?.file_name || "";
  const signedUrl = urlData?.data?.signedUrl || "";
  
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const isYoutube = 
    contentData?.data?.file_type === 'youtube' || 
    signedUrl.includes('youtube.com') || 
    signedUrl.includes('youtu.be');

  const isLoading = !contentData;

  // --- Handlers ---
  const handleStartPopQuiz = async () => {
    if (!session || isPopQuizLoading) return;
    setIsPopQuizLoading(true);
    toast({ title: 'INITIATING SIMULATION...', description: 'Analyzing vector patterns...' });
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
      toast({ title: 'SYSTEM ERROR', description: e.message, variant: 'destructive' });
    } finally {
      setIsPopQuizLoading(false);
    }
  };

  const handleMouseUpCapture = (e: React.MouseEvent) => {
    const chatPanel = (e.target as HTMLElement).closest(
      'div[data-chat-panel="true"]',
    );
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
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <div className="relative">
                <div className="h-16 w-16 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Cpu className="w-6 h-6 text-primary animate-pulse" />
                </div>
            </div>
            <div className="text-sm font-mono text-primary/70 animate-pulse">
                DECRYPTING DATA STREAM...
            </div>
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

      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {/* HUD Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-background/80 backdrop-blur-xl z-10">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/documents')}
              className="h-9 w-9 rounded-lg hover:bg-white/5"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-bold font-mono truncate max-w-[200px] sm:max-w-md text-foreground tracking-tight">
                {contentData?.data?.file_name.toUpperCase()}
              </h1>
              <span className="text-[10px] text-primary/70 font-mono flex items-center gap-2">
                {isYoutube ? <Youtube className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                <span className="tracking-wider">
                    {isYoutube ? 'VIDEO_FEED' : isPdf ? 'PDF_DOCUMENT' : 'TEXT_FILE'} • SECURE
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartPopQuiz}
              disabled={isPopQuizLoading}
              className="hidden sm:flex h-9 gap-2 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/50 transition-all font-mono text-xs uppercase tracking-wide relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-primary/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              {isPopQuizLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 fill-primary" />
              )}
              <span>Initialize Quiz</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/5">
                  <MoreVertical className="w-5 h-5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-950 border-white/10 text-zinc-300">
                <DropdownMenuItem onClick={() => {
                   if (urlData?.data?.signedUrl) {
                     window.open(urlData.data.signedUrl, '_blank');
                   } else {
                     toast({ title: "ACCESS DENIED", description: "Download link generation failed." });
                   }
                }} className="font-mono text-xs focus:bg-primary/20 focus:text-primary">
                  <Download className="w-3.5 h-3.5 mr-2" /> 
                  {isYoutube ? 'OPEN SOURCE' : 'DOWNLOAD DATA'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Resizable Content Area */}
        <ResizablePanelGroup direction="horizontal" className="flex-1 h-full">
          {/* Left Panel: Content */}
          <ResizablePanel
            defaultSize={60}
            minSize={30}
            className="bg-zinc-950/50 relative flex flex-col"
          >
            <Tabs
              defaultValue="document"
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              <div className="px-4 border-b border-white/5 bg-background flex justify-center shrink-0">
                <TabsList className="h-10 bg-zinc-900/50 border border-white/5 p-1 w-full max-w-md justify-center rounded-lg">
                  <TabsTrigger
                    value="document"
                    className="flex-1 rounded-md data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none font-mono text-xs uppercase tracking-wide"
                  >
                    <ScanLine className="w-3.5 h-3.5 mr-2" /> Raw Data
                  </TabsTrigger>
                  <TabsTrigger
                    value="analysis"
                    className="flex-1 rounded-md data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none font-mono text-xs uppercase tracking-wide"
                  >
                    <BrainCircuit className="w-3.5 h-3.5 mr-2" /> Neural Analysis
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 relative overflow-hidden">
                <TabsContent
                  value="document"
                  className="h-full m-0 border-0 data-[state=inactive]:hidden"
                >
                  {isYoutube ? (
                    // CASE 1: YouTube Video + Transcript
                    <ScrollArea className="h-full w-full bg-black/20">
                        <div className="max-w-4xl mx-auto p-6 space-y-8" onMouseUp={handleMouseUpCapture}>
                            <YouTubeEmbed videoUrl={signedUrl} />
                            
                            <div className="prose prose-invert max-w-none">
                                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                                    <FileText className="w-4 h-4 text-primary" />
                                    <h3 className="text-lg font-mono font-bold m-0 tracking-tight text-white">AUDIO_TRANSCRIPT_LOG</h3>
                                </div>
                                <div className="pt-4 text-zinc-400 font-sans leading-relaxed">
                                    <MarkdownViewer content={contentData?.data?.extracted_text || '*Signal weak. No transcript available.*'} />
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                  ) : urlData?.data?.signedUrl && isPdf ? (
                    // CASE 2: Valid PDF Viewer
                    <div className="h-full w-full bg-zinc-950">
                      <div className="h-full w-full overflow-hidden">
                        <PdfViewer
                          url={urlData.data.signedUrl}
                          onTextSelect={handleMouseUpCapture}
                        />
                      </div>
                    </div>
                  ) : showRawText ? (
                    // CASE 3: Text View
                    <ScrollArea className="h-full w-full bg-zinc-950">
                       <div className="sticky top-0 z-10 p-2 flex justify-center bg-transparent pointer-events-none">
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                className="shadow-lg pointer-events-auto bg-zinc-800 text-zinc-300 border border-white/10 hover:bg-zinc-700 font-mono text-xs"
                                onClick={() => setShowRawText(false)}
                            >
                                <EyeOff className="w-3 h-3 mr-2" /> CLOSE_TEXT_VIEW
                            </Button>
                        </div>
                      <div
                        className="min-h-full py-8 px-4 flex justify-center"
                        onMouseUp={handleMouseUpCapture}
                      >
                        <div className="w-full max-w-3xl bg-zinc-900 shadow-xl border border-white/5 rounded-xl p-8 md:p-12 min-h-[80vh]">
                          <MarkdownViewer
                            content={contentData?.data?.extracted_text || ''}
                          />
                        </div>
                      </div>
                    </ScrollArea>
                  ) : (
                    // CASE 4: Fallback
                     <FilePreviewFallback 
                        fileName={contentData?.data?.file_name || "Unknown"}
                        downloadUrl={urlData?.data?.signedUrl}
                        onViewText={() => setShowRawText(true)}
                    />
                  )}
                </TabsContent>

                <TabsContent
                  value="analysis"
                  className="h-full m-0 overflow-y-auto data-[state=inactive]:hidden bg-background"
                >
                  <div className="max-w-4xl mx-auto p-6 space-y-8">
                    {/* Header Section */}
                    <div className="flex flex-col gap-2 border-b border-white/5 pb-6">
                      <h2 className="text-xl font-bold font-mono flex items-center gap-3 text-white">
                        <Sparkles className="w-5 h-5 text-primary animate-pulse" /> 
                        INTELLIGENCE_REPORT
                      </h2>
                      <p className="text-sm text-muted-foreground font-mono">
                        Generated by Neural Engine v4.0
                      </p>
                    </div>

                    {!insightsData?.data ? (
                      /* Loading Skeleton */
                      <div className="grid gap-4 opacity-50">
                         <div className="h-32 w-full bg-white/5 rounded-xl border border-white/5 animate-pulse" />
                         <div className="grid grid-cols-2 gap-4">
                            <div className="h-24 w-full bg-white/5 rounded-xl border border-white/5 animate-pulse" />
                            <div className="h-24 w-full bg-white/5 rounded-xl border border-white/5 animate-pulse" />
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        {/* 1. Executive Summary */}
                        <div className="relative group">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-500" />
                          <Card className="relative border-white/10 bg-zinc-900/80 backdrop-blur-sm">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-emerald-400 font-mono text-sm uppercase tracking-wider">
                                <Target className="w-4 h-4" /> Core Directives
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-3">
                                {(insightsData.data.mainArguments || []).map((arg, i) => (
                                  <li key={i} className="flex gap-3 text-sm text-zinc-300">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-none bg-emerald-500 shrink-0" />
                                    <span className="leading-relaxed font-sans">{safeRender(arg)}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        </div>

                        {/* 2. Key Concepts Cloud */}
                        <div>
                          <h3 className="text-sm font-bold font-mono text-yellow-500 mb-4 flex items-center gap-2 uppercase tracking-wider">
                            <Lightbulb className="w-4 h-4" /> Semantic Nodes
                          </h3>
                          <div className="flex flex-wrap gap-2 p-6 bg-zinc-900/50 border border-white/10 rounded-xl">
                            {(insightsData.data.keyConcepts || []).map((c, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="px-3 py-1.5 text-xs font-mono cursor-pointer bg-black/40 border-primary/30 text-primary hover:bg-primary hover:text-black hover:border-primary transition-all"
                                onClick={() => chatRef.current?.sendMessage(`Analyze semantic node: "${safeRender(c)}"`)}
                              >
                                {safeRender(c)}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* 3. Interactive Practice Questions */}
                        <div>
                          <h3 className="text-sm font-bold font-mono text-blue-500 mb-4 flex items-center gap-2 uppercase tracking-wider">
                            <ListChecks className="w-4 h-4" /> Simulation Scenarios
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(insightsData.data.examQuestions || []).map((q, i) => (
                              <div
                                key={i}
                                onClick={() => chatRef.current?.sendMessage(`Run simulation: "${safeRender(q)}"`)}
                                className="group relative p-5 rounded-xl border border-white/10 bg-zinc-900/50 hover:bg-zinc-800/80 hover:border-blue-500/50 cursor-pointer transition-all"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="space-y-2">
                                    <span className="text-[10px] font-mono font-bold text-blue-500/70 uppercase tracking-widest">
                                      Scenario 0{i + 1}
                                    </span>
                                    <p className="text-sm font-medium leading-snug line-clamp-3 text-zinc-300 group-hover:text-white transition-colors">
                                      {safeRender(q)}
                                    </p>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-blue-400 transition-colors" />
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

          <ResizableHandle withHandle className="bg-white/10 hover:bg-primary/50 transition-colors w-1" />

          {/* Right Panel: Chat (The Neural Link) */}
          <ResizablePanel
            defaultSize={40}
            minSize={25}
            className="bg-background flex flex-col"
            data-chat-panel="true"
          >
            <div className="h-full flex flex-col border-l border-white/5">
              <ChatInterface
                ref={chatRef}
                context={pageContext}
                initialMessages={historyData?.data}
                isLoadingHistory={!historyData}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Pop Quiz Modal */}
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