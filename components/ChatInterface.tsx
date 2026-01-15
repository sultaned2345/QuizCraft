// src/components/ChatInterface.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User, Loader2, Sparkles, Mic, Square, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';
import { AudioVisualizer } from '@/components/ui/AudioVisualizer'; // Import our new component

interface ChatInterfaceProps {
  documentId?: string;
  projectId?: string;
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

  // --- Voice State ---
  const [isListening, setIsListening] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initial Greeting
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

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isListening, isLoading]);

  // --- Voice Logic ---
  const startListening = async () => {
    try {
      // 1. Get Audio Stream for the Visualizer
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream);
      setIsListening(true);

      // 2. Start Speech Recognition (Browser Native)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;     // Keep listening even if user pauses
        recognition.interimResults = true; // Show results as they speak
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          // Append final results to input
          if (finalTranscript) {
             setInput(prev => {
                const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                return prev + (needsSpace ? ' ' : '') + finalTranscript;
             });
          }
          // Note: We aren't showing interim results in this specific UI to keep state simple, 
          // but you could add a separate preview state if desired.
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          stopListening();
        };

        recognition.onend = () => {
           // If we didn't manually stop, restart (for continuous listening) or just stop
           if (isListening) {
             // Optional: recognition.start(); 
           }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } else {
        alert("Voice recognition is not supported in this browser. Try Chrome or Edge.");
        stopListening();
      }

    } catch (err) {
      console.error("Mic access denied", err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    if (isListening) stopListening();

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
        <div className="space-y-6 max-w-3xl mx-auto pb-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <Avatar className={cn("w-8 h-8", msg.role === 'model' ? "bg-primary/10" : "bg-muted")}>
                <AvatarFallback>
                  {msg.role === 'model' ? <Bot size={16} className="text-primary" /> : <User size={16} />}
                </AvatarFallback>
              </Avatar>
              
              <div className={cn(
                "rounded-2xl px-4 py-3 text-sm max-w-[85%] shadow-sm leading-relaxed",
                msg.role === 'user' 
                  ? "bg-primary text-primary-foreground rounded-tr-none" 
                  : "bg-muted/50 border border-border/50 rounded-tl-none"
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
                            customStyle={{ margin: 0, borderRadius: '0.5rem' }}
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={cn("bg-black/20 px-1 py-0.5 rounded font-mono text-xs", className)} {...props}>
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
              <div className="bg-muted/50 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 bg-background/95 backdrop-blur border-t supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto relative flex gap-2 items-end">
          
          {/* Input Container */}
          <div className={cn(
            "flex-1 relative flex items-center transition-all duration-300 ease-in-out bg-muted/30 border border-input rounded-xl focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 overflow-hidden",
            isListening ? "ring-2 ring-primary/50 border-primary/50 bg-primary/5" : ""
          )}>
            
            <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Listening... (you can still type)" : "Ask about this document..."}
                className="border-none shadow-none focus-visible:ring-0 h-[52px] px-4 bg-transparent flex-1"
                disabled={isLoading}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(e)}
            />

            {/* Visualizer Indicator inside Input */}
            {isListening && (
               <div className="pr-4 flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                  <span className="text-xs font-medium text-primary animate-pulse whitespace-nowrap hidden sm:block">Listening</span>
                  <AudioVisualizer stream={mediaStream} isRecording={isListening} />
               </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            
            {/* Mic Toggle */}
            <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                onClick={isListening ? stopListening : startListening}
                className={cn(
                    "h-[52px] w-[52px] rounded-xl border-2 transition-all duration-200",
                    isListening ? "animate-pulse" : "border-dashed hover:border-primary hover:text-primary"
                )}
                title={isListening ? "Stop Listening" : "Use Voice"}
                disabled={isLoading}
            >
                {isListening ? <Square size={20} fill="currentColor" /> : <Mic size={20} />}
            </Button>

            {/* Send Button */}
            {(input.trim() || isListening) && (
              <Button 
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !isListening)}
                className="h-[52px] w-[52px] rounded-xl shadow-md transition-all duration-200"
              >
                <Send size={20} className={cn(isLoading && "opacity-0")} />
                {isLoading && <Loader2 size={20} className="absolute animate-spin" />}
              </Button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}