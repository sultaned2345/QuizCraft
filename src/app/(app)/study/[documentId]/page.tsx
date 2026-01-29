// src/app/(app)/study/[documentId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation'; // FIX: Use standard hook
import { useTurboGenerator } from '@/hooks/useTurboGenerator';
import { TurboLoading } from '@/components/TurboLoading';
import { ChatInterface } from '@/components/ChatInterface'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Play, FileText, BrainCircuit, Mic, Sparkles, MessageSquare, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function StudyHubPage() {
  // FIX: Unwrap params safely
  const params = useParams();
  const documentId = params?.documentId as string;
  
  // 1. The Hook acts as the Orchestrator
  // FIX: removed 'statuses' (it doesn't exist on hook return), use 'results' instead
  const { startTurbo, status, results, isFullyComplete } = useTurboGenerator(documentId);
  const [init, setInit] = useState(false);

  // 2. Auto-start generation on mount
  useEffect(() => {
    if (!init && documentId) {
      setInit(true);
      startTurbo();
    }
  }, [init, startTurbo, documentId]);

  // 3. LOADING PHASE: Show the Sci-Fi Loader until EVERYTHING is done
  if (!isFullyComplete) {
    // FIX: Pass results as statuses so the loader knows what's done
    return <TurboLoading status={status} statuses={results} />;
  }

  // 4. COMPLETE PHASE: The "God View" Dashboard
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <Button variant="ghost" size="icon" asChild className="-ml-2 h-8 w-8">
                    <Link href="/dashboard"><ArrowLeft className="w-4 h-4" /></Link>
                </Button>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
                TURBO HUB
                </h1>
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-sm md:text-base">
              <Sparkles className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              AI Analysis Complete. Your study assets are ready.
            </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" asChild>
                <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[500px] md:h-[calc(100vh-200px)]">
        
        {/* LEFT COLUMN: Chat (Span 7) */}
        <div className="md:col-span-7 flex flex-col h-full shadow-sm">
            <Card className="flex-1 border-indigo-500/20 shadow-xl shadow-indigo-500/5 flex flex-col overflow-hidden h-full">
                <CardHeader className="py-3 px-4 border-b bg-muted/30 flex flex-row items-center gap-2">
                   <MessageSquare className="w-4 h-4 text-indigo-500" />
                   <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                     AI Tutor
                   </CardTitle>
                </CardHeader>
                <div className="flex-1 overflow-hidden relative bg-card/50">
                    {/* Embedded Chat Interface */}
                    <ChatInterface documentId={documentId} embedded={true} />
                </div>
            </Card>
        </div>

        {/* RIGHT COLUMN: Assets (Span 5) */}
        <div className="md:col-span-5 flex flex-col gap-6 h-full">
            
            {/* 1. Podcast Card (Hero Feature) */}
            <Card className="group relative overflow-hidden border-none bg-gradient-to-br from-slate-950 to-slate-900 text-white shadow-2xl shrink-0">
                {/* Background Noise Texture */}
                <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
                
                <CardContent className="p-6 relative z-10 flex flex-row items-center gap-6">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                            <Mic className="w-8 h-8 text-cyan-400" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-cyan-500 text-[10px] text-black font-bold px-1.5 py-0.5 rounded-full">
                            AI
                        </div>
                    </div>
                    
                    <div className="flex-1 space-y-2">
                        <div>
                            <h3 className="text-lg font-bold tracking-tight text-white">Deep Dive Podcast</h3>
                            <p className="text-slate-400 text-xs uppercase tracking-widest font-medium">
                                Audio Generated
                            </p>
                        </div>
                        
                        {results.podcast ? (
                           <Button 
                             size="sm" 
                             className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all hover:shadow-[0_0_10px_rgba(6,182,212,0.5)]" 
                             asChild
                           >
                               <Link href={`/podcasts/${results.podcast}`}>
                                 <Play className="w-4 h-4 mr-2 fill-current" /> Play Episode
                               </Link>
                           </Button>
                        ) : (
                           <Button disabled size="sm" className="w-full bg-slate-800 text-slate-500">
                               Generation Failed
                           </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* 2. Study Tools Tabs */}
            <Card className="flex-1 border-muted bg-card/40 backdrop-blur-sm overflow-hidden flex flex-col shadow-sm">
                <Tabs defaultValue="quiz" className="flex-1 flex flex-col h-full">
                    <div className="px-4 pt-4 border-b bg-muted/20">
                        <TabsList className="w-full grid grid-cols-3 bg-muted/50">
                            <TabsTrigger value="quiz">Quiz</TabsTrigger>
                            <TabsTrigger value="cards">Cards</TabsTrigger>
                            <TabsTrigger value="notes">Notes</TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Tab Content Area */}
                    <div className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-card">
                        
                        {/* QUIZ TAB */}
                        <TabsContent value="quiz" className="w-full space-y-6 animate-in fade-in zoom-in-95 mt-0">
                            <div className="w-20 h-20 bg-orange-500/10 rounded-full mx-auto flex items-center justify-center mb-4">
                                <BrainCircuit className="w-10 h-10 text-orange-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-semibold">Knowledge Check</h3>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                    5 AI-generated questions to test your understanding of this document.
                                </p>
                            </div>
                            {results.quiz && (
                                <Button asChild className="w-full max-w-xs" size="lg" variant="default">
                                    <Link href={`/quiz/${results.quiz}`}>Start Quiz</Link>
                                </Button>
                            )}
                        </TabsContent>

                        {/* FLASHCARDS TAB */}
                        <TabsContent value="cards" className="w-full space-y-6 animate-in fade-in zoom-in-95 mt-0">
                             <div className="w-20 h-20 bg-blue-500/10 rounded-full mx-auto flex items-center justify-center mb-4">
                                <Sparkles className="w-10 h-10 text-blue-500" />
                            </div>
                             <div className="space-y-2">
                                <h3 className="text-xl font-semibold">Flashcards</h3>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                    Active recall deck created from key terms and definitions.
                                </p>
                            </div>
                            {results.flashcard && (
                                <Button asChild className="w-full max-w-xs" size="lg" variant="outline">
                                     <Link href={`/flashcards/${results.flashcard}`}>View Deck</Link>
                                </Button>
                            )}
                        </TabsContent>

                        {/* NOTES TAB */}
                        <TabsContent value="notes" className="w-full space-y-6 animate-in fade-in zoom-in-95 mt-0">
                             <div className="w-20 h-20 bg-emerald-500/10 rounded-full mx-auto flex items-center justify-center mb-4">
                                <FileText className="w-10 h-10 text-emerald-500" />
                            </div>
                             <div className="space-y-2">
                                <h3 className="text-xl font-semibold">Summary Notes</h3>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                    A structured summary and study guide of the entire document.
                                </p>
                            </div>
                            {results.note && (
                                <Button asChild className="w-full max-w-xs" size="lg" variant="secondary">
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