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
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  ArrowLeft,
  RotateCw,
  Check,
  X,
  AlertCircle,
  Trophy,
  Lightbulb,
  ArrowRight,
  GripHorizontal,
  MousePointerClick
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizData {
  quiz: Quiz;
  questions: Question[];
}

type AnswerStatus = 'unanswered' | 'correct' | 'incorrect';

type QuizQuestion = Question & { shuffledOptions?: string[] };

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// --- REDESIGNED MATCHING COMPONENT ---
function MatchingQuestionUI({
  question,
  answerStatus,
  onQuestionComplete,
}: {
  question: QuizQuestion;
  answerStatus: AnswerStatus;
  onQuestionComplete: (isCorrect: boolean) => void;
}) {
  const [activePromptIdx, setActivePromptIdx] = useState<number | null>(null);
  // userMatches[promptIndex] = shuffledOptionIndex (or null)
  const [userMatches, setUserMatches] = useState<(number | null)[]>([]);

  const {
    prompts,
    correctOptions, // The strict answer key (index matches prompt index)
    shuffledOptions, // The display list of options
  } = useMemo(() => ({
    prompts: (question.prompts as string[]) || [],
    correctOptions: (question.options as string[]) || [],
    shuffledOptions: question.shuffledOptions || [],
  }), [question]);

  useEffect(() => {
    setUserMatches(new Array(prompts.length).fill(null));
    setActivePromptIdx(null);
  }, [prompts]);

  // Handle clicking a Slot (Prompt)
  const handleSlotClick = (pIdx: number) => {
    if (answerStatus !== 'unanswered') return;

    // If matches already exist in this slot, clear it (return option to pool)
    if (userMatches[pIdx] !== null) {
      const newMatches = [...userMatches];
      newMatches[pIdx] = null;
      setUserMatches(newMatches);
      return;
    }

    // Set this slot as "waiting for input"
    setActivePromptIdx(pIdx === activePromptIdx ? null : pIdx);
  };

  // Handle clicking an Option from the Pool
  const handleOptionClick = (oIdx: number) => {
    if (answerStatus !== 'unanswered') return;

    // If a slot is active, fill it
    if (activePromptIdx !== null) {
      const newMatches = [...userMatches];
      newMatches[activePromptIdx] = oIdx;
      setUserMatches(newMatches);
      setActivePromptIdx(null); // Clear active state
    } 
    // If no slot is active, find the first empty slot and fill it (auto-advance)
    else {
        const firstEmptyIndex = userMatches.findIndex(m => m === null);
        if (firstEmptyIndex !== -1) {
            const newMatches = [...userMatches];
            newMatches[firstEmptyIndex] = oIdx;
            setUserMatches(newMatches);
        }
    }
  };

  const handleSubmit = () => {
    let correctCount = 0;
    for (let pIdx = 0; pIdx < prompts.length; pIdx++) {
      const correctAns = correctOptions[pIdx];
      const userOptionIdx = userMatches[pIdx];
      if (userOptionIdx !== null) {
        const userAns = shuffledOptions[userOptionIdx];
        if (userAns === correctAns) {
          correctCount++;
        }
      }
    }
    // All must be correct
    onQuestionComplete(correctCount === prompts.length);
  };

  const allMatched = userMatches.every((m) => m !== null);
  const availableOptions = shuffledOptions.map((opt, idx) => ({ opt, idx })).filter(
    item => !userMatches.includes(item.idx)
  );

  return (
    <div className="space-y-6">
        {/* Instructions */}
        {answerStatus === 'unanswered' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
                <MousePointerClick className="w-3.5 h-3.5" />
                <span>Tap a slot to activate it, then tap an option to fill it.</span>
            </div>
        )}

      {/* --- Slots (Prompts) --- */}
      <div className="space-y-3">
        {prompts.map((prompt, pIdx) => {
          const userOptionIdx = userMatches[pIdx];
          const isFilled = userOptionIdx !== null;
          const isActive = activePromptIdx === pIdx;
          
          let statusColor = "border-border";
          if (answerStatus === 'correct') statusColor = "border-green-500 bg-green-50 dark:bg-green-950/20";
          if (answerStatus === 'incorrect') {
             // Check individual match correctness
             const userAns = isFilled ? shuffledOptions[userOptionIdx] : null;
             const correctAns = correctOptions[pIdx];
             statusColor = userAns === correctAns 
                ? "border-green-500 bg-green-50 dark:bg-green-950/20" 
                : "border-red-500 bg-red-50 dark:bg-red-950/20";
          }
          if (answerStatus === 'unanswered' && isActive) statusColor = "border-primary ring-1 ring-primary";

          return (
            <div 
                key={pIdx}
                onClick={() => handleSlotClick(pIdx)}
                className={cn(
                    "relative flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-muted/50",
                    statusColor
                )}
            >
                {/* Prompt Text */}
                <div className="flex-1 font-medium text-sm sm:text-base flex items-center gap-3">
                    <span className="bg-muted text-muted-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0">
                        {pIdx + 1}
                    </span>
                    {prompt}
                </div>

                {/* The "Slot" Area */}
                <div className={cn(
                    "flex-1 min-h-[40px] rounded-md border-2 border-dashed flex items-center px-3 text-sm transition-colors",
                    isActive ? "border-primary bg-primary/5" : "border-muted-foreground/20",
                    isFilled ? "border-solid border-primary/50 bg-background" : "bg-muted/10"
                )}>
                    {isFilled ? (
                        <div className="flex items-center justify-between w-full">
                            <span className="font-medium text-primary">{shuffledOptions[userOptionIdx]}</span>
                            {answerStatus === 'unanswered' && <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />}
                        </div>
                    ) : (
                        <span className="text-muted-foreground/40 italic text-xs">Tap to fill...</span>
                    )}
                </div>
            </div>
          );
        })}
      </div>

      {/* --- Option Pool (Draggable-like Chips) --- */}
      {answerStatus === 'unanswered' && (
          <div className="p-4 bg-muted/30 rounded-xl border">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                <GripHorizontal className="w-3.5 h-3.5" /> Available Options
            </h4>
            {availableOptions.length === 0 ? (
                <div className="text-sm text-muted-foreground italic text-center py-2">
                    All slots filled. Ready to submit?
                </div>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {availableOptions.map(({ opt, idx }) => (
                        <Button
                            key={idx}
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOptionClick(idx)}
                            className="shadow-sm hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                            {opt}
                        </Button>
                    ))}
                </div>
            )}
          </div>
      )}

      {/* --- Correction View (Only when Incorrect) --- */}
      {answerStatus === 'incorrect' && (
          <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-sm">
             <div className="font-semibold text-red-700 dark:text-red-400 mb-2">Correct Matches:</div>
             <ul className="space-y-1 list-disc list-inside text-red-600 dark:text-red-300">
                 {prompts.map((p, i) => (
                     <li key={i}>
                         <span className="font-medium text-foreground/80">{p}</span> → <span className="font-bold">{correctOptions[i]}</span>
                     </li>
                 ))}
             </ul>
          </div>
      )}
      
      {/* Submit Button */}
      {answerStatus === 'unanswered' && (
         <Button
           className="w-full mt-4"
           size="lg"
           disabled={!allMatched}
           onClick={handleSubmit}
         >
           Check Matches
         </Button>
      )}
    </div>
  );
}


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

  const { data: apiResponse, error, isLoading } = useSWR<ApiResponse<QuizData>>(
    session ? `/api/quiz/${quizId}` : null,
    (url: string) =>
      fetcher(url, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      }),
    { revalidateOnFocus: false }
  );

  const quizData = apiResponse?.data;

  useEffect(() => {
    if (quizData?.questions && quizData.questions.length > 0) {
      const shuffledQuestions = shuffleArray(quizData.questions);

      const questionsWithShuffledOptions = shuffledQuestions.map((q) => {
        if (q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
          return {
            ...q,
            options: shuffleArray(q.options as string[]),
          };
        }
        if (q.question_type === 'MATCHING' && Array.isArray(q.options)) {
          return {
            ...q,
            shuffledOptions: shuffleArray(q.options as string[]),
          };
        }
        return q;
      });

      setQuizQuestions(questionsWithShuffledOptions as QuizQuestion[]);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setAnswerStatus('unanswered');
      setCorrectAnswers(0);
      setIsFinished(false);
      setShowHint(false);
    }
  }, [quizData]);

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const progress =
    quizQuestions.length > 0
      ? ((currentQuestionIndex + 1) / quizQuestions.length) * 100
      : 0;

  const handleAnswerSelect = (answer: string) => {
    if (answerStatus !== 'unanswered') return;

    const answerTrimmed = answer.trim();
    setSelectedAnswer(answerTrimmed);

    let isCorrect = false;
    if (
      currentQuestion.question_type === 'MULTIPLE_CHOICE' ||
      currentQuestion.question_type === 'TRUE_FALSE'
    ) {
      isCorrect = currentQuestion.correct_answer === answerTrimmed;
    } else if (currentQuestion.question_type === 'FILL_IN_THE_BLANK') {
      const correctAnswers = (currentQuestion.options as string[]) || [];
      if (correctAnswers.length > 0) {
        isCorrect = correctAnswers.some(
          (a) => a.toLowerCase() === answerTrimmed.toLowerCase()
        );
      } else {
        isCorrect = currentQuestion.correct_answer.toLowerCase() === answerTrimmed.toLowerCase();
      }
    }

    if (isCorrect) {
      setAnswerStatus('correct');
      setCorrectAnswers((prev) => prev + 1);
    } else {
      setAnswerStatus('incorrect');
    }
  };

  const handleMatchingComplete = (isCorrect: boolean) => {
    if (answerStatus !== 'unanswered') return; 

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
      setShowHint(false);
    } else {
      setIsFinished(true);
      if (session) {
        fetch('/api/quiz/attempt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            quizId: quizId,
            score: correctAnswers,
            total: quizQuestions.length
          })
        }).catch(err => console.error("Failed to save quiz attempt:", err));
      }
    }
  };

  const handleRestart = () => {
    if (quizData?.questions && quizData.questions.length > 0) {
      const shuffledQuestions = shuffleArray(quizData.questions);
      const questionsWithShuffledOptions = shuffledQuestions.map((q) => {
        if (q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
          return {
            ...q,
            options: shuffleArray(q.options as string[]),
          };
        }
        if (q.question_type === 'MATCHING' && Array.isArray(q.options)) {
          return {
            ...q,
            shuffledOptions: shuffleArray(q.options as string[]),
          };
        }
        return q;
      });
      setQuizQuestions(questionsWithShuffledOptions as QuizQuestion[]);
    }
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setAnswerStatus('unanswered');
    setCorrectAnswers(0);
    setIsFinished(false);
    setShowHint(false);
  };

  const getOptionClass = (optionText: string) => {
    if (answerStatus === 'unanswered') {
      return 'border-border hover:bg-muted/50 transition-colors';
    }
    const isThisCorrect = currentQuestion.correct_answer === optionText;
    if (isThisCorrect) {
      return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500 font-medium';
    }
    if (selectedAnswer === optionText && !isThisCorrect) {
      return 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 ring-1 ring-red-500';
    }
    return 'border-border opacity-50';
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading Quiz...</p>
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

  if (!quizData || quizQuestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4" />
        <h2 className="text-2xl font-semibold">{quizData?.quiz?.title || 'Quiz'}</h2>
        <p className="text-center">This quiz has no questions in it.</p>
        <Button onClick={() => router.push('/quizzes')} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quizzes
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full items-center py-8 px-4 bg-zinc-50/50 dark:bg-zinc-950">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/quizzes')}
            className="pl-0 hover:bg-transparent hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Exit
          </Button>
          <div className="flex flex-col items-center">
             <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quiz</span>
             <h1
                className="text-xl font-bold truncate max-w-[200px] text-center"
                title={quizData.quiz.title}
             >
                {quizData.quiz.title}
             </h1>
          </div>
          <div className="w-20"></div> {/* Spacer for alignment */}
        </div>

        {!isFinished && (
          <div className="mb-8 space-y-2">
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2 w-full" />
          </div>
        )}

        <AnimatePresence mode="wait">
          {isFinished ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
              <Card className="w-full max-w-md shadow-xl border-none ring-1 ring-border/50">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto w-20 h-20 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mb-4">
                    <Trophy className="w-10 h-10 text-yellow-600 dark:text-yellow-500" />
                  </div>
                  <CardTitle className="text-2xl">Quiz Complete!</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-2 pb-8">
                  <div className="text-5xl font-black text-primary tracking-tight">
                    {Math.round((correctAnswers / quizQuestions.length) * 100)}%
                  </div>
                  <p className="text-muted-foreground">
                    You scored {correctAnswers} out of {quizQuestions.length}
                  </p>
                </CardContent>
                <CardFooter className="flex gap-3 bg-muted/20 p-6">
                  <Button variant="outline" className="flex-1" onClick={handleRestart}>
                    <RotateCw className="mr-2 h-4 w-4" /> Retry
                  </Button>
                  <Button className="flex-1" onClick={() => router.push('/quizzes')}>
                    Finish
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="shadow-lg border-none ring-1 ring-border/50 overflow-hidden">
                <CardHeader className="bg-muted/10 pb-4">
                   <div className="flex justify-between items-start gap-4">
                      <Badge variant="outline" className="mb-2">
                         Question {currentQuestionIndex + 1}
                      </Badge>
                      {currentQuestion.question_type === 'MATCHING' && <Badge variant="secondary">Matching</Badge>}
                      {currentQuestion.question_type === 'MULTIPLE_CHOICE' && <Badge variant="secondary">Multiple Choice</Badge>}
                      {currentQuestion.question_type === 'TRUE_FALSE' && <Badge variant="secondary">True / False</Badge>}
                      {currentQuestion.question_type === 'FILL_IN_THE_BLANK' && <Badge variant="secondary">Fill in Blank</Badge>}
                   </div>
                   <h2 className="text-xl font-semibold leading-relaxed">
                      {currentQuestion.question_text}
                   </h2>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* --- Question Body --- */}
                  <div className="space-y-3">
                    {currentQuestion.question_type === 'MULTIPLE_CHOICE' &&
                      (currentQuestion.options as string[]).map((option) => (
                        <Button
                          key={option}
                          variant="outline"
                          className={cn(
                            'h-auto min-h-14 w-full justify-start text-left p-4 whitespace-normal text-base relative',
                            answerStatus !== 'unanswered' && 'pointer-events-none',
                            getOptionClass(option)
                          )}
                          onClick={() => handleAnswerSelect(option)}
                        >
                          <div className="flex-1 pr-8">{option}</div>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              {answerStatus !== 'unanswered' && getOptionClass(option).includes('green') && (
                                  <div className="bg-green-100 dark:bg-green-900 rounded-full p-1"><Check className="w-4 h-4 text-green-600 dark:text-green-400" /></div>
                              )}
                              {answerStatus !== 'unanswered' && getOptionClass(option).includes('red') && (
                                  <div className="bg-red-100 dark:bg-red-900 rounded-full p-1"><X className="w-4 h-4 text-red-600 dark:text-red-400" /></div>
                              )}
                          </div>
                        </Button>
                      ))}

                    {currentQuestion.question_type === 'TRUE_FALSE' &&
                      ['True', 'False'].map((option) => (
                        <Button
                          key={option}
                          variant="outline"
                          className={cn(
                            'h-14 w-full text-left p-4 text-base relative',
                            answerStatus !== 'unanswered' && 'pointer-events-none',
                            getOptionClass(option)
                          )}
                          onClick={() => handleAnswerSelect(option)}
                        >
                           <span className="font-medium">{option}</span>
                           <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              {answerStatus !== 'unanswered' && getOptionClass(option).includes('green') && (
                                  <div className="bg-green-100 dark:bg-green-900 rounded-full p-1"><Check className="w-4 h-4 text-green-600 dark:text-green-400" /></div>
                              )}
                              {answerStatus !== 'unanswered' && getOptionClass(option).includes('red') && (
                                  <div className="bg-red-100 dark:bg-red-900 rounded-full p-1"><X className="w-4 h-4 text-red-600 dark:text-red-400" /></div>
                              )}
                          </div>
                        </Button>
                      ))}
                      
                    {currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                      <div className="space-y-4">
                        <Input
                          type="text"
                          placeholder="Type your answer here..."
                          value={selectedAnswer || ''}
                          onChange={(e) => setSelectedAnswer(e.target.value)}
                          disabled={answerStatus !== 'unanswered'}
                          className="h-12 text-lg"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && answerStatus === 'unanswered' && selectedAnswer) {
                              handleAnswerSelect(selectedAnswer.trim());
                            }
                          }}
                        />
                        {answerStatus === 'unanswered' && (
                            <Button
                            className="w-full h-12 text-base"
                            disabled={!selectedAnswer?.trim()}
                            onClick={() => handleAnswerSelect(selectedAnswer!.trim())}
                            >
                            Submit Answer
                            </Button>
                        )}
                      </div>
                    )}

                    {currentQuestion.question_type === 'MATCHING' && (
                      <MatchingQuestionUI
                        question={currentQuestion}
                        answerStatus={answerStatus}
                        onQuestionComplete={handleMatchingComplete}
                      />
                    )}
                  </div>

                  {/* --- Enhanced Explanation Section --- */}
                  <AnimatePresence>
                     {/* 1. HINT */}
                    {answerStatus === 'unanswered' && showHint && currentQuestion.explanation && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="rounded-xl border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900 p-4 overflow-hidden"
                        >
                          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500 font-semibold mb-2">
                            <Lightbulb className="w-4 h-4 fill-yellow-500 text-yellow-500" /> Hint
                          </div>
                          <p className="text-sm text-yellow-800 dark:text-yellow-200/80 leading-relaxed">
                            {currentQuestion.explanation}
                          </p>
                        </motion.div>
                      )}

                    {/* 2. SUCCESS FEEDBACK */}
                    {answerStatus === 'correct' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/50 p-5"
                      >
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-lg mb-2">
                          <Check className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900 rounded-full p-1" />
                          Correct!
                        </div>
                        {currentQuestion.explanation && (
                            <div className="mt-3 pl-1 border-l-2 border-emerald-200 dark:border-emerald-800 ml-2">
                                <p className="text-sm text-muted-foreground ml-3 leading-relaxed">
                                    {currentQuestion.explanation}
                                </p>
                            </div>
                        )}
                      </motion.div>
                    )}

                    {/* 3. ERROR FEEDBACK */}
                    {answerStatus === 'incorrect' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 p-5"
                      >
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-lg mb-3">
                          <X className="w-6 h-6 bg-red-100 dark:bg-red-900 rounded-full p-1" />
                          Incorrect
                        </div>

                        {currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                             <div className="mb-3 text-sm">
                                <span className="font-semibold text-foreground">Correct Answer: </span>
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                    {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0
                                    ? currentQuestion.options.join(', ')
                                    : currentQuestion.correct_answer}
                                </span>
                             </div>
                        )}

                        {currentQuestion.explanation ? (
                             <div className="pl-3 border-l-2 border-red-200 dark:border-red-800">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {currentQuestion.explanation}
                                </p>
                             </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No explanation available.</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>

                <CardFooter className="bg-muted/5 p-6 border-t flex items-center justify-between gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHint(!showHint)}
                    disabled={
                      answerStatus !== 'unanswered' ||
                      !currentQuestion.explanation
                    }
                    className={cn(
                        "text-muted-foreground",
                        (answerStatus !== 'unanswered' || !currentQuestion.explanation) && "opacity-0 pointer-events-none"
                    )}
                  >
                    <Lightbulb className="w-4 h-4 mr-2" />
                    {showHint ? "Hide Hint" : "Need a Hint?"}
                  </Button>

                  <Button
                    className="min-w-[140px] shadow-sm"
                    size="lg"
                    disabled={answerStatus === 'unanswered'}
                    onClick={handleNext}
                  >
                    {currentQuestionIndex === quizQuestions.length - 1
                      ? 'View Results'
                      : 'Next Question'}
                    <ArrowRight className="w-4 h-4 ml-2" />
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