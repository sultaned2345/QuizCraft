'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, BrainCircuit, Layers, Loader2, Sparkles } from 'lucide-react';

import { NoteEditor } from '@/components/NoteEditor'; 
import { PdfViewer } from '@/components/PdfViewer';
import { QuizzesClientComponent } from '@/app/(app)/quizzes/QuizzesClientComponent'; 
import { FlashcardsClientComponent } from '@/app/(app)/flashcards/FlashcardsClientComponent';
import { useTurboGenerator } from '@/hooks/useTurboGenerator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function DocumentHubPage() {
  const { documentId } = useParams();
  const { session } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("notes");
  
  const { generate, isGenerating, status } = useTurboGenerator();

  const { data: docData, isLoading } = useSWR(
    session && documentId ? `/api/documents/${documentId}` : null,
    (url) => fetcher(url, session?.access_token || '')
  );

  const document = docData?.data;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!document) {
    return <div className="p-8 text-center">Document not found</div>;
  }

  const handleTurboGen = (type: 'quiz' | 'flashcards' | 'notes') => {
      // FIX: Pass the ID, not the content. The server fetches content using the ID.
      // Ensure documentId is a string (handle array case just in case of Next.js params quirk)
      const docId = Array.isArray(documentId) ? documentId[0] : documentId;
      generate(type, docId); 
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      
      {/* Header / Toolbar */}
      <div className="border-b px-6 py-3 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold truncate max-w-md">{document.file_name}</h1>
            <p className="text-xs text-muted-foreground">{document.file_type} • {new Date(document.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Turbo Actions */}
        <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-2">{status !== 'idle' && status}</span>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button disabled={isGenerating} className="gap-2">
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Generate
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleTurboGen('quiz')}>
                        New Quiz
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTurboGen('flashcards')}>
                        Flashcard Deck
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTurboGen('notes')}>
                        Summarize Notes
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          
          <div className="px-6 py-2 border-b bg-muted/20">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="notes" className="gap-2">
                <BookOpen className="w-4 h-4" /> Notes
              </TabsTrigger>
              <TabsTrigger value="quizzes" className="gap-2">
                <BrainCircuit className="w-4 h-4" /> Quizzes
              </TabsTrigger>
              <TabsTrigger value="flashcards" className="gap-2">
                <Layers className="w-4 h-4" /> Flashcards
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: NOTES (Split View: PDF + Editor) */}
          <TabsContent value="notes" className="flex-1 m-0 h-full overflow-hidden data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 h-full">
              
              {/* Left: Source Material (PDF or Video) */}
              <div className="h-full border-r bg-zinc-100 dark:bg-zinc-900 overflow-hidden relative">
                 {document.file_path ? (
                    <PdfViewer url={document.publicUrl || ''} onTextSelect={() => {}} />
                 ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                       Source content not available
                    </div>
                 )}
              </div>

              {/* Right: AI Notes Editor */}
              <div className="h-full overflow-y-auto bg-background">
                 <NoteEditor 
                    initialContent={document.content || ''} 
                    documentId={document.id}
                    isReadOnly={false} 
                 />
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: QUIZZES */}
          <TabsContent value="quizzes" className="flex-1 m-0 p-6 overflow-y-auto data-[state=inactive]:hidden">
             <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                   <h2 className="text-xl font-semibold">Practice Tests</h2>
                   <Button onClick={() => router.push(`/quiz/generate?docId=${document.id}`)}>
                     Generate New Quiz
                   </Button>
                </div>
                <QuizzesClientComponent />
             </div>
          </TabsContent>

          {/* TAB 3: FLASHCARDS */}
          <TabsContent value="flashcards" className="flex-1 m-0 p-6 overflow-y-auto data-[state=inactive]:hidden">
             <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                   <h2 className="text-xl font-semibold">Flashcard Decks</h2>
                   <Button onClick={() => router.push(`/flashcards/generate?docId=${document.id}`)}>
                     Generate Deck
                   </Button>
                </div>
                <FlashcardsClientComponent />
             </div>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}