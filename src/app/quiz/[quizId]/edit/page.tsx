// src/app/quiz/[quizId]/edit/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseHelpers } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft, LogOut, Sparkles, Plus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from '@/components/theme-toggle';
import { Quiz, Question, QuestionType, ApiResponse } from '@/types/database';
import { QuestionEditor } from '@/components/QuestionEditor'; // <-- IMPORT NEW COMPONENT

// DashboardHeader remains the same
const DashboardHeader = () => {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="py-4 px-6 md:px-12 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <Link href="/quizzes" className="flex items-center gap-2"> {/* <-- MODIFIED */}
        <Sparkles className="w-6 h-6 text-primary" />
        <span className="text-xl font-bold">QuizCraft</span>
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {user?.email}
        </span>
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </header>
  );
};


export default function EditQuizPage() {
  const { quizId } = useParams();
  const { session } = useAuth();
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
        router.push('/login');
        return;
    }
    if (user && quizId) {
      // Fetch quiz AND questions
      supabaseHelpers.getQuiz(quizId as string)
        .then((quiz: (Quiz & { questions: Question[] }) | null) => {
          if (!quiz) {
            throw new Error("Quiz not found.");
          }
          // Note: RLS handles ownership check on the backend, 
          // but an extra client-side check is good practice.
          // This assumes `getQuiz` returns null if RLS fails.
          // Let's add an explicit ownership check based on your old code:
          
          // --- THIS IS THE FIX ---
          // Changed quiz.userId to quiz.user_id
          if (quiz.user_id !== user.id) { 
          // --- END OF FIX ---
            toast({ title: "Access Denied", description: "You don't have permission to edit this quiz.", variant: "destructive" });
            router.push('/quizzes'); // <-- MODIFIED
            return;
          }
          
          setTitle(quiz.title);
          // Set questions, ensuring 'options' is always an array for MC/TF
          // and explanation is not null
          setQuestions(quiz.questions.map(q => ({
            ...q,
            options: Array.isArray(q.options) ? q.options : (
              (q.question_type === 'MULTIPLE_CHOICE' || q.question_type === 'TRUE_FALSE') ? [] : null
            ),
            explanation: q.explanation || ''
          })));
          setLoading(false);
        })
        .catch((err) => {
          toast({ title: "Error", description: err.message || "Quiz not found.", variant: "destructive" });
          router.push('/quizzes'); // <-- MODIFIED
        });
    }
  }, [user, authLoading, quizId, router, toast]);
  
  const handleQuestionChange = (index: number, updatedQuestion: Question) => {
    const newQuestions = [...questions];
    newQuestions[index] = updatedQuestion;
    setQuestions(newQuestions);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      toast({ title: "Cannot remove last question", description: "A quiz must have at least one question.", variant: "destructive" });
      return;
    }
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions);
  };

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: `new-${Date.now()}`, // Temporary ID
      quiz_id: quizId as string,
      question_text: "New Question",
      question_type: "MULTIPLE_CHOICE",
      options: ["Option 1", "Option 2", "Option 3", "Option 4"],
      correct_answer: "Option 1",
      explanation: "",
      created_at: new Date().toISOString(), // This won't be saved, but good for consistency
      prompts: null
    };
    setQuestions([...questions, newQuestion]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/quiz/${quizId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          title: title, 
          questions: questions // Send the entire questions array
        }),
      });

      const result: ApiResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update quiz.');
      }

      toast({ title: "✅ Success", description: "Quiz has been updated!" });
      router.push('/quizzes'); // <-- MODIFIED
      router.refresh(); // Force refresh dashboard data
    } catch (error: any) {
      toast({ title: "❌ Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin"/>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <DashboardHeader />
      <div className="container mx-auto max-w-4xl py-12 px-4">
        <Button variant="ghost" className="mb-6" onClick={() => router.push('/quizzes')}> {/* <-- MODIFIED */}
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Quizzes
        </Button>
        
        <div className="space-y-8">
          {/* Quiz Title Card */}
          <Card>
            <CardHeader>
              <CardTitle>Edit Quiz Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="title">Quiz Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
              </div>
            </CardContent>
          </Card>

          {/* Questions Editor */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Questions</h2>
            {questions.map((q, index) => (
              <QuestionEditor
                key={q.id || `new-${index}`} // Use ID or index for new questions
                index={index}
                question={q}
                onQuestionChange={handleQuestionChange}
                onRemoveQuestion={handleRemoveQuestion}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <Button variant="outline" onClick={handleAddQuestion} disabled={saving}>
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>
            <Button onClick={handleSave} disabled={saving || !title.trim() || questions.length === 0}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save All Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}