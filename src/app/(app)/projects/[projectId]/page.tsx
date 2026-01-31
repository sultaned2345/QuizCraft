'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTurboGenerator } from '@/hooks/useTurboGenerator';
import { TurboLoading } from '@/components/TurboLoading';
import { ChatInterface } from '@/components/ChatInterface'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { FileText, Play, BrainCircuit, Mic, Layers, MessageSquare, Share2, MoreVertical, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { PdfViewer } from '@/components/PdfViewer'; // ✅ Fixed: Changed to named import

export default function ProjectHubPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const searchParams = useSearchParams();
  
  // Turbo Logic
  const isTurboMode = searchParams.get('turbo') === 'true';
  const docIdParam = searchParams.get('docId');
  const { startTurbo, statuses, results, isFullyComplete } = useTurboGenerator(docIdParam || '');
  
  const [hasStarted, setHasStarted] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null); // ✅ State for PDF URL

  // 1. Start Turbo Generator
  useEffect(() => {
    if (isTurboMode && docIdParam && !hasStarted) {
      setHasStarted(true);
      startTurbo();
    }
  }, [isTurboMode, docIdParam, hasStarted, startTurbo]);

  // 2. Fetch Document URL (So we can see the PDF)
  useEffect(() => {
    async function fetchProjectContent() {
      // If we know the docId from URL, use it directly
      const targetDocId = docIdParam; 
      
      if (targetDocId) {
        try {
            const res = await fetch(`/api/documents/${targetDocId}/url`);
            const data = await res.json();
            if (data.url) setDocUrl(data.url);
        } catch (e) {
            console.error("Failed to fetch doc url", e);
        }
      } else {
        // Otherwise fetch project content to find the linked doc
        // (You can implement this fallback if needed)
      }
    }
    fetchProjectContent();
  }, [docIdParam, projectId]);

  // 3. Loading View
  if (isTurboMode && !isFullyComplete) {
    return <TurboLoading statuses={statuses} />;
  }

  // 4. Main View
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background overflow-hidden">
      
      {/* Header */}
      <header className="h-16 border-b flex items-center justify-between px-6 bg-card/50 backdrop-blur z-20">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
                <LayoutDashboard className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
                <h1 className="text-lg font-bold leading-none">Project Workspace</h1>
                <p className="text-xs text-muted-foreground mt-1">
                   {isTurboMode ? 'Turbo Generation Complete' : 'Viewing Project'}
                </p>
            </div>
            <Badge variant="outline" className="ml-2 bg-green-500/10 text-green-500 border-green-500/20">
                Ready
            </Badge>
         </div>
         <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon"><Share2 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
         </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: PDF Viewer */}
        <div className="w-[45%] border-r flex flex-col bg-muted/10 relative">
            {docUrl ? (
                // ✅ This is where the file appears
                <PdfViewer url={docUrl} />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
                   <div className="text-center p-8">
                      <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p>Loading Document...</p>
                   </div>
                </div>
            )}
        </div>

        {/* RIGHT: AI Tools (Tabs) */}
        <div className="flex-1 flex flex-col bg-background">
            <Tabs defaultValue="chat" className="flex-1 flex flex-col">
                <div className="border-b px-4">
                    <TabsList className="bg-transparent h-14 w-full justify-start gap-6">
                        <TabsTrigger value="chat" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none h-full">
                            <MessageSquare className="w-4 h-4 mr-2" /> Chat
                        </TabsTrigger>
                        <TabsTrigger value="notes" className="data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none h-full">
                            <FileText className="w-4 h-4 mr-2" /> Notes
                        </TabsTrigger>
                        <TabsTrigger value="quiz" className="data-[state=active]:border-b-2 data-[state=active]:border-orange-500 rounded-none h-full">
                            <BrainCircuit className="w-4 h-4 mr-2" /> Quiz
                        </TabsTrigger>
                        <TabsTrigger value="podcast" className="data-[state=active]:border-b-2 data-[state=active]:border-pink-500 rounded-none h-full">
                            <Mic className="w-4 h-4 mr-2" /> Podcast
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-hidden relative bg-muted/5 p-0">
                    <TabsContent value="chat" className="h-full m-0 p-0">
                        <ChatInterface documentId={docIdParam || ''} embedded={true} className="h-full border-none shadow-none" />
                    </TabsContent>

                    <TabsContent value="notes" className="h-full m-0 p-6">
                        {results.note ? (
                            <div className="text-center mt-20">
                                <h3 className="text-xl font-semibold mb-4">Notes Generated</h3>
                                <Button asChild variant="secondary">
                                    <Link href={`/notes/${results.note}`}>Open Full Note Editor</Link>
                                </Button>
                            </div>
                        ) : <p className="p-8 text-center text-muted-foreground">Notes pending...</p>}
                    </TabsContent>

                    <TabsContent value="quiz" className="h-full m-0 flex flex-col items-center justify-center p-8">
                         {results.quiz ? (
                            <div className="text-center space-y-4">
                                <BrainCircuit className="w-16 h-16 text-orange-500 mx-auto" />
                                <h3 className="text-xl font-bold">Quiz Ready</h3>
                                <Button asChild className="bg-orange-500 hover:bg-orange-600">
                                    <Link href={`/quiz/${results.quiz}`}>Start Quiz</Link>
                                </Button>
                            </div>
                        ) : <p className="text-muted-foreground">Generating Quiz...</p>}
                    </TabsContent>

                    <TabsContent value="podcast" className="h-full m-0 flex flex-col items-center justify-center p-8">
                        {results.podcast ? (
                             <Card className="w-full max-w-md bg-slate-900 text-white border-none">
                                <CardContent className="p-8 text-center space-y-6">
                                    <Mic className="w-12 h-12 text-pink-500 mx-auto animate-pulse" />
                                    <h3 className="text-xl font-bold">Audio Generated</h3>
                                    <Button className="w-full bg-pink-500 hover:bg-pink-600">
                                        <Link href={`/podcasts/${results.podcast}`} className="flex items-center">
                                            <Play className="w-4 h-4 mr-2" /> Listen Now
                                        </Link>
                                    </Button>
                                </CardContent>
                             </Card>
                        ) : <p className="text-muted-foreground">Synthesizing Audio...</p>}
                    </TabsContent>
                </div>
            </Tabs>
        </div>
      </div>
    </div>
  );
}