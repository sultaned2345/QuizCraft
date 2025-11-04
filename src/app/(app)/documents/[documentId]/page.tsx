// src/app/(app)/documents/[documentId]/page.tsx
// MODIFIED FILE

'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, FileText, StickyNote, FileQuestion, Layers, Sparkles, Brain, HelpCircle, Target, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatInterface } from '@/components/ChatInterface';
import { usePageContext, PageContextType } from '@/contexts/PageContext';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ApiResponse, Message, Question } from '@/types/database';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PopQuizModal } from '@/components/PopQuizModal'; // <-- 1. IMPORT NEW MODAL

interface ViewingContentState {
  title: string;
  text: string | null;
  pdfUrl: string | null;
}
interface AIDocumentInsights {
  keyConcepts: string[];
  examQuestions: string[];
  mainArguments: string[];
}

export default function DocumentViewPage() {
  const [viewingContent, setViewingContent] = useState<ViewingContentState>({ title: '', text: null, pdfUrl: null });
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [insights, setInsights] = useState<AIDocumentInsights | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(true);
  
  // --- 2. ADD NEW STATE ---
  const [isPopQuizOpen, setIsPopQuizOpen] = useState(false);
  const [popQuizQuestions, setPopQuizQuestions] = useState<Question[]>([]);
  const [isPopQuizLoading, setIsPopQuizLoading] = useState(false);
  // --- END NEW STATE ---

  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;
  const { toast } = useToast();

  const { setPageContext } = usePageContext();
  const pageContext = useMemo((): PageContextType => ({
    type: 'document',
    id: documentId,
  }), [documentId]);
  
  useEffect(() => {
    setPageContext(pageContext);
    return () => setPageContext(null);
  }, [setPageContext, pageContext]);

  useEffect(() => {
    if (!session || !documentId) {
        if (!authLoading && !user) router.push('/login');
        return;
    };

    const fetchData = async () => {
      setIsLoadingContent(true);
      setIsHistoryLoading(true);
      setIsLoadingInsights(true);

      try {
        const [contentRes, historyRes, insightsRes] = await Promise.all([
          fetch(`/api/documents/${documentId}/content`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          }),
          fetch(`/api/chat/history?context_id=${documentId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          }),
          fetch(`/api/documents/${documentId}/insights`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
        ]);

        // Process Content
        const contentResult: ApiResponse<{ extracted_text: string | null; file_name: string }> = await contentRes.json();
        if (!contentRes.ok || !contentResult.success || !contentResult.data) {
          throw new Error(contentResult.error || 'Failed to fetch document content.');
        }
        setViewingContent(prev => ({ ...prev, title: contentResult.data!.file_name, text: contentResult.data!.extracted_text, pdfUrl: null }));
        setIsLoadingContent(false);

        // Process History
        const historyResult: ApiResponse<Message[]> = await historyRes.json();
        if (historyResult.success && historyResult.data) {
          setChatHistory(historyResult.data);
        }
        setIsHistoryLoading(false);

        // Process Insights
        const insightsResult: ApiResponse<AIDocumentInsights | null> = await insightsRes.json();
        if (insightsResult.success && insightsResult.data) {
          setInsights(insightsResult.data);
        }
        setIsLoadingInsights(false);
        
        // PDF URL logic (if you have it)
        const isPdf = contentResult.data.file_name.toLowerCase().endsWith('.pdf');
        if (isPdf) {
          const urlRes = await fetch(`/api/documents/${documentId}/url`, {
             headers: { Authorization: `Bearer ${session.access_token}` }
          });
          const urlResult: ApiResponse<{ signedUrl: string }> = await urlRes.json();
          if (urlResult.success && urlResult.data) {
            setViewingContent(prev => ({ ...prev, pdfUrl: urlResult.data.signedUrl }));
          }
        }

      } catch (error: any) {
        toast({ title: 'Error Loading Document', description: error.message, variant: 'destructive' });
        router.push('/documents');
      }
    };

    fetchData();
  }, [documentId, session, authLoading, user, router, toast]);

  // --- 3. ADD POP QUIZ HANDLER ---
  const handleStartPopQuiz = async () => {
    if (!session || isPopQuizLoading) return;
    setIsPopQuizLoading(true);
    toast({ title: "Generating Pop Quiz...", description: "Please wait, the AI is creating questions." });
    try {
      const response = await fetch('/api/generate-pop-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ documentId: documentId })
      });
      
      const result: ApiResponse<{ questions: Question[] }> = await response.json();
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Failed to generate pop quiz.');
      }

      setPopQuizQuestions(result.data.questions);
      setIsPopQuizOpen(true);

    } catch (err: any) {
      toast({ title: "Pop Quiz Failed", description: err.message, variant: 'destructive' });
    } finally {
      setIsPopQuizLoading(false);
    }
  };
  // --- END HANDLER ---
  

  if (isLoadingContent || authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-100px)]">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => router.push('/documents')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Documents
          </Button>
          <h1 className="text-xl font-semibold truncate text-center" title={viewingContent.title}>
            {viewingContent.title}
          </h1>
          <div className="w-32"></div> 
        </div>

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
                    </div>
                  ) : (
                    <div className="space-y-6 p-1">
                      {/* --- 4. ADD BUTTON to Exam Questions section --- */}
                      <InsightSection icon={<HelpCircle className="w-4 h-4 text-blue-500" />} title="Potential Exam Questions">
                        {insights.examQuestions.length > 0 ? (
                           <>
                              <ul className="list-disc pl-0 space-y-1 text-sm text-muted-foreground">
                                {insights.examQuestions.map((q, i) => (
                                  <li key={i}>{q}</li>
                                ))}
                              </ul>
                              <Button 
                                size="sm" 
                                className="mt-4" 
                                onClick={handleStartPopQuiz}
                                disabled={isPopQuizLoading}
                              >
                                {isPopQuizLoading ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Zap className="w-4 h-4 mr-2" />
                                )}
                                Start Pop Quiz
                              </Button>
                           </>
                        ) : (
                           <p className="text-sm text-muted-foreground italic">No specific exam questions were generated.</p>
                        )}
                      </InsightSection>
                      
                      <InsightSection icon={<Target className="w-4 h-4 text-primary" />} title="Main Arguments">
                        {insights.mainArguments.length > 0 ? (
                           <ul className="list-disc pl-0 space-y-1 text-sm text-muted-foreground">
                            {insights.mainArguments.map((arg, i) => (
                              <li key={i}>{arg}</li>
                            ))}
                          </ul>
                        ) : <p className="text-sm text-muted-foreground italic">No main arguments extracted.</p>}
                      </InsightSection>
                      
                      <InsightSection icon={<Sparkles className="w-4 h-4 text-yellow-500" />} title="Key Concepts">
                         {insights.keyConcepts.length > 0 ? (
                            <ul className="list-disc pl-0 space-y-1 text-sm text-muted-foreground">
                              {insights.keyConcepts.map((concept, i) => (
                                <li key={i}>{concept}</li>
                              ))}
                            </ul>
                         ) : <p className="text-sm text-muted-foreground italic">No key concepts extracted.</p>}
                      </InsightSection>
                    </div>
                  )}
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Right Column: Chat Interface (unchanged) */}
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
      
      {/* --- 5. RENDER THE MODAL --- */}
      <PopQuizModal
        isOpen={isPopQuizOpen}
        onOpenChange={setIsPopQuizOpen}
        questions={popQuizQuestions}
      />
    </>
  );
}

// Helper component
const InsightSection = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
  <div className="space-y-2">
    <h3 className="flex items-center gap-2 font-semibold">
      {icon}
      <span>{title}</span>
    </h3>
    <div className="pl-6">
      {children}
    </div>
  </div>
);