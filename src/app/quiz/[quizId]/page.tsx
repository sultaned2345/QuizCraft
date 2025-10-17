'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseHelpers } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Share2, CheckCircle, Loader2 } from 'lucide-react';
import { Quiz, Question } from '@/types/database';

// Re-usable header from your dashboard
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
        <span className="text-xl font-bold">QuizCraft</span>
      </Link>
      {user && (
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign Out
        </Button>
      )}
    </header>
  );
};

export default function QuizPage() {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const quizId = params.quizId as string;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && quizId) {
      fetchQuizData();
    }
  }, [user, authLoading, quizId, router]);

  const fetchQuizData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const quizData = await supabaseHelpers.getQuiz(quizId);
      const questionsData = await supabaseHelpers.getQuestions(quizId);
      setQuiz(quizData);
      setQuestions(questionsData);
    } catch (err) {
      console.error('Error fetching quiz data:', err);
      setError('Quiz not found or you do not have permission to view it.');
      toast({
        title: 'Error',
        description: 'Failed to load the quiz.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!quiz?.share_link) return;
    const shareUrl = `${window.location.origin}/quiz/${quiz.share_link}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: 'Link Copied!',
      description: 'The shareable link has been copied to your clipboard.',
    });
  };

  const toggleAnswer = (questionId: string) => {
    setRevealedAnswers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2">Loading Quiz...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center">
         <p className="text-destructive mb-4">{error}</p>
         <Button asChild>
           <Link href="/dashboard">
             <ArrowLeft className="w-4 h-4 mr-2" />
             Back to Dashboard
           </Link>
         </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <Button variant="ghost" className="mb-2" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">{quiz?.title}</h1>
            <div className="flex items-center gap-2 mt-2">
                <Badge variant={quiz?.is_public ? "default" : "secondary"}>
                    {quiz?.is_public ? "Public" : "Draft"}
                </Badge>
                <p className="text-sm text-muted-foreground">{questions.length} questions</p>
            </div>
          </div>
          <Button onClick={handleCopyShareLink} disabled={!quiz?.share_link}>
            <Share2 className="w-4 h-4 mr-2" />
            Share Quiz
          </Button>
        </div>

        <div className="space-y-6">
          {questions.map((q, index) => (
            <Card key={q.id}>
              <CardHeader>
                <CardTitle>Question {index + 1}</CardTitle>
                <CardDescription className="text-base text-foreground pt-2">{q.question_text}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-4">
                  {q.options.map((option, i) => (
                    <li
                      key={i}
                      className={`flex items-center gap-2 p-2 rounded-md
                        ${revealedAnswers.has(q.id) && option === q.correct_answer ? 'bg-green-100 dark:bg-green-900/50' : ''}`}
                    >
                      {revealedAnswers.has(q.id) && option === q.correct_answer && <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />}
                      <span>{option}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" onClick={() => toggleAnswer(q.id)}>
                  {revealedAnswers.has(q.id) ? 'Hide' : 'Show'} Answer
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}