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
import { usePageContext } from '@/contexts/PageContext'; // <-- 1. IMPORT CONTEXT HOOK

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
  const { session } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { pageContext } = usePageContext(); // <-- 2. READ CONTEXT
  const [proactivePrompt, setProactivePrompt] = useState<string | null>(null); // <-- 3. NEW STATE

  // 4. EFFECT FOR PROACTIVE PROMPTS
  useEffect(() => {
    // Only show proactive prompt if the dialog is opened AND the chat is new
    if (isOpen && messages.length === 0) {
      if (pageContext?.type === 'quiz') {
        setProactivePrompt("I see you're editing a quiz. Need help refining a question or adding a new one? (e.g., \"Make question 2 harder\" or \"Add a true/false question about...\")");
      } else if (pageContext?.type === 'essay') {
        setProactivePrompt("I see you just got feedback on your essay. Have any follow-up questions? (e.g., \"Can you give me an example of a better thesis for this essay?\")");
      } else if (pageContext?.type === 'page' && pageContext.name === 'essay-grader') {
        setProactivePrompt("Welcome to the Essay Grader! Paste your essay or ask me to review a draft when you're ready.");
      } else {
        setProactivePrompt(null);
      }
    } else if (!isOpen) {
      // Clear messages when dialog is closed
      setMessages([]);
      setProactivePrompt(null);
    }
  }, [isOpen, pageContext, messages.length]);

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
          history: messages, 
          message: input,
          context: pageContext, // <-- 5. SEND CONTEXT TO API
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
        const chunk = decoder.decode(value);
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
            {/* 6. DYNAMIC DESCRIPTION */}
            {pageContext?.type === 'quiz' ? "Ask me to refine questions for this quiz."
             : pageContext?.type === 'essay' ? "Ask me follow-up questions about your feedback."
             : "Ask me anything about your study materials."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 my-4 pr-1 overflow-hidden">
             <ScrollArea className="h-full pr-3" ref={scrollAreaRef as any}>
                <div className="space-y-4">
                {/* 7. RENDER PROACTIVE PROMPT */}
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
                
                {/* ... (rest of messages.map remains unchanged) ... */}
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
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}