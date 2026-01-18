// src/app/(app)/study/[documentId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTurboGenerator } from '@/hooks/useTurboGenerator';
import { TurboLoading } from '@/components/TurboLoading';
import { ChatInterface } from '@/components/ChatInterface'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Play, FileText, BrainCircuit, Mic, Sparkles, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function StudyHubPage({ params }: { params: { documentId: string } }) {
  const { documentId } = params;
  const { startTurbo, statuses, results, isFullyComplete } = useTurboGenerator(documentId);
  const [init, setInit] = useState(false);

  // Auto-start on mount
  useEffect(() => {
    if (!init) {
      setInit(true);
      startTurbo();
    }
  }, [init, startTurbo]);

  // 1. Loading Phase
  if (!isFullyComplete) {
    return <TurboLoading status="GENERATING_NEURAL_ASSETS" />;
  }

  // 2. The Dashboard (Bento Grid)
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
              TURBO STUDY HUB
            </h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              All learning assets generated successfully.
            </p>
        </div>
        <Button variant="outline" asChild>
            <Link href="/dashboard">Exit to Dashboard</Link>
        </Button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[80vh]">
        
        {/* LEFT: Chat (Span 7) */}
        <div className="md:col-span-7 flex flex-col gap-6 h-full min-h-[500px]">
            <Card className="flex-1 border-indigo-500/20 shadow-xl shadow-indigo-500/5 flex flex-col overflow-hidden">
                <CardHeader className="py-3 px-4 border-b bg-muted/40 backdrop-blur">
                   <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-indigo-500">
                     <MessageSquare className="w-4 h-4" /> AI Tutor
                   </CardTitle>
                </CardHeader>
                <div className="flex-1 overflow-hidden relative">
                    <ChatInterface documentId={documentId} embedded={true} />
                </div>
            </Card>
        </div>

        {/* RIGHT: Assets (Span 5) */}
        <div className="md:col-span-5 flex flex-col gap-6 h-full">
            
            {/* Podcast Card */}
            <Card className="group relative overflow-hidden border-none bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xl shrink-0">
                <div className="absolute inset-0 bg-white/5 opacity-20" />
                <CardContent className="p-6 relative z-10 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center animate-pulse border border-cyan-500/50">
                        <Mic className="w-8 h-8 text-cyan-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold tracking-tight">AI Podcast</h3>
                        <p className="text-slate-400 text-xs uppercase tracking-widest">Audio Deep Dive</p>
                    </div>
                    {results.podcast ? (
                       <Button className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold" asChild>
                           <Link href={`/podcasts/${results.podcast}`}>
                             <Play className="w-4 h-4 mr-2" /> Play Episode
                           </Link>
                       </Button>
                    ) : (
                       <Button disabled className="w-full opacity-50 bg-slate-700">Generation Failed</Button>
                    )}
                </CardContent>
            </Card>

            {/* Tabs for Quiz, Notes, Flashcards */}
            <Card className="flex-1 border-muted bg-card/50 backdrop-blur overflow-hidden flex flex-col">
                <Tabs defaultValue="quiz" className="flex-1 flex flex-col">
                    <div className="px-4 pt-4">
                        <TabsList className="w-full grid grid-cols-3">
                            <TabsTrigger value="quiz">Quiz</TabsTrigger>
                            <TabsTrigger value="cards">Cards</TabsTrigger>
                            <TabsTrigger value="notes">Notes</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
                        <TabsContent value="quiz" className="w-full space-y-4 animate-in fade-in zoom-in-95 mt-0">
                            <div className="p-4 bg-orange-500/10 rounded-full mx-auto w-fit">
                                <BrainCircuit className="w-8 h-8 text-orange-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold">Ready to test?</h3>
                                <p className="text-sm text-muted-foreground mt-1">5 questions generated.</p>
                            </div>
                            {results.quiz && (
                                <Button asChild className="w-full" variant="default">
                                    <Link href={`/quiz/${results.quiz}`}>Start Quiz</Link>
                                </Button>
                            )}
                        </TabsContent>

                        <TabsContent value="cards" className="w-full space-y-4 animate-in fade-in zoom-in-95 mt-0">
                             <div className="p-4 bg-blue-500/10 rounded-full mx-auto w-fit">
                                <Sparkles className="w-8 h-8 text-blue-500" />
                            </div>
                             <div>
                                <h3 className="font-semibold">Active Recall</h3>
                                <p className="text-sm text-muted-foreground mt-1">Review key terms.</p>
                            </div>
                            {results.flashcard && (
                                <Button asChild className="w-full" variant="outline">
                                     <Link href={`/flashcards/${results.flashcard}`}>View Deck</Link>
                                </Button>
                            )}
                        </TabsContent>

                        <TabsContent value="notes" className="w-full space-y-4 animate-in fade-in zoom-in-95 mt-0">
                             <div className="p-4 bg-emerald-500/10 rounded-full mx-auto w-fit">
                                <FileText className="w-8 h-8 text-emerald-500" />
                            </div>
                             <div>
                                <h3 className="font-semibold">Study Guide</h3>
                                <p className="text-sm text-muted-foreground mt-1">Structured summary.</p>
                            </div>
                            {results.note && (
                                <Button asChild className="w-full" variant="secondary">
                                     <Link href={`/notes/${results.note}`}>Read Notes</Link>
                                </Button>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </Card>
        </div>
      </div>
    </div>
  );
}