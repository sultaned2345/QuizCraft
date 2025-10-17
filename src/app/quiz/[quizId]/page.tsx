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
import { ArrowLeft, Share2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);

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

  const handleAnswerSelect = (answer: string) => {
    if (isAnswered) return;
    setSelectedAnswer(answer);
    setIsAnswered(true);
    if (answer === questions[currentQuestionIndex].correct_answer) {
      setScore(score + 1);
    }
  };

  const handleNextQuestion = () => {
    setIsAnswered(false);
    setSelectedAnswer(null);
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  const renderQuestion = () => {
    const question = questions[currentQuestionIndex];
    switch (question.question_type) {
      case 'MULTIPLE_CHOICE':
        return (
          <div className="space-y-2">
            {(question.options as string[]).map((option, index) => (
              <Button
                key={index}
                variant="outline"
                className={`w-full justify-start h-auto p-4 text-left whitespace-normal ${
                  isAnswered && option === question.correct_answer
                    ? 'bg-green-100 border-green-400 dark:bg-green-900/50'
                    : ''
                } ${
                  isAnswered && selectedAnswer === option && option !== question.correct_answer
                    ? 'bg-red-100 border-red-400 dark:bg-red-900/50'
                    : ''
                }`}
                onClick={() => handleAnswerSelect(option)}
                disabled={isAnswered}
              >
                {option}
              </Button>
            ))}
          </div>
        );
      case 'TRUE_FALSE':
        return (
            <div className="space-y-2">
                {["True", "False"].map((option, index) => (
                    <Button
                        key={index}
                        variant="outline"
                        className={`w-full justify-start h-auto p-4 text-left whitespace-normal ${isAnswered && option === question.correct_answer ? 'bg-green-100 border-green-400 dark:bg-green-900/50' : ''} ${isAnswered && selectedAnswer === option && option !== question.correct_answer ? 'bg-red-100 border-red-400 dark:bg-red-900/50' : ''}`}
                        onClick={() => handleAnswerSelect(option)}
                        disabled={isAnswered}
                    >
                        {option}
                    </Button>
                ))}
            </div>
        );
      case 'FILL_IN_THE_BLANK':
        return (
            <div>
                <p className="text-lg mb-4">{question.question_text.replace("____", "[...]")}</p>
                <Button onClick={() => handleAnswerSelect(question.correct_answer)}>Show Answer</Button>
            </div>
        );
      default:
        return <p>Unsupported question type.</p>;
    }
  };

  if (isLoading || authLoading) {
    // ... loading state ...
  }
  if (error) {
    // ... error state ...
  }

  const isQuizFinished = currentQuestionIndex >= questions.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 md:py-12">
        <Button variant="ghost" className="mb-6" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{quiz?.title}</CardTitle>
            <CardDescription>
              {isQuizFinished
                ? "Quiz Complete!"
                : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isQuizFinished ? (
              <div className="text-center">
                <h2 className="text-xl font-semibold">Your Score</h2>
                <p className="text-4xl font-bold my-4">
                  {score} / {questions.length}
                </p>
                <Button onClick={() => window.location.reload()}>Try Again</Button>
              </div>
            ) : questions.length > 0 && (
              <div>
                <p className="text-lg font-semibold mb-4">{questions[currentQuestionIndex].question_text}</p>
                {renderQuestion()}
                {isAnswered && (
                  <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {selectedAnswer === questions[currentQuestionIndex].correct_answer ? (
                      <div className="flex items-center text-green-600 dark:text-green-400">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        <p className="font-semibold">Correct!</p>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600 dark:text-red-400">
                        <XCircle className="w-5 h-5 mr-2" />
                        <p className="font-semibold">Incorrect.</p>
                      </div>
                    )}
                    <p className="mt-2 text-sm text-muted-foreground">{questions[currentQuestionIndex].explanation}</p>
                    <Button className="mt-4 w-full" onClick={handleNextQuestion}>
                      Next Question
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}