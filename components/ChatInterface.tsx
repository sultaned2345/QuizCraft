'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  documentId?: string; // If chatting with specific doc
  projectId?: string; // If chatting with whole project
  initialMessage?: string;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: Date;
}

export function ChatInterface({ documentId, projectId, initialMessage }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Add initial greeting
  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      setMessages([{
        id: 'init',
        role: 'model',
        content: initialMessage,
        createdAt: new Date()
      }]);
    }
  }, [initialMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      createdAt: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          documentId, 
          projectId
        }),
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to respond");

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.response,
        createdAt: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "I'm having trouble connecting to the brain. Please try again.",
        createdAt: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border-l border-border/50">
      
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6 max-w-3xl mx-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <Avatar className={cn("w-8 h-8", msg.role === 'model' ? "bg-primary/10" : "bg-muted")}>
                <AvatarFallback>
                  {msg.role === 'model' ? <Bot size={16} className="text-primary" /> : <User size={16} />}
                </AvatarFallback>
              </Avatar>
              
              <div className={cn(
                "rounded-lg p-4 text-sm max-w-[85%] shadow-sm",
                msg.role === 'user' 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted/50 border border-border/50"
              )}>
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <ReactMarkdown
                    components={{
                      code({node, inline, className, children, ...props}: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={dracula}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={cn("bg-slate-800 text-slate-200 px-1 rounded", className)} {...props}>
                            {children}
                          </code>
                        )
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="w-8 h-8 bg-primary/10">
                <AvatarFallback><Sparkles size={16} className="animate-pulse text-primary" /></AvatarFallback>
              </Avatar>
              <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this document..."
            className="pr-12 py-6 shadow-sm"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!input.trim() || isLoading}
            className="absolute right-1 top-1 h-10 w-10"
          >
            <Send size={18} />
          </Button>
        </form>
      </div>
    </div>
  );
}