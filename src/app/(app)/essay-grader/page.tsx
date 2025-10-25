'use client';

import { useState, useEffect } from 'react'; // Added useEffect
import Link from 'next/link'; // Added Link
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, FileSignature, Upload, FileText, AlertCircle, Info } from 'lucide-react'; // Added Info icon
import { ApiResponse, GradeEssayResponseData, GradedEssayFeedback } from '@/types/database';
import { Input } from '@/components/ui/input';
import { formatFileSize } from '@/lib/file-parser';

// Interface for the AI Usage API response data
interface AIUsageStatus {
    currentCount: number | undefined;
    limit: number | typeof Infinity;
    remaining: number | typeof Infinity;
    isPro: boolean;
}

export default function EssayGraderPage() {
  const [essayText, setEssayText] = useState('');
  const [rubricText, setRubricText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<GradeEssayResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- State for AI Usage ---
  const [aiUsage, setAiUsage] = useState<AIUsageStatus | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(true);

  const { session } = useAuth();
  const { toast } = useToast();

  // --- Fetch AI Usage on Load ---
  useEffect(() => {
    const fetchUsage = async () => {
      if (!session) {
          setIsUsageLoading(false); // Stop loading if no session
          return;
      };
      setIsUsageLoading(true);
      try {
        const response = await fetch('/api/usage/ai', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        const result: ApiResponse<AIUsageStatus> = await response.json();
        if (result.success && result.data) {
          setAiUsage(result.data);
        } else {
          console.error("Failed to fetch AI usage:", result.error);
          setAiUsage(null); // Set to null on fetch error
        }
      } catch (err) {
        console.error("Error fetching AI usage:", err);
        setAiUsage(null); // Set to null on exception
      } finally {
        setIsUsageLoading(false);
      }
    };

    fetchUsage();
  }, [session]); // Refetch when session changes

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
     } else {
       setSelectedFile(null);
     }
   };

  // --- UNCOMMENTED handleSubmit LOGIC ---
  const handleSubmit = async () => {
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
    setFeedback(null);
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
        if (result.error?.includes("limit exceeded")) { throw new Error("You have reached your AI generation limit for this month."); }
         if (result.error?.includes("too short")) { throw new Error("The essay content is too short (minimum 50 characters required). Please provide more text."); }
        throw new Error(result.error || `Grading failed. Status: ${response.status}`);
      }
      setFeedback(result.data);
      toast({ title: "Feedback Generated", description: "Your essay feedback is ready." });
      // --- Refresh usage count after successful grading ---
      if (aiUsage && aiUsage.currentCount !== undefined && aiUsage.limit !== Infinity) {
        setAiUsage(prev => {
             if (!prev) return null; // Should not happen but typescript check
             const newCount = (prev.currentCount ?? 0) + 1;
             const newRemaining = Math.max(0, prev.limit - newCount);
             return { ...prev, currentCount: newCount, remaining: newRemaining };
         });
      }
      // --- End Refresh ---
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during grading.');
      toast({ title: "Grading Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- UNCOMMENTED renderFeedback LOGIC ---
  const renderFeedback = (fb: GradedEssayFeedback | undefined | null) => {
    if (!fb) return null;
    const categories = ['clarity', 'argument', 'grammar', 'summary']; // Define desired order
    return (
      <>
        {categories.map((key) => (
          fb[key] && ( // Only render if feedback exists for this category
            <div key={key} className="mb-4">
              <h4 className="font-semibold capitalize text-base mb-1">{key.replace(/_/g, ' ')}</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{fb[key]}</p>
            </div>
          )
        ))}
        {/* Render any extra categories AI might provide */}
        {Object.entries(fb).filter(([key]) => !categories.includes(key)).map(([key, value]) => (
           value && (
             <div key={key} className="mb-4">
               <h4 className="font-semibold capitalize text-base mb-1">{key.replace(/_/g, ' ')}</h4>
               <p className="text-sm text-muted-foreground whitespace-pre-wrap">{value}</p>
             </div>
           )
        ))}
      </>
    );
  };

  // Determine if submit button should be disabled based on usage
  const isOverLimit = !isUsageLoading && aiUsage && aiUsage.limit !== Infinity && (aiUsage.currentCount ?? 0) >= aiUsage.limit;

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <h1 className="text-3xl font-bold">Essay Grader</h1>
          {/* Display AI Usage Info */}
          <div className="text-sm text-muted-foreground">
              {isUsageLoading ? (
                  <span className="flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Checking AI usage...</span>
              ) : aiUsage ? (
                  aiUsage.isPro ? (
                      <span>Pro Plan: Unlimited AI Generations</span>
                  ) : (
                      <span>
                          AI Generations this month: <span className="font-medium text-foreground">{aiUsage.currentCount ?? '?'} / {aiUsage.limit}</span> used.
                          (<span className="font-medium text-foreground">{aiUsage.remaining}</span> remaining)
                          {/* <Link href="/pricing" className="ml-2 text-primary font-medium hover:underline">Upgrade</Link> */}
                      </span>
                  )
              ) : (
                  <span className="text-destructive">Could not load AI usage.</span>
              )}
          </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Column */}
        <div className="space-y-6">
           <Card>
                <CardHeader>
                    <CardTitle>Your Essay</CardTitle>
                    <CardDescription>Paste your essay text or upload a file (PDF/TXT, Max 3MB).</CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Input Mode Toggle */}
                    <div className="flex justify-center mb-4 border border-input rounded-lg p-1 w-min mx-auto bg-background">
                        <Button variant={inputMode === "text" ? "secondary" : "ghost"} onClick={() => { setInputMode("text"); setSelectedFile(null); setError(null);}} className="w-28 h-8 text-xs sm:text-sm"><FileText className="w-4 h-4 mr-1 sm:mr-2" />Text</Button>
                        <Button variant={inputMode === "file" ? "secondary" : "ghost"} onClick={() => { setInputMode("file"); setEssayText(''); setError(null);}} className="w-28 h-8 text-xs sm:text-sm"><Upload className="w-4 h-4 mr-1 sm:mr-2" />File</Button>
                    </div>

                    {/* Text Input */}
                    {inputMode === 'text' && (
                        <Textarea
                            placeholder="Paste your essay here..."
                            value={essayText}
                            onChange={(e) => { setEssayText(e.target.value); if(selectedFile) setSelectedFile(null); setError(null); }}
                            className="min-h-[250px] text-base border rounded-md"
                            disabled={isLoading}
                        />
                    )}

                    {/* File Input */}
                    {inputMode === 'file' && (
                        <div className="space-y-2">
                             <Label htmlFor="file-upload" className="sr-only">Upload Essay File</Label>
                             <Input
                                id="file-upload"
                                type="file"
                                accept=".pdf,.txt,application/pdf,text/plain" // Be more explicit with accept
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
                disabled={isLoading || isUsageLoading || isOverLimit || (inputMode === 'text' && !essayText.trim()) || (inputMode === 'file' && !selectedFile)}
                className="w-full"
             >
                {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
                {isLoading ? 'Grading...' : isOverLimit ? 'AI Limit Reached' : 'Get Feedback'}
             </Button>
             {isOverLimit && (
                 <p className="text-xs text-destructive text-center mt-1">You have used all your free AI generations for this month.</p>
             )}
        </div>

        {/* Feedback Column */}
        <div className="space-y-6">
           <Card className="min-h-[400px]"> {/* Ensure feedback card has min height */}
                <CardHeader>
                    <CardTitle>AI Feedback</CardTitle>
                    <CardDescription>Results will appear here after grading.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && ( /* Show loading state */
                        <div className="flex flex-col items-center justify-center pt-10 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin mb-4" />
                            <p>Analyzing your essay...</p>
                        </div>
                    )}
                    {!isLoading && feedback && ( /* Show feedback */
                        <div>
                            {feedback.score !== null && (
                                <div className="mb-6 pb-4 border-b">
                                     <h3 className="text-sm font-medium text-muted-foreground mb-1">Estimated Score</h3>
                                     <p className="text-4xl font-bold">{feedback.score}<span className="text-2xl text-muted-foreground">/100</span></p>
                                </div>
                            )}
                            {renderFeedback(feedback.feedback)}

                            {feedback.suggestions && feedback.suggestions.length > 0 && (
                                <div className="mt-6 pt-4 border-t">
                                    <h4 className="font-semibold text-base mb-2">Suggestions for Improvement</h4>
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                        {feedback.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                            )}
                            {/* TODO: Add "Generate Study Material" Buttons here later */}
                        </div>
                    )}
                     {!isLoading && !feedback && !error && ( /* Initial empty state */
                         <div className="flex flex-col items-center justify-center pt-10 text-muted-foreground">
                            <FileSignature className="w-12 h-12 mb-4" />
                            <p>Submit your essay to receive feedback.</p>
                        </div>
                    )}
                    {/* Error state (only if not loading and no feedback exists) */}
                    {!isLoading && !feedback && error && (
                         <div className="flex flex-col items-center justify-center pt-10 text-destructive">
                            <AlertCircle className="w-12 h-12 mb-4" />
                            <p>Could not generate feedback.</p>
                            <p className="text-xs mt-2 text-center">({error})</p>
                        </div>
                    )}
                </CardContent>
           </Card>
        </div>
      </div>
    </>
  );
}