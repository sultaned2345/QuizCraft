'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { 
    ArrowLeft, 
    BookOpen, 
    BrainCircuit, 
    Layers, 
    Loader2, 
    Sparkles,
    MoreVertical 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { NoteEditor } from '@/components/NoteEditor'; 
import { PdfViewer } from '@/components/PdfViewer';
import { QuizzesClientComponent } from '@/app/(app)/quizzes/QuizzesClientComponent'; 
import { FlashcardsClientComponent } from '@/app/(app)/flashcards/FlashcardsClientComponent';

// 1. Import the hook
import { useTurboGenerator } from '@/hooks/useTurboGenerator';

export default function DocumentHubPage() {
  const { documentId } = useParams();
  const { session } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("notes");

  // 2. Initialize the hook
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

  // 3. Add Handler
  const handleTurboGen = (type: 'quiz' | 'flashcards' | 'notes') => {
      // CRITICAL FIX: Pass 'document.id' (UUID), NEVER 'document.content'
      if (document?.id) {
          generate(type, document.id);
      } else {
          console.error("Missing document ID");
      }
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

        {/* 4. Turbo Actions UI */}
        <div className="flex items-center gap-2">
            {/* Show Status Text if doing something */}
            {status !== 'idle' && (
                <span className="text-xs text-muted-foreground font-mono mr-2 animate-pulse">
                    {status}
                </span>
            )}
            
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button disabled={isGenerating} className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0">
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Magic Generate
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleTurboGen('quiz')}>
                        <BrainCircuit className="w-4 h-4 mr-2" /> New Quiz
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTurboGen('flashcards')}>
                        <Layers className="w-4 h-4 mr-2" /> Flashcard Deck
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTurboGen('notes')}>
                        <BookOpen className="w-4 h-4 mr-2" /> Summarize Notes
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

          {/* TAB 1: NOTES */}
          <TabsContent value="notes" className="flex-1 m-0 h-full overflow-hidden data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 h-full">
              <div className="h-full border-r bg-zinc-100 dark:bg-zinc-900 overflow-hidden relative">
                 {document.file_path ? (
                    <PdfViewer url={document.publicUrl || ''} onTextSelect={() => {}} />
                 ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">Source content not available</div>
                 )}
              </div>
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
                   <Button variant="outline" onClick={() => handleTurboGen('quiz')} disabled={isGenerating}>
                     <Sparkles className="w-4 h-4 mr-2" /> Auto-Generate
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
                   <Button variant="outline" onClick={() => handleTurboGen('flashcards')} disabled={isGenerating}>
                     <Sparkles className="w-4 h-4 mr-2" /> Auto-Generate
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