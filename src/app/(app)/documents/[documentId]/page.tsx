// src/app/(app)/documents/[documentId]/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PageContextType } from '@/contexts/PageContext';
import { ApiResponse, DocumentMetadata } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, FileText, StickyNote, FileQuestion, Layers, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatInterface } from '@/components/ChatInterface';
import { usePageContext } from '@/contexts/PageContext';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Define the shape of the message for the ChatInterface
interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: any[];
}

interface ViewingContentState {
  title: string;
  text: string | null;
  pdfUrl: string | null;
}

export default function DocumentViewPage() {
  const params = useParams();
  const router = useRouter();
  const { session, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { setPageContext } = usePageContext();
  
  const documentId = params.documentId as string;

  // State for document content
  const [viewingContent, setViewingContent] = useState<ViewingContentState>({ title: '', text: null, pdfUrl: null });
  const [isLoadingContent, setIsLoadingContent] = useState(true);

  // State for chat
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  
  // Define the context for this page
  const pageContext = useMemo((): PageContextType => ({
    type: 'document',
    id: documentId,
  }), [documentId]);

  // Set page context when component mounts
  useEffect(() => {
    if (pageContext) {
      setPageContext(pageContext);
    }
    // Clear context on unmount
    return () => {
      setPageContext(null);
    };
  }, [pageContext, setPageContext]);

  // Effect to fetch all necessary data
  useEffect(() => {
    if (!session || !documentId) {
        if (!authLoading && !user) router.push('/login');
        return;
    };

    const fetchData = async () => {
      setIsLoadingContent(true);
      setIsHistoryLoading(true);

      try {
        // --- FIX: Fetch content and history first ---
        const [contentRes, historyRes] = await Promise.all([
          // 1. Fetch content
          fetch(`/api/documents/${documentId}/content`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          }),
          // 2. Fetch chat history
          fetch(`/api/chat/history?context_id=${documentId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
        ]);

        // Process Content
        const contentResult: ApiResponse<{ extracted_text: string | null; file_name: string }> = await contentRes.json();
        if (!contentRes.ok || !contentResult.success || !contentResult.data) {
          throw new Error(contentResult.error || 'Failed to fetch document content.');
        }
        const docText = contentResult.data.extracted_text;
        const docFileName = contentResult.data.file_name;
        
        // Set content state
        setViewingContent(prev => ({ ...prev, title: docFileName, text: docText, pdfUrl: null }));
        setIsLoadingContent(false); // <-- Content is loaded

        // Process History
        const historyResult: ApiResponse<Message[]> = await historyRes.json();
        if (historyResult.success && historyResult.data) {
          setChatHistory(historyResult.data);
        }
        setIsHistoryLoading(false); // <-- History is loaded

        // --- 3. NEW: Conditionally fetch PDF URL ---
        const isPdf = docFileName.toLowerCase().endsWith('.pdf');
        if (isPdf) {
          console.log("Document is a PDF, fetching signed URL...");
          const urlRes = await fetch(`/api/documents/${documentId}/url`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          
          const urlResult: ApiResponse<{ signedUrl: string }> = await urlRes.json();
          if (urlRes.ok && urlResult.success && urlResult.data) {
            // We set pdfUrl here in a separate state update
            setViewingContent(prev => ({ ...prev, pdfUrl: urlResult.data.signedUrl }));
          } else {
             // Log an error but don't fail the page, just fall back to text view
             console.warn("Failed to fetch PDF signed URL:", urlResult.error);
             toast({ title: "Could not load PDF view", description: "Falling back to text view.", variant: "destructive" });
          }
        }
        // --- END FIX ---

      } catch (error: any) {
        toast({ title: 'Error Loading Document', description: error.message, variant: 'destructive' });
        router.push('/documents'); // Go back if loading fails
      }
    };

    fetchData();
  }, [documentId, session, authLoading, user, router, toast]);

  if (authLoading || (!isLoadingContent && !viewingContent.title)) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          onClick={() => router.push('/documents')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Documents
        </Button>
        <h1 className="text-xl font-semibold truncate text-right" title={viewingContent.title}>
          {isLoadingContent ? "Loading..." : viewingContent.title}
        </h1>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden h-full">
        
        {/* Left Column: Document Viewer */}
        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Document
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {isLoadingContent ? (
              <div className="flex justify-center items-center h-full min-h-[60vh]">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : viewingContent.pdfUrl ? (
              <iframe
                src={viewingContent.pdfUrl}
                className="w-full h-full min-h-[65vh] border rounded-md"
                title={`PDF Viewer for ${viewingContent.title}`}
              />
            ) : (
              <ScrollArea className="h-full max-h-[65vh] pr-3 border rounded-md p-4">
                <pre className="text-sm whitespace-pre-wrap break-words">
                  {viewingContent.text || "No text extracted or file is empty."}
                </pre>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Chat Interface */}
        <Card className="flex flex-col h-full overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <Sparkles className="w-5 h-5 text-primary" />
               AI Tutor
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden h-full">
            <ChatInterface
              context={pageContext}
              initialMessages={chatHistory}
              isLoadingHistory={isHistoryLoading}
              className="h-full"
            />
          </CardContent>
        </Card>

      </div>
    </div>
  );
}