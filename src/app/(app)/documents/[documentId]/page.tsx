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
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Search // Added Search icon for concept nav
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
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

// --- DOM Highlighter Helper ---
/**
 * Simple client-side highlighter that finds text in the document container, 
 * wraps it in a mark tag, and scrolls to it.
 */
const highlightAndScrollToConcept = (concept: string) => {
  if (!concept) return;
  const container = document.getElementById('document-content-container');
  if (!container) return;

  // 1. Remove existing highlights
  const marks = container.querySelectorAll('mark.concept-highlight');
  marks.forEach(mark => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize(); // Merge text nodes
    }
  });

  // 2. Find and highlight new concept
  // Note: This is a basic implementation. For production PDF/Complex HTML, 
  // a more robust library like 'mark.js' is recommended.
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodesToHighlight: { node: Node, index: number }[] = [];
  const term = concept.toLowerCase();

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.tagName === 'SCRIPT' || node.parentElement?.tagName === 'STYLE') continue;
    
    const text = node.textContent?.toLowerCase();
    const index = text?.indexOf(term);
    
    if (text && index !== undefined && index >= 0) {
      nodesToHighlight.push({ node, index });
      // We only highlight the first few occurrences to avoid freezing large docs
      if (nodesToHighlight.length >= 5) break; 
    }
  }

  if (nodesToHighlight.length === 0) return false;

  // Process in reverse to keep DOM indices valid
  let firstHighlight: HTMLElement | null = null;
  
  for (let i = nodesToHighlight.length - 1; i >= 0; i--) {
    const { node, index } = nodesToHighlight[i];
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + term.length);
    
    const mark = document.createElement('mark');
    mark.className = 'concept-highlight bg-yellow-200 dark:bg-yellow-900/50 text-foreground rounded px-0.5 transition-all duration-500 ease-in-out';
    mark.textContent = concept; // Restore original casing if possible, or use text content
    
    try {
      range.surroundContents(mark);
      firstHighlight = mark;
    } catch (e) {
      console.warn("Could not highlight node (likely crossing tag boundaries)", e);
    }
  }

  // 3. Scroll to first occurrence
  if (firstHighlight) {
    (firstHighlight as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }
  return false;
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

// --- UPDATED COMPONENT: Interactive Practice Question (Socratic Mode) ---
function PracticeQuestionCard({ 
  question, 
  index,
  documentId 
}: { 
  question: string; 
  index: number;
  documentId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [isGrading, setIsGrading] = useState(false);
  
  // Feedback state: status can be 'correct', 'incorrect', or 'tutor' (ongoing conversation)
  const [feedback, setFeedback] = useState<{ 
    status: 'correct' | 'incorrect' | 'tutor'; 
    message: string 
  } | null>(null);
  
  const { session } = useAuth();
  const { toast } = useToast();

  const handleGrade = async () => {
    if (!answer.trim() || !session) return;
    
    setIsGrading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          messages: [
            { 
              role: 'user', 
              content: `You are a specialized Socratic Tutor.
              
              Question: "${question}"
              Student Answer: "${answer}"
              
              Task:
              1. If the answer is completely correct, start with "CORRECT" and briefly affirm why.
              2. If the answer is wrong or incomplete, start with "TUTOR". DO NOT reveal the correct answer. Instead, ask a thought-provoking leading question or give a hint that guides the student to correct themselves.
              3. Keep your response short (max 2-3 sentences).` 
            }
          ],
          contextId: documentId 
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const aiText = data.data.content || "";
      const lowerText = aiText.toLowerCase();
      
      let status: 'correct' | 'incorrect' | 'tutor' = 'tutor';
      
      if (lowerText.startsWith("correct") || lowerText.includes("that is correct")) {
        status = 'correct';
      } else if (lowerText.startsWith("incorrect")) {
        status = 'incorrect'; // Fallback, though prompts urges 'TUTOR'
      } else {
        status = 'tutor'; // Default to conversational mode
      }
      
      setFeedback({
        status,
        message: aiText.replace(/^(CORRECT|TUTOR|INCORRECT)[:\s-]*\s*/i, "") // Clean up prefix
      });
      
    } catch (e) {
      toast({ title: "Grading Failed", description: "Could not check answer.", variant: "destructive" });
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <Card className={cn(
      "transition-all duration-200 border-l-4",
      isOpen ? "border-l-primary shadow-md" : "border-l-transparent hover:border-l-primary/50"
    )}>
      <div 
        className="p-5 cursor-pointer flex justify-between items-start gap-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="space-y-1 flex-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            Question {index + 1}
            {feedback && (
               <span className={cn(
                 "text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1", 
                 feedback.status === 'correct' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
               )}>
                 {feedback.status === 'correct' ? <CheckCircle2 className="w-3 h-3"/> : <MessageCircle className="w-3 h-3" />}
                 {feedback.status === 'correct' ? "SOLVED" : "IN PROGRESS"}
               </span>
            )}
          </span>
          <p className="text-sm font-medium leading-relaxed text-foreground/90">
            {safeRender(question)}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {isOpen && (
        <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
           {/* If feedback exists, show it above the input for context */}
           {feedback && (
             <div className={cn(
               "mb-4 rounded-lg p-4 text-sm space-y-2 border",
               feedback.status === 'correct' 
                 ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900" 
                 : "bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900"
             )}>
                <div className="flex items-start gap-3">
                  {feedback.status === 'correct' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 flex-1">
                    <p className={cn("font-semibold", 
                      feedback.status === 'correct' ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-400"
                    )}>
                      {feedback.status === 'correct' ? "Correct!" : "Tutor Feedback"}
                    </p>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground/90">
                      <MarkdownViewer content={feedback.message} />
                    </div>
                  </div>
                </div>
             </div>
           )}

           {/* Input Area - Always visible unless correct, to allow revision */}
           {feedback?.status !== 'correct' ? (
             <div className="space-y-3">
               <Textarea 
                 placeholder={feedback ? "Revise your answer based on the hint..." : "Type your answer here..."}
                 className={cn("min-h-[100px] resize-none text-sm transition-colors", feedback && "border-blue-200 focus-visible:ring-blue-500")}
                 value={answer}
                 onChange={(e) => setAnswer(e.target.value)}
                 disabled={isGrading}
                 onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) handleGrade();
                 }}
               />
               <div className="flex justify-between items-center">
                 <p className="text-xs text-muted-foreground">
                   {feedback ? "Try again to get it right!" : "AI Tutor will guide you."}
                 </p>
                 <Button 
                   size="sm" 
                   onClick={handleGrade} 
                   disabled={!answer.trim() || isGrading}
                 >
                   {isGrading ? (
                     <>
                       <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Analyzing...
                     </>
                   ) : (
                     <>
                       <Zap className="w-3.5 h-3.5 mr-2" /> {feedback ? "Submit Revision" : "Check Answer"}
                     </>
                   )}
                 </Button>
               </div>
             </div>
           ) : (
             <div className="flex justify-end">
                <Button 
                   variant="ghost" 
                   size="sm" 
                   onClick={() => { setFeedback(null); setAnswer(''); }}
                   className="text-xs h-7"
                >
                   <RefreshCw className="w-3 h-3 mr-1.5" /> Practice Again
                </Button>
             </div>
           )}
        </div>
      )}
    </Card>
  );
}

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
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('explain')}
          className="h-7 px-2 text-xs font-medium"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5 text-sky-500" /> Explain
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
  
  // NEW: State for active concept being highlighted
  const [activeConcept, setActiveConcept] = useState<string | null>(null);
  
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

  const handleConceptClick = (concept: string) => {
    if (activeConcept === concept) {
       // Toggle off
       setActiveConcept(null);
    } else {
       // Activate and highlight
       setActiveConcept(concept);
       const found = highlightAndScrollToConcept(concept);
       if (!found) {
           toast({ description: "Could not find text match in document view.", duration: 2000 });
       }
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

        {/* Resizable Content Area */}
        <ResizablePanelGroup direction="horizontal" className="flex-1 h-full">
          {/* Left Panel: Content */}
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
                    <BrainCircuit className="w-3.5 h-3.5" /> Smart Analysis
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 relative overflow-hidden" id="document-content-container">
                <TabsContent
                  value="document"
                  className="h-full m-0 border-0 data-[state=inactive]:hidden"
                >
                  {urlData?.data?.signedUrl ? (
                    // PDF Viewer
                    <div className="h-full w-full bg-zinc-100 dark:bg-zinc-950">
                      <div className="h-full w-full overflow-hidden">
                        <PdfViewer
                          url={urlData.data.signedUrl}
                          onTextSelect={handleMouseUpCapture}
                        />
                      </div>
                    </div>
                  ) : (
                    // Markdown Viewer
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
                    {/* Header Section */}
                    <div className="flex flex-col gap-2">
                      <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
                        <Sparkles className="w-6 h-6 text-primary" /> 
                        Document Intelligence
                      </h2>
                      <p className="text-muted-foreground">
                        AI-generated insights, key takeaways, and study materials based on this file.
                      </p>
                    </div>

                    {!insightsData?.data ? (
                      /* Loading Skeleton */
                      <div className="grid gap-4">
                         <div className="h-32 w-full bg-muted/50 rounded-xl animate-pulse" />
                         <div className="grid grid-cols-2 gap-4">
                            <div className="h-24 w-full bg-muted/50 rounded-xl animate-pulse" />
                            <div className="h-24 w-full bg-muted/50 rounded-xl animate-pulse" />
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        {/* 1. Executive Summary */}
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

                        {/* 2. Key Concepts Cloud (Semantic Link Update) */}
                        <div>
                          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-yellow-500" /> Key Concepts
                          </h3>
                          <div className="flex flex-wrap gap-2 p-6 bg-white dark:bg-zinc-900 border rounded-xl shadow-sm">
                            {(insightsData.data.keyConcepts || []).map((c, i) => {
                              const conceptName = safeRender(c);
                              const isActive = activeConcept === conceptName;
                              return (
                                <Badge
                                  key={i}
                                  variant={isActive ? "default" : "outline"}
                                  className={cn(
                                    "px-3 py-1.5 text-sm font-normal cursor-pointer transition-all duration-200 select-none",
                                    isActive 
                                      ? "ring-2 ring-primary ring-offset-2" 
                                      : "hover:bg-primary/10 hover:text-primary hover:border-primary/50"
                                  )}
                                  onClick={() => handleConceptClick(conceptName)}
                                >
                                  {isActive && <Search className="w-3 h-3 mr-1.5 animate-pulse" />}
                                  {conceptName}
                                </Badge>
                              );
                            })}
                            {(!insightsData.data.keyConcepts || insightsData.data.keyConcepts.length === 0) && (
                               <span className="text-muted-foreground text-sm">No concepts extracted.</span>
                            )}
                          </div>
                          {activeConcept && (
                             <p className="text-xs text-muted-foreground mt-2 flex items-center">
                               <Search className="w-3 h-3 mr-1" />
                               Highlighting "{activeConcept}" in document view.
                             </p>
                          )}
                        </div>

                        {/* 3. Interactive Practice Questions (Socratic Mode Update) */}
                        <div>
                          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <ListChecks className="w-5 h-5 text-blue-500" /> Practice Questions
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {(insightsData.data.examQuestions || []).map((q, i) => (
                               <PracticeQuestionCard 
                                 key={i} 
                                 question={safeRender(q)} 
                                 index={i} 
                                 documentId={documentId} 
                               />
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

          {/* Right Panel: Chat */}
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