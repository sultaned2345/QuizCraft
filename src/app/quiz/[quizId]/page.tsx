// src/app/quiz/[quizId]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseHelpers } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'; // <-- ADDED
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Share2,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Eye,
  Sparkles,
  LogOut,
  Timer,
} from 'lucide-react';
import { Quiz, Question } from '@/types/database';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';

// Define a type for storing user answers
type UserAnswer = {
  questionId: string;
  selectedAnswer: string; // For MATCHING, this will be a stringified array
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

  const [viewMode, setViewMode] = useState<'quiz' | 'results' | 'review'>(
    'quiz'
  );

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // --- MODIFICATION: Added state for MATCHING questions ---
  const [matchingAnswers, setMatchingAnswers] = useState<string[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  // --- END MODIFICATION ---

  const { user, loading: authLoading, session } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const quizId = params.quizId as string;

  const saveAttempt = useCallback(
    async (score: number, total: number) => {
      if (!session || !quizId) {
        console.warn('No session or quizId, cannot save attempt.');
        return;
      }

      try {
        const response = await fetch('/api/quiz/attempt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            quizId: quizId,
            score: score,
            total: total,
          }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to save attempt');
        }

        console.log('Quiz attempt saved successfully.');
      } catch (error) {
        console.error('Error saving quiz attempt:', error);
      }
    },
    [session, quizId]
  );

  const handleQuizEnd = useCallback(() => {
    if (viewMode === 'results') return;

    const finalScore = userAnswers.filter((a) => a.isCorrect).length;
    if (questions.length > 0) {
      saveAttempt(finalScore, questions.length);
    }
    setViewMode('results');
  }, [userAnswers, questions, saveAttempt, viewMode]);

  const loadQuizData = useCallback(async () => {
    if (!user || !quizId) return;

    setIsLoading(true);
    setError('');
    try {
      console.log(
        `[QuizPage loadQuizData] Calling supabaseHelpers.getQuiz for ID: ${quizId} with User ID: ${user.id}`
      );
      const quizData = await supabaseHelpers.getQuiz(quizId);

      console.log(
        `[QuizPage loadQuizData] Received quizData:`,
        quizData ? `Title: ${quizData.title}` : null
      );

      if (!quizData) {
        console.log(
          '[QuizPage loadQuizData] Setting error: Quiz not found or no permission.'
        );
        setError('Quiz not found or you may not have permission to view it.');
        setQuiz(null);
        setQuestions([]);
      } else if (!quizData.questions || quizData.questions.length === 0) {
        console.log(
          '[QuizPage loadQuizData] Setting error: Quiz found but no questions.'
        );
        setError('This quiz exists but has no questions yet.');
        setQuiz(quizData);
        setQuestions([]);
      } else {
        console.log(
          `[QuizPage loadQuizData] Success: Found quiz "${quizData.title}" with ${quizData.questions.length} questions.`
        );
        setQuiz(quizData);
        setQuestions(quizData.questions);
        if (quizData.time_limit_minutes) {
          setTimeLeft(quizData.time_limit_minutes * 60);
        }
      }
    } catch (err: any) {
      console.error('[QuizPage loadQuizData] Error caught during fetch:', err);
      setError(
        err.message || 'An unexpected error occurred while fetching the quiz.'
      );
      setQuiz(null);
      setQuestions([]);
    } finally {
      console.log('[QuizPage loadQuizData] Setting isLoading to false.');
      setIsLoading(false);
    }
  }, [user, quizId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!authLoading && user && quizId) {
      loadQuizData();
    }
  }, [user, authLoading, quizId, router, loadQuizData]);

  useEffect(() => {
    if (timeLeft === null || timeLeft === 0 || viewMode !== 'quiz') return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          toast({
            title: "Time's Up!",
            description: 'Your quiz is being submitted automatically.',
            variant: 'destructive',
          });
          handleQuizEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, viewMode, toast, handleQuizEnd]);

  // --- MODIFICATION: Reset state on question change ---
  useEffect(() => {
    const currentQuestion = questions[currentQuestionIndex];
    if (currentQuestion?.question_type === 'MATCHING') {
      const prompts = currentQuestion.prompts;
      setMatchingAnswers(
        Array(Array.isArray(prompts) ? prompts.length : 0).fill('')
      );
      // Shuffle options for display
      const options = Array.isArray(currentQuestion.options)
        ? currentQuestion.options
        : [];
      setShuffledOptions([...options].sort(() => Math.random() - 0.5));
    } else {
      setMatchingAnswers([]);
      setShuffledOptions([]);
    }
    // Reset other answer states
    setSelectedAnswer(null);
    setFillInBlankAnswer('');
    setIsAnswered(false);
  }, [currentQuestionIndex, questions]);
  // --- END MODIFICATION ---

  // --- MODIFICATION: Updated answer selection logic ---
  const handleAnswerSelect = (answer: string) => {
    if (isAnswered) return;
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    let isCorrect = false;
    let selectedAnswerForStorage = answer;

    switch (currentQuestion.question_type) {
      case 'MULTIPLE_CHOICE':
      case 'TRUE_FALSE':
        isCorrect =
          answer.toLowerCase().trim() ===
          (currentQuestion.correct_answer || '').toLowerCase().trim();
        break;

      case 'FILL_IN_THE_BLANK':
        const validAnswers = Array.isArray(currentQuestion.options)
          ? currentQuestion.options
          : [];
        isCorrect = validAnswers.some(
          (opt) => opt.toLowerCase().trim() === answer.toLowerCase().trim()
        );
        selectedAnswerForStorage = answer.trim(); // Store the user's typed answer
        break;

      case 'MATCHING':
        try {
          const userAnswersArray = JSON.parse(answer) as string[];
          const correctAnswersArray = Array.isArray(currentQuestion.options)
            ? currentQuestion.options
            : [];
          isCorrect =
            userAnswersArray.length === correctAnswersArray.length &&
            userAnswersArray.every((ans, i) => ans === correctAnswersArray[i]);
          selectedAnswerForStorage = answer; // Store the stringified array
        } catch (e) {
          console.error('Failed to parse matching answers', e);
          isCorrect = false;
        }
        break;

      default:
        isCorrect =
          answer.toLowerCase().trim() ===
          (currentQuestion.correct_answer || '').toLowerCase().trim();
    }

    setSelectedAnswer(selectedAnswerForStorage);
    setIsAnswered(true);
    setUserAnswers([
      ...userAnswers,
      {
        questionId: currentQuestion.id,
        selectedAnswer: selectedAnswerForStorage,
        isCorrect,
      },
    ]);
  };
  // --- END MODIFICATION ---

  // --- MODIFICATION: Simplified next question logic ---
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      handleQuizEnd();
    }
  };
  // --- END MODIFICATION ---

  // --- MODIFICATION: Simplified restart logic ---
  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    if (quiz?.time_limit_minutes) {
      setTimeLeft(quiz.time_limit_minutes * 60);
    } else {
      setTimeLeft(null);
    }
    setViewMode('quiz');
    // useEffect on currentQuestionIndex will handle resetting answer states
  };
  // --- END MODIFICATION ---

  // --- NEW: Handler for MATCHING dropdowns ---
  const handleMatchingAnswerChange = (
    promptIndex: number,
    selectedAnswer: string
  ) => {
    if (isAnswered) return;
    const newAnswers = [...matchingAnswers];
    newAnswers[promptIndex] = selectedAnswer;
    setMatchingAnswers(newAnswers);
  };
  // --- END NEW ---

  const renderQuestion = () => {
    if (!questions[currentQuestionIndex]) {
      console.error(
        `[renderQuestion] Attempted to render question at index ${currentQuestionIndex}, but it's undefined.`
      );
      return <p>Error: Could not load question data.</p>;
    }

    const question = questions[currentQuestionIndex];
    switch (question.question_type) {
      case 'MULTIPLE_CHOICE':
        const options = Array.isArray(question.options) ? question.options : [];
        if (options.length === 0)
          console.warn(
            `[renderQuestion] MULTIPLE_CHOICE question (ID: ${question.id}) has no options.`
          );
        return (
          <div className="space-y-2">
            {options.map((option, index) => (
              <Button
                key={index}
                variant="outline"
                className={`w-full justify-start h-auto p-4 text-left whitespace-normal ${
                  isAnswered && option === question.correct_answer
                    ? 'bg-green-100 border-green-400 dark:bg-green-900/50'
                    : ''
                } ${
                  isAnswered &&
                  selectedAnswer === option &&
                  option !== question.correct_answer
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
            {['True', 'False'].map((option, index) => (
              <Button
                key={index}
                variant="outline"
                className={`w-full justify-start h-auto p-4 text-left whitespace-normal ${
                  isAnswered && option === question.correct_answer
                    ? 'bg-green-100 border-green-400 dark:bg-green-900/50'
                    : ''
                } ${
                  isAnswered &&
                  selectedAnswer === option &&
                  option !== question.correct_answer
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
      case 'FILL_IN_THE_BLANK':
        return (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={fillInBlankAnswer}
                onChange={(e) => setFillInBlankAnswer(e.target.value)}
                placeholder="Type your answer here..."
                disabled={isAnswered}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAnswered) {
                    e.preventDefault();
                    handleAnswerSelect(fillInBlankAnswer);
                  }
                }}
              />
              <Button
                onClick={() => handleAnswerSelect(fillInBlankAnswer)}
                disabled={isAnswered}
              >
                Submit
              </Button>
            </div>
          </div>
        );
      // --- MODIFICATION: Added MATCHING UI ---
      case 'MATCHING':
        const prompts = Array.isArray(question.prompts) ? question.prompts : [];
        if (prompts.length === 0) {
          console.warn(
            `[renderQuestion] MATCHING question (ID: ${question.id}) has no prompts.`
          );
          return <p>Error: This matching question is set up incorrectly.</p>;
        }
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              {prompts.map((prompt, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row items-center gap-2"
                >
                  <div className="p-3 border rounded-md bg-muted w-full sm:w-1/2 break-words">
                    {prompt}
                  </div>
                  <Select
                    value={matchingAnswers[index] || ''}
                    onValueChange={(value) =>
                      handleMatchingAnswerChange(index, value)
                    }
                    disabled={isAnswered}
                  >
                    <SelectTrigger className="w-full sm:w-1/2">
                      <SelectValue placeholder="Select an answer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {shuffledOptions.map((option, optIndex) => (
                        <SelectItem key={optIndex} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Button
              onClick={() => handleAnswerSelect(JSON.stringify(matchingAnswers))} // Pass answers as string
              disabled={isAnswered || matchingAnswers.some((a) => a === '')}
            >
              Submit
            </Button>
          </div>
        );
      // --- END MODIFICATION ---
      default:
        console.error(
          `[renderQuestion] Unsupported question type encountered: ${question.question_type} for question ID: ${question.id}`
        );
        return <p>Error: Unsupported question type.</p>;
    }
  };

  if (isLoading || authLoading) {
    console.log(
      '[QuizPage Render] Showing loading spinner (isLoading || authLoading).'
    );
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    console.log(`[QuizPage Render] Showing error message: "${error}"`);
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8 md:py-12 text-center">
          <p className="text-destructive font-semibold">{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </main>
      </div>
    );
  }

  if (!quiz) {
    console.error(
      '[QuizPage Render] Reached render return, but quiz is null and no error is set. This should not happen.'
    );
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-destructive">
          An unexpected error occurred. Could not load quiz data.
        </p>
      </div>
    );
  }

  console.log(
    `[QuizPage Render] Rendering quiz "${quiz.title}" in viewMode: ${viewMode}`
  );

  const score = userAnswers.filter((a) => a.isCorrect).length;
  const currentQuestion = questions[currentQuestionIndex];
  const minutes = timeLeft ? Math.floor(timeLeft / 60) : 0;
  const seconds = timeLeft ? timeLeft % 60 : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 md:py-12">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{quiz.title}</CardTitle>
            {viewMode === 'quiz' && (
              <>
                <div className="flex justify-between items-center pt-1">
                  <CardDescription>
                    Question {currentQuestionIndex + 1} of{' '}
                    {questions.length > 0 ? questions.length : 0}
                  </CardDescription>
                  {quiz.time_limit_minutes && timeLeft !== null && (
                    <CardDescription
                      className={cn(
                        'flex items-center font-medium',
                        timeLeft <= 60 && 'text-destructive'
                      )}
                    >
                      <Timer className="w-4 h-4 mr-1.5" />
                      {minutes}:{String(seconds).padStart(2, '0')}
                    </CardDescription>
                  )}
                </div>
                <Progress
                  value={
                    questions.length > 0
                      ? ((currentQuestionIndex + 1) / questions.length) * 100
                      : 0
                  }
                  className="mt-2"
                />
              </>
            )}
          </CardHeader>
          <CardContent>
            {/* Handle quiz view */}
            {viewMode === 'quiz' && questions.length > 0 && currentQuestion && (
              <div>
                {currentQuestion.question_type === 'FILL_IN_THE_BLANK' ? (
                  <div
                    className="text-lg font-semibold mb-4"
                    dangerouslySetInnerHTML={{
                      __html: currentQuestion.question_text.replace(
                        /____/g,
                        '<strong>[BLANK]</strong>'
                      ),
                    }}
                  />
                ) : (
                  <div className="text-lg font-semibold mb-4">
                    {currentQuestion.question_text}
                  </div>
                )}

                {renderQuestion()}

                {/* --- MODIFICATION: Updated Feedback Block --- */}
                {isAnswered && currentQuestion && (
                  <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {userAnswers.find(
                      (a) => a.questionId === currentQuestion.id
                    )?.isCorrect ? (
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
                        {currentQuestion.question_type ===
                          'FILL_IN_THE_BLANK' && (
                          <p className="text-sm mt-1">
                            Accepted answers:{' '}
                            {(Array.isArray(currentQuestion.options)
                              ? currentQuestion.options
                              : []
                            ).join(', ')}
                          </p>
                        )}
                        {currentQuestion.question_type === 'MATCHING' && (
                          <p className="text-sm mt-1">
                            Check the review section at the end for correct
                            pairs.
                          </p>
                        )}
                        {(currentQuestion.question_type === 'MULTIPLE_CHOICE' ||
                          currentQuestion.question_type === 'TRUE_FALSE') && (
                          <p className="text-sm mt-1">
                            Correct answer: {currentQuestion.correct_answer}
                          </p>
                        )}
                      </div>
                    )}

                    {currentQuestion.explanation && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {currentQuestion.explanation}
                      </p>
                    )}

                    <Button
                      className="mt-4 w-full"
                      onClick={handleNextQuestion}
                    >
                      {currentQuestionIndex < questions.length - 1
                        ? 'Next Question'
                        : 'Finish Quiz'}
                    </Button>
                  </div>
                )}
                {/* --- END MODIFICATION --- */}
              </div>
            )}

            {/* Handle empty quiz */}
            {viewMode === 'quiz' && questions.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <p>This quiz currently has no questions.</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push('/dashboard')}
                >
                  Back to Dashboard
                </Button>
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
                  <Button
                    variant="outline"
                    onClick={() => setViewMode('review')}
                    disabled={questions.length === 0}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Review Answers
                  </Button>
                </div>
              </div>
            )}

            {/* --- MODIFICATION: Updated Review View --- */}
            {viewMode === 'review' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-center">
                  Review Your Answers
                </h2>
                {questions.map((q, index) => {
                  const userAnswer = userAnswers.find(
                    (a) => a.questionId === q.id
                  );
                  const isCorrect = userAnswer?.isCorrect;

                  return (
                    <div
                      key={q.id}
                      className={cn(
                        'p-4 rounded-lg border',
                        isCorrect
                          ? 'border-green-500/50 bg-green-500/5'
                          : 'border-destructive/50 bg-destructive/5'
                      )}
                    >
                      <p
                        className="font-semibold"
                        dangerouslySetInnerHTML={{
                          __html: `${index + 1}. ${q.question_text.replace(
                            /____/g,
                            `<strong>[BLANK]</strong>` // Show blank in review
                          )}`,
                        }}
                      ></p>

                      {q.question_type === 'MATCHING' ? (
                        <div className="mt-2 text-sm">
                          <p
                            className={cn(
                              isCorrect
                                ? 'text-green-700 dark:text-green-400'
                                : 'text-destructive'
                            )}
                          >
                            Your submission was {isCorrect ? 'Correct' : 'Incorrect'}.
                          </p>
                          <div className="mt-2 space-y-1">
                            <h4 className="font-medium">Correct Pairs:</h4>
                            {(Array.isArray(q.prompts) ? q.prompts : []).map(
                              (prompt, i) => (
                                <p key={i} className="text-muted-foreground">
                                  {prompt} &rarr;{' '}
                                  {Array.isArray(q.options) ? q.options[i] : 'N/A'}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                      ) : q.question_type === 'FILL_IN_THE_BLANK' ? (
                        <div className="mt-2 text-sm">
                          <p
                            className={cn(
                              isCorrect
                                ? 'text-green-700 dark:text-green-400'
                                : 'text-destructive'
                            )}
                          >
                            Your answer: {userAnswer?.selectedAnswer || 'Not answered'}
                          </p>
                          {!isCorrect && (
                            <p className="mt-1 text-green-700 dark:text-green-400">
                              Accepted answers:{' '}
                              {(Array.isArray(q.options) ? q.options : []).join(
                                ', '
                              )}
                            </p>
                          )}
                        </div>
                      ) : (
                        // MC and T/F
                        <div className="mt-2 text-sm">
                          <p
                            className={cn(
                              isCorrect
                                ? 'text-green-700 dark:text-green-400'
                               : 'text-destructive'
                            )}
                          >
                            Your answer: {userAnswer?.selectedAnswer || 'Not answered'}
                          </p>
                          {!isCorrect && (
                            <p className="mt-1 text-green-700 dark:text-green-400">
                              Correct answer: {q.correct_answer}
                            </p>
                          )}
                        </div>
                      )}

                      {q.explanation && (
                        <p className="mt-2 text-xs text-muted-foreground border-t pt-2">
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
                <Button className="w-full" onClick={handleRestartQuiz}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Take Quiz Again
                </Button>
              </div>
            )}
            {/* --- END MODIFICATION --- */}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}