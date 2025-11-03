// components/ChatInterface.tsx
'use client'; // <-- THIS IS THE FIX

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bot,
  Loader2,
  Send,
  Sparkles,
  User as UserIcon,
  FileText,
  StickyNote,
  FileQuestion,
  Layers,
  MessageSquareText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageContextType } from '@/contexts/PageContext';
import { ApiResponse, GeneratedDeckInfo, RelatedItem } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

// (Types and helper functions remain the same)
type Source = Pick<RelatedItem, 'content_id' | 'content_type' | 'content_title' | 'citation'>;
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
function getSourceHref(source: Source): string {
    if (source.content_type === 'note') {
        return `/notes`; 
    }
    if (source.content_type === 'document') {
        return `/documents`;
    }
    return '#';
}
function getSourceIcon(source: Source) {
    if (source.content_type === 'note') {
        return <StickyNote className="w-3 h-3" />;
    }
    if (source.content_type === 'document') {
        return <FileText className="w-3 h-3" />;
    }
    return null;
}


export function ChatInterface({
  context,
  initialMessages,
  isLoadingHistory: isHistoryLoadingProp = false,
  className
}: ChatInterfaceProps) {
  // (All state and hooks remain the same)
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(isHistoryLoadingProp);
  const { session } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [proactivePrompt, setProactivePrompt] = useState<string | null>(null);
  const [proactiveActions, setProactiveActions] = useState<React.ReactNode | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[] | null>(null);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // (All action handlers and useEffects remain the same)
  const handleGenerateQuizFromContext = () => {
    if (context?.type !== 'document' || !context.id) return;
    setIsActionLoading(true);
    toast({ title: 'Preparing Quiz...' });
    router.push(`/create?docId=${context.id}`);
    setIsActionLoading(false);
  };
  
  const handleGenerateNotesFromContext = async () => {
    if (context?.type !== 'document' || !context.id || !session) return;
    setIsActionLoading(true);
    toast({ title: 'Generating Notes...', description: 'Please wait, this may take a moment.' });
    try {
      const cRes = await fetch(`/api/documents/${context.id}/content`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const cResult: ApiResponse<{ extracted_text: string | null }> = await cRes.json();
      if (!cResult.success || !cResult.data?.extracted_text) throw new Error(cResult.error || 'Failed to fetch document content.');

      const gRes = await fetch(`/api/generate-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          text: cResult.data.extracted_text,
        })
      });
      const gResult: ApiResponse = await gRes.json();
      if (!gRes.ok || !gResult.success) throw new Error(gResult.error || 'Failed to generate notes.');
      
      toast({ title: 'Notes Generated!' });
      router.push('/notes');
    } catch (e: any) {
      toast({ title: 'Note Generation Failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleGenerateFlashcardsFromContext = async () => {
    if (context?.type !== 'document' || !context.id || !session) return;
    setIsActionLoading(true);
    toast({ title: 'Generating Flashcards...', description: 'Please wait, this may take a moment.' });
    try {
      const response = await fetch(`/api/generate-flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ documentId: context.id, numberOfCards: 15 })
      });
      const result: ApiResponse<GeneratedDeckInfo> = await response.json();
      if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Failed to generate flashcards.');
      
      toast({ title: 'Flashcards Generated!', description: `Deck "${result.data.title}" created.` });
      router.push(`/flashcards/${result.data.id}`);
    } catch (e: any) {
      toast({ title: 'Card Generation Failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
      setIsHistoryLoading(isHistoryLoadingProp);
    } else if (isHistoryLoadingProp) {
        setMessages([]);
        setIsHistoryLoading(true);
    } else if (session) {
      setIsHistoryLoading(true);
      setProactiveActions(null); 
      setSuggestedQuestions(null);
      
      let historyFetchUrl = '/api/chat/history';
      
      if (context?.type === 'quiz' && context.id) {
        setProactivePrompt("I see you're looking at a quiz. Need help refining a question or adding a new one? (e.g., \"Make question 2 harder\" or \"Add a true/false question about...\")");
        historyFetchUrl = `/api/chat/history?context_id=${context.id}`;
      } else if (context?.type === 'essay' && context.id) {
        setProactivePrompt("I see you just got feedback on your essay. Have any follow-up questions? (e.g., \"Can you give me an example of a better thesis for this essay?\")");
        historyFetchUrl = `/api/chat/history?context_id=${context.id}`;
      } else if (context?.type === 'document' && context.id) {
        setProactivePrompt("I see you're viewing this document. What would you like to do?");
        historyFetchUrl = `/api/chat/history?context_id=${context.id}`;
        
        setIsSuggestionsLoading(true);
        fetch(`/api/documents/${context.id}/suggest-questions`, {
            headers: { 'Authorization': `Bearer ${session?.access_token}` },
        })
        .then(res => res.json())
        .then((data: ApiResponse<string[]>) => {
            if (data.success && data.data && data.data.length > 0) {
                setSuggestedQuestions(data.data);
            } else {
                setSuggestedQuestions([]);
            }
        })
        .catch(() => setSuggestedQuestions([]))
        .finally(() => setIsSuggestionsLoading(false));
        
        setProactiveActions(
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <Button size="sm" variant="secondary" onClick={handleGenerateQuizFromContext} disabled={isActionLoading}>
              {isActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileQuestion className="w-4 h-4 mr-2" />}
              Generate Quiz
            </Button>
            <Button size="sm" variant="secondary" onClick={handleGenerateNotesFromContext} disabled={isActionLoading}>
              {isActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <StickyNote className="w-4 h-4 mr-2" />}
              Summarize Notes
            </Button>
            <Button size="sm" variant="secondary" onClick={handleGenerateFlashcardsFromContext} disabled={isActionLoading}>
              {isActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Layers className="w-4 h-4 mr-2" />}
              Make Flashcards
            </Button>
          </div>
        );
      } else {
        setProactivePrompt(null);
        historyFetchUrl = '/api/chat/history';
      }

      fetch(historyFetchUrl, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      .then(res => res.json())
      .then((data: ApiResponse<Message[]>) => {
          if (data.success && data.data) {
              if (data.data.length > 0) {
                  setMessages(data.data);
              } else if (!proactivePrompt && !proactiveActions) {
                   setMessages([{ role: 'model', text: 'Hi! How can I help you with your study materials?' }]);
              } else {
                  setMessages([]);
              }
          } else {
              setMessages([{ role: 'model', text: 'Hi! How can I help you with your study materials?' }]);
          }
      })
      .catch(() => {
          setMessages([{ role: 'model', text: 'Could not load chat history. How can I help?' }]);
      })
      .finally(() => {
          setIsHistoryLoading(false);
      });
    }
  }, [context, session, initialMessages, isHistoryLoadingProp]);

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    setIsHistoryLoading(isHistoryLoadingProp);
  }, [isHistoryLoadingProp]);


  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollableViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollableViewport) {
        scrollableViewport.scrollTop = scrollableViewport.scrollHeight;
      }
    }
  }, [messages, isHistoryLoading]);

  const sendMessage = async (messageText: string) => {
    if (!messageText || !session || isLoading) return;

    setProactivePrompt(null); 
    setProactiveActions(null);
    setSuggestedQuestions(null);
    
    const userMessage: Message = { role: 'user', text: messageText };
    const history = [...messages, userMessage];
    setMessages(history);
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

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({ error: `Request failed with status ${response.status}` }));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
      
      const sourcesHeader = response.headers.get('X-Ai-Sources');
      const sources: Source[] = sourcesHeader ? JSON.parse(sourcesHeader) : [];
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      setMessages((prev) => [...prev, { role: 'model', text: '', sources: sources }]);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        
        setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].text = fullResponse;
            newMessages[newMessages.length - 1].sources = sources; 
            return newMessages;
        });
      }

    } catch (error: any) {
      const errorMessage = error.message || 'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => {
        const newMessages = [...prev];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'model' && newMessages[newMessages.length - 1].text === '') {
          newMessages[newMessages.length - 1].text = errorMessage;
          return newMessages;
        }
        return [...prev, { role: 'model', text: errorMessage }];
      });
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input.trim());
  };
  
  const sendSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <ScrollArea className="h-full flex-1 my-4 pr-1" ref={scrollAreaRef as any}>
        <div className="space-y-4 pr-3">
          {isHistoryLoading ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <Skeleton className="h-12 w-3/4 rounded-lg" />
              </div>
              <div className="flex items-start gap-3 justify-end">
                <Skeleton className="h-8 w-1/2 rounded-lg" />
                <Skeleton className="w-10 h-10 rounded-full" />
              </div>
            </div>
          ) : (
            <>
              {messages.length === 0 && (proactivePrompt || proactiveActions || isSuggestionsLoading || (suggestedQuestions && suggestedQuestions.length > 0)) && (
                <div className="flex items-start gap-3">
                  <div className="bg-primary rounded-full p-2 text-primary-foreground flex-shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="rounded-lg p-3 bg-secondary w-full space-y-3">
                    {proactivePrompt && <p className="text-sm">{proactivePrompt}</p>}
                    
                    {proactiveActions}

                    {isSuggestionsLoading && (
                      <div className="space-y-2 pt-2">
                        <Skeleton className="h-7 w-full rounded-md" />
                        <Skeleton className="h-7 w-2/3 rounded-md" />
                      </div>
                    )}
                    {suggestedQuestions && suggestedQuestions.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <h4 className="text-xs font-semibold text-muted-foreground">Suggested Questions:</h4>
                        {suggestedQuestions.map((q, i) => (
                          <Button
                            key={i}
                            size="sm"
                            variant="outline"
                            className="h-auto text-xs w-full justify-start text-left bg-background"
                            onClick={() => sendSuggestedQuestion(q)}
                            disabled={isLoading}
                          >
                            <MessageSquareText className="w-3 h-3 mr-2 shrink-0" />
                            {q}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {messages.map((msg, index) => (
                <div key={index} className={cn("flex flex-col", msg.role === 'user' ? 'items-end' : 'items-start')}>
                  <div className={`flex items-start gap-3 w-full ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'model' && (
                      <div className="bg-primary rounded-full p-2 text-primary-foreground flex-shrink-0">
                        <Bot className="w-5 h-5" />
                      </div>
                    )}
                    <div className={`rounded-lg p-3 max-w-[85%] ${msg.role === 'user' ? 'bg-muted' : 'bg-secondary'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="bg-muted rounded-full p-2 flex-shrink-0">
                        <UserIcon className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 ml-12 pl-1">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-1">Sources:</h4>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((source) => (
                          <Button key={source.citation} variant="outline" size="sm" asChild className="h-7 text-xs px-2 py-1 bg-background">
                            <Link href={getSourceHref(source)} title={source.content_title}>
                              {getSourceIcon(source)}
                              <span className="ml-1.5 mr-1 font-mono">[{source.citation}]</span>
                              <span className="truncate max-w-28">{source.content_title}</span>
                            </Link>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="bg-primary rounded-full p-2 text-primary-foreground">
                <Bot className="w-5 h-5" />
              </div>
              <div className="rounded-lg p-3 bg-secondary flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <form onSubmit={handleFormSubmit} className="flex w-full gap-2 pt-4 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question..."
          disabled={isLoading || isHistoryLoading || isActionLoading || isSuggestionsLoading}
        />
        <Button type="submit" disabled={isLoading || isHistoryLoading || isActionLoading || isSuggestionsLoading || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}