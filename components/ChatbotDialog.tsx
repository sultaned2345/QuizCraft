// components/ChatbotDialog.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { Bot, Loader2, Send, Sparkles, User as UserIcon, FileText, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePageContext } from '@/contexts/PageContext'; 
import { ApiResponse } from '@/types/database'; // --- ADDED ---
import { Skeleton } from '@/components/ui/skeleton'; // --- ADDED ---

// ... (Source, Message, ChatbotDialogProps, getSourceHref, getSourceIcon functions remain unchanged) ...
interface Source {
  content_id: string;
  content_type: 'note' | 'document';
  content_title: string;
  citation: number;
}
interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: Source[];
}
interface ChatbotDialogProps {
  isOpen: boolean;
  onClose: () => void;
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


export function ChatbotDialog({ isOpen, onClose }: ChatbotDialogProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false); // --- ADDED ---
  const { session } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { pageContext } = usePageContext(); 
  const [proactivePrompt, setProactivePrompt] = useState<string | null>(null);

  // --- MODIFIED: Effect for proactive prompts AND history loading ---
  useEffect(() => {
    if (isOpen) {
      if (pageContext?.type === 'quiz') {
        // Context: Quiz
        setMessages([]); // Clear history for context-specific chat
        setIsHistoryLoading(false);
        setProactivePrompt("I see you're looking at a quiz. Need help refining a question or adding a new one? (e.g., \"Make question 2 harder\" or \"Add a true/false question about...\")");
      } else if (pageContext?.type === 'essay') {
         // Context: Essay
        setMessages([]); // Clear history for context-specific chat
        setIsHistoryLoading(false);
        setProactivePrompt("I see you just got feedback on your essay. Have any follow-up questions? (e.g., \"Can you give me an example of a better thesis for this essay?\")");
      } else {
        // Context: General (load history)
        setProactivePrompt(null);
        if (session) {
            setIsHistoryLoading(true);
            fetch('/api/chat/history', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            })
            .then(res => res.json())
            .then((data: ApiResponse<Message[]>) => {
                if (data.success && data.data) {
                    setMessages(data.data);
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
      }
    } else if (!isOpen) {
      // Clear messages when dialog is closed
      setMessages([]);
      setProactivePrompt(null);
    }
  }, [isOpen, pageContext, session]);
  // --- END MODIFICATION ---

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollableViewport = scrollAreaRef.current.querySelector('div');
      if (scrollableViewport) {
        scrollableViewport.scrollTop = scrollableViewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !session) return;

    // Clear proactive prompt if user sends a message
    setProactivePrompt(null); 
    
    const userMessage: Message = { role: 'user', text: input };
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
          history: messages, // Send the history *before* the new message
          message: input,
          context: pageContext,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed with status ${response.status}`);
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
        const chunk = decoder.decode(value, { stream: true }); // --- ADDED stream: true ---
        fullResponse += chunk;
        
        setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].text = fullResponse;
            newMessages[newMessages.length - 1].sources = sources; 
            return newMessages;
        });
      }

    } catch (error) {
      const errorMessage = 'Sorry, I encountered an error. Please try again.';
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] md:max-w-lg grid-rows-[auto_1fr_auto] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Tutor
          </DialogTitle>
          <DialogDescription>
            {pageContext?.type === 'quiz' ? "Ask me to refine questions for this quiz."
             : pageContext?.type === 'essay' ? "Ask me follow-up questions about your feedback."
             : "Ask me anything about your study materials."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 my-4 pr-1 overflow-hidden">
             <ScrollArea className="h-full pr-3" ref={scrollAreaRef as any}>
                <div className="space-y-4">
                {/* --- ADDED: History Loading Skeleton --- */}
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
                        {/* (Proactive prompt render remains unchanged) */}
                        {messages.length === 0 && proactivePrompt && (
                        <div className="flex items-start gap-3">
                            <div className="bg-primary rounded-full p-2 text-primary-foreground flex-shrink-0">
                            <Bot className="w-5 h-5" />
                            </div>
                            <div className="rounded-lg p-3 bg-secondary">
                            <p className="text-sm">{proactivePrompt}</p>
                            </div>
                        </div>
                        )}
                        
                        {/* (messages.map remains unchanged) ... */}
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
                                                    <Link href={getSourceHref(source)} onClick={onClose} title={source.content_title}>
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
        </div>
        <DialogFooter>
          <form onSubmit={handleSendMessage} className="flex w-full gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              disabled={isLoading || isHistoryLoading}
            />
            <Button type="submit" disabled={isLoading || isHistoryLoading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}