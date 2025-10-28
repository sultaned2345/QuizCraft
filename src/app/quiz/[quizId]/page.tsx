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
import { ArrowLeft, Share2, CheckCircle, XCircle, Loader2, RefreshCw, Eye, Sparkles, LogOut } from 'lucide-react'; // Added Sparkles, LogOut
import { Quiz, Question } from '@/types/database';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle'; // Added ThemeToggle import

// Define a type for storing user answers
type UserAnswer = {
    questionId: string;
    selectedAnswer: string;
    isCorrect: boolean;
};

// Updated DashboardHeader (moved from edit page)
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
        <Sparkles className="w-6 h-6 text-primary" /> {/* Added icon */}
        <span className="text-xl font-bold">QuizCraft</span>
      </Link>
      {user && (
        <div className="flex items-center gap-2"> {/* Added gap-2 */}
            <ThemeToggle /> {/* Added ThemeToggle */}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" /> {/* Added icon and margin */}
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
  
  // New state to manage the view: 'quiz', 'results', 'review'
  const [viewMode, setViewMode] = useState<'quiz' | 'results' | 'review'>('quiz');

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const quizId = params.quizId as string;

  // This useEffect handles fetching the quiz data
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && quizId) {
      // Renamed inner function to avoid conflict
      const loadQuizData = async () => {
        setIsLoading(true);
        setError('');
        try {
          // Call the updated helper function
          const quizData = await supabaseHelpers.getQuiz(quizId); // quizData can now be null
    
          // --- CHANGE HERE: Check if quizData is null ---
          if (quizData && quizData.questions && quizData.questions.length > 0) {
            setQuiz(quizData);
            setQuestions(quizData.questions);
          } else {
            // If quizData is null OR has no questions, set an error
            setError('Quiz not found, has no questions, or you may not have permission to view it.');
            setQuiz(null); // Ensure quiz state is null
            setQuestions([]); // Ensure questions state is empty
          }
        } catch (err: any) { // Catch errors thrown by handleSupabaseError
          console.error("Error fetching quiz data:", err); // Log the actual error
          setError(err.message || 'An unexpected error occurred while fetching the quiz.');
          setQuiz(null);
          setQuestions([]);
        } finally {
          setIsLoading(false);
        }
      };

      loadQuizData(); // Call the fetch function
    }
  }, [user, authLoading, quizId, router]); // Dependencies
  
  const handleAnswerSelect = (answer: string) => {
    if (isAnswered) return;
    const currentQuestion = questions[currentQuestionIndex];
    // Handle potential edge case where correct_answer might be null/undefined
    const isCorrect = answer.toLowerCase().trim() === (currentQuestion?.correct_answer || '').toLowerCase().trim();

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
        // Quiz finished, show results
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
    // Add check to ensure question exists
    if (!questions[currentQuestionIndex]) {
        return <p>Error: Question data is missing.</p>;
    }

    const question = questions[currentQuestionIndex];
    switch (question.question_type) {
      case 'MULTIPLE_CHOICE':
        return (
          <div className="space-y-2">
            {(question.options as string[]).map((option, index) => (
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
                <p className="text-lg mb-4" dangerouslySetInnerHTML={{ __html: question.question_text.replace(/____/g, '<strong>[BLANK]</strong>') }}></p>
                <div className="flex gap-2">
                    <Input
                        value={fillInBlankAnswer}
                        onChange={(e) => setFillInBlankAnswer(e.target.value)}
                        placeholder="Type your answer here..."
                        disabled={isAnswered}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !isAnswered) { e.preventDefault(); handleAnswerSelect(fillInBlankAnswer); } }} // Add Enter key listener
                    />
                    <Button onClick={() => handleAnswerSelect(fillInBlankAnswer)} disabled={isAnswered}>Submit</Button>
                </div>
            </div>
        );
      default:
        return <p>Unsupported question type: {question.question_type}</p>;
    }
  };
  
  // --- ADJUSTED RENDER LOGIC ---
  if (isLoading || authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  // Explicitly render error state if an error occurred during fetch
  if (error) {
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
   
   // If no error, but quiz is still null (e.g., initial state before fetch completes, though loading check should catch this)
   if (!quiz) {
       return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" /> {/* Show loader as fallback */}
            </div>
       );
   }
  // --- END ADJUSTED RENDER LOGIC ---


  const score = userAnswers.filter(a => a.isCorrect).length;
  const currentQuestion = questions[currentQuestionIndex]; // Get current question for feedback block

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
            {viewMode === 'quiz' && (
                <>
                    <CardDescription>
                        Question {currentQuestionIndex + 1} of {questions.length}
                    </CardDescription>
                    <Progress value={((currentQuestionIndex + 1) / questions.length) * 100} className="mt-2" />
                </>
            )}
          </CardHeader>
          <CardContent>
            {viewMode === 'quiz' && questions.length > 0 && currentQuestion && ( // Check currentQuestion
              <div>
                <div className="text-lg font-semibold mb-4" 
                     // Handle FILL_IN_THE_BLANK question text rendering here if not in renderQuestion
                     dangerouslySetInnerHTML={ currentQuestion.question_type === 'FILL_IN_THE_BLANK' 
                        ? { __html: currentQuestion.question_text.replace(/____/g, '<strong>[BLANK]</strong>') }
                        : undefined
                     }
                >
                   {currentQuestion.question_type !== 'FILL_IN_THE_BLANK' && currentQuestion.question_text}
                </div>
                {renderQuestion()}
                {isAnswered && (
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
             {viewMode === 'quiz' && questions.length === 0 && ( // Handle empty quiz
                <div className="text-center text-muted-foreground">
                    <p>This quiz has no questions.</p>
                </div>
             )}


            {viewMode === 'results' && (
              <div className="text-center">
                <h2 className="text-xl font-semibold">Quiz Complete!</h2>
                <p className="text-6xl font-bold my-4">
                  {score} / {questions.length}
                </p>
                <div className="flex justify-center gap-2">
                    <Button onClick={handleRestartQuiz}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                    </Button>
                    <Button variant="outline" onClick={() => setViewMode('review')}>
                        <Eye className="w-4 h-4 mr-2" />
                        Review Answers
                    </Button>
                </div>
              </div>
            )}
            
            {viewMode === 'review' && (
                <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-center">Review Your Answers</h2>
                    {questions.map((q, index) => {
                        const userAnswer = userAnswers.find(a => a.questionId === q.id);
                        const isCorrect = userAnswer?.isCorrect;
                        return (
                            <div key={q.id} className={cn("p-4 rounded-lg border", isCorrect ? "border-green-500/50 bg-green-500/5" : "border-destructive/50 bg-destructive/5")}>
                                <p className="font-semibold">{index + 1}. {q.question_text.replace(/____/g, `[${q.correct_answer}]`)}</p> {/* Show answer in fill-in-blank */}
                                <p className={cn("mt-2 text-sm", isCorrect ? "text-green-700 dark:text-green-400" : "text-destructive")}>
                                    Your answer: {userAnswer?.selectedAnswer || "Not answered"}
                                </p>
                                {!isCorrect && q.question_type !== 'FILL_IN_THE_BLANK' && ( // Don't repeat correct answer if already shown
                                    <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                                        Correct answer: {q.correct_answer}
                                    </p>
                                )}
                                <p className="mt-2 text-xs text-muted-foreground border-t pt-2">{q.explanation}</p>
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
