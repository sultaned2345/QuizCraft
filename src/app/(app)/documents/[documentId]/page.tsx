// src/app/(app)/documents/[documentId]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react'; 
import { useRouter, useParams } from 'next/navigation'; 
import Link from 'next/link';
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  BrainCircuit, 
  Layers, 
  Mic, 
  PanelRightClose, 
  PanelRightOpen,
  Sparkles,
  Bot,
  Loader2,
  PenTool,
  Play,
  BookOpen
} from "lucide-react";

// --- Components ---
import { PdfViewer } from "@/components/PdfViewer";
import { ChatInterface } from "@/components/ChatInterface";
import { PodcastPlayer } from "@/components/PodcastPlayer";
import { NoteEditor } from "@/components/NoteEditor"; 
import { useTurboGenerator } from '@/hooks/useTurboGenerator';

// --- Types ---
interface StudySet {
  note: { id: string; title: string; content: string } | null;
  quiz: { id: string; title: string; questions: any[] } | null;
  deck: { id: string; title: string; flashcards: any[] } | null;
}

export default function StudyWorkspacePage() {
  const params = useParams();
  const rawId = params?.documentId;
  const router = useRouter();

  // FIX: Redirect immediately if ID is explicitly invalid to prevent broken states
  useEffect(() => {
    if (rawId === 'undefined' || rawId === 'null') {
      router.push('/documents');
    }
  }, [rawId, router]);
  
  // Safe ID resolution
  const documentId = (typeof rawId === 'string' && rawId !== 'undefined' && rawId !== 'null') ? rawId : null;
  
  // --- UI State ---
  const [isContentOpen, setIsContentOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("document");

  // --- Data State ---
  const [docData, setDocData] = useState<{
    title: string;
    content: string;
    podcast?: any;
  } | null>(null);
  
  const [studySet, setStudySet] = useState<StudySet>({ note: null, quiz: null, deck: null });
  const [isLoading, setIsLoading] = useState(true);

  // --- Data Fetching ---
  const refreshData = useCallback(async () => {
     // FIX: Do not fetch if ID is invalid or missing
     if (!documentId) return;
     
     try {
        // Fetch both Document Metadata and Linked Study Assets in parallel
        const [docRes, setRes] = await Promise.all([
           fetch(`/api/documents/${documentId}`),
           fetch(`/api/documents/${documentId}/study-set`)
        ]);

        if (docRes.ok) {
           const json = await docRes.json();
           const data = json.data || json;
           setDocData({
             title: data.file_name || "Document",
             content: data.extracted_text || "",
             podcast: data.podcast 
           });
        }

        if (setRes.ok) {
           const json = await setRes.json();
           setStudySet(json.data);
        }
     } catch (error) {
        console.error("Failed to refresh data", error);
     }
  }, [documentId]);

  // --- Hook Integration ---
  // Ensure we pass a stable string or empty string to the hook to avoid null errors
  const { generate, isGenerating } = useTurboGenerator(documentId || '', {
    onSuccess: () => refreshData() 
  });
  
  // Initial Load
  useEffect(() => {
    if (!documentId) return;
    setIsLoading(true);
    refreshData().finally(() => setIsLoading(false));
  }, [documentId, refreshData]);

  // Handle Invalid/Loading State
  if (!documentId) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Initializing workspace...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] -m-4 md:-m-8 overflow-hidden flex flex-col bg-background">
      
      <ResizablePanelGroup direction="horizontal" className="flex-1 h-full">
        
        {/* === LEFT PANEL: CHAT INTERFACE === */}
        <ResizablePanel 
          defaultSize={35} 
          minSize={25} 
          maxSize={50} 
          className="flex flex-col border-r border-border/40 bg-card/30 backdrop-blur-sm"
        >
          <div className="h-14 flex items-center justify-between px-4 border-b border-border/40 bg-background/50">
             <div className="flex items-center gap-2 font-mono text-sm font-medium text-primary">
                <Bot className="w-4 h-4" />
                <span>AI TUTOR</span>
             </div>
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => setIsContentOpen(!isContentOpen)}
               className="text-muted-foreground hover:text-foreground"
               title={isContentOpen ? "Hide Content" : "Show Content"}
             >
               {isContentOpen ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
             </Button>
          </div>

          <div className="flex-1 overflow-hidden relative">
             <ChatInterface documentId={documentId} />
          </div>
        </ResizablePanel>

        {isContentOpen && <ResizableHandle withHandle className="bg-border/40 hover:bg-primary/50 transition-colors w-1.5" />}

        {/* === RIGHT PANEL: CONTENT === */}
        {isContentOpen && (
          <ResizablePanel defaultSize={65} minSize={30} className="flex flex-col bg-muted/10">
            
            {/* Tabs Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-border/40 bg-background/80 backdrop-blur-md">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex items-center">
                <TabsList className="h-9 bg-muted/50 p-1 rounded-lg">
                  <TabsTrigger value="document" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <FileText className="w-3.5 h-3.5" /> 
                    <span className="hidden sm:inline">PDF</span>
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <PenTool className="w-3.5 h-3.5" /> 
                    <span className="hidden sm:inline">Notes</span>
                  </TabsTrigger>
                  <TabsTrigger value="quiz" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <BrainCircuit className="w-3.5 h-3.5" /> 
                    <span className="hidden sm:inline">Quiz</span>
                  </TabsTrigger>
                  <TabsTrigger value="flashcards" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Layers className="w-3.5 h-3.5" /> 
                    <span className="hidden sm:inline">Cards</span>
                  </TabsTrigger>
                  <TabsTrigger value="audio" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Mic className="w-3.5 h-3.5" /> 
                    <span className="hidden sm:inline">Audio</span>
                  </TabsTrigger>
                </TabsList>

                <div className="ml-auto flex items-center gap-2">
                   {activeTab === 'document' && (
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                           <Sparkles className="w-4 h-4" />
                       </Button>
                   )}
                </div>
              </Tabs>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto relative bg-background/50">
              <Tabs value={activeTab} className="h-full w-full">
                
                {/* 1. PDF Viewer */}
                <TabsContent value="document" className="h-full m-0 p-0">
                  <div className="h-full w-full overflow-hidden">
                     <PdfViewer documentId={documentId} />
                  </div>
                </TabsContent>
                
                {/* 2. Notes Editor */}
                <TabsContent value="notes" className="h-full m-0 p-0">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>
                  ) : studySet.note ? (
                    <NoteEditor 
                       noteId={studySet.note.id} 
                       initialContent={studySet.note.content} 
                       initialTitle={studySet.note.title} 
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center space-y-4 p-8 text-center">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                           <PenTool className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-medium">No Notes Yet</h3>
                        <p className="text-muted-foreground max-w-sm">
                          Let AI summarize this document and create structured study notes for you.
                        </p>
                        <Button onClick={() => generate('note')} disabled={isGenerating}>
                          {isGenerating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 w-4 h-4" />}
                          Generate Notes
                        </Button>
                    </div>
                  )}
                </TabsContent>

                {/* 3. Quiz Hub */}
                <TabsContent value="quiz" className="h-full m-0 p-8 overflow-y-auto">
                   {isLoading ? (
                      <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>
                   ) : studySet.quiz ? (
                      <div className="max-w-md mx-auto mt-10 space-y-6">
                         <div className="p-8 rounded-3xl border bg-card shadow-lg text-center space-y-4">
                            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center">
                               <BrainCircuit className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                               <h2 className="text-2xl font-bold">{studySet.quiz.title}</h2>
                               <p className="text-muted-foreground">
                                  {studySet.quiz.questions?.length || 'Unknown'} Questions • Multiple Choice & Text
                               </p>
                            </div>
                            <Link href={`/quiz/${studySet.quiz.id}`} className="block w-full">
                                <Button size="lg" className="w-full rounded-xl text-base h-12">
                                   <Play className="w-4 h-4 mr-2 fill-current" /> Start Quiz
                                </Button>
                            </Link>
                         </div>
                         <div className="text-center">
                            <Button variant="link" className="text-muted-foreground" onClick={() => generate('quiz')} disabled={isGenerating}>
                               Regenerate Quiz
                            </Button>
                         </div>
                      </div>
                   ) : (
                      <div className="h-full flex flex-col items-center justify-center space-y-4 p-8 text-center">
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                              <BrainCircuit className="w-8 h-8 text-primary" />
                          </div>
                          <h3 className="text-xl font-medium">Test Your Knowledge</h3>
                          <p className="text-muted-foreground max-w-sm">
                              Generate a quiz to reinforce what you've learned from this document.
                          </p>
                          <Button onClick={() => generate('quiz')} disabled={isGenerating}>
                              {isGenerating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 w-4 h-4" />}
                              Generate Quiz
                          </Button>
                      </div>
                   )}
                </TabsContent>

                {/* 4. Flashcards Hub */}
                <TabsContent value="flashcards" className="h-full m-0 p-8 overflow-y-auto">
                   {isLoading ? (
                      <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>
                   ) : studySet.deck ? (
                      <div className="max-w-md mx-auto mt-10 space-y-6">
                         <div className="p-8 rounded-3xl border bg-card shadow-lg text-center space-y-4">
                            <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                               <Layers className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                               <h2 className="text-2xl font-bold">{studySet.deck.title}</h2>
                               <p className="text-muted-foreground">
                                  {studySet.deck.flashcards?.length || 'Unknown'} Cards • Active Recall
                                </p>
                            </div>
                            <Link href={`/flashcards/${studySet.deck.id}`} className="block w-full">
                                <Button size="lg" className="w-full rounded-xl text-base h-12">
                                   <BookOpen className="w-4 h-4 mr-2" /> Review Deck
                                </Button>
                            </Link>
                         </div>
                         <div className="text-center">
                             <Button variant="link" className="text-muted-foreground" onClick={() => generate('flashcards')} disabled={isGenerating}>
                                Regenerate Cards
                             </Button>
                         </div>
                      </div>
                   ) : (
                      <div className="h-full flex flex-col items-center justify-center space-y-4 p-8 text-center">
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                              <Layers className="w-8 h-8 text-primary" />
                          </div>
                          <h3 className="text-xl font-medium">Master the Details</h3>
                          <p className="text-muted-foreground max-w-sm">
                              Create flashcards to memorize key concepts and definitions.
                          </p>
                          <Button onClick={() => generate('flashcards')} disabled={isGenerating}>
                              {isGenerating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 w-4 h-4" />}
                              Generate Flashcards
                          </Button>
                      </div>
                   )}
                </TabsContent>

                {/* 5. Audio Player */}
                <TabsContent value="audio" className="h-full m-0 p-8 overflow-y-auto">
                   {isLoading ? (
                      <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p>Loading audio workspace...</p>
                      </div>
                   ) : (
                      <div className="max-w-2xl mx-auto space-y-8 mt-10">
                         <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight">Audio Notebook</h2>
                            <p className="text-muted-foreground">
                              Listen to an AI-generated discussion about this document.
                            </p>
                         </div>
                         
                         {docData && (
                           <PodcastPlayer 
                              content={docData.content}
                              title={docData.title}
                              sourceId={documentId}
                              sourceType="document"
                              existingPodcast={docData.podcast}
                           />
                         )}
                      </div>
                   )}
                </TabsContent>

              </Tabs>
            </div>

          </ResizablePanel>
        )}
      </ResizablePanelGroup>
    </div>
  );
}