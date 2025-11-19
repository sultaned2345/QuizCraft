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
import { ApiResponse, RelatedItem } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type Source = Pick<
  RelatedItem,
  'content_id' | 'content_type' | 'content_title' | 'citation' | 'content_chunk'
>;

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
      <div
        className={cn(
          'flex flex-col h-full bg-gradient-to-b from-background to-muted/20 relative',
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
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-12 w-3/4 rounded-xl" />
                  </div>
                </div>
              </div>
            )}

            {/* Modern Empty State */}
            {!isLoadingHistory && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-8 animate-in zoom-in-95 duration-300">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                  <div className="bg-background p-4 rounded-2xl border shadow-sm relative">
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

                {/* Sleek Action Grid */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-sm px-4">
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-2 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:border-blue-800 transition-all group"
                    onClick={handleGenerateQuizFromContext}
                    disabled={isActionLoading}
                  >
                    <FileQuestion className="w-5 h-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                    <span className="text-[10px] font-medium">Quiz Me</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-2 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 dark:hover:bg-orange-950/30 dark:hover:border-orange-800 transition-all group"
                    onClick={handleGenerateFlashcardsFromContext}
                    disabled={isActionLoading}
                  >
                    <Layers className="w-5 h-5 text-muted-foreground group-hover:text-orange-500 transition-colors" />
                    <span className="text-[10px] font-medium">Flashcards</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col gap-2 hover:bg-green-50 hover:border-green-200 hover:text-green-600 dark:hover:bg-green-950/30 dark:hover:border-green-800 transition-all group"
                    onClick={handleGenerateNotesFromContext}
                    disabled={isActionLoading}
                  >
                    <StickyNote className="w-5 h-5 text-muted-foreground group-hover:text-green-500 transition-colors" />
                    <span className="text-[10px] font-medium">Summarize</span>
                  </Button>
                </div>

                {/* Suggested Chips */}
                {suggestedQuestions.length > 0 && (
                  <div className="flex flex-col gap-2 w-full max-w-xs px-4">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Suggested
                    </span>
                    {suggestedQuestions.slice(0, 2).map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(q)}
                        className="text-xs text-left px-4 py-2.5 rounded-lg bg-muted/50 hover:bg-primary/10 hover:text-primary transition-all truncate border border-transparent hover:border-primary/20"
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
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}

                <div
                  className={cn(
                    'relative max-w-[80%] px-5 py-3.5 text-sm leading-relaxed shadow-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                      : 'bg-card text-card-foreground rounded-2xl rounded-tl-sm border',
                  )}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                      {msg.sources.map((src) => (
                        <TooltipProvider key={src.citation}>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Link
                                href={getSourceHref(src)}
                                className="inline-flex items-center gap-1.5 text-[10px] bg-background/50 hover:bg-background px-2.5 py-1 rounded-full transition-all ring-1 ring-inset ring-border hover:ring-primary/30"
                              >
                                <span className="font-bold text-primary">
                                  {src.citation}
                                </span>
                                <span className="truncate max-w-[100px] opacity-70">
                                  {src.content_title}
                                </span>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs p-3 shadow-xl bg-popover text-popover-foreground">
                              {src.content_chunk}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Thinking Indicator */}
            {isLoading && (
              <div className="flex w-full gap-3 justify-start animate-in fade-in">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                  <Zap className="w-4 h-4 text-primary fill-primary" />
                </div>
                <div className="bg-card px-4 py-3 rounded-2xl rounded-tl-sm border flex items-center gap-2 shadow-sm">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">
                    Thinking...
                  </span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Floating Input Area */}
        <div className="p-4 pt-2 bg-transparent z-20">
          <div className="relative shadow-lg rounded-2xl bg-background border ring-4 ring-muted/20 transition-all focus-within:ring-primary/20 focus-within:border-primary/50">
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
                placeholder="Ask anything..."
                className="min-h-[20px] max-h-32 w-full resize-none border-0 bg-transparent focus-visible:ring-0 py-2.5 px-3 shadow-none text-sm placeholder:text-muted-foreground/50"
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="h-8 w-8 shrink-0 rounded-xl mb-1 mr-1 transition-all hover:scale-105 active:scale-95"
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