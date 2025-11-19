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
  User as UserIcon,
  Sparkles,
  FileQuestion,
  StickyNote,
  Layers,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageContextType } from '@/contexts/PageContext';
import { ApiResponse, GeneratedDeckInfo, RelatedItem } from '@/types/database';
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
      initialMessages = [],
      isLoadingHistory = false,
      className,
    },
    ref,
  ) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
    
    const { session } = useAuth();
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const router = useRouter();
    const { toast } = useToast();

    // --- 1. RESTORED ACTION HANDLERS ---
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
      toast({ title: 'Summarizing Notes...', description: 'This may take a moment.' });
      
      try {
        // 1. Get content first
        const cRes = await fetch(`/api/documents/${context.id}/content`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const cResult = await cRes.json();
        
        if (!cResult.success || !cResult.data?.extracted_text) throw new Error("Could not read document.");

        // 2. Generate
        const gRes = await fetch(`/api/generate-notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ text: cResult.data.extracted_text }),
        });
        const gResult = await gRes.json();

        if (!gResult.success) throw new Error(gResult.error);

        toast({ title: 'Notes Created!' });
        router.push('/notes');
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
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
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ documentId: context.id, numberOfCards: 15 }),
        });
        const data = await res.json();
        if (data.success) {
          toast({ title: 'Success', description: `Deck "${data.data.title}" created.` });
          router.push(`/flashcards/${data.data.id}`);
        } else throw new Error(data.error);
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
      } finally {
        setIsActionLoading(false);
      }
    };

    // --- 2. RESTORED SUGGESTIONS FETCHING ---
    useEffect(() => {
      if (context?.type === 'document' && context.id && session && messages.length === 0) {
         fetch(`/api/documents/${context.id}/suggest-questions`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success && data.data) setSuggestedQuestions(data.data);
            })
            .catch(() => {}); // Silent fail is fine for suggestions
      }
    }, [context, session, messages.length]);

    useEffect(() => {
      setMessages(initialMessages);
    }, [initialMessages]);

    useEffect(() => {
      if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
      }
    }, [messages, isLoading, suggestedQuestions]);

    const sendMessage = useCallback(async (messageText: string) => {
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

        if (!response.ok || !response.body) throw new Error('Failed to send message');

        const sourcesHeader = response.headers.get('X-Ai-Sources');
        const sources: Source[] = sourcesHeader ? JSON.parse(sourcesHeader) : [];
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        setMessages((prev) => [...prev, { role: 'model', text: '', sources }]);

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
        setMessages((prev) => [...prev, { role: 'model', text: 'Sorry, something went wrong.' }]);
      } finally {
        setIsLoading(false);
      }
    }, [session, isLoading, messages, context]);

    useImperativeHandle(ref, () => ({ sendMessage }), [sendMessage]);

    return (
      <div className={cn('flex flex-col h-full bg-background/50', className)}>
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-6">
            
            {/* LOADING STATE */}
            {isLoadingHistory && messages.length === 0 && (
              <div className="space-y-4">
                 <Skeleton className="h-10 w-2/3 rounded-xl bg-muted/50" />
                 <Skeleton className="h-20 w-full rounded-xl bg-muted/50" />
              </div>
            )}

            {/* EMPTY STATE WITH ACTIONS (Restored & Redesigned) */}
            {!isLoadingHistory && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-6 opacity-90">
                <div className="bg-primary/5 p-4 rounded-full ring-1 ring-primary/10">
                   <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-sm text-foreground">Study Assistant Ready</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Ask questions about this document or use a quick action below.
                  </p>
                </div>

                {/* Quick Actions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-sm">
                  <Button variant="outline" size="sm" className="h-auto py-3 flex flex-col gap-1 border-primary/10 hover:bg-primary/5 hover:border-primary/30 transition-all" onClick={handleGenerateQuizFromContext} disabled={isActionLoading}>
                    <FileQuestion className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium">Quiz Me</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-auto py-3 flex flex-col gap-1 border-primary/10 hover:bg-primary/5 hover:border-primary/30 transition-all" onClick={handleGenerateFlashcardsFromContext} disabled={isActionLoading}>
                    <Layers className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-medium">Flashcards</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-auto py-3 flex flex-col gap-1 border-primary/10 hover:bg-primary/5 hover:border-primary/30 transition-all" onClick={handleGenerateNotesFromContext} disabled={isActionLoading}>
                    <StickyNote className="w-4 h-4 text-green-500" />
                    <span className="text-xs font-medium">Summarize</span>
                  </Button>
                </div>

                {/* Suggested Questions Chips */}
                {suggestedQuestions.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 max-w-md mt-4">
                    {suggestedQuestions.slice(0, 3).map((q, i) => (
                      <button 
                        key={i}
                        onClick={() => sendMessage(q)}
                        className="text-[11px] px-3 py-1.5 rounded-full bg-muted/50 hover:bg-primary/10 hover:text-primary transition-colors border border-transparent hover:border-primary/20 text-muted-foreground"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MESSAGES */}
            {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex w-full',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'relative max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted/80 text-foreground rounded-bl-sm border'
                    )}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                    
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-primary/10 flex flex-wrap gap-2">
                         {msg.sources.map((src) => (
                           <TooltipProvider key={src.citation}>
                             <Tooltip delayDuration={0}>
                               <TooltipTrigger asChild>
                                 <Link
                                   href={getSourceHref(src)}
                                   className="inline-flex items-center gap-1 text-[10px] bg-background/50 hover:bg-background px-2 py-1 rounded-full transition-colors ring-1 ring-inset ring-black/5"
                                 >
                                   <span className="font-bold text-xs">{src.citation}</span>
                                   <span className="truncate max-w-[80px]">{src.content_title}</span>
                                 </Link>
                               </TooltipTrigger>
                               <TooltipContent className="max-w-xs text-xs p-3">
                                 {src.content_chunk}
                               </TooltipContent>
                             </Tooltip>
                           </TooltipProvider>
                         ))}
                      </div>
                    )}
                  </div>
                </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted/50 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* INPUT AREA */}
        <div className="p-4 border-t bg-background">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="relative flex items-end gap-2 bg-muted/30 p-1.5 rounded-xl border focus-within:ring-1 focus-within:ring-ring transition-all"
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Type a message..."
              className="min-h-[44px] max-h-32 w-full resize-none border-0 bg-transparent focus-visible:ring-0 py-3 px-3 shadow-none text-sm"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-9 w-9 shrink-0 rounded-lg mb-0.5 mr-0.5"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    );
  }
);

ChatInterface.displayName = 'ChatInterface';