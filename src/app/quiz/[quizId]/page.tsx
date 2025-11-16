// src/app/quiz/[quizId]/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { fetcher } from '@/lib/fetcher';
import useSWR from 'swr';
import { Quiz, Question, ApiResponse } from '@/types/database'; // Import ApiResponse
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input'; // Import Input
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  ArrowLeft,
  RotateCw,
  Check,
  X,
  AlertCircle,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// This is the shape from /api/quiz/[quizId]
interface QuizData {
  quiz: Quiz;
  questions: Question[];
}

type AnswerStatus = 'unanswered' | 'correct' | 'incorrect';

// Helper function to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; // Swap
  }
  return newArray;
}

export default function TakeQuizPage() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>('unanswered');
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);

  const router = useRouter();
  const params = useParams();
  const quizId = params.quizId as string;
  const { session } = useAuth();

  // Fetch from the GET route we created
  // --- THIS IS THE FIX ---
  const { data, error, isLoading } = useSWR<QuizData>(
  // --- END THE FIX ---
    session ? `/api/quiz/${quizId}` : null,
    (url: string) =>
      fetcher(url, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      }),
    { revalidateOnFocus: false }
  );

  // Shuffle questions and answers on load
  useEffect(() => {
    if (data?.questions && data.questions.length > 0) {
      const shuffledQuestions = shuffleArray(data.questions);

      const questionsWithShuffledOptions = shuffledQuestions.map((q) => {
        // Shuffle options for Multiple Choice
        if (q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
          return {
            ...q,
            options: shuffleArray(q.options as string[]),
          };
        }
        // Shuffle options for Matching (the answer pool)
        if (q.question_type === 'MATCHING' && Array.isArray(q.options)) {
          return {
            ...q,
            options: shuffleArray(q.options as string[]),
          };
        }
        return q;
      });

      setQuizQuestions(questionsWithShuffledOptions);
      // Reset all states
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setAnswerStatus('unanswered');
      setCorrectAnswers(0);
      setIsFinished(false);
    }
  }, [data]);

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const progress =
    quizQuestions.length > 0
      ? ((currentQuestionIndex + 1) / quizQuestions.length) * 100
      : 0;

  const handleAnswerSelect = (answer: string) => {
    if (answerStatus !== 'unanswered') return; // Already answered

    const answerTrimmed = answer.trim();
    setSelectedAnswer(answerTrimmed);

    let isCorrect = false;
    if (
      currentQuestion.question_type === 'MULTIPLE_CHOICE' ||
      currentQuestion.question_type === 'TRUE_FALSE'
    ) {
      isCorrect = currentQuestion.correct_answer === answerTrimmed;
    } else if (currentQuestion.question_type === 'FILL_IN_THE_BLANK') {
      // Correct answers are stored in the 'options' array
      const correctAnswers = (currentQuestion.options as string[]) || [];
      // Case-insensitive check
      isCorrect = correctAnswers.some(
        (a) => a.toLowerCase() === answerTrimmed.toLowerCase()
      );
    }

    if (isCorrect) {
      setAnswerStatus('correct');
      setCorrectAnswers((prev) => prev + 1);
    } else {
      setAnswerStatus('incorrect');
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setAnswerStatus('unanswered');
    } else {
      // Finish quiz
      setIsFinished(true);
    }
  };

  const handleRestart = () => {
    // Just trigger the useEffect
    if (data?.questions && data.questions.length > 0) {
      const shuffledQuestions = shuffleArray(data.questions);
      const questionsWithShuffledOptions = shuffledQuestions.map((q) => {
        if (q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
          return {
            ...q,
            options: shuffleArray(q.options as string[]),
          };
        }
        return q;
      });
      setQuizQuestions(questionsWithShuffledOptions);
    }
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setAnswerStatus('unanswered');
    setCorrectAnswers(0);
    setIsFinished(false);
  };

  const getOptionClass = (optionText: string) => {
    if (answerStatus === 'unanswered') {
      return 'border-border hover:bg-muted/50';
    }

    const isThisCorrect = currentQuestion.correct_answer === optionText;

    if (isThisCorrect) {
      // Is the correct answer
      return 'border-green-500 bg-green-500/10 text-green-700 ring-2 ring-green-500';
    }
    if (selectedAnswer === optionText && !isThisCorrect) {
      // Is the selected, incorrect answer
      return 'border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive';
    }

    // Is neither selected nor correct (an incorrect option)
    return 'border-border opacity-60';
  };
  
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading Quiz...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <AlertCircle className="h-12 w-12 mb-4" />
        <h2 className="text-2xl font-semibold">Failed to Load Quiz</h2>
        <p className="text-center">{error.message}</p>
        <Button onClick={() => router.push('/quizzes')} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quizzes
        </Button>
      </div>
    );
  }

  if (!data || quizQuestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4" />
        <h2 className="text-2xl font-semibold">{data?.quiz.title || 'Quiz'}</h2>
        <p className="text-center">This quiz has no questions in it.</p>
        <Button onClick={() => router.push('/quizzes')} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quizzes
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full items-center py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            onClick={() => router.push('/quizzes')}
            className="pl-0"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Quizzes
          </Button>
          <h1
            className="text-xl font-semibold truncate text-center"
            title={data.quiz.title}
          >
            {data.quiz.title}
          </h1>
          <div className="w-24"></div> {/* Spacer */}
        </div>

        {!isFinished && (
          <div className="flex items-center gap-4 mb-6">
            <span className="text-sm font-medium text-muted-foreground">
              Question {currentQuestionIndex + 1} of {quizQuestions.length}
            </span>
            <Progress value={progress} className="flex-1 h-2" />
          </div>
        )}

        {/* Main Content Area: Quiz or Summary */}
        <AnimatePresence mode="wait">
          {isFinished ? (
            // --- Summary Screen ---
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
              <Card className="w-full max-w-md shadow-lg">
                <CardHeader>
                  <CardTitle className="text-center text-2xl">
                    Quiz Complete!
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <Trophy className="w-16 h-16 text-yellow-500" />
                  <h3 className="text-4xl font-bold mt-4">
                    {correctAnswers} / {quizQuestions.length}
                  </h3>
                  <p className="text-lg text-muted-foreground">
                    Your score:{' '}
                    {Math.round(
                      (correctAnswers / quizQuestions.length) * 100
                    )}
                    %
                  </p>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <Button className="w-full" onClick={handleRestart}>
                    <RotateCw className="mr-2 h-4 w-4" />
                    Take Again
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/quizzes')}
                  >
                    Back to Quizzes
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ) : (
            // --- Question Screen ---
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="shadow-lg">
                <CardContent className="p-6">
                  <p className="text-lg font-semibold mb-4 min-h-[60px]">
                    {currentQuestion.question_text}
                  </p>
                  <div className="space-y-3">
                    
                    {/* --- REBUILT RENDER LOGIC --- */}
                    
                    {/* Multiple Choice */}
                    {currentQuestion.question_type === 'MULTIPLE_CHOICE' &&
                      (currentQuestion.options as string[]).map((option) => (
                        <Button
                          key={option}
                          variant="outline"
                          className={cn(
                            'h-auto min-h-12 w-full justify-start text-left p-4 whitespace-normal',
                            answerStatus !== 'unanswered' &&
                              'pointer-events-none',
                            getOptionClass(option)
                          )}
                          onClick={() => handleAnswerSelect(option)}
                        >
                          <span className="flex-1">{option}</span>
                          {answerStatus !== 'unanswered' &&
                            getOptionClass(option).includes('green') && (
                              <Check className="w-5 h-5 ml-2 text-green-600" />
                            )}
                          {answerStatus !== 'unanswered' &&
                            getOptionClass(option).includes('destructive') && (
                              <X className="w-5 h-5 ml-2 text-destructive" />
                            )}
                        </Button>
                      ))}

                    {/* True/False */}
                    {currentQuestion.question_type === 'TRUE_FALSE' &&
                      ['True', 'False'].map((option) => (
                        <Button
                          key={option}
                          variant="outline"
                          className={cn(
                            'h-12 w-full text-left p-4',
                            answerStatus !== 'unanswered' &&
                              'pointer-events-none',
                            getOptionClass(option)
                          )}
                          onClick={() => handleAnswerSelect(option)}
                        >
                          <span className="flex-1">{option}</span>
                          {answerStatus !== 'unanswered' &&
                            getOptionClass(option).includes('green') && (
                              <Check className="w-5 h-5 ml-2 text-green-600" />
                            )}
                          {answerStatus !== 'unanswered' &&
                            getOptionClass(option).includes('destructive') && (
                              <X className="w-5 h-5 ml-2 text-destructive" />
                            )}
                        </Button>
                      ))}
                      
                    {/* Fill in the Blank */}
                    {currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                      <div className="space-y-3">
                        <Input
                          type="text"
                          placeholder="Type your answer..."
                          value={selectedAnswer || ''}
                          onChange={(e) => setSelectedAnswer(e.target.value)}
                          disabled={answerStatus !== 'unanswered'}
                          className="text-base"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && answerStatus === 'unanswered' && selectedAnswer) {
                              handleAnswerSelect(selectedAnswer.trim());
                            }
                          }}
                        />
                        <Button
                          className="w-full"
                          disabled={answerStatus !== 'unanswered' || !selectedAnswer?.trim()}
                          onClick={() => handleAnswerSelect(selectedAnswer!.trim())}
                        >
                          Submit Answer
                        </Button>
                      </div>
                    )}

                    {/* Matching (Placeholder) */}
                    {currentQuestion.question_type === 'MATCHING' && (
                      <div className="p-4 rounded-md border bg-muted/50 text-muted-foreground text-sm">
                        <p className="font-semibold">Matching Question</p>
                        <p>
                          This question type is not yet supported in the
                          quiz-taker. Please edit this quiz to change the
                          question type.
                        </p>
                      </div>
                    )}
                    
                    {/* --- END REBUILT RENDER LOGIC --- */}
                    
                  </div>

                  {/* Feedback Message */}
                  <AnimatePresence>
                    {answerStatus === 'correct' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 flex items-center font-medium text-green-600"
                      >
                        <Check className="w-5 h-5 mr-2" />
                        That's correct!
                      </motion.div>
                    )}
                    {answerStatus === 'incorrect' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 flex flex-col font-medium text-destructive"
                      >
                        <div className="flex items-center">
                          <X className="w-5 h-5 mr-2" />
                          That's not right.
                        </div>
                        
                        {/* Show correct answer for FITB */}
                        {currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                            <p className="text-sm font-normal text-muted-foreground ml-7 mt-1">
                                Correct answer(s): {(currentQuestion.options as string[]).join(', ')}
                            </p>
                        )}
                        
                        {currentQuestion.explanation && (
                          <p className="text-sm font-normal text-muted-foreground ml-7 mt-1">
                            {currentQuestion.explanation}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
                <CardFooter className="p-6 pt-0 flex justify-end">
                  <Button
                    className="w-full sm:w-auto"
                    disabled={answerStatus === 'unanswered'}
                    onClick={handleNext}
                  >
                    {currentQuestionIndex === quizQuestions.length - 1
                      ? 'Finish Quiz'
                      : 'Next Question'}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}