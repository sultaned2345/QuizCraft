// src/app/(app)/projects/[projectId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTurboGenerator } from '@/hooks/useTurboGenerator';
import { TurboLoading } from '@/components/TurboLoading';
import { ChatInterface } from '@/components/ChatInterface'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Play, BrainCircuit, Mic, Layers, 
  MessageSquare, Share2, MoreVertical, LayoutDashboard 
} from 'lucide-react';
import Link from 'next/link';
import PdfViewer from '@/components/PdfViewer'; // You'll need a simple PDF viewer component

export default function ProjectHubPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const searchParams = useSearchParams();
  
  // 1. Logic to handle "Turbo" auto-start
  const isTurboMode = searchParams.get('turbo') === 'true';
  const docIdParam = searchParams.get('docId');

  // We only run the generator if we have a specific NEW document ID passed in URL
  const { startTurbo, statuses, results, isFullyComplete } = useTurboGenerator(docIdParam || '');
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (isTurboMode && docIdParam && !hasStarted) {
      setHasStarted(true);
      startTurbo();
    }
  }, [isTurboMode, docIdParam, hasStarted, startTurbo]);

  // 2. Loading State (Only if we are in "Turbo Mode" and not done)
  if (isTurboMode && !isFullyComplete) {
    return <TurboLoading statuses={statuses} />;
  }

  // 3. The "One Big File" Interface
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background overflow-hidden">
      
      {/* Top Bar: Project Identity */}
      <header className="h-16 border-b flex items-center justify-between px-6 bg-card/50 backdrop-blur z-20">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
                <LayoutDashboard className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
                <h1 className="text-lg font-bold leading-none">Project: Turbo Alpha</h1>
                <p className="text-xs text-muted-foreground mt-1">Generated {new Date().toLocaleDateString()}</p>
            </div>
            <Badge variant="outline" className="ml-2 bg-green-500/10 text-green-500 border-green-500/20">
                Ready
            </Badge>
         </div>
         <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon"><Share2 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
            <Button className="ml-2 bg-indigo-600 hover:bg-indigo-700">Export Report</Button>
         </div>
      </header>

      {/* Main Workspace: Split View */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: The Source (File) - 45% Width */}
        <div className="w-[45%] border-r flex flex-col bg-muted/10 relative">
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
               {/* Replace this with your actual <PdfViewer url={docUrl} /> */}
               <div className="text-center p-8">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>Document Previewer Area</p>
                  <p className="text-sm opacity-50">(Integrate your PDF viewer here)</p>
               </div>
            </div>
        </div>

        {/* RIGHT PANEL: The AI Tools - 55% Width */}
        <div className="flex-1 flex flex-col bg-background">
            <Tabs defaultValue="chat" className="flex-1 flex flex-col">
                
                {/* Modern Tab Navigation */}
                <div className="border-b px-4">
                    <TabsList className="bg-transparent h-14 w-full justify-start gap-6">
                        <TabsTrigger value="chat" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none h-full px-2">
                            <MessageSquare className="w-4 h-4 mr-2" /> Chat
                        </TabsTrigger>
                        <TabsTrigger value="notes" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none h-full px-2">
                            <FileText className="w-4 h-4 mr-2" /> Notes
                        </TabsTrigger>
                        <TabsTrigger value="quiz" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none h-full px-2">
                            <BrainCircuit className="w-4 h-4 mr-2" /> Quiz
                        </TabsTrigger>
                        <TabsTrigger value="flashcards" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none h-full px-2">
                            <Layers className="w-4 h-4 mr-2" /> Flashcards
                        </TabsTrigger>
                        <TabsTrigger value="podcast" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-pink-500 rounded-none h-full px-2">
                            <Mic className="w-4 h-4 mr-2" /> Podcast
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Tab Contents */}
                <div className="flex-1 overflow-hidden relative bg-muted/5">
                    
                    {/* CHAT */}
                    <TabsContent value="chat" className="h-full m-0 p-0">
                        {/* Embed Chat Interface without internal padding/borders to fit flush */}
                        <ChatInterface documentId={docIdParam || ''} embedded={true} className="h-full border-none shadow-none" />
                    </TabsContent>

                    {/* NOTES */}
                    <TabsContent value="notes" className="h-full m-0 p-6 overflow-auto">
                        <ScrollArea className="h-full pr-4">
                           <div className="prose dark:prose-invert max-w-none">
                              <h2>Study Notes</h2>
                              {results.note ? (
                                <Link href={`/notes/${results.note}`} className="text-indigo-500 underline">
                                    Click to open full note editor
                                </Link>
                              ) : (
                                <p className="text-muted-foreground">Notes are ready. View them in the editor.</p>
                              )}
                              {/* Render markdown preview here if available */}
                           </div>
                        </ScrollArea>
                    </TabsContent>

                    {/* QUIZ */}
                    <TabsContent value="quiz" className="h-full m-0 flex flex-col items-center justify-center p-8 text-center">
                        <div className="max-w-md space-y-6">
                            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto">
                                <BrainCircuit className="w-10 h-10 text-orange-500" />
                            </div>
                            <h2 className="text-2xl font-bold">Quiz Generated!</h2>
                            <p className="text-muted-foreground">
                                We've extracted 5 key questions from the document.
                            </p>
                            <Button size="lg" className="w-full bg-orange-500 hover:bg-orange-600" asChild>
                                <Link href={`/quiz/${results.quiz}`}>Take Quiz Now</Link>
                            </Button>
                        </div>
                    </TabsContent>

                    {/* PODCAST */}
                    <TabsContent value="podcast" className="h-full m-0 flex flex-col items-center justify-center p-8">
                        <Card className="w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-2xl">
                            <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                                <div className="w-24 h-24 rounded-full bg-pink-500/20 flex items-center justify-center animate-pulse">
                                    <Mic className="w-10 h-10 text-pink-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold">Deep Dive Audio</h3>
                                    <p className="text-slate-400">AI-Hosted discussion about this file.</p>
                                </div>
                                {results.podcast ? (
                                    <Button className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold h-12 rounded-full">
                                        <Play className="w-5 h-5 mr-2 fill-current" /> Play Episode
                                    </Button>
                                ) : (
                                    <div className="text-sm text-slate-500">Generating audio...</div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                </div>
            </Tabs>
        </div>
      </div>
    </div>
  );
}