// src/app/(app)/essay-grader/page.tsx
'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Sparkles,
  FileSignature,
  Upload,
  FileText,
  AlertCircle,
  Info,
  History,
  Eye,
  CheckCircle,
  Star,
  RefreshCw,
  BrainCircuit, // <-- 1. IMPORT ICON
} from 'lucide-react';
import { ApiResponse, GradeEssayResponseData, GradedEssayFeedback, GradedEssay } from '@/types/database';
import { Input } from '@/components/ui/input';
import { formatFileSize } from '@/lib/file-parser';
import { usePageContext } from '@/contexts/PageContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpgradeModal } from '@/components/UpgradeModalContext';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

type GradedEssayListItem = Pick<GradedEssay, 'id' | 'essay_title' | 'score' | 'graded_at'>;

const rubricPresets = {
    general: { name: "General", rubric: "Evaluate based on standard academic criteria: Clarity (Is the point clear?), Argument (Is the logic sound?), and Grammar (Are there errors?)." },
    persuasive: { name: "Persuasive", rubric: "Evaluate this as a persuasive essay. Focus on: (1) The strength and clarity of the thesis statement, (2) The quality and relevance of supporting evidence, (3) The effectiveness of the counter-argument and rebuttal, and (4) The overall rhetorical impact." },
    admission: { name: "Admission", rubric: "Evaluate this as a college admission essay. Focus on: (1) A compelling personal narrative, (2) A strong and unique authorial voice, (3) Clarity of thought and structure, and (4) Flawless grammar and style." }
};

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

// (ScoreBadge component is unchanged)
function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="text-center mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-1">Estimated Score</h3>
        <p className="text-4xl font-bold">N/A</p>
      </div>
    );
  }
  let colorClass = 'text-gray-600 dark:text-gray-400';
  if (score >= 90) colorClass = 'text-green-600 dark:text-green-500';
  else if (score >= 80) colorClass = 'text-blue-600 dark:text-blue-500';
  else if (score >= 70) colorClass = 'text-yellow-600 dark:text-yellow-500';
  else colorClass = 'text-red-600 dark:text-red-500';

  return (
    <div className="text-center mb-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-1">Estimated Score</h3>
      <p className={cn("text-6xl font-bold", colorClass)}>
        {score}
        <span className="text-4xl text-muted-foreground">/100</span>
      </p>
    </div>
  );
}

export default function EssayGraderPage() {
  const [essayText, setEssayText] = useState('');
  const [rubricText, setRubricText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [isLoading, setIsLoading] = useState(false);
  const [gradedEssay, setGradedEssay] = useState<GradeEssayResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputTab, setOutputTab] = useState<'feedback' | 'history'>('feedback');
  const [wordCount, setWordCount] = useState(0);

  const { session } = useAuth();
  const { toast } = useToast();
  const { setPageContext } = usePageContext();
  const router = useRouter();
  const { openModal } = useUpgradeModal();

  // (useSWR hooks are unchanged)
  const { 
    data: aiUsage, 
    error: usageError, 
    isLoading: isUsageLoading,
    mutate: mutateUsage // Function to refetch usage
  } = useSWR<AIUsageStatus>(
    session ? '/api/usage/ai' : null,
    (url: string) => fetcher(url, { headers: { 'Authorization': `Bearer ${session!.access_token}` } }),
    { revalidateOnFocus: true } // Re-fetches when tab is focused
  );

  const { 
    data: history, 
    error: historyError, 
    isLoading: isHistoryLoading,
    mutate: mutateHistory // Function to refetch history
  } = useSWR<GradedEssayListItem[]>(
    session ? '/api/graded-essays' : null,
    (url: string) => fetcher(url, { headers: { 'Authorization': `Bearer ${session!.access_token}` } }),
    { revalidateOnFocus: true }
  );

  // --- 2. DEFINE ICON MAPPING ---
  const feedbackIcons = {
    strengths: <Star className="w-5 h-5 text-green-500" />,
    clarity: <Eye className="w-5 h-5 text-blue-500" />,
    argument: <BrainCircuit className="w-5 h-5 text-purple-500" />,
    grammar: <FileSignature className="w-5 h-5 text-red-500" />,
  };
  // --- END OF ADDITION ---

  useEffect(() => {
    if (gradedEssay?.id) {
      setPageContext({ type: 'essay', id: gradedEssay.id });
    } else {
      setPageContext({ type: 'page', name: 'essay-grader' });
    }
    return () => setPageContext(null);
  }, [gradedEssay, setPageContext]);

  // (handleFileChange, handleTextChange, handleViewHistoryItem, handleSubmit, renderHighlightedEssay are unchanged)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
       setError(null);
       const maxSize = 3 * 1024 * 1024;
       const isValidMime = ['application/pdf', 'text/plain'].includes(file.type);
       const isValidExt = ['.pdf', '.txt'].some(ext => file.name.toLowerCase().endsWith(ext));
       if (!isValidMime && !isValidExt) {
         setError("Invalid file type. PDF/TXT only.");
         setSelectedFile(null);
         if (e.target) e.target.value = '';
         return;
       }
       if (file.size > maxSize) {
         setError(`File exceeds 3MB (${formatFileSize(file.size)}).`);
         setSelectedFile(null);
         if (e.target) e.target.value = '';
         return;
       }
       setSelectedFile(file);
       setEssayText('');
       setWordCount(0); 
       setGradedEssay(null);
       setOutputTab('history');
     } else {
       setSelectedFile(null);
     }
   };
   const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
     const newText = e.target.value;
     const newWordCount = countWords(newText);
     
     setEssayText(newText);
     setWordCount(newWordCount);
     
     if(selectedFile) setSelectedFile(null); 
     setGradedEssay(null);
     setOutputTab('history');

     if (newWordCount > WORD_LIMIT) {
       setError(`Word limit exceeded: ${newWordCount} / ${WORD_LIMIT} words.`);
     } else if (error && error.startsWith('Word limit exceeded')) {
       setError(null);
     } else if (error && error.startsWith('Essay text is too short')) {
       setError(null);
     }
   };

  const handleViewHistoryItem = async (essayId: string) => {
    if (!session) return;
    setIsLoading(true);
    setError(null);
    setGradedEssay(null);
    setEssayText('');
    setSelectedFile(null);
    setOutputTab('feedback');
    
    try {
        // We use fetcher here for consistency with useSWR
        const resultData = await fetcher<GradedEssay>(
            `/api/graded-essays/${essayId}`, 
            { headers: { 'Authorization': `Bearer ${session.access_token}` } }
        );
        
        const responseData: GradeEssayResponseData = {
            id: resultData.id,
            feedback: resultData.feedback as GradedEssayFeedback,
            score: resultData.score,
            suggestions: (resultData.feedback as any)?.suggestions || [],
            graded_at: resultData.graded_at,
            essay_content: resultData.essay_content,
        };

        setGradedEssay(responseData);
        setEssayText(resultData.essay_content);
        setRubricText(resultData.rubric_or_criteria || '');
        setWordCount(countWords(resultData.essay_content)); 
        
        toast({ title: "History Loaded", description: `Displaying feedback for "${resultData.essay_title || 'graded essay'}".` });

    } catch (err: any) {
        setError(err.message || 'An unexpected error occurred while fetching history.');
        toast({ title: "Failed to Load History", description: err.message, variant: "destructive" });
        setOutputTab('history');
    } finally {
        setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (inputMode === 'text' && wordCount > WORD_LIMIT) {
        setError(`Word limit exceeded: ${wordCount} / ${WORD_LIMIT} words.`);
        return;
    }
    if ((inputMode === 'text' && !essayText.trim()) || (inputMode === 'file' && !selectedFile)) {
      setError('Please provide an essay by pasting text or uploading a file.');
      return;
    }
    if (essayText.trim().length > 0 && essayText.trim().length < 50) {
       setError('Pasted essay text is too short (minimum 50 characters required).');
       return;
    }
    if (!session) {
      toast({ title: "Authentication Error", description: "Please log in again.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setGradedEssay(null);

    try {
      let response: Response;
      const headers: HeadersInit = { 'Authorization': `Bearer ${session.access_token}` };
      let requestBody: BodyInit;
      if (inputMode === 'file' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (rubricText.trim()) formData.append('rubricText', rubricText.trim());
        requestBody = formData;
      } else {
        headers['Content-Type'] = 'application/json';
        const body: { essayText: string; rubricText?: string } = { essayText: essayText.trim() };
        if (rubricText.trim()) body.rubricText = rubricText.trim();
        requestBody = JSON.stringify(body);
      }
      response = await fetch('/api/grade-essay', { method: 'POST', headers: headers, body: requestBody });
      const result: ApiResponse<GradeEssayResponseData> = await response.json();
      if (!response.ok || !result.success || !result.data) {
        if (result.error === 'limit_exceeded') {
          openModal();
          throw new Error(result.message || 'AI generation limit reached.');
        }
         if (result.error?.includes("too short")) { throw new Error("The essay content is too short (minimum 50 characters required). Please provide more text."); }
         if (result.error?.includes("word limit exceeded")) {
             throw new Error(result.error);
         }
        throw new Error(result.error || `Grading failed. Status: ${response.status}`);
      }
      
      setGradedEssay(result.data);
      setOutputTab('feedback');
      toast({ title: "Feedback Generated", description: "Your essay feedback is ready." });
      
      mutateHistory();
      mutateUsage();
      
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred during grading.';
      if (!errorMessage.includes('limit reached')) {
        setError(errorMessage);
        toast({ title: "Grading Failed", description: errorMessage, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderHighlightedEssay = (text: string, feedback: GradedEssayFeedback) => {
    const categories: ('clarity' | 'argument' | 'grammar')[] = ['clarity', 'argument', 'grammar'];
    let parts: (string | React.ReactNode)[] = [text];
    const colors = {
        clarity: 'bg-blue-200 dark:bg-blue-900/50',
        argument: 'bg-yellow-200 dark:bg-yellow-900/50',
        grammar: 'bg-red-200 dark:bg-red-900/50',
    };
    categories.forEach(cat => {
        const categoryData = feedback[cat];
        if (typeof categoryData === 'object' && categoryData.highlights) {
            categoryData.highlights.forEach((highlight, index) => {
                let newParts: (string | React.ReactNode)[] = [];
                parts.forEach(part => {
                    if (typeof part !== 'string') {
                        newParts.push(part);
                        return;
                    }
                    const splitText = part.split(highlight.text);
                    if (splitText.length > 1) {
                        for (let i = 0; i < splitText.length - 1; i++) {
                            newParts.push(splitText[i]);
                            newParts.push(
                                <TooltipProvider key={`${cat}-${index}-${i}`} delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <mark className={cn("rounded px-0.5 py-0.5 cursor-pointer", colors[cat])}>
                                                {highlight.text}
                                            </mark>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            <p className="font-semibold capitalize">{cat}</p>
                                            <p>{highlight.comment}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            );
                        }
                        newParts.push(splitText[splitText.length - 1]);
                    } else {
                        newParts.push(part);
                    }
                });
                parts = newParts;
            });
        }
    });
    return <pre className="text-sm whitespace-pre-wrap break-words p-4">{parts.map((part, i) => <Fragment key={i}>{part}</Fragment>)}</pre>;
  };

  // --- 3. MODIFY renderFeedback ---
  const renderFeedback = (fb: GradedEssayFeedback | undefined | null) => {
    if (!fb) return null;
    const categories: ('strengths' |'clarity' | 'argument' | 'grammar')[] = ['strengths','clarity', 'argument', 'grammar'];
    
    return (
      <div className="space-y-4">
        {fb.summary && (
          <div className="mb-4">
            <h4 className="font-semibold text-base mb-1">Overall Summary</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{fb.summary}</p>
          </div>
        )}
        <Accordion type="multiple" defaultValue={['strengths', 'clarity', 'argument', 'grammar']} className="w-full">
          {categories.map((key) => {
            const data = fb[key];
            if (!data) return null;

            const icon = feedbackIcons[key]; // Get the icon

            if (typeof data === 'object' && data.summary) {
              return (
                <AccordionItem value={key} key={key}>
                  <AccordionTrigger className="text-base font-semibold capitalize">
                    {/* Add icon here */}
                    <span className="flex items-center gap-2">
                      {icon}
                      {key}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap italic">"{data.summary}"</p>
                    {data.highlights && data.highlights.length > 0 && (
                      <ul className="space-y-2">
                        {data.highlights.map((h, i) => (
                          <li key={i} className="text-xs border-l-2 pl-3 py-1 border-border/50">
                            <blockquote className="font-mono text-foreground p-2 bg-muted rounded">"{h.text}"</blockquote>
                            <p className="text-muted-foreground mt-1">&rarr; {h.comment}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            }
            if (typeof data === 'string') {
               return (
                 <AccordionItem value={key} key={key}>
                    <AccordionTrigger className="text-base font-semibold capitalize">
                       {/* Also add icon here */}
                      <span className="flex items-center gap-2">
                        {icon}
                        {key.replace(/_/g, ' ')}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data}</p>
                    </AccordionContent>
                 </AccordionItem>
               );
            }
            return null;
          })}
        </Accordion>
      </div>
    );
  };
  // --- END OF MODIFICATION ---
  
  const isOverLimit = !isUsageLoading && aiUsage && aiUsage.limit !== Infinity && (aiUsage.currentCount ?? 0) >= (aiUsage.limit ?? Infinity);
  const isOverTextLimit = inputMode === 'text' && (wordCount > WORD_LIMIT || !essayText.trim());

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <h1 className="text-3xl font-bold">Essay Grader</h1>
          <div className="text-sm text-muted-foreground">
              {isUsageLoading ? (
                  <span className="flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Checking AI usage...</span>
              ) : usageError ? (
                  <span className="text-destructive">Could not load AI usage.</span>
              ) : aiUsage ? (
                  aiUsage.isPro ? (
                      <span className="font-medium text-primary flex items-center gap-1"><Star className="w-4 h-4" /> Pro Plan: Unlimited AI Generations</span>
                  ) : (
                      <span>
                          AI Generations: <span className="font-medium text-foreground">{aiUsage.currentCount ?? '?'} / {aiUsage.limit}</span>
                      </span>
                  )
              ) : null}
          </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* (Input Column is unchanged) */}
        <div className="lg:col-span-1 space-y-6">
           <Card>
                <CardHeader>
                    <CardTitle>Your Essay</CardTitle>
                    <CardDescription>Paste text or upload a file (PDF/TXT, Max 3MB).</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-center mb-4 border border-input rounded-lg p-1 w-min mx-auto bg-background">
                        <Button variant={inputMode === "text" ? "secondary" : "ghost"} onClick={() => { setInputMode("text"); setSelectedFile(null); setError(null); setGradedEssay(null);}} className="w-28 h-8 text-xs sm:text-sm"><FileText className="w-4 h-4 mr-1 sm:mr-2" />Text</Button>
                        <Button variant={inputMode === "file" ? "secondary" : "ghost"} onClick={() => { setInputMode("file"); setEssayText(''); setWordCount(0); setError(null); setGradedEssay(null);}} className="w-28 h-8 text-xs sm:text-sm"><Upload className="w-4 h-4 mr-1 sm:mr-2" />File</Button>
                    </div>
                    {inputMode === 'text' && (
                        <div className="relative">
                            <Textarea
                                placeholder="Paste your essay here..."
                                value={essayText}
                                onChange={handleTextChange}
                                className={cn(
                                    "min-h-[250px] text-base border rounded-md",
                                    wordCount > WORD_LIMIT ? "border-destructive focus-visible:ring-destructive" : ""
                                )}
                                disabled={isLoading}
                            />
                            <p className={cn(
                                "text-xs text-right mt-1.5",
                                wordCount > WORD_LIMIT ? "text-destructive" : "text-muted-foreground"
                            )}>
                                {wordCount} / {WORD_LIMIT} words
                            </p>
                        </div>
                    )}
                    {inputMode === 'file' && (
                        <div className="space-y-2">
                             <Label htmlFor="file-upload" className="sr-only">Upload Essay File</Label>
                             <Input
                                id="file-upload"
                                type="file"
                                accept=".pdf,.txt,application/pdf,text/plain" 
                                onChange={handleFileChange}
                                disabled={isLoading}
                                className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer border rounded-md"
                              />
                              {selectedFile && <p className="text-xs text-muted-foreground truncate pt-1">Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})</p>}
                        </div>
                    )}
                </CardContent>
           </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Grading Criteria (Optional)</CardTitle>
                    <CardDescription>Provide specific instructions or a rubric for the AI.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        placeholder="e.g., Focus on the use of historical evidence. Grade based on clarity (40%), argument (40%), grammar (20%)..."
                        value={rubricText}
                        onChange={(e) => setRubricText(e.target.value)}
                        className="min-h-[100px] border rounded-md"
                        disabled={isLoading}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={() => setRubricText(rubricPresets.general.rubric)}>
                            {rubricPresets.general.name}
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={() => setRubricText(rubricPresets.persuasive.rubric)}>
                            {rubricPresets.persuasive.name}
                        </Button>
                         <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={() => setRubricText(rubricPresets.admission.rubric)}>
                            {rubricPresets.admission.name}
                        </Button>
                    </div>
                </CardContent>
            </Card>
             {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
              )}
             <Button
                size="lg"
                onClick={handleSubmit}
                disabled={
                    isLoading || 
                    isUsageLoading || // <-- Use SWR loading state
                    isOverLimit || 
                    (inputMode === 'text' && (isOverTextLimit || wordCount === 0)) || 
                    (inputMode === 'file' && !selectedFile)
                }
                className="w-full"
             >
                {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
                {isLoading ? 'Grading...' : isOverLimit ? 'AI Limit Reached' : 'Get Feedback'}
             </Button>
             {isOverLimit && (
                 <Button variant="link" className="text-xs text-destructive text-center w-full" onClick={openModal}>
                    You have used all your free AI generations. Upgrade to Pro?
                 </Button>
             )}
        </div>
        
        {/* (Output Column is unchanged) */}
        <div className="lg:col-span-1">
           <Card className="min-h-[400px] flex flex-col"> 
                <Tabs value={outputTab} onValueChange={(value) => setOutputTab(value as 'feedback' | 'history')} className="flex-1 flex flex-col">
                    <CardHeader>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="feedback">AI Feedback</TabsTrigger>
                            <TabsTrigger value="history">Grading History</TabsTrigger>
                        </TabsList>
                    </CardHeader>
                    
                    <TabsContent value="feedback" className="flex-1 flex flex-col mt-0">
                        <CardContent className="flex-1 flex flex-col">
                            {isLoading ? ( 
                                <div className="flex flex-col items-center justify-center pt-10 text-muted-foreground flex-1">
                                    <Loader2 className="w-8 h-8 animate-spin mb-4" />
                                    <p>Analyzing your essay...</p>
                                </div>
                            ) : gradedEssay ? ( 
                                <ScrollArea className="h-full max-h-[60vh] p-1 pr-3">
                                    <ScoreBadge score={gradedEssay.score} />
                                    {renderFeedback(gradedEssay.feedback)}
                                    {gradedEssay.suggestions && gradedEssay.suggestions.length > 0 && (
                                        <div className="mt-6 pt-4 border-t">
                                            <h4 className="font-semibold text-base mb-2">Suggestions for Improvement</h4>
                                            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                                {gradedEssay.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </ScrollArea>
                            ) : ( 
                                 <div className="flex flex-col items-center justify-center pt-10 text-muted-foreground flex-1 text-center">
                                    <FileSignature className="w-12 h-12 mb-4" />
                                    <p>Submit your essay to receive feedback.</p>
                                </div>
                            )}
                        </CardContent>
                    </TabsContent>
                    
                    <TabsContent value="history" className="flex-1 flex flex-col mt-0">
                        <CardContent className="flex-1 flex flex-col">
                             {isHistoryLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-12 w-full" />
                                    <Skeleton className="h-12 w-full" />
                                    <Skeleton className="h-12 w-full" />
                                </div>
                             ) : historyError ? (
                                <div className="flex flex-col items-center justify-center pt-10 text-destructive text-center">
                                    <AlertCircle className="w-12 h-12 mb-4" />
                                    <p>Failed to load history.</p>
                                </div>
                            ) : !history || history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center pt-10 text-muted-foreground text-center">
                                    <History className="w-12 h-12 mb-4" />
                                    <p>Your graded essays will appear here.</p>
                                </div>
                            ) : (
                                <ScrollArea className="h-full max-h-[60vh]">
                                    <Button variant="outline" size="sm" className="w-full mb-2" onClick={() => mutateHistory()} disabled={isHistoryLoading}>
                                        <RefreshCw className={cn("w-4 h-4 mr-2", isHistoryLoading && "animate-spin")} />
                                        Refresh History
                                    </Button>
                                    <div className="space-y-2">
                                        {history.map(item => (
                                            <div
                                                key={item.id}
                                                className={cn(
                                                    "w-full justify-between h-auto p-3 flex items-center border rounded-md hover:bg-muted/50",
                                                    isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                                )}
                                                onClick={() => !isLoading && handleViewHistoryItem(item.id)}
                                                tabIndex={0}
                                                onKeyDown={(e) => (e.key === 'Enter' && !isLoading) && handleViewHistoryItem(item.id)}
                                            >
                                                <div className="text-left">
                                                    <p className="font-medium text-sm truncate">{item.essay_title || 'Untitled Essay'}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(item.graded_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                {item.score !== null && (
                                                    <span className={cn(
                                                        "font-bold text-lg ml-2",
                                                        item.score >= 90 ? 'text-green-600' :
                                                        item.score >= 80 ? 'text-blue-600' :
                                                        item.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                                                    )}>
                                                        {item.score}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </TabsContent>
                </Tabs>
           </Card>
         </div>
      </div>
    </>
  );
}