// src/app/(app)/documents/[documentId]/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
// ... other imports
import { Loader2, ArrowLeft, FileText, StickyNote, FileQuestion, Layers, Sparkles, Brain, HelpCircle, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
// ...
import { ChatInterface } from '@/components/ChatInterface';
import { usePageContext } from '@/contexts/PageContext';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// --- 1. ADD TABS AND SKELETON ---
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';

// ... (Message interface remains the same) ...

interface ViewingContentState {
  title: string;
  text: string | null;
  pdfUrl: string | null;
}

// --- 2. ADD INSIGHTS TYPE ---
interface AIDocumentInsights {
  keyConcepts: string[];
  examQuestions: string[];
  mainArguments: string[];
}

// --- 3. ADD INSIGHTS STATE ---
export default function DocumentViewPage() {
  // ... (all existing state remains the same) ...
  const [viewingContent, setViewingContent] = useState<ViewingContentState>({ title: '', text: null, pdfUrl: null });
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  
  // --- ADDED STATE ---
  const [insights, setInsights] = useState<AIDocumentInsights | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(true);
  // --- END ADDED STATE ---

  const { setPageContext } = usePageContext();
  const pageContext = useMemo((): PageContextType => ({
    type: 'document',
    id: documentId,
  }), [documentId]);
  
  // ... (setPageContext useEffect remains the same) ...

  // --- 4. MODIFY fetchData useEffect ---
  useEffect(() => {
    if (!session || !documentId) {
        if (!authLoading && !user) router.push('/login');
        return;
    };

    const fetchData = async () => {
      setIsLoadingContent(true);
      setIsHistoryLoading(true);
      setIsLoadingInsights(true); // <-- Set insights loading

      try {
        // --- Fetch content, history, AND insights ---
        const [contentRes, historyRes, insightsRes] = await Promise.all([
          fetch(`/api/documents/${documentId}/content`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          }),
          fetch(`/api/chat/history?context_id=${documentId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          }),
          // --- ADDED INSIGHTS FETCH ---
          fetch(`/api/documents/${documentId}/insights`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
        ]);

        // ... (Process Content logic remains the same) ...
        const contentResult: ApiResponse<{ extracted_text: string | null; file_name: string }> = await contentRes.json();
        if (!contentRes.ok || !contentResult.success || !contentResult.data) {
          throw new Error(contentResult.error || 'Failed to fetch document content.');
        }
        const docText = contentResult.data.extracted_text;
        const docFileName = contentResult.data.file_name;
        setViewingContent(prev => ({ ...prev, title: docFileName, text: docText, pdfUrl: null }));
        setIsLoadingContent(false);

        // ... (Process History logic remains the same) ...
        const historyResult: ApiResponse<Message[]> = await historyRes.json();
        if (historyResult.success && historyResult.data) {
          setChatHistory(historyResult.data);
        }
        setIsHistoryLoading(false);

        // --- ADDED INSIGHTS PROCESSING ---
        const insightsResult: ApiResponse<AIDocumentInsights | null> = await insightsRes.json();
        if (insightsResult.success && insightsResult.data) {
          setInsights(insightsResult.data);
        }
        setIsLoadingInsights(false);
        // --- END INSIGHTS PROCESSING ---

        // ... (PDF URL logic remains the same) ...
        const isPdf = docFileName.toLowerCase().endsWith('.pdf');
        if (isPdf) {
          // ... fetch signed url ...
          // ... setViewingContent(prev => ({ ...prev, pdfUrl: urlResult.data.signedUrl }));
        }

      } catch (error: any) {
        toast({ title: 'Error Loading Document', description: error.message, variant: 'destructive' });
        router.push('/documents');
      }
    };

    fetchData();
  }, [documentId, session, authLoading, user, router, toast]);

  // ... (loading state render remains the same) ...

  // --- 5. MODIFY JSX TO INCLUDE TABS ---
  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* ... (Page Header remains the same) ... */}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden h-full">
        
        {/* Left Column: Document Viewer + Insights */}
        <Card className="flex flex-col h-full overflow-hidden">
          <Tabs defaultValue="document" className="flex-1 flex flex-col h-full overflow-hidden">
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="document">
                  <FileText className="w-4 h-4 mr-2" />
                  Document
                </TabsTrigger>
                <TabsTrigger value="insights">
                  <Brain className="w-4 h-4 mr-2" />
                  AI Insights
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="document" className="flex-1 overflow-auto mt-0">
              <CardContent className="h-full">
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
            </TabsContent>

            <TabsContent value="insights" className="flex-1 overflow-auto mt-0">
              <CardContent>
                {isLoadingInsights ? (
                  <div className="space-y-4 p-4">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-6 w-1/3 mt-4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : !insights ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-muted-foreground text-center">
                    <Brain className="w-12 h-12 mb-4" />
                    <p className="font-medium">No AI Insights Generated</p>
                    <p className="text-sm">This document may be too short or was uploaded before this feature was available.</p>
                  </div>
                ) : (
                  <div className="space-y-6 p-1">
                    <InsightSection icon={<Target className="w-4 h-4 text-primary" />} title="Main Arguments">
                      {insights.mainArguments.map((arg, i) => (
                        <li key={i}>{arg}</li>
                      ))}
                    </InsightSection>
                    <InsightSection icon={<HelpCircle className="w-4 h-4 text-blue-500" />} title="Potential Exam Questions">
                      {insights.examQuestions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </InsightSection>
                    <InsightSection icon={<Sparkles className="w-4 h-4 text-yellow-500" />} title="Key Concepts">
                      {insights.keyConcepts.map((concept, i) => (
                        <li key={i}>{concept}</li>
                      ))}
                    </InsightSection>
                  </div>
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Right Column: Chat Interface (remains the same) */}
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

// --- 6. ADD A HELPER COMPONENT for insights ---
const InsightSection = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
  <div className="space-y-2">
    <h3 className="flex items-center gap-2 font-semibold">
      {icon}
      <span>{title}</span>
    </h3>
    <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
      {children}
    </ul>
  </div>
);