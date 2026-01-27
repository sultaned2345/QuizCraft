// src/app/(app)/documents/[documentId]/page.tsx
'use client';

import { useState, useEffect, use } from 'react'; 
import { useRouter } from 'next/navigation';
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
  AlertTriangle,
  Loader2
} from "lucide-react";

import { PdfViewer } from "@/components/PdfViewer";
import { ChatInterface } from "@/components/ChatInterface";
import { PodcastPlayer } from "@/components/PodcastPlayer"; // ✅ Import the Player

export default function StudyWorkspacePage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = use(params);
  const router = useRouter();
  
  // UI State
  const [isContentOpen, setIsContentOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("document");

  // Data State
  const [docData, setDocData] = useState<{
    title: string;
    content: string;
    podcast?: any;
  } | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const invalidId = !documentId || documentId === 'undefined';

  // 1. Fetch Document Details on Mount
  useEffect(() => {
    if (invalidId) return;

    const fetchDoc = async () => {
      try {
        setIsLoadingData(true);
        const res = await fetch(`/api/documents/${documentId}`);
        if (!res.ok) throw new Error("Failed to load document");
        
        const json = await res.json();
        const data = json.data || json; // Handle wrapped or unwrapped responses

        setDocData({
          title: data.file_name || "Document",
          content: data.extracted_text || "",
          podcast: data.podcast // Expecting relation from API, or undefined
        });
      } catch (error) {
        console.error("Error fetching doc data:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchDoc();
  }, [documentId, invalidId]);

  if (invalidId) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <div className="p-4 bg-red-500/10 rounded-full text-red-500">
          <AlertTriangle className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-bold">Document Not Found</h2>
        <Button onClick={() => router.push('/documents')}>Return to Library</Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] -m-4 md:-m-8 overflow-hidden flex flex-col bg-background">
      
      <ResizablePanelGroup direction="horizontal" className="flex-1 h-full">
        
        {/* === LEFT PANEL: CHAT INTERFACE (Primary) === */}
        <ResizablePanel 
          defaultSize={35} 
          minSize={25} 
          maxSize={50} 
          className="flex flex-col border-r border-border/40 bg-card/30 backdrop-blur-sm"
        >
          {/* Chat Header */}
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

        {/* === RIGHT PANEL: CONTENT (Reference) === */}
        {isContentOpen && (
          <ResizablePanel defaultSize={65} minSize={30} className="flex flex-col bg-muted/10">
            
            <div className="h-14 flex items-center justify-between px-4 border-b border-border/40 bg-background/80 backdrop-blur-md">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex items-center">
                <TabsList className="h-9 bg-muted/50 p-1 rounded-lg">
                  <TabsTrigger value="document" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <FileText className="w-3.5 h-3.5" /> 
                    <span className="hidden sm:inline">PDF</span>
                  </TabsTrigger>
                  <TabsTrigger value="quiz" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <BrainCircuit className="w-3.5 h-3.5" /> 
                    <span className="hidden sm:inline">Quiz</span>
                  </TabsTrigger>
                  <TabsTrigger value="flashcards" className="gap-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Layers className="w-3.5 h-3.5" /> 
                    <span className="hidden sm:inline">Flashcards</span>
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

            <div className="flex-1 overflow-y-auto relative bg-background/50">
              <Tabs value={activeTab} className="h-full w-full">
                
                {/* PDF VIEW */}
                <TabsContent value="document" className="h-full m-0 p-0">
                  <div className="h-full w-full overflow-hidden">
                     <PdfViewer documentId={documentId} />
                  </div>
                </TabsContent>
                
                {/* QUIZ PLACEHOLDER */}
                <TabsContent value="quiz" className="h-full m-0 p-8 overflow-y-auto">
                  <div className="max-w-4xl mx-auto text-center space-y-6">
                      <div className="p-12 rounded-3xl border border-dashed border-border bg-card/50">
                          <BrainCircuit className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <h2 className="text-xl font-medium mb-2">Quiz Generator</h2>
                          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                              Generate a new quiz based on the document's content to test your knowledge.
                          </p>
                          <Button>Create New Quiz</Button>
                      </div>
                  </div>
                </TabsContent>

                {/* FLASHCARDS PLACEHOLDER */}
                <TabsContent value="flashcards" className="h-full m-0 p-8 overflow-y-auto">
                   <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                      <Layers className="w-12 h-12 opacity-20" />
                      <p>Select a flashcard deck to review</p>
                   </div>
                </TabsContent>

                {/* ✅ AUDIO / PODCAST PLAYER */}
                <TabsContent value="audio" className="h-full m-0 p-8 overflow-y-auto">
                   {isLoadingData ? (
                      <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p>Loading audio workspace...</p>
                      </div>
                   ) : (
                      <div className="max-w-2xl mx-auto space-y-8">
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