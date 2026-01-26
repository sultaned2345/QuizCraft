// src/app/(app)/documents/[documentId]/page.tsx
'use client';

import { useState, useEffect, use } from 'react'; // ✅ Import 'use'
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
  AlertTriangle
} from "lucide-react";

import { PdfViewer } from "@/components/PdfViewer";
import { ChatInterface } from "@/components/ChatInterface";

// ✅ Update type definition for Next.js 15
export default function StudyWorkspacePage({ params }: { params: Promise<{ documentId: string }> }) {
  // ✅ Unwrap the params Promise using React.use()
  const { documentId } = use(params);
  
  const router = useRouter();
  const [isContentOpen, setIsContentOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("document");
  
  // ✅ Check validity on the unwrapped ID
  const invalidId = !documentId || documentId === 'undefined';

  useEffect(() => {
    if (invalidId) {
       // Optional: Auto-redirect
       // setTimeout(() => router.push('/documents'), 3000);
    }
  }, [invalidId, router]);

  if (invalidId) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <div className="p-4 bg-red-500/10 rounded-full text-red-500">
          <AlertTriangle className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-bold">Document Not Found</h2>
        <p className="text-muted-foreground">The document ID is invalid or missing.</p>
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
             {/* ✅ Pass unwrapped documentId */}
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
                
                <TabsContent value="document" className="h-full m-0 p-0">
                  <div className="h-full w-full overflow-hidden">
                     {/* ✅ Pass unwrapped documentId */}
                     <PdfViewer documentId={documentId} />
                  </div>
                </TabsContent>
                
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

                <TabsContent value="flashcards" className="h-full m-0 p-8 overflow-y-auto">
                   <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                      <Layers className="w-12 h-12 opacity-20" />
                      <p>Select a flashcard deck to review</p>
                   </div>
                </TabsContent>

                <TabsContent value="audio" className="h-full m-0 p-8 overflow-y-auto">
                   <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                      <Mic className="w-12 h-12 opacity-20" />
                      <p>Audio transcript and player will appear here.</p>
                   </div>
                </TabsContent>
              </Tabs>
            </div>

          </ResizablePanel>
        )}
      </ResizablePanelGroup>
    </div>
  );
}