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
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Check,
  X,
  AlertCircle,
  Trophy,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  RefreshCcw,
  Activity,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---

interface QuizData {
  quiz: Quiz;
  questions: Question[];
}

type AnswerStatus = 'unanswered' | 'correct' | 'incorrect';

// Extended type to hold shuffled options for display
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

    [newOrder[index], newOrder[swapIndex]] = [
      newOrder[swapIndex],
      newOrder[index],
    ];
    setCurrentOrder(newOrder);
  };

  const handleSubmit = () => {
    if (answerStatus !== 'unanswered') return;
    const correctOrder = question.options as string[];
    const isCorrect = JSON.stringify(currentOrder) === JSON.stringify(correctOrder);
    onQuestionComplete(isCorrect);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {currentOrder.map((item, index) => {
          const correctOrder = question.options as string[];
          const isSlotCorrect = correctOrder[index] === item;

          let itemClass = 'bg-black/40 border-white/10 text-zinc-300';
          if (answerStatus === 'correct') {
            itemClass = 'border-green-500/50 bg-green-500/10 text-green-400';
          } else if (answerStatus === 'incorrect') {
            itemClass = isSlotCorrect
              ? 'border-green-500/50 bg-green-500/10 text-green-400'
              : 'border-red-500/50 bg-red-500/10 text-red-400';
          }

          return (
            <div
              key={`${item}-${index}`}
              className={cn(
                'flex items-center gap-3 p-3 border rounded-lg transition-colors',
                itemClass
              )}
            >
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-white/10 text-muted-foreground hover:text-white"
                  onClick={() => moveItem(index, 'up')}
                  disabled={index === 0 || answerStatus !== 'unanswered'}
                >
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-white/10 text-muted-foreground hover:text-white"
                  onClick={() => moveItem(index, 'down')}
                  disabled={
                    index === currentOrder.length - 1 ||
                    answerStatus !== 'unanswered'
                  }
                >
                  <ArrowDown className="w-3 h-3" />
                </Button>
              </div>
              <span className="flex-1 font-medium font-mono text-sm">{item}</span>
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
        <Button className="w-full mt-4 font-mono uppercase tracking-widest bg-primary text-black hover:bg-primary/90" onClick={handleSubmit}>
          Submit Order
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

  const {
    prompts,
    options: correctOptions, 
    shuffledOptions, 
  } = useMemo(
    () => ({
      prompts: (question.prompts as string[]) || [],
      options: (question.options as string[]) || [],
      shuffledOptions: question.shuffledOptions || [],
    }),
    [question]
  );

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
    const existingMatchIdx = newUserMatches.indexOf(optionIdx);
    if (existingMatchIdx > -1) {
      newUserMatches[existingMatchIdx] = null;
    }
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
        const userAns = shuffledOptions[userOptionIdx];
        if (userAns === correctAns) {
          correctCount++;
        }
      }
    }
    onQuestionComplete(correctCount === prompts.length);
  };

  const allMatched = useMemo(
    () => userMatches.every((m) => m !== null),
    [userMatches]
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {answerStatus === 'unanswered' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground hover:text-white"
          >
            <RefreshCcw className="w-3 h-3 mr-1" /> Reset Matches
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 relative">
        {/* Prompts Column */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-wider mb-2">
            Items
          </h4>
          {prompts.map((prompt, pIdx) => {
            const isSelected = selectedPromptIdx === pIdx;
            const isMatched = userMatches[pIdx] !== null;
            let state: 'default' | 'selected' | 'matched' | 'correct' | 'incorrect' = 'default';

            if (answerStatus === 'unanswered') {
              if (isSelected) state = 'selected';
              else if (isMatched) state = 'matched';
            } else {
              const correctAns = correctOptions[pIdx];
              const userAns = userMatches[pIdx] !== null ? shuffledOptions[userMatches[pIdx]!] : null;
              state = userAns === correctAns ? 'correct' : 'incorrect';
            }

            return (
              <div key={pIdx} className="relative">
                <Button
                  variant="outline"
                  onClick={() => handlePromptClick(pIdx)}
                  className={cn(
                    'h-auto min-h-14 w-full justify-start text-left p-4 whitespace-normal border transition-all',
                    state === 'default' && 'border-white/10 bg-black/40 text-zinc-300 hover:bg-white/5',
                    state === 'selected' && 'border-primary ring-1 ring-primary bg-primary/10 text-primary',
                    state === 'matched' && 'border-primary/50 bg-primary/5 text-primary/80',
                    state === 'correct' && 'border-green-500 bg-green-500/10 text-green-400',
                    state === 'incorrect' && 'border-red-500 bg-red-500/10 text-red-400'
                  )}
                  disabled={answerStatus !== 'unanswered'}
                >
                  <span className="mr-2 font-mono font-bold opacity-50 text-xs">{pIdx + 1}.</span>{' '}
                  {prompt}
                </Button>
                <div
                  className={cn(
                    'absolute right-[-18px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full hidden md:block z-10 transition-colors',
                    isMatched || state !== 'default' ? 'bg-primary' : 'bg-white/10',
                    state === 'correct' && 'bg-green-500',
                    state === 'incorrect' && 'bg-red-500'
                  )}
                />
              </div>
            );
          })}
        </div>

        {/* Options Column */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-wider mb-2">
            Matches
          </h4>
          {shuffledOptions.map((option, oIdx) => {
            const isMatched = userMatches.includes(oIdx);
            let state: 'default' | 'matched' | 'correct' | 'incorrect' = 'default';

            if (answerStatus === 'unanswered') {
              if (isMatched) state = 'matched';
            } else {
              const promptIdx = userMatches.indexOf(oIdx);
              if (promptIdx > -1) {
                const correctAns = correctOptions[promptIdx];
                state = option === correctAns ? 'correct' : 'incorrect';
              }
            }

            return (
              <div key={oIdx} className="relative">
                <div
                  className={cn(
                    'absolute left-[-18px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full hidden md:block z-10 transition-colors',
                    isMatched || state !== 'default' ? 'bg-primary' : 'bg-white/10',
                    state === 'correct' && 'bg-green-500',
                    state === 'incorrect' && 'bg-red-500'
                  )}
                />
                <Button
                  variant="outline"
                  onClick={() => handleOptionClick(oIdx)}
                  className={cn(
                    'h-auto min-h-14 w-full justify-start text-left p-4 whitespace-normal border transition-all',
                    state === 'default' && 'border-white/10 bg-black/40 text-zinc-300 hover:bg-white/5',
                    state === 'matched' && 'border-primary/50 bg-primary/5 text-primary/80',
                    state === 'correct' && 'border-green-500 bg-green-500/10 text-green-400',
                    state === 'incorrect' && 'border-red-500 bg-red-500/10 text-red-400',
                    answerStatus === 'unanswered' && selectedPromptIdx === null && 'opacity-50 cursor-not-allowed'
                  )}
                  disabled={answerStatus !== 'unanswered' || selectedPromptIdx === null}
                >
                  {option}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {answerStatus === 'unanswered' && (
        <Button
          className="w-full mt-4 font-mono uppercase tracking-widest bg-primary text-black hover:bg-primary/90"
          disabled={!allMatched}
          onClick={handleSubmit}
        >
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

  // FIX: Validate quizId is not "null" (string) or undefined
  const isValidQuizId = quizId && quizId !== 'null' && quizId !== 'undefined';

  const {
    data: apiResponse,
    error,
    isLoading,
  } = useSWR<ApiResponse<QuizData>>(
    // Conditionally fetch only if ID is valid
    session && isValidQuizId ? `/api/quiz/${quizId}` : null,
    (url: string) =>
      fetcher(url, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      }),
    { revalidateOnFocus: false }
  );

  const quizData = apiResponse?.data;

  // Initialize and shuffle questions once data loads
  useEffect(() => {
    if (quizData?.questions && quizData.questions.length > 0) {
      const shuffledQuestions = shuffleArray(quizData.questions);

      const questionsWithShuffledOptions = shuffledQuestions.map((q) => {
        // Shuffle Multiple Choice options
        if (q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
          return {
            ...q,
            options: shuffleArray(q.options as string[]),
          };
        }
        // Shuffle Matching options for display
        if (
          q.question_type === 'MATCHING' &&
          Array.isArray(q.options)
        ) {
          return {
            ...q,
            shuffledOptions: shuffleArray(q.options as string[]),
          };
        }
        // Shuffle Ordering options for display
        if (
            q.question_type === 'ORDERING' &&
            Array.isArray(q.options)
          ) {
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

  // Handler for text-based answers (MC, TF, Blank)
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
        // Check against list of acceptable answers
        isCorrect = correctAnswers.some(
          (a) => a.toLowerCase() === answerTrimmed.toLowerCase()
        );
      } else {
        // Legacy check
        isCorrect =
          currentQuestion.correct_answer.toLowerCase() ===
          answerTrimmed.toLowerCase();
      }
    }

    if (isCorrect) {
      setAnswerStatus('correct');
      setCorrectAnswers((prev) => prev + 1);
    } else {
      setAnswerStatus('incorrect');
    }
  };

  // Handler for complex components (Matching, Ordering)
  const handleComplexQuestionComplete = (isCorrect: boolean) => {
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
      if (session && isValidQuizId) {
        fetch('/api/quiz/attempt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            quizId: quizId,
            score: correctAnswers,
            total: quizQuestions.length,
          }),
        }).catch((err) => console.error('Failed to save quiz attempt:', err));
      }
    }
  };

  const handleRestart = () => {
    // Quick reload for simplicity to re-fetch and re-shuffle
    window.location.reload();
  };

  const getOptionClass = (optionText: string) => {
    if (answerStatus === 'unanswered') return 'border-white/10 hover:bg-white/5 hover:border-primary/50 text-zinc-300';
    
    const isThisCorrect = currentQuestion.correct_answer === optionText;
    if (isThisCorrect) {
      return 'border-green-500 bg-green-500/10 text-green-400 shadow-[0_0_15px_-3px_rgba(34,197,94,0.4)]';
    }
    if (selectedAnswer === optionText && !isThisCorrect) {
      return 'border-red-500 bg-red-500/10 text-red-400 shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)]';
    }
    return 'border-white/5 opacity-50';
  };

  // FIX: Handle Invalid ID explicitly immediately
  if (!isValidQuizId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-red-500">
        <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
        <h2 className="text-xl font-mono font-bold">INVALID MISSION ID</h2>
        <p className="text-muted-foreground font-mono text-sm mt-2">Target ID is null or corrupted.</p>
        <Button onClick={() => router.push('/quizzes')} variant="outline" className="mt-6 font-mono text-xs">
          RETURN TO BASE
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
         <div className="text-primary font-mono animate-pulse text-sm">INITIALIZING SIMULATION...</div>
      </div>
    );
  }

  if (error || !quizData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-red-500">
        <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
        <h2 className="text-xl font-mono font-bold">SIMULATION FAILED</h2>
        <Button onClick={() => router.push('/quizzes')} variant="outline" className="mt-6 font-mono text-xs">
          ABORT
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden relative">
       {/* Background Grid Pattern */}
       <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="w-full max-w-3xl mx-auto p-6 relative z-10 flex flex-col h-full">
        {/* Top HUD */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => router.push('/quizzes')} className="text-muted-foreground hover:text-white font-mono text-xs">
            <ArrowLeft className="mr-2 h-4 w-4" /> ABORT MISSION
          </Button>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono">
             <Activity className="w-3 h-3 text-primary animate-pulse" />
             <span>LIVE_SIMULATION</span>
          </div>
        </div>

        {!isFinished && (
          <div className="mb-8 space-y-2">
            <div className="flex justify-between text-xs font-mono text-muted-foreground uppercase">
                <span>Progress</span>
                <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-1 bg-white/10" />
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center pb-12">
        <AnimatePresence mode="wait">
          {isFinished ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center"
            >
               <div className="relative mb-8">
                  <div className="absolute inset-0 bg-yellow-500/20 blur-[60px] rounded-full" />
                  <Trophy className="w-24 h-24 text-yellow-500 relative z-10 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]" />
               </div>
               
               <h2 className="text-3xl font-bold font-mono mb-2 tracking-tight text-white">MISSION ACCOMPLISHED</h2>
               <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 mb-8">
                 {Math.round((correctAnswers / quizQuestions.length) * 100)}%
               </div>
               
               <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-8">
                  <div className="p-5 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center">
                     <span className="text-xs font-mono text-muted-foreground uppercase mb-1">Correct</span>
                     <span className="text-2xl font-bold text-green-400">{correctAnswers}</span>
                  </div>
                  <div className="p-5 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center">
                     <span className="text-xs font-mono text-muted-foreground uppercase mb-1">Total</span>
                     <span className="text-2xl font-bold text-white">{quizQuestions.length}</span>
                  </div>
               </div>

               <div className="flex gap-4 w-full max-w-sm">
                  <Button 
                    className="flex-1 font-mono uppercase tracking-widest bg-primary text-black hover:bg-primary/90 font-bold" 
                    onClick={handleRestart}
                  >
                    Re-Deploy
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 font-mono uppercase tracking-widest border-white/10 hover:bg-white/5" 
                    onClick={() => router.push('/quizzes')}
                  >
                    Exit
                  </Button>
               </div>
            </motion.div>
          ) : (
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              {/* Ensure currentQuestion exists before rendering to avoid runtime crashes during fast transitions */}
              {currentQuestion && (
                <Card className="bg-zinc-900/80 backdrop-blur-xl border-white/10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <CardContent className="p-8">
                    <div className="mb-8">
                      <span className="text-xs font-mono text-primary/70 uppercase tracking-widest mb-3 block">
                          Query Sequence 0{currentQuestionIndex + 1}
                      </span>
                      <h3 className="text-xl md:text-2xl font-semibold leading-relaxed text-white">
                          {currentQuestion.question_text}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {/* Multiple Choice / True False */}
                      {['MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(currentQuestion.question_type) && 
                        (currentQuestion.options as string[]).map((option) => (
                          <Button
                            key={option}
                            variant="outline"
                            className={cn(
                              'h-auto min-h-14 w-full justify-start text-left p-4 whitespace-normal text-base transition-all duration-200',
                              answerStatus !== 'unanswered' && 'pointer-events-none opacity-100',
                              getOptionClass(option)
                            )}
                            onClick={() => handleAnswerSelect(option)}
                          >
                            <span className="flex-1 font-sans">{option}</span>
                            {answerStatus !== 'unanswered' && getOptionClass(option).includes('green') && <Check className="w-5 h-5 ml-2 text-green-400" />}
                            {answerStatus !== 'unanswered' && getOptionClass(option).includes('red') && <X className="w-5 h-5 ml-2 text-red-400" />}
                          </Button>
                      ))}
                      
                      {/* Fill in Blank */}
                      {currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                          <div className="space-y-4">
                              <Input 
                                  placeholder="ENTER DATA VALUE..." 
                                  className="bg-black/50 border-white/20 h-14 font-mono text-lg text-white"
                                  value={selectedAnswer || ''}
                                  onChange={(e) => setSelectedAnswer(e.target.value)}
                                  disabled={answerStatus !== 'unanswered'}
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter' && answerStatus === 'unanswered' && selectedAnswer) {
                                        handleAnswerSelect(selectedAnswer.trim());
                                      }
                                  }}
                              />
                              <Button 
                                  className="w-full h-12 font-mono uppercase tracking-widest bg-white text-black hover:bg-white/90" 
                                  disabled={answerStatus !== 'unanswered' || !selectedAnswer?.trim()} 
                                  onClick={() => handleAnswerSelect(selectedAnswer!.trim())}
                              >
                                  Verify Data
                              </Button>
                          </div>
                      )}

                      {/* Complex Types */}
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

                    </div>

                    {/* Feedback Overlay */}
                    <AnimatePresence>
                      {answerStatus !== 'unanswered' && (
                          <motion.div 
                              initial={{ height: 0, opacity: 0 }} 
                              animate={{ height: 'auto', opacity: 1 }}
                              className={cn(
                                  "mt-8 p-6 rounded-lg border-l-4 font-mono text-sm",
                                  answerStatus === 'correct' ? "bg-green-500/10 border-green-500 text-green-400" : "bg-red-500/10 border-red-500 text-red-400"
                              )}
                          >
                              <div className="flex items-center gap-2 font-bold mb-2 uppercase tracking-wider text-base">
                                  {answerStatus === 'correct' ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                  {answerStatus === 'correct' ? 'Data Verified' : 'Corruption Detected'}
                              </div>
                              
                              {answerStatus === 'incorrect' && currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                                  <div className="mb-2 text-white/80">
                                      Expected: <span className="text-white font-bold">{Array.isArray(currentQuestion.options) ? currentQuestion.options[0] : currentQuestion.correct_answer}</span>
                                  </div>
                              )}

                              <p className="opacity-90 font-sans leading-relaxed text-zinc-300">
                                  {currentQuestion.explanation || (answerStatus === 'incorrect' ? "Check your source material for further analysis." : "Logic sound. Proceed to next query.")}
                              </p>
                          </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                  
                  <CardFooter className="bg-black/40 p-6 border-t border-white/5 flex justify-between items-center">
                      <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setShowHint(true)} 
                          disabled={answerStatus !== 'unanswered' || showHint || !currentQuestion.explanation} 
                          className={cn(
                              "text-yellow-500/70 hover:text-yellow-500 hover:bg-yellow-500/10 transition-all",
                              (answerStatus !== 'unanswered' || showHint) && "opacity-0"
                          )}
                      >
                          <Lightbulb className="w-4 h-4 mr-2" /> HINT
                      </Button>

                      <AnimatePresence>
                          {showHint && answerStatus === 'unanswered' && (
                              <motion.div 
                                  initial={{ opacity: 0, y: 10 }} 
                                  animate={{ opacity: 1, y: 0 }}
                                  className="absolute bottom-20 left-8 right-8 bg-yellow-950/90 border border-yellow-500/30 p-4 rounded-lg text-yellow-200 text-sm shadow-xl backdrop-blur-md z-20"
                              >
                                  <div className="font-bold flex items-center gap-2 mb-1"><Lightbulb className="w-4 h-4" /> Hint Decrypted:</div>
                                  {currentQuestion.explanation}
                              </motion.div>
                          )}
                      </AnimatePresence>

                      <Button 
                          onClick={handleNext} 
                          disabled={answerStatus === 'unanswered'} 
                          className="bg-white text-black hover:bg-white/90 font-mono text-xs uppercase font-bold px-8 h-10"
                      >
                          {currentQuestionIndex === quizQuestions.length - 1 ? 'FINALIZE' : 'NEXT_QUERY'} <ArrowLeft className="w-3 h-3 ml-2 rotate-180" />
                      </Button>
                  </CardFooter>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}