// src/app/quiz/[quizId]/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { fetcher } from '@/lib/fetcher';
import useSWR from 'swr';
import { Quiz, Question, ApiResponse } from '@/types/database';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  AlertCircle,
  Trophy,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  RefreshCcw,
  BookOpen,
  Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
interface QuizData {
  quiz: Quiz;
  questions: Question[];
}

type AnswerStatus = 'unanswered' | 'correct' | 'incorrect';
type QuizQuestion = Question & { shuffledOptions?: string[] };

// --- Helpers ---
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// ---------------------------------------------------------------------------
// SUB-COMPONENT: Ordering Question UI
// ---------------------------------------------------------------------------
function OrderingQuestionUI({
  question,
  answerStatus,
  onQuestionComplete,
}: {
  question: QuizQuestion;
  answerStatus: AnswerStatus;
  onQuestionComplete: (isCorrect: boolean) => void;
}) {
  const [currentOrder, setCurrentOrder] = useState<string[]>([]);

  useEffect(() => {
    if (question.shuffledOptions) {
      setCurrentOrder([...question.shuffledOptions]);
    } else if (question.options && Array.isArray(question.options)) {
        setCurrentOrder([...question.options]);
    }
  }, [question]);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (answerStatus !== 'unanswered') return;

    const newOrder = [...currentOrder];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;

    if (swapIndex < 0 || swapIndex >= newOrder.length) return;

    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    setCurrentOrder(newOrder);
  };

  const handleSubmit = () => {
    if (answerStatus !== 'unanswered') return;
    const correctOrder = question.options as string[];
    const isCorrect = JSON.stringify(currentOrder) === JSON.stringify(correctOrder);
    onQuestionComplete(isCorrect);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {currentOrder.map((item, index) => {
          const correctOrder = question.options as string[];
          const isSlotCorrect = correctOrder[index] === item;
          let itemClass = 'bg-card border-border hover:bg-accent/50';
          
          if (answerStatus === 'correct') {
            itemClass = 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400';
          } else if (answerStatus === 'incorrect') {
            itemClass = isSlotCorrect
              ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
              : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400';
          }

          return (
            <div
              key={`${item}-${index}`}
              className={cn(
                'flex items-center gap-3 p-3 border rounded-md transition-all duration-200',
                itemClass
              )}
            >
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={() => moveItem(index, 'up')}
                  disabled={index === 0 || answerStatus !== 'unanswered'}
                >
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={() => moveItem(index, 'down')}
                  disabled={index === currentOrder.length - 1 || answerStatus !== 'unanswered'}
                >
                  <ArrowDown className="w-3 h-3" />
                </Button>
              </div>
              <span className="flex-1 text-sm font-medium">{item}</span>
              {answerStatus !== 'unanswered' &&
                (isSlotCorrect ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <X className="w-4 h-4 text-red-500" />
                ))}
            </div>
          );
        })}
      </div>
      {answerStatus === 'unanswered' && (
        <Button className="w-full mt-4" onClick={handleSubmit}>
          Confirm Order
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUB-COMPONENT: Matching Question UI
// ---------------------------------------------------------------------------
function MatchingQuestionUI({
  question,
  answerStatus,
  onQuestionComplete,
}: {
  question: QuizQuestion;
  answerStatus: AnswerStatus;
  onQuestionComplete: (isCorrect: boolean) => void;
}) {
  const [selectedPromptIdx, setSelectedPromptIdx] = useState<number | null>(null);
  const [userMatches, setUserMatches] = useState<(number | null)[]>([]);

  const { prompts, options: correctOptions, shuffledOptions } = useMemo(() => ({
      prompts: (question.prompts as string[]) || [],
      options: (question.options as string[]) || [],
      shuffledOptions: question.shuffledOptions || [],
    }), [question]);

  useEffect(() => {
    setUserMatches(new Array(prompts.length).fill(null));
    setSelectedPromptIdx(null);
  }, [prompts]);

  const handlePromptClick = (promptIdx: number) => {
    if (answerStatus !== 'unanswered') return;
    if (userMatches[promptIdx] !== null) {
      const newUserMatches = [...userMatches];
      newUserMatches[promptIdx] = null;
      setUserMatches(newUserMatches);
      setSelectedPromptIdx(promptIdx); 
    } else {
      setSelectedPromptIdx(promptIdx);
    }
  };

  const handleOptionClick = (optionIdx: number) => {
    if (answerStatus !== 'unanswered' || selectedPromptIdx === null) return;
    const newUserMatches = [...userMatches];
    // Remove if already used elsewhere
    const existingMatchIdx = newUserMatches.indexOf(optionIdx);
    if (existingMatchIdx > -1) newUserMatches[existingMatchIdx] = null;
    
    newUserMatches[selectedPromptIdx] = optionIdx;
    setUserMatches(newUserMatches);
    setSelectedPromptIdx(null);
  };

  const handleReset = () => {
    if (answerStatus !== 'unanswered') return;
    setUserMatches(new Array(prompts.length).fill(null));
    setSelectedPromptIdx(null);
  };

  const handleSubmit = () => {
    if (answerStatus !== 'unanswered') return;
    let correctCount = 0;
    for (let pIdx = 0; pIdx < prompts.length; pIdx++) {
      const correctAns = correctOptions[pIdx];
      const userOptionIdx = userMatches[pIdx];
      if (userOptionIdx !== null) {
        if (shuffledOptions[userOptionIdx] === correctAns) correctCount++;
      }
    }
    onQuestionComplete(correctCount === prompts.length);
  };

  const allMatched = useMemo(() => userMatches.every((m) => m !== null), [userMatches]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground font-medium uppercase">Match Items</span>
        {answerStatus === 'unanswered' && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 text-xs">
            <RefreshCcw className="w-3 h-3 mr-1" /> Reset
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {prompts.map((prompt, pIdx) => {
            const isSelected = selectedPromptIdx === pIdx;
            const isMatched = userMatches[pIdx] !== null;
            let stateClass = 'border-border bg-card hover:bg-accent/50';

            if (answerStatus === 'unanswered') {
              if (isSelected) stateClass = 'border-primary ring-1 ring-primary bg-primary/5';
              else if (isMatched) stateClass = 'border-primary/50 bg-primary/5 text-primary';
            } else {
              const correctAns = correctOptions[pIdx];
              const userAns = userMatches[pIdx] !== null ? shuffledOptions[userMatches[pIdx]!] : null;
              stateClass = userAns === correctAns 
                ? 'border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400' 
                : 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400';
            }

            return (
              <div key={pIdx} 
                onClick={() => handlePromptClick(pIdx)}
                className={cn(
                  'cursor-pointer rounded-lg border p-3 text-sm transition-all',
                  stateClass,
                  answerStatus !== 'unanswered' && 'cursor-default'
                )}
              >
                <span className="font-mono text-xs opacity-50 mr-2">{pIdx + 1}.</span>
                {prompt}
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          {shuffledOptions.map((option, oIdx) => {
            const isMatched = userMatches.includes(oIdx);
            let stateClass = 'border-border bg-card hover:bg-accent/50';

            if (answerStatus === 'unanswered') {
              if (isMatched) stateClass = 'border-primary/50 bg-primary/5 opacity-50';
            } else {
              // Find which prompt matched this option
              const promptIdx = userMatches.indexOf(oIdx);
              if (promptIdx > -1) {
                 const correctAns = correctOptions[promptIdx];
                 stateClass = option === correctAns 
                  ? 'border-green-500/50 bg-green-500/10' 
                  : 'border-red-500/50 bg-red-500/10';
              }
            }

            return (
              <div key={oIdx}
                onClick={() => handleOptionClick(oIdx)}
                className={cn(
                  'cursor-pointer rounded-lg border p-3 text-sm transition-all',
                  stateClass,
                  answerStatus === 'unanswered' && selectedPromptIdx === null && 'opacity-50 cursor-not-allowed',
                  answerStatus !== 'unanswered' && 'cursor-default'
                )}
              >
                {option}
              </div>
            );
          })}
        </div>
      </div>

      {answerStatus === 'unanswered' && (
        <Button className="w-full" disabled={!allMatched} onClick={handleSubmit}>
          Submit Matches
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN PAGE COMPONENT
// ---------------------------------------------------------------------------
export default function TakeQuizPage() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>('unanswered');
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [showHint, setShowHint] = useState(false);

  const router = useRouter();
  const params = useParams();
  const quizId = params.quizId as string;
  const { session } = useAuth();
  const isValidQuizId = quizId && quizId !== 'null' && quizId !== 'undefined';

  const { data: apiResponse, error, isLoading } = useSWR<ApiResponse<QuizData>>(
    session && isValidQuizId ? `/api/quiz/${quizId}` : null,
    (url: string) => fetcher(url, { headers: { Authorization: `Bearer ${session!.access_token}` } }),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (apiResponse?.data?.questions) {
      const qData = apiResponse.data;
      const shuffledQuestions = shuffleArray(qData.questions).map(q => {
        if (q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
          return { ...q, options: shuffleArray(q.options as string[]) };
        }
        if (['MATCHING', 'ORDERING'].includes(q.question_type) && Array.isArray(q.options)) {
          return { ...q, shuffledOptions: shuffleArray(q.options as string[]) };
        }
        return q;
      });
      setQuizQuestions(shuffledQuestions as QuizQuestion[]);
    }
  }, [apiResponse]);

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const progress = quizQuestions.length > 0 ? ((currentQuestionIndex) / quizQuestions.length) * 100 : 0;

  const handleAnswerSelect = (answer: string) => {
    if (answerStatus !== 'unanswered') return;
    const answerTrimmed = answer.trim();
    setSelectedAnswer(answerTrimmed);

    let isCorrect = false;
    if (['MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(currentQuestion.question_type)) {
      isCorrect = currentQuestion.correct_answer === answerTrimmed;
    } else if (currentQuestion.question_type === 'FILL_IN_THE_BLANK') {
      const correctAnswers = (currentQuestion.options as string[]) || [];
      isCorrect = correctAnswers.length > 0 
        ? correctAnswers.some(a => a.toLowerCase() === answerTrimmed.toLowerCase())
        : currentQuestion.correct_answer.toLowerCase() === answerTrimmed.toLowerCase();
    }

    setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) setCorrectAnswers(prev => prev + 1);
  };

  const handleComplexQuestionComplete = (isCorrect: boolean) => {
    setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) setCorrectAnswers(prev => prev + 1);
  };

  const handleNext = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setAnswerStatus('unanswered');
      setShowHint(false);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    setIsFinished(true);
    if (session && isValidQuizId) {
      fetch('/api/quiz/attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ quizId, score: correctAnswers, total: quizQuestions.length }),
      }).catch(console.error);
    }
  };

  const getOptionClass = (optionText: string) => {
    if (answerStatus === 'unanswered') return 'hover:border-primary/50 hover:bg-accent/50 cursor-pointer';
    if (currentQuestion.correct_answer === optionText) return 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400';
    if (selectedAnswer === optionText) return 'border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400';
    return 'opacity-50';
  };

  if (!isValidQuizId || error) return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <p className="text-muted-foreground">Quiz not found</p>
      <Button onClick={() => router.push('/dashboard')}>Return Home</Button>
    </div>
  );

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading quiz...</p>
      </div>
    </div>
  );

  // --- RESULTS SCREEN ---
  if (isFinished) {
    const scorePercentage = Math.round((correctAnswers / quizQuestions.length) * 100);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-2 shadow-2xl">
          <CardContent className="pt-10 pb-8 flex flex-col items-center text-center space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <div className="bg-background relative p-4 rounded-full border-2 border-primary/20">
                <Trophy className="w-12 h-12 text-primary" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Quiz Complete</h2>
              <p className="text-muted-foreground">Here is how you performed</p>
            </div>

            <div className="flex items-end justify-center gap-2">
              <span className="text-6xl font-bold tracking-tighter">{scorePercentage}%</span>
              <span className="text-xl text-muted-foreground font-medium mb-2">/ 100</span>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="bg-muted/50 p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase font-bold">Correct</p>
                <p className="text-xl font-semibold text-green-600 dark:text-green-400">{correctAnswers}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase font-bold">Total</p>
                <p className="text-xl font-semibold">{quizQuestions.length}</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 pb-8">
            <Button onClick={() => window.location.reload()} className="w-full" size="lg">
              <RefreshCcw className="w-4 h-4 mr-2" /> Try Again
            </Button>
            <Button variant="ghost" onClick={() => router.push('/dashboard')} className="w-full">
              Back to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --- QUIZ SCREEN ---
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 text-muted-foreground">
            <X className="w-4 h-4 mr-2" /> Exit
          </Button>
          <div className="flex items-center gap-2 text-sm font-medium">
             <Timer className="w-4 h-4 text-primary" />
             <span>Question {currentQuestionIndex + 1} of {quizQuestions.length}</span>
          </div>
        </div>
        <Progress value={progress} className="h-1 rounded-none" />
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full p-4 md:p-8 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {currentQuestion && (
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0 pb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="outline" className="text-xs font-mono tracking-wider text-muted-foreground uppercase">
                      {currentQuestion.question_type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <h3 className="text-xl md:text-2xl font-semibold leading-relaxed">
                    {currentQuestion.question_text}
                  </h3>
                </CardHeader>

                <CardContent className="px-0 space-y-6">
                  {/* Question Inputs */}
                  {['MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(currentQuestion.question_type) && 
                    <div className="grid gap-3">
                      {(currentQuestion.options as string[]).map((option) => (
                        <div
                          key={option}
                          onClick={() => handleAnswerSelect(option)}
                          className={cn(
                            "flex items-center p-4 rounded-xl border transition-all duration-200 text-sm md:text-base font-medium",
                            getOptionClass(option),
                            answerStatus !== 'unanswered' && 'pointer-events-none'
                          )}
                        >
                          <div className="flex-1">{option}</div>
                          {answerStatus !== 'unanswered' && currentQuestion.correct_answer === option && <Check className="w-5 h-5 text-green-600 dark:text-green-400" />}
                          {answerStatus !== 'unanswered' && selectedAnswer === option && currentQuestion.correct_answer !== option && <X className="w-5 h-5 text-red-600 dark:text-red-400" />}
                        </div>
                      ))}
                    </div>
                  }

                  {currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                    <div className="space-y-4">
                      <Input 
                        placeholder="Type your answer..." 
                        className="h-12 text-lg"
                        value={selectedAnswer || ''}
                        onChange={(e) => setSelectedAnswer(e.target.value)}
                        disabled={answerStatus !== 'unanswered'}
                        onKeyDown={(e) => e.key === 'Enter' && answerStatus === 'unanswered' && selectedAnswer && handleAnswerSelect(selectedAnswer)}
                      />
                      {answerStatus === 'unanswered' && (
                        <Button onClick={() => handleAnswerSelect(selectedAnswer || '')} disabled={!selectedAnswer}>
                          Submit Answer
                        </Button>
                      )}
                    </div>
                  )}

                  {currentQuestion.question_type === 'MATCHING' && (
                    <MatchingQuestionUI 
                      question={currentQuestion} 
                      answerStatus={answerStatus} 
                      onQuestionComplete={handleComplexQuestionComplete} 
                    />
                  )}
                  
                  {currentQuestion.question_type === 'ORDERING' && (
                    <OrderingQuestionUI 
                      question={currentQuestion} 
                      answerStatus={answerStatus} 
                      onQuestionComplete={handleComplexQuestionComplete} 
                    />
                  )}

                  {/* Feedback Section */}
                  <AnimatePresence>
                    {answerStatus !== 'unanswered' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }}
                        className={cn(
                          "rounded-lg p-4 flex gap-4 text-sm",
                          answerStatus === 'correct' ? "bg-green-50 dark:bg-green-500/10 text-green-900 dark:text-green-300" : "bg-red-50 dark:bg-red-500/10 text-red-900 dark:text-red-300"
                        )}
                      >
                        <div className="shrink-0">
                          {answerStatus === 'correct' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        </div>
                        <div className="space-y-1">
                           <p className="font-semibold">{answerStatus === 'correct' ? 'Correct!' : 'Incorrect'}</p>
                           {answerStatus === 'incorrect' && currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                             <p>Correct answer: <span className="font-mono font-bold">{currentQuestion.correct_answer}</span></p>
                           )}
                           <p className="opacity-90 leading-relaxed">{currentQuestion.explanation}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>

                <CardFooter className="px-0 flex justify-between pt-4">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowHint(true)}
                    disabled={answerStatus !== 'unanswered' || showHint}
                    className={cn(showHint && "text-primary")}
                  >
                    <Lightbulb className="w-4 h-4 mr-2" /> 
                    {showHint ? "Hint revealed" : "Show Hint"}
                  </Button>
                  
                  {/* Hint Reveal */}
                  {showHint && answerStatus === 'unanswered' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute bottom-20 left-0 right-0 mx-4 bg-popover border p-4 rounded-lg shadow-lg text-sm">
                      <p className="font-semibold mb-1 flex items-center gap-2"><Lightbulb className="w-3 h-3 text-yellow-500" /> Hint</p>
                      {currentQuestion.explanation}
                    </motion.div>
                  )}

                  <Button onClick={handleNext} disabled={answerStatus === 'unanswered'} size="lg" className="min-w-[140px]">
                    {currentQuestionIndex === quizQuestions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}