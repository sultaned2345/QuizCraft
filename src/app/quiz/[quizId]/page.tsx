'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseHelpers } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Share2, CheckCircle, XCircle, Loader2, RefreshCw, Eye, Sparkles, LogOut } from 'lucide-react';
import { Quiz, Question } from '@/types/database';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';

// Define a type for storing user answers
type UserAnswer = {
    questionId: string;
    selectedAnswer: string;
    isCorrect: boolean;
};

// Updated DashboardHeader
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
      {user && (
        <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
        </div>
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
  const [fillInBlankAnswer, setFillInBlankAnswer] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);

  const [viewMode, setViewMode] = useState<'quiz' | 'results' | 'review'>('quiz');

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const quizId = params.quizId as string;

   // Define loadQuizData using useCallback to avoid redefining it on every render
   const loadQuizData = useCallback(async () => {
    if (!user || !quizId) return; // Guard against missing user or quizId

    setIsLoading(true);
    setError('');
    try {
      console.log(`[QuizPage loadQuizData] Calling supabaseHelpers.getQuiz for ID: ${quizId} with User ID: ${user.id}`);
      const quizData = await supabaseHelpers.getQuiz(quizId);

      console.log(`[QuizPage loadQuizData] Received quizData:`, quizData ? `Title: ${quizData.title}` : null);

      if (!quizData) {
        console.log('[QuizPage loadQuizData] Setting error: Quiz not found or no permission.');
        setError('Quiz not found or you may not have permission to view it.');
        setQuiz(null);
        setQuestions([]);
      } else if (!quizData.questions || quizData.questions.length === 0) {
        console.log('[QuizPage loadQuizData] Setting error: Quiz found but no questions.');
        setError('This quiz exists but has no questions yet.');
        setQuiz(quizData);
        setQuestions([]);
      } else {
        console.log(`[QuizPage loadQuizData] Success: Found quiz "${quizData.title}" with ${quizData.questions.length} questions.`);
        setQuiz(quizData);
        setQuestions(quizData.questions);
      }

    } catch (err: any) {
      console.error("[QuizPage loadQuizData] Error caught during fetch:", err);
      setError(err.message || 'An unexpected error occurred while fetching the quiz.');
      setQuiz(null);
      setQuestions([]);
    } finally {
      console.log('[QuizPage loadQuizData] Setting isLoading to false.');
      setIsLoading(false);
    }
  }, [user, quizId]); // Dependencies for useCallback

  // This useEffect handles authentication check and triggers data loading
  useEffect(() => {
    // Log initial state when effect runs
    console.log('[QuizPage useEffect] Start. authLoading:', authLoading, 'User ID:', user?.id);

    if (!authLoading && !user) {
      console.log('[QuizPage useEffect] User not found after loading, redirecting to login.');
      router.push('/login');
      return; // Stop execution
    }

    // Only proceed if loading is finished, user exists, and quizId is present
    if (!authLoading && user && quizId) {
      console.log(`[QuizPage useEffect] Conditions met: User (${user.id}), quizId (${quizId}). Calling loadQuizData.`);
      loadQuizData();
    } else {
      // Log why we might not be fetching yet
      console.log('[QuizPage useEffect] Conditions not met yet. Waiting for user/authLoading/quizId.');
      if (authLoading) console.log('[QuizPage useEffect] Reason: authLoading is true.');
      if (!user) console.log('[QuizPage useEffect] Reason: user is null.');
      if (!quizId) console.log('[QuizPage useEffect] Reason: quizId is missing.');
    }
  }, [user, authLoading, quizId, router, loadQuizData]); // Added loadQuizData to dependencies


  const handleAnswerSelect = (answer: string) => {
    if (isAnswered) return;
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return; // Add guard clause
    const isCorrect = answer.toLowerCase().trim() === (currentQuestion.correct_answer || '').toLowerCase().trim();

    setSelectedAnswer(answer);
    setIsAnswered(true);
    setUserAnswers([...userAnswers, { questionId: currentQuestion.id, selectedAnswer: answer, isCorrect }]);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
        setIsAnswered(false);
        setSelectedAnswer(null);
        setFillInBlankAnswer('');
        setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
        setViewMode('results');
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setSelectedAnswer(null);
    setFillInBlankAnswer('');
    setIsAnswered(false);
    setViewMode('quiz');
  };

  const renderQuestion = () => {
    if (!questions[currentQuestionIndex]) {
        console.error(`[renderQuestion] Attempted to render question at index ${currentQuestionIndex}, but it's undefined.`);
        return <p>Error: Could not load question data.</p>;
    }

    const question = questions[currentQuestionIndex];
    switch (question.question_type) {
      case 'MULTIPLE_CHOICE':
        // Ensure options is an array before mapping
        const options = Array.isArray(question.options) ? question.options : [];
        if (options.length === 0) console.warn(`[renderQuestion] MULTIPLE_CHOICE question (ID: ${question.id}) has no options.`);
        return (
          <div className="space-y-2">
            {options.map((option, index) => (
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
            <div className="space-y-4">
                 {/* Question text for FITB is now handled outside renderQuestion */}
                <div className="flex gap-2">
                    <Input
                        value={fillInBlankAnswer}
                        onChange={(e) => setFillInBlankAnswer(e.target.value)}
                        placeholder="Type your answer here..."
                        disabled={isAnswered}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !isAnswered) { e.preventDefault(); handleAnswerSelect(fillInBlankAnswer); } }}
                    />
                    <Button onClick={() => handleAnswerSelect(fillInBlankAnswer)} disabled={isAnswered}>Submit</Button>
                </div>
            </div>
        );
      default:
         console.error(`[renderQuestion] Unsupported question type encountered: ${question.question_type} for question ID: ${question.id}`);
        return <p>Error: Unsupported question type.</p>;
    }
  };

  // --- RENDER LOGIC ---
  if (isLoading || authLoading) {
    console.log('[QuizPage Render] Showing loading spinner (isLoading || authLoading).');
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  // Render error message if 'error' state is set
  if (error) {
       console.log(`[QuizPage Render] Showing error message: "${error}"`);
       return (
           <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
               <DashboardHeader />
               <main className="container mx-auto px-4 py-8 md:py-12 text-center">
                    <p className="text-destructive font-semibold">{error}</p>
                    <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Button>
               </main>
           </div>
       );
   }

   // If no error, but quiz is still null (failsafe)
   if (!quiz) {
       console.error('[QuizPage Render] Reached render return, but quiz is null and no error is set. This should not happen.');
       return (
            <div className="min-h-screen flex items-center justify-center">
                 <p className="text-destructive">An unexpected error occurred. Could not load quiz data.</p>
                 {/* Optionally add a back button here too */}
            </div>
       );
   }

  console.log(`[QuizPage Render] Rendering quiz "${quiz.title}" in viewMode: ${viewMode}`);

  const score = userAnswers.filter(a => a.isCorrect).length;
  const currentQuestion = questions[currentQuestionIndex]; // Get current question AFTER checking quiz/questions exist

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
            <CardTitle className="text-2xl font-bold">{quiz.title}</CardTitle> {/* Use quiz.title safely */}
            {viewMode === 'quiz' && (
                <>
                    <CardDescription>
                        Question {currentQuestionIndex + 1} of {questions.length > 0 ? questions.length : 0}
                    </CardDescription>
                    <Progress value={questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0} className="mt-2" />
                </>
            )}
          </CardHeader>
          <CardContent>
             {/* Handle quiz view */}
            {viewMode === 'quiz' && questions.length > 0 && currentQuestion && (
              <div>
                {/* Moved FITB question text rendering here for clarity */}
                <div className="text-lg font-semibold mb-4"
                     dangerouslySetInnerHTML={ currentQuestion.question_type === 'FILL_IN_THE_BLANK'
                        ? { __html: currentQuestion.question_text.replace(/____/g, '<strong>[BLANK]</strong>') }
                        : undefined
                     }
                >
                   {currentQuestion.question_type !== 'FILL_IN_THE_BLANK' && currentQuestion.question_text}
                </div>
                {renderQuestion()}
                {isAnswered && currentQuestion && ( // Ensure currentQuestion exists for feedback
                  <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {userAnswers.find(a => a.questionId === currentQuestion.id)?.isCorrect ? (
                      <div className="flex items-center text-green-600 dark:text-green-400">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        <p className="font-semibold">Correct!</p>
                      </div>
                    ) : (
                      <div className="text-red-600 dark:text-red-400">
                        <div className="flex items-center font-semibold">
                            <XCircle className="w-5 h-5 mr-2" />
                            <p>Incorrect.</p>
                        </div>
                        <p className="text-sm mt-1">Correct answer: {currentQuestion.correct_answer}</p>
                      </div>
                    )}
                    <p className="mt-2 text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                    <Button className="mt-4 w-full" onClick={handleNextQuestion}>
                      {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Handle empty quiz */}
             {viewMode === 'quiz' && questions.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                    <p>This quiz currently has no questions.</p>
                     <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
                </div>
             )}

            {/* Handle results view */}
            {viewMode === 'results' && (
              <div className="text-center py-8">
                <h2 className="text-xl font-semibold">Quiz Complete!</h2>
                <p className="text-6xl font-bold my-4">
                  {score} / {questions.length > 0 ? questions.length : 0}
                </p>
                <div className="flex justify-center gap-2">
                    <Button onClick={handleRestartQuiz}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                    </Button>
                    <Button variant="outline" onClick={() => setViewMode('review')} disabled={questions.length === 0}>
                        <Eye className="w-4 h-4 mr-2" />
                        Review Answers
                    </Button>
                </div>
              </div>
            )}

            {/* Handle review view */}
            {viewMode === 'review' && (
                <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-center">Review Your Answers</h2>
                    {questions.map((q, index) => {
                        const userAnswer = userAnswers.find(a => a.questionId === q.id);
                        const isCorrect = userAnswer?.isCorrect;
                        return (
                            <div key={q.id} className={cn("p-4 rounded-lg border", isCorrect ? "border-green-500/50 bg-green-500/5" : "border-destructive/50 bg-destructive/5")}>
                                {/* Display FITB with correct answer in brackets */}
                                <p className="font-semibold" dangerouslySetInnerHTML={{
                                    __html: `${index + 1}. ${q.question_text.replace(/____/g, `<strong>[${q.correct_answer || '?'}]</strong>`)}`
                                }}></p>
                                <p className={cn("mt-2 text-sm", isCorrect ? "text-green-700 dark:text-green-400" : "text-destructive")}>
                                    Your answer: {userAnswer?.selectedAnswer || "Not answered"}
                                </p>
                                {/* Only show correct answer explicitly if wrong AND not FITB (already shown above) */}
                                {!isCorrect && q.question_type !== 'FILL_IN_THE_BLANK' && (
                                    <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                                        Correct answer: {q.correct_answer}
                                    </p>
                                )}
                                {q.explanation && ( // Conditionally render explanation
                                    <p className="mt-2 text-xs text-muted-foreground border-t pt-2">{q.explanation}</p>
                                )}
                            </div>
                        )
                    })}
                     <Button className="w-full" onClick={handleRestartQuiz}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Take Quiz Again
                    </Button>
                </div>
            )}

          </CardContent>
        </Card>
      </main>
    </div>
  );
}