// components/ChatInterface.tsx
'use client';

import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bot,
  Loader2,
  Send,
  User,
  Sparkles,
  FileQuestion,
  StickyNote,
  Layers,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageContextType } from '@/contexts/PageContext';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// --- Interfaces ---
interface Source {
  content_id: string;
  content_type: 'note' | 'document' | 'project';
  content_title: string;
  citation: number;
  content_chunk: string;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: Source[];
}

interface ChatInterfaceProps {
  context: PageContextType;
  initialMessages?: Message[];
  isLoadingHistory?: boolean;
  className?: string;
}

export interface ChatInterfaceHandle {
  sendMessage: (messageText: string) => void;
}

function getSourceHref(source: Source): string {
  return source.content_type === 'note'
    ? `/notes/${source.content_id}`
    : `/documents/${source.content_id}`;
}

export const ChatInterface = forwardRef<ChatInterfaceHandle, ChatInterfaceProps>(
  (
    {
      context,
      initialMessages,
      isLoadingHistory = false,
      className,
    },
    ref,
  ) => {
    const [messages, setMessages] = useState<Message[]>(initialMessages || []);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

    const { session } = useAuth();
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const router = useRouter();
    const { toast } = useToast();

    // --- Action Handlers ---
    const handleGenerateQuizFromContext = () => {
      if (!context.id) return;
      setIsActionLoading(true);
      toast({ title: 'Preparing Quiz...' });
      router.push(`/create?docId=${context.id}`);
      setIsActionLoading(false);
    };

    const handleGenerateNotesFromContext = async () => {
      if (context?.type !== 'document' || !context.id || !session) return;
      setIsActionLoading(true);
      toast({
        title: 'Summarizing Notes...',
        description: 'This may take a moment.',
      });

      try {
        const cRes = await fetch(`/api/documents/${context.id}/content`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const cResult = await cRes.json();

        if (!cResult.success || !cResult.data?.extracted_text)
          throw new Error('Could not read document.');

        const gRes = await fetch(`/api/generate-notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text: cResult.data.extracted_text }),
        });
        const gResult = await gRes.json();

        if (!gResult.success) throw new Error(gResult.error);

        toast({ title: 'Notes Created!' });
        router.push('/notes');
      } catch (e: any) {
        toast({
          title: 'Error',
          description: e.message,
          variant: 'destructive',
        });
      } finally {
        setIsActionLoading(false);
      }
    };

    const handleGenerateFlashcardsFromContext = async () => {
      if (!context.id || !session) return;
      setIsActionLoading(true);
      toast({ title: 'Generating Flashcards...' });
      try {
        const res = await fetch(`/api/generate-flashcards`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            documentId: context.id,
            numberOfCards: 15,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast({
            title: 'Success',
            description: `Deck "${data.data.title}" created.`,
          });
          router.push(`/flashcards/${data.data.id}`);
        } else throw new Error(data.error);
      } catch (e: any) {
        toast({
          title: 'Error',
          description: e.message,
          variant: 'destructive',
        });
      } finally {
        setIsActionLoading(false);
      }
    };

    // --- Effects ---
    useEffect(() => {
      if (initialMessages) {
        setMessages(initialMessages);
      }
    }, [initialMessages]);

    useEffect(() => {
      if (
        context?.type === 'document' &&
        context.id &&
        session &&
        messages.length === 0
      ) {
        fetch(`/api/documents/${context.id}/suggest-questions`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.data) setSuggestedQuestions(data.data);
          })
          .catch(() => {});
      }
    }, [context, session, messages.length]);

    useEffect(() => {
      if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector(
          '[data-radix-scroll-area-viewport]',
        );
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
      }
    }, [messages, isLoading, suggestedQuestions]);

    const sendMessage = useCallback(
      async (messageText: string) => {
        if (!messageText.trim() || !session || isLoading) return;

        const userMessage: Message = { role: 'user', text: messageText };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              history: messages,
              message: messageText,
              context: context,
            }),
          });

          if (!response.ok || !response.body)
            throw new Error('Failed to send message');

          const sourcesHeader = response.headers.get('X-Ai-Sources');
          const sources: Source[] = sourcesHeader
            ? JSON.parse(sourcesHeader)
            : [];

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullResponse = '';

          setMessages((prev) => [
            ...prev,
            { role: 'model', text: '', sources },
          ]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullResponse += decoder.decode(value, { stream: true });

            setMessages((prev) => {
              const newMsg = [...prev];
              newMsg[newMsg.length - 1].text = fullResponse;
              return newMsg;
            });
          }
        } catch (error) {
          setMessages((prev) => [
            ...prev,
            { role: 'model', text: 'Sorry, something went wrong.' },
          ]);
        } finally {
          setIsLoading(false);
        }
      },
      [session, isLoading, messages, context],
    );

    useImperativeHandle(ref, () => ({ sendMessage }), [sendMessage]);

    return (
      // FIX 1: Changed bg-background to bg-transparent
      <div
        className={cn(
          'flex flex-col h-full bg-transparent relative font-sans',
          className,
        )}
      >
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-6 pb-4">
            {/* Loading Skeleton */}
            {isLoadingHistory && messages.length === 0 && (
              <div className="space-y-6 px-2">
                <div className="flex gap-3">
                   <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-1/3 bg-black/5 dark:bg-white/10 animate-pulse rounded" />
                    <div className="h-12 w-3/4 bg-black/5 dark:bg-white/10 animate-pulse rounded-xl" />
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!isLoadingHistory && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-8 animate-in zoom-in-95 duration-300">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                  <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm p-4 rounded-2xl border shadow-sm relative">
                    <Sparkles className="w-8 h-8 text-primary fill-primary/20" />
                  </div>
                </div>

                <div className="space-y-2 max-w-[280px]">
                  <h3 className="font-semibold text-foreground">
                    AI Study Partner
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    I can explain concepts, quiz you on this document, or help you
                    create study materials.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 w-full max-w-sm px-4">
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-2 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:border-blue-800 transition-all group border-border/50 shadow-sm"
                    onClick={handleGenerateQuizFromContext}
                    disabled={isActionLoading}
                  >
                    <FileQuestion className="w-5 h-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                    <span className="text-[10px] font-medium">Quiz Me</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-2 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 dark:hover:bg-orange-950/30 dark:hover:border-orange-800 transition-all group border-border/50 shadow-sm"
                    onClick={handleGenerateFlashcardsFromContext}
                    disabled={isActionLoading}
                  >
                    <Layers className="w-5 h-5 text-muted-foreground group-hover:text-orange-500 transition-colors" />
                    <span className="text-[10px] font-medium">Flashcards</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-2 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm hover:bg-green-50 hover:border-green-200 hover:text-green-600 dark:hover:bg-green-950/30 dark:hover:border-green-800 transition-all group border-border/50 shadow-sm"
                    onClick={handleGenerateNotesFromContext}
                    disabled={isActionLoading}
                  >
                    <StickyNote className="w-5 h-5 text-muted-foreground group-hover:text-green-500 transition-colors" />
                    <span className="text-[10px] font-medium">Summarize</span>
                  </Button>
                </div>

                {suggestedQuestions.length > 0 && (
                  <div className="flex flex-col gap-2 w-full max-w-xs px-4">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Suggested
                    </span>
                    {suggestedQuestions.slice(0, 2).map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(q)}
                        className="text-xs text-left px-4 py-2.5 rounded-lg bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm hover:bg-primary/10 hover:text-primary transition-all truncate border border-border/50 hover:border-primary/20 shadow-sm"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Chat Messages */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex w-full gap-3 animate-in slide-in-from-bottom-2 duration-300',
                  msg.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center shrink-0 border border-border/50 mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}

                <div
                  className={cn(
                    'relative max-w-[85%] px-5 py-3.5 text-sm shadow-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                      : 'bg-white dark:bg-zinc-900 border border-border/50 text-foreground rounded-2xl rounded-tl-sm',
                  )}
                >
                  {/* MARKDOWN RENDERING */}
                  <div className={cn(
                    // FIX 2: Prose-slate and better contrast
                    "prose prose-sm max-w-none dark:prose-invert leading-relaxed break-words prose-slate",
                    msg.role === 'user' 
                      ? "prose-p:text-primary-foreground prose-headings:text-primary-foreground prose-strong:text-primary-foreground prose-code:text-primary-foreground prose-code:bg-primary-foreground/20" 
                      : "prose-p:text-slate-700 dark:prose-p:text-slate-300"
                  )}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/10 flex flex-wrap gap-2">
                      {msg.sources.map((src) => (
                        <TooltipProvider key={src.citation}>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Link
                                href={getSourceHref(src)}
                                className="inline-flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded-md bg-muted/50 border border-border/50 text-[10px] text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                              >
                                <span className="font-mono font-bold text-primary">[{src.citation}]</span>
                                <span className="truncate max-w-[80px]">{src.content_title}</span>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs p-3 bg-popover text-popover-foreground shadow-xl">
                              {src.content_chunk}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Thinking Indicator */}
            {isLoading && (
              <div className="flex w-full gap-3 justify-start animate-in fade-in">
                 <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center shrink-0 border border-border/50">
                  <Zap className="w-4 h-4 text-primary fill-current" />
                </div>
                <div className="bg-white dark:bg-zinc-900 px-4 py-3 rounded-2xl rounded-tl-sm border border-border/50 flex items-center gap-2 shadow-sm">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">
                    Thinking...
                  </span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        {/* FIX 3: Added backdrop-blur to input area */}
        <div className="p-4 pt-2 bg-background/0 z-20 sticky bottom-0">
          <div className="relative shadow-xl rounded-3xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-border/50 ring-1 ring-black/5 transition-all focus-within:ring-primary/20 focus-within:border-primary/50">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex items-end gap-2 p-2"
            >
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Ask a follow-up question..."
                className="min-h-[20px] max-h-32 w-full resize-none border-0 bg-transparent focus-visible:ring-0 py-2.5 px-3 shadow-none text-sm placeholder:text-muted-foreground/50"
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="h-8 w-8 shrink-0 rounded-full mb-1 mr-1 transition-all hover:scale-105 active:scale-95 shadow-sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  },
);

ChatInterface.displayName = 'ChatInterface';