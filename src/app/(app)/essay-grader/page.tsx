// src/app/(app)/essay-grader/page.tsx
'use client';

import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
    Loader2, Sparkles, AlertCircle, 
    CheckCircle, Star, RefreshCw,
    Scale, PenSquare, Minimize2, Maximize2,
    BookOpen, Gavel
} from 'lucide-react';
import { 
    ApiResponse, 
    GradeEssayResponseData, 
    GradedEssayFeedback, 
    GradedEssay, 
    RubricSettings, 
    EssayFeedbackHighlight,
    EssayFeedbackCategory
} from '@/types/database';
import { usePageContext } from '@/contexts/PageContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpgradeModal } from '@/components/UpgradeModalContext';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// --- Types ---
type GradedEssayListItem = Pick<GradedEssay, 'id' | 'essay_title' | 'score' | 'graded_at'>;

interface AIUsageStatus {
    currentCount: number | undefined;
    limit: number | typeof Infinity;
    remaining: number | typeof Infinity;
    isPro: boolean;
}

const WORD_LIMIT = 3000;
const countWords = (text: string): number => {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
};

// --- Components ---

function ScoreGauge({ score }: { score: number | null }) {
  if (score === null) return null;
  
  // Calculate color
  let color = '#ef4444'; // red-500
  if (score >= 90) color = '#22c55e'; // green-500
  else if (score >= 80) color = '#3b82f6'; // blue-500
  else if (score >= 70) color = '#eab308'; // yellow-500

  // SVG Gauge Logic
  const radius = 70;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="relative flex items-center justify-center">
        <svg
          height={radius * 2}
          width={radius * 2}
          className="rotate-[-90deg] transition-all duration-1000 ease-out"
        >
           {/* Background Circle */}
          <circle
            stroke="#e5e7eb"
            strokeWidth={stroke}
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="dark:stroke-slate-800"
          />
          {/* Progress Circle */}
          <circle
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center text-center animate-in fade-in zoom-in duration-700">
            <span className="text-4xl font-bold" style={{ color }}>{score}</span>
            <span className="text-xs text-muted-foreground uppercase font-semibold">Score</span>
        </div>
      </div>
    </div>
  );
}

export default function EssayGraderPage() {
  const [essayText, setEssayText] = useState('');
  const [rubricText, setRubricText] = useState('');
  const [rubricSettings, setRubricSettings] = useState<RubricSettings>({
      academicLevel: 'Undergraduate',
      tone: 'Formal',
      strictness: 'Standard'
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [gradedEssay, setGradedEssay] = useState<GradeEssayResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputTab, setOutputTab] = useState<'feedback' | 'history'>('feedback');
  const [wordCount, setWordCount] = useState(0);
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null); // Text of the highlight currently focused
  const [isFocusMode, setIsFocusMode] = useState(false);

  const { session } = useAuth();
  const { toast } = useToast();
  const { setPageContext } = usePageContext();
  const { openModal } = useUpgradeModal();

  const { 
    data: aiUsage, 
    isLoading: isUsageLoading,
    mutate: mutateUsage
  } = useSWR<AIUsageStatus>(
    session ? '/api/usage/ai' : null,
    (url: string) => fetcher<AIUsageStatus>(url, { headers: { 'Authorization': `Bearer ${session!.access_token}` } }).then(res => {
        if (!res.data) throw new Error("Failed to load usage data");
        return res.data;
    }),
    { revalidateOnFocus: true }
  );

  const { 
    data: historyData, 
    isLoading: isHistoryLoading,
    mutate: mutateHistory
  } = useSWR<GradedEssayListItem[]>( 
    session ? '/api/graded-essays' : null,
    (url: string) => fetcher<GradedEssayListItem[]>(url, { headers: { 'Authorization': `Bearer ${session!.access_token}` } }).then(res => res.data || []), 
    { revalidateOnFocus: true }
  );

  const history: GradedEssayListItem[] = historyData || [];
  
  useEffect(() => {
    if (gradedEssay?.id) {
      setPageContext({ type: 'essay', id: gradedEssay.id });
    } else {
      setPageContext({ type: 'page', name: 'essay-grader' });
    }
    return () => setPageContext(null);
  }, [gradedEssay, setPageContext]);

   const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
     const newText = e.target.value;
     const newWordCount = countWords(newText);
     setEssayText(newText);
     setWordCount(newWordCount);
     
     // Reset results if user starts typing heavily
     if (gradedEssay && Math.abs(newWordCount - countWords(gradedEssay.essay_content)) > 20) {
        setGradedEssay(null); 
     }

     if (newWordCount > WORD_LIMIT) {
       setError(`Word limit exceeded: ${newWordCount} / ${WORD_LIMIT} words.`);
     } else {
       setError(null);
     }
   };
   
   const applyFix = (original: string, replacement: string) => {
       if (!essayText.includes(original)) {
           toast({ title: "Error", description: "Could not find original text to replace.", variant: "destructive" });
           return;
       }
       // Replace only the first occurrence to avoid destroying subsequent text if the phrase is repeated
       const newText = essayText.replace(original, replacement);
       setEssayText(newText);
       setWordCount(countWords(newText));
       toast({ title: "Fix Applied", description: "Essay updated successfully." });
   };

  const handleViewHistoryItem = async (essayId: string) => {
    if (!session) return;
    setIsLoading(true);
    setError(null);
    setGradedEssay(null);
    setOutputTab('feedback');
    
    try {
        const result = await fetcher<any>(
            `/api/graded-essays/${essayId}`, 
            { headers: { 'Authorization': `Bearer ${session.access_token}` } }
        );
        const resultData: GradedEssay = result.data || result;
        
        // Safe cast for feedback
        const feedbackData = resultData.feedback as unknown as GradedEssayFeedback;

        const responseData: GradeEssayResponseData = {
            id: resultData.id,
            feedback: feedbackData,
            score: resultData.score,
            suggestions: (resultData.feedback as any)?.suggestions || [],
            graded_at: resultData.graded_at,
            essay_content: resultData.essay_content,
        };

        setGradedEssay(responseData);
        setEssayText(resultData.essay_content);
        setRubricText(resultData.rubric_or_criteria || '');
        setWordCount(countWords(resultData.essay_content)); 
        
        toast({ title: "History Loaded", description: `Loaded "${resultData.essay_title || 'graded essay'}".` });

    } catch (err: any) {
        setError(err.message || 'Failed to fetch history.');
        toast({ title: "Error", description: err.message, variant: "destructive" });
        setOutputTab('history');
    } finally {
        setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (wordCount > WORD_LIMIT) {
        setError(`Word limit exceeded.`);
        return;
    }
    if (essayText.trim().length < 50) {
       setError('Essay text is too short (min 50 chars).');
       return;
    }
    if (!session) {
      toast({ title: "Login Required", description: "Please log in.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setGradedEssay(null);

    try {
      const response = await fetch('/api/grade-essay', { 
          method: 'POST', 
          headers: { 
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
          }, 
          body: JSON.stringify({ 
              essayText: essayText.trim(),
              rubricText: rubricText.trim(),
              rubricSettings
          }) 
      });

      const result: ApiResponse<GradeEssayResponseData> = await response.json();
      
      if (!response.ok || !result.success || !result.data) {
        if (result.error === 'limit_exceeded') {
          openModal();
          throw new Error('AI generation limit reached.');
        }
        throw new Error(result.error || `Grading failed.`);
      }
      
      setGradedEssay(result.data);
      setOutputTab('feedback');
      mutateHistory();
      mutateUsage();
      
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Grading Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  // --- Render Helpers ---

  // Highlight Text in Editor
  const HighlightedTextDisplay = () => {
      if (!gradedEssay) return <pre className="whitespace-pre-wrap font-serif text-lg leading-relaxed">{essayText}</pre>;

      const categories: ('clarity' | 'argument' | 'grammar' | 'strengths')[] = ['clarity', 'argument', 'grammar', 'strengths'];
      let parts: (string | React.ReactNode)[] = [essayText];

      const colors: Record<string, string> = {
          clarity: 'bg-blue-100 dark:bg-blue-900/40 border-b-2 border-blue-400',
          argument: 'bg-yellow-100 dark:bg-yellow-900/40 border-b-2 border-yellow-400',
          grammar: 'bg-red-100 dark:bg-red-900/40 border-b-2 border-red-400',
          strengths: 'bg-green-100 dark:bg-green-900/40 border-b-2 border-green-400',
      };

      categories.forEach(cat => {
          // Explicit cast to ensure TS knows we are accessing a valid key
          const catData = gradedEssay.feedback[cat as keyof GradedEssayFeedback];
          
          if (typeof catData === 'object' && catData && 'highlights' in catData && Array.isArray(catData.highlights)) {
              (catData as EssayFeedbackCategory).highlights.forEach((h: EssayFeedbackHighlight) => {
                  let newParts: (string | React.ReactNode)[] = [];
                  parts.forEach(part => {
                      if (typeof part !== 'string') { newParts.push(part); return; }
                      
                      const split = part.split(h.text);
                      if (split.length > 1) {
                          newParts.push(split[0]);
                          newParts.push(
                              <mark 
                                key={`${cat}-${h.text.substring(0,10)}`}
                                className={cn(
                                    "cursor-pointer rounded px-0.5 transition-colors", 
                                    colors[cat],
                                    activeHighlight === h.text ? "ring-2 ring-offset-1 ring-primary" : ""
                                )}
                                onClick={() => setActiveHighlight(h.text)}
                              >
                                  {h.text}
                              </mark>
                          );
                          newParts.push(split.slice(1).join(h.text)); 
                      } else {
                          newParts.push(part);
                      }
                  });
                  parts = newParts;
              });
          }
      });

      return <div className="font-serif text-lg leading-relaxed whitespace-pre-wrap">{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</div>;
  };

  // Feedback Cards Side Panel
  const FeedbackSidebar = () => {
      if (!gradedEssay) return null;
      const { feedback } = gradedEssay;
      const categories = [
        { id: 'strengths', label: 'Strengths', icon: <Star className="w-4 h-4 text-green-500" /> },
        { id: 'clarity', label: 'Clarity', icon: <CheckCircle className="w-4 h-4 text-blue-500" /> },
        { id: 'argument', label: 'Argument', icon: <Scale className="w-4 h-4 text-yellow-500" /> },
        { id: 'grammar', label: 'Grammar', icon: <PenSquare className="w-4 h-4 text-red-500" /> },
      ];

      return (
          <ScrollArea className="h-full pr-4">
              <div className="space-y-6 pb-10">
                  {/* Thesis Alert */}
                  {feedback.thesis && (
                      <Alert variant={feedback.thesis.detected ? "default" : "destructive"} className="border-l-4">
                          <BookOpen className="h-4 w-4" />
                          <AlertTitle>Thesis Statement {feedback.thesis.detected ? "Detected" : "Missing"}</AlertTitle>
                          <AlertDescription className="text-sm mt-2">
                             {feedback.thesis.detected ? (
                                 <div className="space-y-2">
                                     <div className="italic bg-muted/50 p-2 rounded text-xs border-l-2 border-primary">"{feedback.thesis.statement}"</div>
                                     <p>{feedback.thesis.critique}</p>
                                 </div>
                             ) : (
                                 "The AI could not clearly identify your thesis statement. Ensure your introduction ends with a strong, arguable claim."
                             )}
                          </AlertDescription>
                      </Alert>
                  )}

                  {/* Summary */}
                  <div className="bg-muted/30 p-4 rounded-lg border">
                      <h4 className="font-semibold mb-2">Editor's Summary</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{feedback.summary}</p>
                  </div>

                  {/* Categories */}
                  {categories.map(cat => {
                      const data = feedback[cat.id as keyof GradedEssayFeedback];
                      
                      // Type guard to ensure data is an object with highlights
                      if (!data || typeof data !== 'object' || !('highlights' in data) || !Array.isArray(data.highlights) || data.highlights.length === 0) return null;

                      const categoryData = data as EssayFeedbackCategory;

                      return (
                          <div key={cat.id} className="space-y-3">
                              <h3 className="font-semibold flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground border-b pb-1">
                                  {cat.icon} {cat.label}
                              </h3>
                              {categoryData.summary && <p className="text-xs italic text-muted-foreground mb-2">"{categoryData.summary}"</p>}
                              
                              {categoryData.highlights.map((h, idx) => (
                                  <Card 
                                    key={idx} 
                                    className={cn(
                                        "transition-all cursor-pointer border-l-4 hover:shadow-md",
                                        activeHighlight === h.text ? "ring-1 ring-primary border-l-primary" : "border-l-transparent",
                                        cat.id === 'grammar' ? "hover:border-l-red-400" : 
                                        cat.id === 'clarity' ? "hover:border-l-blue-400" :
                                        cat.id === 'strengths' ? "hover:border-l-green-400" : "hover:border-l-yellow-400"
                                    )}
                                    onClick={() => setActiveHighlight(h.text)}
                                  >
                                      <CardContent className="p-3 space-y-2">
                                          <div className="text-xs font-mono bg-muted/50 p-1.5 rounded truncate">
                                              "{h.text}"
                                          </div>
                                          <p className="text-sm">{h.comment}</p>
                                          
                                          {/* Apply Fix Button */}
                                          {h.replacement && (
                                              <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="w-full text-xs h-7 gap-1 mt-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:text-green-800 border-green-200 dark:border-green-800"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    applyFix(h.text, h.replacement!);
                                                }}
                                              >
                                                  <RefreshCw className="w-3 h-3" /> Fix: "{h.replacement}"
                                              </Button>
                                          )}
                                      </CardContent>
                                  </Card>
                              ))}
                          </div>
                      );
                  })}
              </div>
          </ScrollArea>
      );
  };

  const isOverLimit = !isUsageLoading && aiUsage && aiUsage.limit !== Infinity && (aiUsage.currentCount ?? 0) >= (aiUsage.limit ?? Infinity);

  return (
    <div className={cn("flex flex-col h-full overflow-hidden transition-all duration-300", isFocusMode ? "bg-background fixed inset-0 z-50 p-4" : "")}>
      {/* Header */}
      {!isFocusMode && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 shrink-0">
              <h1 className="text-3xl font-bold flex items-center gap-2">
                  <PenSquare className="w-8 h-8" /> Essay Grader
              </h1>
              <div className="flex items-center gap-4">
                   {/* Usage Badge */}
                  <div className="text-sm text-muted-foreground hidden md:block">
                    {aiUsage?.isPro ? (
                         <Badge variant="secondary" className="gap-1"><Sparkles className="w-3 h-3 text-primary" /> Pro Plan</Badge>
                    ) : (
                         <Badge variant="outline">Free: {aiUsage?.currentCount ?? 0}/{aiUsage?.limit ?? 5}</Badge>
                    )}
                  </div>
              </div>
          </div>
      )}

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-xl border overflow-hidden shadow-sm bg-card">
        
        {/* LEFT PANEL: Editor */}
        <ResizablePanel defaultSize={55} minSize={30} className="flex flex-col bg-background/50">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 border-b bg-muted/20">
                 <div className="flex items-center gap-2">
                     <Select 
                        value={rubricSettings.academicLevel} 
                        onValueChange={(v) => setRubricSettings(prev => ({...prev, academicLevel: v as RubricSettings['academicLevel']}))}
                        disabled={isLoading || !!gradedEssay}
                     >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="Level" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="High School">High School</SelectItem>
                            <SelectItem value="Undergraduate">Undergraduate</SelectItem>
                            <SelectItem value="Graduate">Graduate</SelectItem>
                        </SelectContent>
                     </Select>

                     <Select 
                        value={rubricSettings.tone} 
                        onValueChange={(v) => setRubricSettings(prev => ({...prev, tone: v as RubricSettings['tone']}))}
                        disabled={isLoading || !!gradedEssay}
                     >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                            <SelectValue placeholder="Tone" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Formal">Formal</SelectItem>
                            <SelectItem value="Creative">Creative</SelectItem>
                            <SelectItem value="Persuasive">Persuasive</SelectItem>
                        </SelectContent>
                     </Select>

                     <Select 
                        value={rubricSettings.strictness} 
                        onValueChange={(v) => setRubricSettings(prev => ({...prev, strictness: v as RubricSettings['strictness']}))}
                        disabled={isLoading || !!gradedEssay}
                     >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                            <SelectValue placeholder="Strictness" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Lenient">Lenient</SelectItem>
                            <SelectItem value="Standard">Standard</SelectItem>
                            <SelectItem value="Strict">Strict</SelectItem>
                        </SelectContent>
                     </Select>
                 </div>
                 <div className="flex items-center gap-1">
                     <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFocusMode(!isFocusMode)}>
                         {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                     </Button>
                 </div>
            </div>

            {/* Editor Area */}
            <ScrollArea className="flex-1 p-6 relative">
                 {gradedEssay ? (
                     <div className="max-w-3xl mx-auto">
                        <HighlightedTextDisplay />
                        <div className="h-20" /> {/* Bottom spacer */}
                     </div>
                 ) : (
                     <Textarea
                        placeholder="Start writing or paste your essay here..."
                        value={essayText}
                        onChange={handleTextChange}
                        className="min-h-full resize-none border-none focus-visible:ring-0 text-lg font-serif leading-relaxed p-0 bg-transparent shadow-none"
                        disabled={isLoading}
                     />
                 )}
            </ScrollArea>
            
            {/* Footer Status Bar */}
            <div className="p-2 border-t bg-muted/20 flex justify-between items-center text-xs text-muted-foreground px-4">
                <span>{wordCount} words</span>
                {gradedEssay && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setGradedEssay(null); setError(null); }}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Edit Essay
                    </Button>
                )}
            </div>
        </ResizablePanel>
        
        <ResizableHandle withHandle />

        {/* RIGHT PANEL: Results & History */}
        <ResizablePanel defaultSize={45} minSize={30} className="bg-muted/10">
            <div className="h-full flex flex-col">
                <Tabs value={outputTab} onValueChange={(v) => setOutputTab(v as 'feedback' | 'history')} className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-4 pt-3 pb-0">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="feedback">Feedback</TabsTrigger>
                            <TabsTrigger value="history">History</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="feedback" className="flex-1 flex flex-col p-4 overflow-hidden data-[state=inactive]:hidden">
                         {isLoading ? (
                             <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                                 <Loader2 className="w-10 h-10 animate-spin text-primary" />
                                 <p className="animate-pulse">Analyzing structure and logic...</p>
                             </div>
                         ) : gradedEssay ? (
                             <div className="flex flex-col h-full gap-4">
                                 {/* Score Card */}
                                 <Card className="shrink-0 border-none shadow-sm bg-gradient-to-br from-background to-muted/50">
                                     <CardContent className="pt-6 pb-2">
                                         <div className="flex items-center justify-between">
                                             <ScoreGauge score={gradedEssay.score} />
                                             <div className="space-y-2 text-right">
                                                 <div className="text-sm font-medium text-muted-foreground">Grade</div>
                                                 <div className="text-2xl font-bold">
                                                     {gradedEssay.score ? (gradedEssay.score >= 90 ? 'A' : gradedEssay.score >= 80 ? 'B' : gradedEssay.score >= 70 ? 'C' : 'F') : 'N/A'}
                                                 </div>
                                                 <Badge variant="outline">{rubricSettings.academicLevel}</Badge>
                                             </div>
                                         </div>
                                     </CardContent>
                                 </Card>
                                 
                                 {/* Dynamic Feedback Sidebar */}
                                 <div className="flex-1 overflow-hidden">
                                    <FeedbackSidebar />
                                 </div>
                             </div>
                         ) : (
                             <div className="flex flex-col items-center justify-center h-full text-center space-y-6 p-8">
                                 <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center">
                                     <Gavel className="w-10 h-10 text-muted-foreground" />
                                 </div>
                                 <div className="space-y-2">
                                     <h3 className="font-semibold text-lg">Ready to Grade</h3>
                                     <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                         Paste your essay on the left and select your criteria to get detailed AI feedback.
                                     </p>
                                 </div>
                                 <Button 
                                    size="lg" 
                                    onClick={handleSubmit} 
                                    disabled={!essayText.trim() || wordCount < 50 || isOverLimit}
                                    className="w-full max-w-xs shadow-lg"
                                 >
                                     <Sparkles className="w-4 h-4 mr-2" />
                                     {isOverLimit ? "Limit Reached" : "Get AI Feedback"}
                                 </Button>
                                 {error && (
                                     <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                                         <AlertCircle className="w-4 h-4" /> {error}
                                     </div>
                                 )}
                             </div>
                         )}
                    </TabsContent>

                    <TabsContent value="history" className="flex-1 overflow-hidden p-4 data-[state=inactive]:hidden">
                         <ScrollArea className="h-full">
                            {isHistoryLoading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                </div>
                            ) : history.length === 0 ? (
                                <p className="text-center text-muted-foreground py-10">No graded essays yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {history.map(item => (
                                        <Card 
                                            key={item.id} 
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => handleViewHistoryItem(item.id)}
                                        >
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <p className="font-medium truncate max-w-[150px] sm:max-w-[200px]">{item.essay_title || 'Untitled'}</p>
                                                    <p className="text-xs text-muted-foreground">{new Date(item.graded_at).toLocaleDateString()}</p>
                                                </div>
                                                <Badge variant={item.score && item.score >= 80 ? 'default' : 'secondary'}>
                                                    {item.score ?? 'N/A'}
                                                </Badge>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                         </ScrollArea>
                    </TabsContent>
                </Tabs>
            </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}