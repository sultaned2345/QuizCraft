// src/app/create/page.tsx
'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
// Removed unused supabase import
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// --- MODIFIED: Import new function ---
import {
  formatFileSize,
  validateFileType,
  extractTextFromFile,
} from '@/lib/file-parser';
// ---
import { QuestionType, ApiResponse, DocumentMetadata } from '@/types/database';
import { useUpgradeModal } from '@/components/UpgradeModalContext';

interface QuizSettings {
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: QuestionType | 'MIXED';
  immediateFeedback: boolean;
}

// Header component
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
        {' '}
        {/* <-- MODIFIED */}
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

export default function CreatePage() {
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDoc, setIsFetchingDoc] = useState(false); // State for fetching doc content
  const [error, setError] = useState('');
  const [quizSettings, setQuizSettings] = useState<QuizSettings>({
    questionCount: 10,
    difficulty: 'medium',
    questionType: 'MIXED',
    immediateFeedback: true,
  });

  // Use the session directly from the context
  const { user, session, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams(); // Hook to read query params
  const { toast } = useToast();
  const { openModal } = useUpgradeModal();

  // Effect to handle initial login state
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Effect to fetch document content if docId is present
  useEffect(() => {
    const docId = searchParams.get('docId');
    if (docId && session && !textContent && !selectedFile) {
      // Only fetch if fields are empty
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
  }, [searchParams, session, toast, textContent, selectedFile]); // Add dependencies

  // --- MODIFIED: handleFileChange ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 3 * 1024 * 1024; // 3MB

      // Updated validation
      const isValidType = ['.pdf', '.txt', '.docx', '.pptx'].some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );

      if (!isValidType) {
        setError('Unsupported file. Please upload PDF, TXT, DOCX, or PPTX.'); // Updated message
        setSelectedFile(null);
        if (e.target) e.target.value = '';
        return;
      }
      // ---

      if (file.size > maxSize) {
        setError(
          `File size exceeds 3MB. Max size is ${formatFileSize(maxSize)}.`
        );
        setSelectedFile(null);
        if (e.target) e.target.value = '';
        return;
      }

      setTextContent(''); // Clear text content when a file is selected
      setSelectedFile(file);
      setError('');
      // Don't clear e.target.value here immediately, let browser handle display
    }
  };
  // ---

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextContent(e.target.value);
    if (selectedFile) {
      setSelectedFile(null); // Clear file when text is entered
    }
    setError(''); // Clear error on text change
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // --- User ID Log ---
    console.log('--- Create Page User ID (from useAuth):', user?.id);
    console.log(
      '--- Create Page Session Token Snippet:',
      session?.access_token?.substring(0, 10)
    );
    // --- End Log ---
    if (!user || !session) {
      setError('Auth session missing.');
      toast({ title: 'Auth Error', variant: 'destructive' });
      return;
    }
    if (!textContent.trim() && !selectedFile) {
      setError('Provide text or upload file.');
      return;
    }
    setIsLoading(true);
    setError('');

    let response; // Declare response outside try block
    try {
      let finalTextContent = textContent.trim();
      // --- MODIFIED: Pass the session token ---
      if (selectedFile) {
        toast({
          title: 'Processing file...',
          description: 'Extracting text from your document.',
        });
        finalTextContent = await extractTextFromFile(
          selectedFile,
          session.access_token // <-- PASS TOKEN HERE
        );
        toast({ title: 'Text extracted!', description: 'Now generating quiz...' });
      }
      // ---
      if (finalTextContent.length < 100)
        throw new Error('Content too short (min 100 chars).');

      const queryParams = new URLSearchParams({
        numQuestions: quizSettings.questionCount.toString(),
        difficulty: quizSettings.difficulty,
        questionType: quizSettings.questionType,
        immediateFeedback: String(quizSettings.immediateFeedback),
      });

      console.log('--- Sending request to /api/generate-quiz ---'); // Log before fetch
      response = await fetch(`/api/generate-quiz?${queryParams}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'text/plain',
        },
        body: finalTextContent,
      });
      console.log('--- Received response from /api/generate-quiz ---', {
        status: response.status,
        ok: response.ok,
      }); // Log after fetch

      // More robust response check
      if (!response.ok) {
        let errorBody: any = 'Failed to parse error response.'; // Use 'any' for flexibility
        try {
          errorBody = await response.json(); // Try to get JSON error details
        } catch {
          try {
            // Add another try-catch for text()
            errorBody = await response.text(); // Fallback to text
          } catch (textError) {
            console.error(
              'Failed to even get text from error response:',
              textError
            );
            errorBody = response.statusText; // Ultimate fallback
          }
        }
        console.error('API Error Response Body:', errorBody);

        // --- 3. CATCH LIMIT ERROR ---
        if (
          typeof errorBody === 'object' &&
          errorBody.error === 'limit_exceeded'
        ) {
          openModal();
          throw new Error(errorBody.message || 'AI generation limit reached.');
        }
        // ---

        // Try to access errorBody.error if it's an object, otherwise use the string/statusText
        const specificError =
          typeof errorBody === 'object' && errorBody !== null && errorBody.error
            ? errorBody.error
            : errorBody;
        throw new Error(`API Error (${response.status}): ${specificError}`);
      }

      // If response.ok, *then* parse JSON
      const result: {
        success?: boolean;
        error?: string;
        id?: string;
        title?: string;
      } = await response.json();

      // Check for success flag specifically if present, otherwise rely on response.ok and ID presence
      if (result.success === false || !result.id) {
        console.error('API Success=false or missing ID:', result);
        throw new Error(
          result.error || 'API indicated failure but provided no error message.'
        );
      }

      // If we reach here, it means success
      toast({
        title: 'Quiz Generated!',
        description: `"${result.title}" created.`,
      }); // Access title directly
      window.location.href = '/quizzes'; // <-- MODIFIED: Force full reload to /quizzes
    } catch (err) {
      // Catch errors from fetch itself, parsing, or thrown checks
      const errorMessage =
        err instanceof Error ? err.message : 'Something went wrong.';

      // --- 4. AVOID DOUBLE-TOASTING LIMIT ERRORS ---
      if (!errorMessage.includes('limit reached')) {
        console.error('--- Error in handleSubmit ---', err); // Log the full error
        setError(errorMessage); // Show error in UI
        toast({
          title: 'Generation Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      // ---
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
              Provide content and configure settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Text Input */}
              <div className="space-y-2 relative">
                <Label htmlFor="content" className="text-base font-semibold">
                  Option 1: Paste Content
                </Label>
                <Textarea
                  id="content"
                  placeholder="Paste text here..."
                  value={textContent}
                  onChange={handleTextChange}
                  className="min-h-48 text-base"
                  disabled={isProcessing}
                />
                {isFetchingDoc && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              {/* OR Separator */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-card px-2 text-muted-foreground">OR</span>
                </div>
              </div>
              {/* File Input */}
              <div className="space-y-3">
                <Label htmlFor="file-upload" className="text-base font-semibold">
                  Option 2: Upload File
                </Label>
                <div
                  className={`relative border-2 border-dashed ${
                    error && !selectedFile
                      ? 'border-destructive'
                      : 'border-slate-300 dark:border-slate-700'
                  } rounded-lg p-6 text-center`}
                >
                  <FileText className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
                  <p className="mt-2 font-semibold">
                    {selectedFile ? selectedFile.name : 'Drag & drop or click'}
                  </play>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF, TXT, DOCX, PPTX (max 3MB).
                    {selectedFile && ` (${formatFileSize(selectedFile.size)})`}
                  </p>
                  {/* --- MODIFIED: accept attribute --- */}
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.txt,.docx,.pptx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isProcessing}
                    onClick={(e) => (e.currentTarget.value = '')}
                  />
                  {/* --- */}
                </div>
              </div>
              {/* Settings */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isProcessing}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Quiz Settings
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
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
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="15">15</SelectItem>
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
                        <SelectItem value="MIXED">Mixed</SelectItem>
                        <SelectItem value="MULTIPLE_CHOICE">
                          Multiple Choice
                        </SelectItem>
                        <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                        <SelectItem value="FILL_IN_THE_BLANK">
                          Fill in the Blank
                        </SelectItem>
                        {/* Note: Matching is not fully supported yet */}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="immediate-feedback"
                        className={`${isProcessing ? 'opacity-50' : ''}`}
                      >
                        Immediate Feedback
                      </Label>
                      <CardDescription
                        className={`${isProcessing ? 'opacity-50' : ''}`}
                      >
                        Show answer after each question.
                      </CardDescription>
                    </div>
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
                <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <div>{error}</div>
                </div>
              )}
              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                className="w-full text-base"
                disabled={
                  isProcessing || (!textContent.trim() && !selectedFile)
                }
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />{' '}
                    {isFetchingDoc ? 'Loading...' : 'Generating...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" /> Generate Quiz
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