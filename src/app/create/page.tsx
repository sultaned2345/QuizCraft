// src/app/create/page.tsx
'use client';

import type React from 'react';
import { useState, useEffect, Suspense } from 'react'; // CHANGED: Added Suspense
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

// CHANGED: Moved main logic to a sub-component
function CreatePageContent() {
  const [textContent, setTextContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDoc, setIsFetchingDoc] = useState(false);
  const [error, setError] = useState('');
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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const docId = searchParams.get('docId');
    if (docId && session && !textContent && !selectedFile) {
      const fetchDocumentContent = async () => {
        setIsFetchingDoc(true);
        setError('');
        try {
          const response = await fetch(`/api/documents/${docId}/content`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const result: ApiResponse<{
            extracted_text: string | null;
            file_name: string;
          }> = await response.json();
          if (!result.success || !result.data?.extracted_text) {
            throw new Error(result.error || 'Failed to fetch document content.');
          }
          setTextContent(result.data.extracted_text);
          toast({
            title: 'Document Loaded',
            description: `Content from "${result.data.file_name}" loaded.`,
          });
        } catch (err: any) {
          setError(`Error loading document: ${err.message}`);
          toast({
            title: 'Error Loading Document',
            description: err.message,
            variant: 'destructive',
          });
        } finally {
          setIsFetchingDoc(false);
        }
      };
      fetchDocumentContent();
    }
  }, [searchParams, session, toast, textContent, selectedFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 3 * 1024 * 1024; // 3MB
      const isValidType = ['.pdf', '.txt', '.docx', '.pptx'].some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );

      if (!isValidType) {
        setError('Unsupported file. Please upload PDF, TXT, DOCX, or PPTX.');
        setSelectedFile(null);
        if (e.target) e.target.value = '';
        return;
      }

      if (file.size > maxSize) {
        setError(`File size exceeds 3MB. Max size is ${formatFileSize(maxSize)}.`);
        setSelectedFile(null);
        if (e.target) e.target.value = '';
        return;
      }

      setTextContent('');
      setYoutubeUrl('');
      setSelectedFile(file);
      setError('');
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextContent(e.target.value);
    if (selectedFile) setSelectedFile(null);
    if (youtubeUrl) setYoutubeUrl('');
    setError('');
  };

  const handleYoutubeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setYoutubeUrl(e.target.value);
    if (selectedFile) setSelectedFile(null);
    if (textContent) setTextContent('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !session) {
      setError('Auth session missing.');
      return;
    }

    if (!textContent.trim() && !selectedFile && !youtubeUrl.trim()) {
      setError('Provide text, upload a file, or enter a YouTube URL.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      let response;

      if (youtubeUrl.trim()) {
        toast({ title: 'Processing Video', description: 'Fetching transcript/audio...' });
        
        response = await fetch('/api/generate-from-youtube', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ videoUrl: youtubeUrl }),
        });

      } else {
        let finalTextContent = textContent.trim();
        
        if (selectedFile) {
          toast({ title: 'Processing File', description: 'Extracting text...' });
          finalTextContent = await extractTextFromFile(
            selectedFile,
            session.access_token
          );
        }

        if (finalTextContent.length < 100) {
           throw new Error('Content too short (min 100 chars).');
        }

        const queryParams = new URLSearchParams({
          numQuestions: quizSettings.questionCount.toString(),
          difficulty: quizSettings.difficulty,
          questionType: quizSettings.questionType,
          immediateFeedback: String(quizSettings.immediateFeedback),
        });

        toast({ title: 'Generating Quiz', description: 'AI is working its magic...' });
        
        response = await fetch(`/api/generate-quiz?${queryParams}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'text/plain',
          },
          body: finalTextContent,
        });
      }

      if (!response.ok) {
        let errorBody: any;
        try { errorBody = await response.json(); } 
        catch { errorBody = { error: response.statusText }; }

        if (errorBody?.error === 'limit_exceeded') {
          openModal();
          throw new Error(errorBody.message || 'AI limit reached.');
        }

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

  const updateSetting = <K extends keyof QuizSettings>(
    key: K,
    value: QuizSettings[K]
  ) => {
    setQuizSettings((prev) => ({ ...prev, [key]: value }));
  };
  
  const isProcessing = isLoading || isFetchingDoc;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 md:py-12">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => router.back()}
          disabled={isProcessing}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              Create a New Quiz
            </CardTitle>
            <CardDescription>
              Provide content via Text, File, or YouTube URL.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Option 1: Text Input */}
              <div className="space-y-2 relative">
                <Label htmlFor="content" className="text-base font-semibold">
                  Option 1: Paste Text
                </Label>
                <Textarea
                  id="content"
                  placeholder="Paste article, notes, or essay here..."
                  value={textContent}
                  onChange={handleTextChange}
                  className="min-h-32 text-base"
                  disabled={isProcessing}
                />
                {isFetchingDoc && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase font-bold">OR</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
              </div>

              {/* Option 2: File Input */}
              <div className="space-y-3">
                <Label htmlFor="file-upload" className="text-base font-semibold">
                  Option 2: Upload File
                </Label>
                <div
                  className={`relative border-2 border-dashed ${
                    error && !selectedFile
                      ? 'border-destructive'
                      : 'border-slate-300 dark:border-slate-700'
                  } rounded-lg p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors`}
                >
                  <FileText className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-sm font-medium">
                    {selectedFile ? selectedFile.name : 'Click to Upload PDF/DOCX/PPTX'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Max 3MB. {selectedFile && `(${formatFileSize(selectedFile.size)})`}
                  </p>
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

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase font-bold">OR</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
              </div>

              {/* Option 3: YouTube Input */}
              <div className="space-y-3">
                 <Label htmlFor="youtube-url" className="text-base font-semibold flex items-center gap-2">
                    Option 3: YouTube Video <span className="text-xs font-normal text-muted-foreground">(Beta)</span>
                 </Label>
                 <div className="relative">
                    <Youtube className="absolute left-3 top-3 h-5 w-5 text-red-500" />
                    <Input 
                        id="youtube-url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={youtubeUrl}
                        onChange={handleYoutubeChange}
                        className="pl-10"
                        disabled={isProcessing}
                    />
                 </div>
              </div>

              {/* Settings */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-4"
                    disabled={isProcessing}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Quiz Settings
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4 p-4 border rounded-md bg-slate-50 dark:bg-slate-800/50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="question-count">Questions</Label>
                      <Select
                        value={String(quizSettings.questionCount)}
                        onValueChange={(v) =>
                          updateSetting('questionCount', Number(v))
                        }
                        disabled={isProcessing}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 Questions</SelectItem>
                          <SelectItem value="10">10 Questions</SelectItem>
                          <SelectItem value="15">15 Questions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="difficulty">Difficulty</Label>
                      <Select
                        value={quizSettings.difficulty}
                        onValueChange={(v: 'easy' | 'medium' | 'hard') =>
                          updateSetting('difficulty', v)
                        }
                        disabled={isProcessing}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="question-type">Question Type</Label>
                    <Select
                      value={quizSettings.questionType}
                      onValueChange={(v: QuestionType | 'MIXED') =>
                        updateSetting('questionType', v)
                      }
                      disabled={isProcessing}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MIXED">Mixed Types</SelectItem>
                        <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
                        <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                        <SelectItem value="FILL_IN_THE_BLANK">Fill in the Blank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <Label htmlFor="immediate-feedback" className="cursor-pointer">
                        Immediate Feedback
                    </Label>
                    <Switch
                      id="immediate-feedback"
                      checked={quizSettings.immediateFeedback}
                      onCheckedChange={(checked) =>
                        updateSetting('immediateFeedback', checked)
                      }
                      disabled={isProcessing}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Error Display */}
              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <div>{error}</div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                className="w-full text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                disabled={
                  isProcessing || (!textContent.trim() && !selectedFile && !youtubeUrl.trim())
                }
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {isFetchingDoc ? 'Loading Document...' : 'Generating Quiz...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" /> 
                    {youtubeUrl ? 'Generate from Video' : 'Generate Quiz'}
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

// CHANGED: Default export is now a Suspense wrapper
export default function CreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <CreatePageContent />
    </Suspense>
  );
}