// file: components/ChatbotDialog.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link'; // Import Link
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
import { cn } from '@/lib/utils'; // Import cn

// --- NEW: Define Source interface ---
interface Source {
  content_id: string;
  content_type: 'note' | 'document';
  content_title: string;
  citation: number;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: Source[]; // --- MODIFIED: Add sources array
}

interface ChatbotDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// --- NEW: Helper function to get link href ---
function getSourceHref(source: Source): string {
    if (source.content_type === 'note') {
        return `/notes`; // NoteEditor opens from the notes page
    }
    if (source.content_type === 'document') {
        return `/documents`; // Document viewer opens from the documents page
    }
    return '#';
}

// --- NEW: Helper function to get icon ---
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

    const userMessage: Message = { role: 'user', text: input };
    // --- MODIFIED: Add current messages to history ---
    const history = [...messages, userMessage];
    setMessages(history);
    // ---
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
          // --- MODIFIED: Send history *before* new message ---
          history: messages, 
          message: input,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      
      // --- MODIFIED: Read header ---
      const sourcesHeader = response.headers.get('X-Ai-Sources');
      const sources: Source[] = sourcesHeader ? JSON.parse(sourcesHeader) : [];
      // ---

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      // Add a placeholder for the model's response
      // --- MODIFIED: Add sources to placeholder ---
      setMessages((prev) => [...prev, { role: 'model', text: '', sources: sources }]);
      // ---

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullResponse += chunk;
        
        // Update the last message (the model's response) in the array
        setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].text = fullResponse;
            // --- MODIFIED: Ensure sources stay on the message ---
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
            Ask me anything about your study materials!
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 my-4 pr-1 overflow-hidden">
             <ScrollArea className="h-full pr-3" ref={scrollAreaRef as any}>
                <div className="space-y-4">
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
                        
                        {/* --- MODIFIED: Render Sources --- */}
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
                        {/* --- END MODIFICATION --- */}
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