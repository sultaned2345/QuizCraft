'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, BrainCircuit, Layers, Loader2 } from 'lucide-react';

// Sub-components (Ensure these are exported correctly from your project)
// You may need to create simple wrappers if these components expect different props.
import { NoteEditor } from '@/components/NoteEditor'; 
import { PdfViewer } from '@/components/PdfViewer';
// Assuming you have list components, otherwise we can build simple ones
import { QuizzesClientComponent } from '@/app/(app)/quizzes/QuizzesClientComponent'; 
import { FlashcardsClientComponent } from '@/app/(app)/flashcards/FlashcardsClientComponent';

export default function DocumentHubPage() {
  const { documentId } = useParams();
  const { session } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("notes");

  // Fetch Document Metadata
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
             {/* Pass documentId to filter quizzes for this specific doc */}
             {/* If your QuizzesClientComponent doesn't support props yet, we will need to refactor it next. */}
             <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                   <h2 className="text-xl font-semibold">Practice Tests</h2>
                   <Button onClick={() => router.push(`/quiz/generate?docId=${document.id}`)}>
                     Generate New Quiz
                   </Button>
                </div>
                {/* Placeholder: Replace with <QuizzesClientComponent documentId={document.id} /> */}
                <QuizzesClientComponent documentId={document.id} />
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
                {/* Placeholder: Replace with <FlashcardsClientComponent documentId={document.id} /> */}
                <FlashcardsClientComponent documentId={document.id} />
             </div>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}