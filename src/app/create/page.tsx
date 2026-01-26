// src/app/create/page.tsx
'use client';

import type React from 'react';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Upload,
  FileText,
  Loader2,
  Settings,
  AlertCircle,
  Sparkles,
  LogOut,
  ArrowLeft,
  Youtube,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  formatFileSize,
  extractTextFromFile,
} from '@/lib/file-parser';
import { QuestionType, ApiResponse } from '@/types/database';
import { useUpgradeModal } from '@/components/UpgradeModalContext';

interface QuizSettings {
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: QuestionType | 'MIXED';
  immediateFeedback: boolean;
}

const DashboardHeader = () => {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="py-4 px-6 md:px-12 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <Link href="/quizzes" className="flex items-center gap-2">
        <Sparkles className="w-6 h-6 text-primary" />
        <span className="text-xl font-bold">QuizCraft</span>
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {user?.email}
        </span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </header>
  );
};

function CreatePageContent() {
  const [textContent, setTextContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [topicInput, setTopicInput] = useState(''); // New state for Topic
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDoc, setIsFetchingDoc] = useState(false);
  const [error, setError] = useState('');
  
  // New State: Input Mode to toggle visible sections
  const [inputMode, setInputMode] = useState<'text' | 'file' | 'youtube' | 'topic'>('text'); 

  const [quizSettings, setQuizSettings] = useState<QuizSettings>({
    questionCount: 10,
    difficulty: 'medium',
    questionType: 'MIXED',
    immediateFeedback: true,
  });

  const { user, session, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { openModal } = useUpgradeModal();

  // Handle Auth
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // Handle URL Params (Docs & AI Remediation)
  useEffect(() => {
    // 1. Check for AI Remediation Mode
    const mode = searchParams.get('mode');
    const source = searchParams.get('source');
    const topic = searchParams.get('topic');
    
    if (mode === 'ai' && source === 'weakness' && topic) {
      setInputMode('topic');
      setTopicInput(decodeURIComponent(topic));
      setQuizSettings(prev => ({ ...prev, difficulty: 'hard', questionCount: 5 })); // Harder questions for remediation
      toast({ 
        title: "Weakness Slayer Activated", 
        description: `Generating a targeted quiz for: ${decodeURIComponent(topic)}` 
      });
      return; 
    }

    // 2. Check for Document ID
    const docId = searchParams.get('docId');
    if (docId && session && !textContent && !selectedFile) {
      setInputMode('text'); // Default to text view for docs
      const fetchDocumentContent = async () => {
        setIsFetchingDoc(true);
        setError('');
        try {
          const response = await fetch(`/api/documents/${docId}/content`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const result: ApiResponse<{ extracted_text: string | null; file_name: string }> = await response.json();
          if (!result.success || !result.data?.extracted_text) {
            throw new Error(result.error || 'Failed to fetch document content.');
          }
          setTextContent(result.data.extracted_text);
          toast({ title: 'Document Loaded', description: `Content from "${result.data.file_name}" loaded.` });
        } catch (err: any) {
          setError(`Error loading document: ${err.message}`);
          toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
          setIsFetchingDoc(false);
        }
      };
      fetchDocumentContent();
    }
  }, [searchParams, session, toast]); // Removed other dependencies to prevent loops

  // Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 3 * 1024 * 1024; // 3MB
      const isValidType = ['.pdf', '.txt', '.docx', '.pptx'].some((ext) => file.name.toLowerCase().endsWith(ext));

      if (!isValidType) {
        setError('Unsupported file. Please upload PDF, TXT, DOCX, or PPTX.');
        return;
      }
      if (file.size > maxSize) {
        setError(`File size exceeds 3MB. Max size is ${formatFileSize(maxSize)}.`);
        return;
      }

      setSelectedFile(file);
      setTextContent(''); setYoutubeUrl(''); setTopicInput(''); setInputMode('file');
      setError('');
    }
  };

  const handleModeSwitch = (mode: 'text' | 'file' | 'youtube' | 'topic') => {
    setInputMode(mode);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !session) { setError('Auth session missing.'); return; }

    // Validation based on mode
    if (inputMode === 'text' && !textContent.trim()) { setError('Please enter some text.'); return; }
    if (inputMode === 'file' && !selectedFile) { setError('Please upload a file.'); return; }
    if (inputMode === 'youtube' && !youtubeUrl.trim()) { setError('Please enter a YouTube URL.'); return; }
    if (inputMode === 'topic' && !topicInput.trim()) { setError('Please enter a topic.'); return; }

    setIsLoading(true);
    setError('');

    try {
      let response;

      // A. YouTube Flow
      if (inputMode === 'youtube') {
        toast({ title: 'Processing Video', description: 'Fetching transcript...' });
        response = await fetch('/api/generate-from-youtube', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ videoUrl: youtubeUrl }),
        });
      } 
      // B. Topic Flow (AI Generator)
      else if (inputMode === 'topic') {
         toast({ title: 'Brainstorming', description: 'AI is generating questions...' });
         // We might need a specific endpoint for pure topic generation or reuse generate-quiz with a flag
         // For now, let's assume generate-quiz can handle a "topic" string if we pass a flag or formatted text
         const queryParams = new URLSearchParams({
            numQuestions: quizSettings.questionCount.toString(),
            difficulty: quizSettings.difficulty,
            questionType: quizSettings.questionType,
            immediateFeedback: String(quizSettings.immediateFeedback),
            mode: 'topic' // Tell backend this is a raw topic, not content
         });

         response = await fetch(`/api/generate-quiz?${queryParams}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'text/plain' },
            body: `TOPIC: ${topicInput}`, // Simple convention for now
         });
      }
      // C. Text/File Flow
      else {
        let finalTextContent = textContent.trim();
        if (inputMode === 'file' && selectedFile) {
          toast({ title: 'Processing File', description: 'Extracting text...' });
          finalTextContent = await extractTextFromFile(selectedFile, session.access_token);
        }

        if (finalTextContent.length < 100) throw new Error('Content too short (min 100 chars).');

        const queryParams = new URLSearchParams({
          numQuestions: quizSettings.questionCount.toString(),
          difficulty: quizSettings.difficulty,
          questionType: quizSettings.questionType,
          immediateFeedback: String(quizSettings.immediateFeedback),
        });

        toast({ title: 'Generating Quiz', description: 'Analyzing content...' });
        response = await fetch(`/api/generate-quiz?${queryParams}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'text/plain' },
          body: finalTextContent,
        });
      }

      if (!response.ok) {
        let errorBody: any;
        try { errorBody = await response.json(); } catch { errorBody = { error: response.statusText }; }
        if (errorBody?.error === 'limit_exceeded') { openModal(); throw new Error(errorBody.message || 'AI limit reached.'); }
        throw new Error(errorBody?.message || errorBody?.error || 'Generation failed.');
      }

      const result = await response.json();
      if (!result.success || !result.data?.id) {
         const quizId = result.id || result.data?.id;
         if (!quizId) throw new Error('API returned success but no Quiz ID.');
      }

      toast({ title: 'Success!', description: 'Quiz created successfully.' });
      window.location.href = '/quizzes';

    } catch (err: any) {
      console.error('Generation Error:', err);
      if (!err.message.includes('limit reached')) {
        setError(err.message);
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = <K extends keyof QuizSettings>(key: K, value: QuizSettings[K]) => {
    setQuizSettings((prev) => ({ ...prev, [key]: value }));
  };
  
  const isProcessing = isLoading || isFetchingDoc;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 md:py-12">
        <Button variant="ghost" className="mb-6" onClick={() => router.back()} disabled={isProcessing}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <Card className="max-w-3xl mx-auto border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
               {inputMode === 'topic' ? <Zap className="w-6 h-6 text-yellow-500 fill-current" /> : <Sparkles className="w-6 h-6 text-primary" />}
               {inputMode === 'topic' ? 'Weakness Slayer' : 'Create a New Quiz'}
            </CardTitle>
            <CardDescription>
              {inputMode === 'topic' 
                ? 'AI will generate targeted questions to help you master this specific topic.' 
                : 'Generate a quiz from any content source.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Mode Selection Tabs */}
              <div className="grid grid-cols-4 gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg mb-6">
                 {['text', 'file', 'youtube', 'topic'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleModeSwitch(m as any)}
                      className={`
                        py-2 text-sm font-medium rounded-md capitalize transition-all
                        ${inputMode === m 
                           ? 'bg-white dark:bg-slate-700 shadow-sm text-primary font-bold' 
                           : 'text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}
                      `}
                    >
                      {m}
                    </button>
                 ))}
              </div>

              {/* INPUT: Text */}
              {inputMode === 'text' && (
                <div className="space-y-2 relative animate-in fade-in zoom-in-95 duration-300">
                  <Label htmlFor="content">Paste Study Material</Label>
                  <Textarea
                    id="content"
                    placeholder="Paste article, notes, or essay here..."
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="min-h-48 text-base font-mono"
                    disabled={isProcessing}
                  />
                  {isFetchingDoc && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded-md backdrop-blur-sm">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              )}

              {/* INPUT: File */}
              {inputMode === 'file' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <Label htmlFor="file-upload">Upload Document</Label>
                  <div className={`relative border-2 border-dashed ${error && !selectedFile ? 'border-destructive' : 'border-slate-300 dark:border-slate-700'} rounded-xl p-10 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group`}>
                    <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                       <FileText className="h-8 w-8 text-slate-400 group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {selectedFile ? selectedFile.name : 'Click to Upload PDF, DOCX, PPTX'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Max 3MB</p>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.txt,.docx,.pptx"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={isProcessing}
                      onClick={(e) => (e.currentTarget.value = '')}
                    />
                  </div>
                </div>
              )}

              {/* INPUT: YouTube */}
              {inputMode === 'youtube' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                   <Label htmlFor="youtube-url">YouTube Video URL</Label>
                   <div className="relative">
                      <div className="absolute left-3 top-3 flex items-center justify-center">
                         <Youtube className="h-5 w-5 text-red-600" />
                      </div>
                      <Input 
                          id="youtube-url"
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={youtubeUrl}
                          onChange={(e) => setYoutubeUrl(e.target.value)}
                          className="pl-10 h-11 text-base"
                          disabled={isProcessing}
                      />
                   </div>
                   <p className="text-xs text-muted-foreground">
                      Works best with videos that have closed captions (CC).
                   </p>
                </div>
              )}

              {/* INPUT: Topic (AI) */}
              {inputMode === 'topic' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                   <Label htmlFor="topic-input">Target Topic</Label>
                   <div className="relative">
                      <div className="absolute left-3 top-3">
                         <Zap className="h-5 w-5 text-yellow-500" />
                      </div>
                      <Input 
                          id="topic-input"
                          placeholder="e.g. 'Photosynthesis', 'The French Revolution', 'Linear Algebra'"
                          value={topicInput}
                          onChange={(e) => setTopicInput(e.target.value)}
                          className="pl-10 h-11 text-base border-yellow-500/50 focus-visible:ring-yellow-500/50 bg-yellow-50/10"
                          disabled={isProcessing}
                      />
                   </div>
                   <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                      <p className="font-bold mb-1">💡 Pro Tip:</p>
                      Be specific! Instead of "Biology", try "Cellular Respiration stages".
                   </div>
                </div>
              )}

              {/* Settings */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" className="w-full mt-2" disabled={isProcessing}>
                    <Settings className="w-4 h-4 mr-2" />
                    Advanced Settings
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4 p-4 border rounded-md bg-slate-50 dark:bg-slate-800/50 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Questions</Label>
                      <Select value={String(quizSettings.questionCount)} onValueChange={(v) => updateSetting('questionCount', Number(v))} disabled={isProcessing}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 Questions</SelectItem>
                          <SelectItem value="10">10 Questions</SelectItem>
                          <SelectItem value="15">15 Questions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Difficulty</Label>
                      <Select value={quizSettings.difficulty} onValueChange={(v: any) => updateSetting('difficulty', v)} disabled={isProcessing}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Question Type</Label>
                    <Select value={quizSettings.questionType} onValueChange={(v: any) => updateSetting('questionType', v)} disabled={isProcessing}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MIXED">Mixed Types</SelectItem>
                        <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
                        <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                        <SelectItem value="FILL_IN_THE_BLANK">Fill in the Blank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <Label htmlFor="immediate-feedback" className="cursor-pointer">Immediate Feedback</Label>
                    <Switch id="immediate-feedback" checked={quizSettings.immediateFeedback} onCheckedChange={(c) => updateSetting('immediateFeedback', c)} disabled={isProcessing} />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Error Display */}
              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive animate-in fade-in">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <div>{error}</div>
                </div>
              )}

              {/* Submit Button */}
              <Button type="submit" size="lg" className="w-full text-base font-bold shadow-lg hover:shadow-primary/25 transition-all h-12" disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" /> 
                    {inputMode === 'topic' ? 'Generate Topic Quiz' : 'Generate Quiz'}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <CreatePageContent />
    </Suspense>
  );
}