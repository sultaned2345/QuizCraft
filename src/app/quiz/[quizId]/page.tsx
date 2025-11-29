// src/app/quiz/[quizId]/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  RefreshCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizData {
  quiz: Quiz;
  questions: Question[];
}

type AnswerStatus = 'unanswered' | 'correct' | 'incorrect';

// Standard Question type
type QuizQuestion = Question; 

// Helper function to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// --- NEW SUB-COMPONENT: MATCHING UI ---
/**
 * A "Slot & Bank" style matching component.
 * Left Side: Prompts with empty slots.
 * Right Side: A bank of options to click.
 */
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
  
  // Stores the TEXT value of the answer placed in slot [index]
  const [userMatches, setUserMatches] = useState<(string | null)[]>([]);
  
  // The shuffled bank of options (Strings)
  const [optionBank, setOptionBank] = useState<string[]>([]);

  // Initialize: Shuffle options once when question loads
  useEffect(() => {
    const rawOptions = (question.options as string[]) || [];
    setOptionBank(shuffleArray(rawOptions));
    setUserMatches(new Array((question.prompts as string[] || []).length).fill(null));
    setSelectedPromptIdx(null);
  }, [question]);

  // Handle clicking a specific prompt (slot)
  const handlePromptClick = (idx: number) => {
    if (answerStatus !== 'unanswered') return;
    
    // If clicking an already filled slot, remove the item back to bank
    if (userMatches[idx] !== null) {
      const newMatches = [...userMatches];
      newMatches[idx] = null;
      setUserMatches(newMatches);
    } else {
      // Select this slot to be filled
      setSelectedPromptIdx(idx === selectedPromptIdx ? null : idx);
    }
  };

  // Handle clicking an option from the bank
  const handleOptionClick = (optionValue: string) => {
    if (answerStatus !== 'unanswered') return;

    // If a prompt slot is selected, fill it
    if (selectedPromptIdx !== null) {
      const newMatches = [...userMatches];
      newMatches[selectedPromptIdx] = optionValue;
      setUserMatches(newMatches);
      
      // Auto-advance to next empty slot if available
      const nextEmpty = newMatches.findIndex(m => m === null);
      setSelectedPromptIdx(nextEmpty !== -1 ? nextEmpty : null);
    }
  };

  const handleSubmit = () => {
    const correctOptions = (question.options as string[]) || [];
    const prompts = (question.prompts as string[]) || [];
    
    let isAllCorrect = true;

    // Check each slot against the original index in correctOptions
    // Assuming prompts[i] matches correctOptions[i]
    for (let i = 0; i < prompts.length; i++) {
      const userVal = userMatches[i]?.trim().toLowerCase();
      const correctVal = correctOptions[i]?.trim().toLowerCase();
      
      if (userVal !== correctVal) {
        isAllCorrect = false;
        break;
      }
    }
    
    onQuestionComplete(isAllCorrect);
  };

  // Helper to check if an option is currently used in any slot
  const isOptionUsed = (opt: string) => userMatches.includes(opt);

  const prompts = (question.prompts as string[]) || [];
  const correctOptions = (question.options as string[]) || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Prompts & Slots */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Prompts</h4>
          {prompts.map((prompt, idx) => {
            const userAns = userMatches[idx];
            const isSelected = selectedPromptIdx === idx;
            
            // State Logic for Colors
            let statusColor = "border-border";
            if (answerStatus !== 'unanswered') {
               const isCorrect = userAns?.trim().toLowerCase() === correctOptions[idx]?.trim().toLowerCase();
               statusColor = isCorrect 
                ? "border-green-500 bg-green-500/10 text-green-700" 
                : "border-destructive bg-destructive/10 text-destructive";
            } else if (isSelected) {
               statusColor = "border-primary ring-1 ring-primary";
            } else if (userAns) {
               statusColor = "border-primary/50 bg-primary/5";
            }

            return (
              <div key={idx} className="relative group">
                <div 
                  onClick={() => handlePromptClick(idx)}
                  className={cn(
                    "flex flex-col p-3 rounded-lg border-2 transition-all cursor-pointer",
                    statusColor,
                    answerStatus !== 'unanswered' && "pointer-events-none"
                  )}
                >
                  <span className="font-medium text-sm mb-2">{prompt}</span>
                  
                  {/* The Slot Area */}
                  <div className={cn(
                    "h-10 rounded border border-dashed flex items-center px-3 text-sm font-medium transition-colors",
                    userAns ? "bg-background border-solid border-primary/20" : "bg-muted/30 border-muted-foreground/30 text-muted-foreground italic"
                  )}>
                    {userAns || "Select from bank..."}
                    {userAns && answerStatus === 'unanswered' && (
                       <X className="ml-auto w-4 h-4 opacity-50 hover:opacity-100" />
                    )}
                  </div>
                </div>
                
                {/* Result Indicator (Only shown after submit) */}
                {answerStatus !== 'unanswered' && (
                  <div className="absolute top-3 right-3">
                    {userMatches[idx]?.trim().toLowerCase() === correctOptions[idx]?.trim().toLowerCase() ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <div className="flex items-center gap-2">
                         <span className="text-xs font-bold text-destructive">Ans: {correctOptions[idx]}</span>
                         <X className="w-5 h-5 text-destructive" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT COLUMN: Option Bank */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Answer Bank</span>
            {answerStatus === 'unanswered' && (
               <span className="text-xs font-normal normal-case opacity-70">Click to place in selected slot</span>
            )}
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {optionBank.map((option, idx) => {
              const used = isOptionUsed(option);
              return (
                <Button
                  key={idx}
                  variant={used ? "ghost" : "outline"}
                  className={cn(
                    "justify-start h-auto py-3 px-4 whitespace-normal text-left transition-all",
                    used ? "opacity-40 bg-muted grayscale" : "hover:border-primary hover:bg-primary/5",
                    answerStatus !== 'unanswered' && "opacity-0 hidden" // Hide bank after answer
                  )}
                  disabled={used || answerStatus !== 'unanswered'}
                  onClick={() => handleOptionClick(option)}
                >
                  {!used && <ArrowRight className="w-4 h-4 mr-2 text-muted-foreground" />}
                  {option}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {answerStatus === 'unanswered' && (
        <Button 
          className="w-full mt-6" 
          onClick={handleSubmit}
          disabled={userMatches.some(m => m === null)}
        >
          Submit Matches
        </Button>
      )}
    </div>
  );
}
// --- END SUB-COMPONENT ---


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

  // Initialize questions
  useEffect(() => {
    if (quizData?.questions && quizData.questions.length > 0) {
      // Shuffle the questions only
      const shuffledQuestions = shuffleArray(quizData.questions);
      
      // We do NOT shuffle options here anymore for Matching. 
      // The Matching component handles its own display shuffling to avoid state desync.
      // For Multiple Choice, we still shuffle options.
      const processedQuestions = shuffledQuestions.map((q) => {
        if (q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
          return {
            ...q,
            options: shuffleArray(q.options as string[]),
          };
        }
        return q;
      });

      setQuizQuestions(processedQuestions);
      setCurrentQuestionIndex(0);
      setCorrectAnswers(0);
      setIsFinished(false);
    }
  }, [quizData]);

  const currentQuestion = quizQuestions[currentQuestionIndex];
  
  // Progress calculation
  const progress = quizQuestions.length > 0
      ? ((currentQuestionIndex + 1) / quizQuestions.length) * 100
      : 0;

  // Standard handler for Non-Matching questions
  const handleAnswerSelect = (answer: string) => {
    if (answerStatus !== 'unanswered') return;

    const answerTrimmed = answer.trim();
    setSelectedAnswer(answerTrimmed);

    let isCorrect = false;
    const qType = currentQuestion.question_type;

    if (qType === 'MULTIPLE_CHOICE' || qType === 'TRUE_FALSE') {
      isCorrect = currentQuestion.correct_answer === answerTrimmed;
    } else if (qType === 'FILL_IN_THE_BLANK') {
      // Robust checking for fill-in-blank
      const correctOpts = (currentQuestion.options as string[]) || [];
      const userLower = answerTrimmed.toLowerCase();
      
      if (correctOpts.length > 0) {
        isCorrect = correctOpts.some(a => a.toLowerCase().trim() === userLower);
      } else {
        isCorrect = currentQuestion.correct_answer.toLowerCase().trim() === userLower;
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
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    setIsFinished(true);
    if (session) {
      try {
        await fetch('/api/quiz/attempt', {
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
        });
      } catch (err) {
        console.error("Failed to save quiz attempt:", err);
      }
    }
  }

  const handleRestart = () => {
    if (quizData?.questions) {
      // Re-shuffle on restart
      const shuffledQuestions = shuffleArray(quizData.questions);
      const processed = shuffledQuestions.map((q) => {
        if (q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
          return { ...q, options: shuffleArray(q.options as string[]) };
        }
        return q;
      });
      setQuizQuestions(processed);
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
      return 'border-border hover:bg-muted/50';
    }
    const isThisCorrect = currentQuestion.correct_answer === optionText;
    if (isThisCorrect) {
      return 'border-green-500 bg-green-500/10 text-green-700 ring-2 ring-green-500';
    }
    if (selectedAnswer === optionText && !isThisCorrect) {
      return 'border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive';
    }
    return 'border-border opacity-60';
  };

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading Quiz...</div>;
  if (error) return <div className="flex flex-col items-center justify-center h-full text-destructive"><AlertCircle className="h-12 w-12 mb-4" /><p>{error.message}</p></div>;
  if (!quizData || quizQuestions.length === 0) return <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><p>This quiz has no questions.</p></div>;

  return (
    <div className="flex flex-col h-full items-center py-8">
      <div className="w-full max-w-2xl px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => router.push('/quizzes')} className="pl-0 hover:bg-transparent hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4" /> Exit
          </Button>
          <div className="flex flex-col items-end">
            <span className="text-sm text-muted-foreground font-medium">Question {currentQuestionIndex + 1}/{quizQuestions.length}</span>
            <Progress value={progress} className="w-32 h-2 mt-2" />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isFinished ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center pt-8"
            >
              <Card className="w-full max-w-md shadow-xl border-2">
                <CardHeader>
                  <CardTitle className="text-center text-3xl">Quiz Complete!</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-6 py-8">
                  <div className="relative">
                    <Trophy className="w-24 h-24 text-yellow-500 fill-yellow-500/20" />
                    <motion.div 
                      initial={{ scale: 0 }} 
                      animate={{ scale: 1 }} 
                      transition={{ delay: 0.3 }}
                      className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm font-bold"
                    >
                      {Math.round((correctAnswers / quizQuestions.length) * 100)}%
                    </motion.div>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">You scored</p>
                    <h3 className="text-5xl font-bold mt-2 text-primary">{correctAnswers} <span className="text-2xl text-muted-foreground">/ {quizQuestions.length}</span></h3>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3 pb-8">
                  <Button className="w-full h-12 text-lg" onClick={handleRestart}>
                    <RefreshCcw className="mr-2 h-5 w-5" /> Try Again
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => router.push('/quizzes')}>
                    Back to Dashboard
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
              <Card className="shadow-md border-t-4 border-t-primary">
                <CardContent className="p-6 sm:p-8">
                  {/* Question Text */}
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold leading-relaxed text-foreground">
                      {currentQuestion.question_text}
                    </h2>
                  </div>

                  {/* Question Content */}
                  <div className="space-y-4">
                    {currentQuestion.question_type === 'MATCHING' ? (
                       <MatchingQuestionUI 
                          question={currentQuestion} 
                          answerStatus={answerStatus}
                          onQuestionComplete={handleMatchingComplete}
                       />
                    ) : (
                      // Standard Options (MC, True/False, Fill Blank)
                      <div className="space-y-3">
                        {['MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(currentQuestion.question_type) && 
                          (currentQuestion.options as string[]).map((option) => (
                          <Button
                            key={option}
                            variant="outline"
                            className={cn(
                              'h-auto min-h-14 w-full justify-start text-left px-5 py-3 text-base whitespace-normal transition-all',
                              answerStatus !== 'unanswered' && 'pointer-events-none',
                              getOptionClass(option)
                            )}
                            onClick={() => handleAnswerSelect(option)}
                          >
                            <span className="flex-1">{option}</span>
                            {answerStatus !== 'unanswered' && getOptionClass(option).includes('green') && <Check className="w-5 h-5 ml-2 text-green-600" />}
                            {answerStatus !== 'unanswered' && getOptionClass(option).includes('destructive') && <X className="w-5 h-5 ml-2 text-destructive" />}
                          </Button>
                        ))}

                        {currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                          <div className="space-y-4">
                            <Input
                              placeholder="Type your answer here..."
                              value={selectedAnswer || ''}
                              onChange={(e) => setSelectedAnswer(e.target.value)}
                              disabled={answerStatus !== 'unanswered'}
                              className="h-12 text-lg"
                              onKeyDown={(e) => e.key === 'Enter' && answerStatus === 'unanswered' && selectedAnswer && handleAnswerSelect(selectedAnswer.trim())}
                            />
                            <Button
                              className="w-full h-12"
                              disabled={answerStatus !== 'unanswered' || !selectedAnswer?.trim()}
                              onClick={() => handleAnswerSelect(selectedAnswer!.trim())}
                            >
                              Submit Answer
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Feedback / Explanations */}
                  <AnimatePresence>
                    {(answerStatus === 'correct' || answerStatus === 'incorrect') && (
                       <motion.div
                         initial={{ height: 0, opacity: 0 }}
                         animate={{ height: 'auto', opacity: 1 }}
                         className={cn(
                           "mt-6 p-4 rounded-lg border flex flex-col gap-2",
                           answerStatus === 'correct' ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                         )}
                       >
                         <div className="flex items-center font-bold">
                           {answerStatus === 'correct' 
                             ? <><Check className="w-5 h-5 mr-2 text-green-600" /><span className="text-green-700">Correct!</span></>
                             : <><X className="w-5 h-5 mr-2 text-red-600" /><span className="text-red-700">Incorrect</span></>
                           }
                         </div>
                         
                         {/* Show correct answers for Fill in blank / incorrect */}
                         {answerStatus === 'incorrect' && currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                            <p className="text-sm text-foreground/80 pl-7">
                              Correct Answer: <span className="font-semibold">{currentQuestion.correct_answer}</span>
                            </p>
                         )}

                         {currentQuestion.explanation && (
                           <div className="text-sm text-muted-foreground pl-7 mt-1 border-l-2 border-black/5 pl-2">
                             {currentQuestion.explanation}
                           </div>
                         )}
                       </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>

                <CardFooter className="p-6 bg-muted/20 border-t flex justify-between items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHint(true)}
                    disabled={answerStatus !== 'unanswered' || showHint || !currentQuestion.explanation}
                    className={cn(currentQuestion.explanation ? "opacity-100" : "opacity-0")}
                  >
                    <Lightbulb className="w-4 h-4 mr-2" /> Hint
                  </Button>
                  
                  {showHint && answerStatus === 'unanswered' && (
                    <motion.p initial={{opacity:0}} animate={{opacity:1}} className="absolute left-6 right-32 text-xs text-muted-foreground bg-background border p-2 rounded shadow-sm">
                      {currentQuestion.explanation}
                    </motion.p>
                  )}

                  <Button 
                    onClick={handleNext} 
                    disabled={answerStatus === 'unanswered'}
                    className="ml-auto w-32"
                  >
                    {currentQuestionIndex === quizQuestions.length - 1 ? 'Finish' : 'Next'} <ArrowRight className="ml-2 w-4 h-4" />
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