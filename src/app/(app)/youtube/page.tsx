// src/app/(app)/youtube/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// FIX: Use named import (curly braces)
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  Brain, 
  MessageSquare, 
  FileText, 
  Sparkles, 
  Send, 
  FileType2, 
  Play 
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

// --- Helper to extract ID for Embed ---
function getYoutubeId(url: string) {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
}

export default function YouTubeTurboPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  // -- UI State --
  const [url, setUrl] = useState('');
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("transcript");

  // -- Data State --
  const [transcript, setTranscript] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [quiz, setQuiz] = useState<any>(null);
  const [flashcards, setFlashcards] = useState<any[]>([]);

  // -- Chat State --
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{role: string, content: string}>>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // 1. AUTO-START EFFECT
  useEffect(() => {
    const paramUrl = searchParams.get('url');
    if (paramUrl && !activeVideoId) {
      setUrl(paramUrl);
      // Small delay to ensure state is set before triggering UI changes
      setTimeout(() => startAnalysis(paramUrl), 100);
    }
  }, [searchParams]);

  // 2. CORE ANALYSIS LOGIC
  const startAnalysis = async (videoUrl: string) => {
    const id = getYoutubeId(videoUrl);
    if (!id) {
        toast({ variant: "destructive", title: "Invalid URL", description: "Please enter a valid YouTube link." });
        return;
    }

    // Show Video Immediately
    setActiveVideoId(id);
    setIsProcessing(true);
    
    // Reset Data
    setNotes(""); 
    setQuiz(null); 
    setFlashcards([]);
    setTranscript("");
    setChatHistory([]);

    try {
      const res = await fetch('/api/youtube/turbo', {
        method: 'POST',
        body: JSON.stringify({ videoUrl }),
      });
      const json = await res.json();
      
      if (!json.success) throw new Error(json.error || json.message);
      
      // Populate Data (Handle potential backend naming variations)
      setTranscript(json.data.transcript || json.data.fullText);
      setNotes(json.data.notes);
      setQuiz(json.data.quiz);
      setFlashcards(json.data.flashcards);

      toast({ title: "Analysis Complete", description: "All study materials are ready!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
      // Optional: reset video if it failed completely, or keep it so user can watch anyway
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartClick = () => startAnalysis(url);

  // 3. CHAT HANDLER
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !transcript) return;
    
    const userMsg = chatInput;
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setChatLoading(true);

    try {
      // Sends transcript as context to the chat API
      const res = await fetch('/api/chat/video', { 
         method: 'POST',
         body: JSON.stringify({ 
           messages: [...chatHistory, { role: 'user', content: userMsg }],
           context: transcript 
         }) 
      });
      const data = await res.json();
      
      if(data.reply) {
          setChatHistory(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Chat Error", description: "Failed to get response." });
    } finally {
      setChatLoading(false);
    }
  };

  // -- RENDER: EMPTY STATE (Landing) --
  if (!activeVideoId) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4 space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-4 max-w-lg">
           <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-indigo-500/30">
              <Sparkles className="w-10 h-10 text-indigo-600" />
           </div>
           <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            Turbo Study Mode
           </h1>
           <p className="text-muted-foreground text-lg">
             Watch any YouTube video while AI takes notes, creates quizzes, and answers your questions in real-time.
           </p>
        </div>

        <div className="flex w-full max-w-xl items-center space-x-2 p-2 bg-background border rounded-full shadow-lg hover:shadow-xl transition-shadow duration-300">
          <Input 
            placeholder="Paste YouTube URL here..." 
            value={url} 
            onChange={(e) => setUrl(e.target.value)}
            className="border-0 focus-visible:ring-0 px-6 h-12 text-lg bg-transparent"
          />
          <Button size="lg" onClick={handleStartClick} className="rounded-full h-12 px-8 bg-indigo-600 hover:bg-indigo-700 transition-all">
            <Play className="w-5 h-5 mr-2 fill-current" /> Start
          </Button>
        </div>
      </div>
    );
  }

  // -- RENDER: TURBO INTERFACE --
  return (
    <div className="h-[calc(100vh-4rem)] w-full overflow-hidden bg-background">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full border-t">
        
        {/* LEFT PANEL: VIDEO */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col bg-black">
             <iframe 
                width="100%" 
                height="100%" 
                src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`} 
                title="YouTube video player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
                className="flex-1"
              />
              <div className="h-14 bg-background border-t flex items-center px-4 justify-between">
                  <span className="font-medium text-sm text-muted-foreground truncate max-w-[70%]">
                    Playing Source: {url}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setActiveVideoId(null)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                    Exit Mode
                  </Button>
              </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* RIGHT PANEL: AI TOOLS */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col bg-muted/10">
            <Tabs defaultValue="transcript" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              
              {/* TABS HEADER */}
              <div className="px-4 py-2 border-b bg-background">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="transcript"><FileType2 className="w-4 h-4 mr-2"/>Text</TabsTrigger>
                  <TabsTrigger value="notes"><FileText className="w-4 h-4 mr-2"/>Notes</TabsTrigger>
                  <TabsTrigger value="quiz"><Brain className="w-4 h-4 mr-2"/>Quiz</TabsTrigger>
                  <TabsTrigger value="flash"><Sparkles className="w-4 h-4 mr-2"/>Cards</TabsTrigger>
                  <TabsTrigger value="chat"><MessageSquare className="w-4 h-4 mr-2"/>Chat</TabsTrigger>
                </TabsList>
              </div>

              {/* TABS CONTENT AREA */}
              <div className="flex-1 overflow-hidden relative bg-background/50">
                
                {/* LOADING OVERLAY */}
                {isProcessing && !transcript && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-50">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
                        <p className="text-sm font-medium animate-pulse">Transcribing & Analyzing...</p>
                        <p className="text-xs text-muted-foreground mt-2">You can watch the video while we work.</p>
                    </div>
                )}

                {/* 1. TRANSCRIPT TAB */}
                <TabsContent value="transcript" className="h-full m-0 p-0">
                    <ScrollArea className="h-full p-8">
                        {transcript ? (
                             <div className="max-w-3xl mx-auto">
                                <h2 className="text-2xl font-bold mb-6">Video Transcript</h2>
                                <div className="prose dark:prose-invert max-w-none">
                                    <p className="whitespace-pre-wrap leading-relaxed text-base text-foreground/90 font-sans">
                                        {transcript}
                                    </p>
                                </div>
                             </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                <p>Fetching transcript...</p>
                            </div>
                        )}
                    </ScrollArea>
                </TabsContent>

                {/* 2. NOTES TAB */}
                <TabsContent value="notes" className="h-full m-0 p-0">
                  <ScrollArea className="h-full p-8">
                    <div className="max-w-3xl mx-auto prose dark:prose-invert">
                      {notes ? (
                          <MarkdownViewer content={notes} />
                      ) : (
                          <div className="text-center mt-20 text-muted-foreground">
                              Generating study notes...
                          </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* 3. QUIZ TAB */}
                <TabsContent value="quiz" className="h-full m-0 p-0">
                   <ScrollArea className="h-full p-8">
                      {quiz ? (
                        <div className="max-w-2xl mx-auto space-y-8 pb-20">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold">{quiz.title}</h2>
                                <p className="text-muted-foreground">Test your knowledge of the video.</p>
                            </div>
                            
                            {quiz.questions?.map((q: any, i: number) => (
                                <Card key={i} className="p-6 border-l-4 border-l-indigo-500 shadow-sm">
                                    <h3 className="text-lg font-semibold mb-4 flex gap-3">
                                        <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0">
                                            {i+1}
                                        </span>
                                        {q.question_text}
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 gap-3 pl-11">
                                        {q.options?.map((opt: string, idx: number) => (
                                            <div key={idx} className="p-3 rounded-lg border bg-muted/20 hover:bg-muted/50 cursor-pointer transition-colors text-sm">
                                                {opt}
                                            </div>
                                        ))}
                                    </div>

                                    <Accordion type="single" collapsible className="mt-6 pl-11">
                                        <AccordionItem value="ans" className="border-b-0">
                                            <AccordionTrigger className="text-xs text-muted-foreground py-2 hover:text-indigo-600 hover:no-underline">
                                                Show Answer
                                            </AccordionTrigger>
                                            <AccordionContent className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-100 dark:border-green-900/50">
                                                <div className="font-semibold text-green-700 dark:text-green-400 mb-1">
                                                    Correct: {q.correct_answer}
                                                </div>
                                                {q.explanation && (
                                                    <p className="text-sm text-muted-foreground">
                                                        {q.explanation}
                                                    </p>
                                                )}
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </Card>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center mt-20 text-muted-foreground">Generating quiz questions...</div>
                      )}
                   </ScrollArea>
                </TabsContent>

                {/* 4. FLASHCARDS TAB */}
                <TabsContent value="flash" className="h-full m-0 p-0">
                  <ScrollArea className="h-full p-8">
                     {flashcards.length > 0 ? (
                        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
                             {flashcards.map((card, i) => (
                                <div key={i} className="group perspective">
                                    <Card className="h-64 relative overflow-hidden transition-all hover:shadow-lg flex flex-col">
                                         <div className="flex-1 p-6 flex items-center justify-center text-center font-semibold text-lg bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
                                            {card.front_content}
                                         </div>
                                         <div className="border-t p-4 bg-muted/10 text-sm text-muted-foreground text-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/20 transition-colors">
                                            <span className="font-bold text-indigo-600 block mb-1">Definition</span>
                                            {card.back_content}
                                         </div>
                                    </Card>
                                </div>
                             ))}
                        </div>
                     ) : (
                        <div className="text-center mt-20 text-muted-foreground">Generating flashcards...</div>
                     )}
                  </ScrollArea>
                </TabsContent>

                {/* 5. CHAT TAB */}
                <TabsContent value="chat" className="h-full m-0 p-0 flex flex-col bg-background">
                    <ScrollArea className="flex-1 p-4">
                        <div className="max-w-3xl mx-auto space-y-6 pb-4">
                            {chatHistory.length === 0 && (
                                <div className="text-center space-y-4 mt-20">
                                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto">
                                        <MessageSquare className="w-8 h-8 text-indigo-600" />
                                    </div>
                                    <h3 className="font-semibold text-lg">Chat with this video</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Ask specific questions about the content,<br/>
                                        or ask for a summary of specific parts.
                                    </p>
                                </div>
                            )}
                            
                            {chatHistory.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm shadow-sm ${
                                        msg.role === 'user' 
                                        ? 'bg-indigo-600 text-white rounded-br-none' 
                                        : 'bg-muted text-foreground rounded-bl-none border'
                                    }`}>
                                        <MarkdownViewer content={msg.content} />
                                    </div>
                                </div>
                            ))}
                            
                            {chatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-muted rounded-2xl px-5 py-3 text-sm text-muted-foreground animate-pulse rounded-bl-none">
                                        Thinking...
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    
                    <div className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                        <div className="max-w-3xl mx-auto flex gap-3">
                            <Input 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder={transcript ? "Ask a question about the video..." : "Waiting for transcript..."}
                                className="flex-1"
                                disabled={!transcript || chatLoading}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            />
                            <Button 
                                onClick={handleSendMessage} 
                                disabled={!transcript || chatLoading || !chatInput.trim()}
                                size="icon"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </TabsContent>

              </div>
            </Tabs>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}