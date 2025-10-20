'use client';

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, FileText, Loader2, Settings, AlertCircle, Sparkles, LogOut, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatFileSize, validateFileType, extractPdfText } from "@/lib/file-parser";
import { QuestionType } from "@/types/database";

interface QuizSettings {
  questionCount: number;
  difficulty: "easy" | "medium" | "hard";
  questionType: QuestionType | 'MIXED';
  immediateFeedback: boolean;
}

// Header component for a consistent authenticated layout
const DashboardHeader = () => {
    const { user, signOut } = useAuth();
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut();
        router.push('/login');
    };

    return (
        <header className="py-4 px-6 md:px-12 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <Link href="/dashboard" className="flex items-center gap-2">
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
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [quizSettings, setQuizSettings] = useState<QuizSettings>({
    questionCount: 10,
    difficulty: "medium",
    questionType: 'MIXED',
    immediateFeedback: true,
  });

  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 3 * 1024 * 1024; // 3MB
      const isValidType = validateFileType(file.name, file.type);

      if (!isValidType) {
        setError("Unsupported file type. Please upload a PDF or TXT file.");
        setSelectedFile(null);
        return;
      }

      if (file.size > maxSize) {
        setError(`File size exceeds 3MB. Max size is ${formatFileSize(maxSize)}.`);
        setSelectedFile(null);
        return;
      }

      setTextContent(""); // Clear text content when a file is selected
      setSelectedFile(file);
      setError("");
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setTextContent(e.target.value);
      if(selectedFile) {
          setSelectedFile(null); // Clear file when text is entered
      }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { router.push("/login"); return; }
    if (!textContent.trim() && !selectedFile) {
      setError("Please provide text content or upload a file.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      let finalTextContent = textContent.trim();

      if (selectedFile) {
        finalTextContent = selectedFile.type === "application/pdf"
            ? await extractPdfText(selectedFile)
            : await selectedFile.text();
      }

      if (finalTextContent.length < 100) {
          throw new Error("Content is too short. Please provide at least 100 characters.");
      }

      const queryParams = new URLSearchParams({
        numQuestions: quizSettings.questionCount.toString(),
        difficulty: quizSettings.difficulty,
        questionType: quizSettings.questionType,
        immediateFeedback: String(quizSettings.immediateFeedback),
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication failed.");

      const response = await fetch(`/api/generate-quiz?${queryParams}`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'text/plain',
        },
        body: finalTextContent,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "An unknown error occurred.");
      }

      toast({
        title: "Quiz Generated!",
        description: `Your new quiz "${result.title}" has been created.`,
      });

      router.push(`/dashboard`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong.";
      setError(errorMessage);
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = <K extends keyof QuizSettings>(key: K, value: QuizSettings[K]) => {
    setQuizSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8 md:py-12">
            <Button variant="ghost" className="mb-6" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
            </Button>
            <Card className="max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">Create a New Quiz</CardTitle>
                    <CardDescription>Provide your content and configure the settings for your new quiz.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="content" className="text-base font-semibold">
                                Option 1: Paste Your Content
                            </Label>
                            <Textarea
                                id="content"
                                placeholder="Paste your article, notes, or any text here..."
                                value={textContent}
                                onChange={handleTextChange}
                                className="min-h-48 text-base"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="bg-card px-2 text-muted-foreground">OR</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="file-upload" className="text-base font-semibold">
                                Option 2: Upload a File
                            </Label>
                            <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center">
                                <FileText className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
                                <p className="mt-2 font-semibold">
                                  {selectedFile ? selectedFile.name : 'Drag & drop or click to upload'}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  PDF or TXT only, max 3MB.
                                </p>
                                <Input
                                    id="file-upload"
                                    type="file"
                                    accept=".pdf,.txt"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <Collapsible>
                            <CollapsibleTrigger asChild>
                                <Button type="button" variant="outline" className="w-full">
                                    <Settings className="w-4 h-4 mr-2" />
                                    Quiz Settings
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-4 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="question-count">Number of Questions</Label>
                                        <Select value={String(quizSettings.questionCount)} onValueChange={(v) => updateSetting("questionCount", Number(v))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="5">5</SelectItem>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="15">15</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="difficulty">Difficulty</Label>
                                        <Select value={quizSettings.difficulty} onValueChange={(v: "easy" | "medium" | "hard") => updateSetting("difficulty", v)}>
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
                                    <Label htmlFor="question-type">Question Type</Label>
                                    <Select value={quizSettings.questionType} onValueChange={(v: QuestionType | 'MIXED') => updateSetting("questionType", v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MIXED">Mixed</SelectItem>
                                            <SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem>
                                            <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                                            <SelectItem value="FILL_IN_THE_BLANK">Fill in the Blank</SelectItem>
                                            <SelectItem value="MATCHING">Matching</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="immediate-feedback">Immediate Feedback</Label>
                                        <CardDescription>
                                            Show correct answer after each question.
                                        </CardDescription>
                                    </div>
                                    <Switch
                                        id="immediate-feedback"
                                        checked={quizSettings.immediateFeedback}
                                        onCheckedChange={(checked) => updateSetting("immediateFeedback", checked)}
                                    />
                                </div>
                            </CollapsibleContent>
                        </Collapsible>

                        {error && (
                            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                <div>{error}</div>
                            </div>
                        )}

                        <Button
                            type="submit"
                            size="lg"
                            className="w-full text-base"
                            disabled={isLoading || (!textContent.trim() && !selectedFile)}
                        >
                            {isLoading ? (
                                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating Your Quiz...</>
                            ) : (
                                <><Sparkles className="w-5 h-5 mr-2" /> Generate Quiz</>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    </div>
  );
}