// src/app/quiz/[quizId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
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

// --- TYPES ---
interface QuizData {
  quiz: Quiz;
  questions: Question[];
}

type AnswerStatus = 'unanswered' | 'correct' | 'incorrect';
type QuizQuestion = Question;

// --- HELPERS ---
function shuffleArray<T>(array: T[] | undefined | null): T[] {
  if (!array || !Array.isArray(array)) return [];
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// --- SUB-COMPONENT: MATCHING GAME ---
function MatchingQuestionUI({
  question,
  answerStatus,
  onQuestionComplete,
}: {
  question: QuizQuestion;
  answerStatus: AnswerStatus;
  onQuestionComplete: (isCorrect: boolean) => void;
}) {
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);
  const [userMatches, setUserMatches] = useState<(string | null)[]>([]); // Array of answers in slots
  const [optionBank, setOptionBank] = useState<string[]>([]);

  // Initialize: Shuffle options once
  useEffect(() => {
    const rawOptions = (question.options as string[]) || [];
    setOptionBank(shuffleArray(rawOptions));
    setUserMatches(new Array((question.prompts as string[] || []).length).fill(null));
    setSelectedSlotIdx(null);
  }, [question]);

  const handleSlotClick = (idx: number) => {
    if (answerStatus !== 'unanswered') return;
    
    // If clicking a filled slot, clear it
    if (userMatches[idx] !== null) {
      const newMatches = [...userMatches];
      newMatches[idx] = null;
      setUserMatches(newMatches);
    } else {
      // Select this slot to be filled
      setSelectedSlotIdx(idx === selectedSlotIdx ? null : idx);
    }
  };

  const handleBankOptionClick = (optionValue: string) => {
    if (answerStatus !== 'unanswered') return;

    // If a slot is selected, fill it
    if (selectedSlotIdx !== null) {
      const newMatches = [...userMatches];
      newMatches[selectedSlotIdx] = optionValue;
      setUserMatches(newMatches);
      
      // Auto-jump to next empty slot
      const nextEmpty = newMatches.findIndex(m => m === null);
      setSelectedSlotIdx(nextEmpty !== -1 ? nextEmpty : null);
    }
  };

  const isOptionUsed = (opt: string) => userMatches.includes(opt);
  const prompts = (question.prompts as string[]) || [];
  const correctOptions = (question.options as string[]) || [];

  const handleSubmit = () => {
    // Check all matches
    let isAllCorrect = true;
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Prompts & Slots */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Match Items
          </h4>
          <div className="space-y-3">
            {prompts.map((prompt, idx) => {
              const userAns = userMatches[idx];
              const isSelected = selectedSlotIdx === idx;
              
              // Determine Border Color
              let containerClass = "border-border/60 hover:border-primary/50";
              if (answerStatus !== 'unanswered') {
                 const isCorrect = userAns?.trim().toLowerCase() === correctOptions[idx]?.trim().toLowerCase();
                 containerClass = isCorrect 
                  ? "border-green-500 bg-green-50/50 text-green-900" 
                  : "border-red-500 bg-red-50/50 text-red-900";
              } else if (isSelected) {
                 containerClass = "border-primary ring-2 ring-primary/20 bg-primary/5";
              } else if (userAns) {
                 containerClass = "border-primary/60 bg-primary/5";
              }

              return (
                <div 
                  key={idx} 
                  onClick={() => handleSlotClick(idx)}
                  className={cn(
                    "relative flex flex-col p-3 rounded-xl border-2 transition-all cursor-pointer group",
                    containerClass,
                    answerStatus !== 'unanswered' && "pointer-events-none"
                  )}
                >
                  <span className="text-sm font-medium mb-2">{prompt}</span>
                  
                  {/* The "Slot" */}
                  <div className={cn(
                    "h-10 rounded-md border border-dashed flex items-center px-3 text-sm transition-colors",
                    userAns 
                      ? "bg-background border-solid border-primary/30 font-medium shadow-sm" 
                      : "bg-muted/40 border-muted-foreground/20 text-muted-foreground italic"
                  )}>
                    {userAns || "Tap to select..."}
                    {userAns && answerStatus === 'unanswered' && (
                       <X className="ml-auto w-3 h-3 opacity-40 group-hover:opacity-100" />
                    )}
                  </div>

                  {/* Result Icon */}
                  {answerStatus !== 'unanswered' && (
                    <div className="absolute top-3 right-3">
                      {userMatches[idx]?.trim().toLowerCase() === correctOptions[idx]?.trim().toLowerCase() 
                        ? <Check className="w-4 h-4 text-green-600" />
                        : <X className="w-4 h-4 text-red-600" />
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Answer Bank */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex justify-between">
            <span>Options</span>
            {answerStatus === 'unanswered' && <span className="font-normal normal-case opacity-60">Click to fill selected slot</span>}
          </h4>
          <div className="flex flex-col gap-2">
            {optionBank.map((option, idx) => {
              const used = isOptionUsed(option);
              return (
                <Button
                  key={idx}
                  variant={used ? "ghost" : "outline"}
                  className={cn(
                    "justify-start h-auto py-3 px-4 text-left whitespace-normal",
                    used ? "opacity-30 grayscale" : "hover:border-primary hover:bg-primary/5 shadow-sm",
                    answerStatus !== 'unanswered' && "opacity-0 hidden"
                  )}
                  disabled={used || answerStatus !== 'unanswered'}
                  onClick={() => handleBankOptionClick(option)}
                >
                  {!used && <ArrowRight className="w-3 h-3 mr-2 text-primary/50" />}
                  <span className="flex-1">{option}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {answerStatus === 'unanswered' && (
        <Button 
          className="w-full h-12 text-lg mt-6" 
          onClick={handleSubmit}
          disabled={userMatches.some(m => m === null)}
        >
          Submit Answers
        </Button>
      )}
    </div>
  );
}

// --- MAIN PAGE COMPONENT ---
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
    (url: string) => fetcher(url, { headers: { Authorization: `Bearer ${session!.access_token}` } }),
    { revalidateOnFocus: false }
  );

  const quizData = apiResponse?.data;

  // Initialize & Shuffle
  useEffect(() => {
    if (quizData?.questions?.length) {
      const shuffledQuestions = shuffleArray(quizData.questions);
      const processed = shuffledQuestions.map((q) => {
        if (q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
          return { ...q, options: shuffleArray(q.options as string[]) };
        }
        return q;
      });
      setQuizQuestions(processed);
    }
  }, [quizData]);

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const progress = quizQuestions.length ? ((currentQuestionIndex + 1) / quizQuestions.length) * 100 : 0;

  // Handlers
  const handleAnswerSelect = (answer: string) => {
    if (answerStatus !== 'unanswered') return;
    const trimmed = answer.trim();
    setSelectedAnswer(trimmed);

    let isCorrect = false;
    const type = currentQuestion.question_type;
    
    if (type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE') {
      isCorrect = currentQuestion.correct_answer === trimmed;
    } else if (type === 'FILL_IN_THE_BLANK') {
      const validOpts = (currentQuestion.options as string[]) || [];
      const userLower = trimmed.toLowerCase();
      isCorrect = validOpts.length > 0 
        ? validOpts.some(o => o.toLowerCase().trim() === userLower)
        : currentQuestion.correct_answer.toLowerCase().trim() === userLower;
    }

    setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) setCorrectAnswers(p => p + 1);
  };

  const handleMatchingComplete = (isCorrect: boolean) => {
    setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) setCorrectAnswers(p => p + 1);
  };

  const handleNext = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(p => p + 1);
      setSelectedAnswer(null);
      setAnswerStatus('unanswered');
      setShowHint(false);
    } else {
      setIsFinished(true);
      // Save attempt logic here...
      if (session) {
         fetch('/api/quiz/attempt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ quizId, score: correctAnswers, total: quizQuestions.length })
         }).catch(console.error);
      }
    }
  };

  const handleRestart = () => {
    window.location.reload(); // Simple reload to re-fetch and re-shuffle
  };

  const getOptionClass = (opt: string) => {
    if (answerStatus === 'unanswered') return 'hover:border-primary/50 hover:bg-muted/50';
    if (currentQuestion.correct_answer === opt) return 'border-green-500 bg-green-50 text-green-900 ring-1 ring-green-500';
    if (selectedAnswer === opt) return 'border-red-500 bg-red-50 text-red-900 ring-1 ring-red-500';
    return 'opacity-50';
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (error || !currentQuestion) return <div className="p-8 text-center text-red-500">Failed to load quiz.</div>;

  return (
    <div className="flex flex-col h-full min-h-screen max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => router.push('/quizzes')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Exit
        </Button>
        <div className="text-right">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Question {currentQuestionIndex + 1} / {quizQuestions.length}
          </p>
          <Progress value={progress} className="w-32 h-1.5" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isFinished ? (
          <motion.div 
            key="result"
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center"
          >
             <Card className="w-full max-w-md shadow-2xl border-none ring-1 ring-border/50">
                <CardHeader className="text-center pb-2">
                   <CardTitle className="text-3xl font-bold">Quiz Complete!</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-6 py-8">
                   <div className="relative p-6 bg-yellow-50 rounded-full">
                      <Trophy className="w-20 h-20 text-yellow-500" />
                   </div>
                   <div className="text-center">
                      <div className="text-5xl font-black text-primary mb-2">
                         {Math.round((correctAnswers / quizQuestions.length) * 100)}%
                      </div>
                      <p className="text-muted-foreground">
                         You got {correctAnswers} out of {quizQuestions.length} correct
                      </p>
                   </div>
                </CardContent>
                <CardFooter className="flex gap-3 pb-8 px-8">
                   <Button onClick={handleRestart} className="flex-1 h-12" variant="outline">
                      <RefreshCcw className="mr-2 h-4 w-4" /> Again
                   </Button>
                   <Button onClick={() => router.push('/quizzes')} className="flex-1 h-12">
                      Done
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
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex-1"
          >
            <Card className={cn(
               "shadow-lg border-t-4 transition-colors duration-300", 
               answerStatus === 'correct' ? "border-t-green-500" : answerStatus === 'incorrect' ? "border-t-red-500" : "border-t-primary"
            )}>
              <CardContent className="p-6 md:p-8">
                {/* Question Text */}
                <h2 className="text-xl md:text-2xl font-semibold leading-relaxed text-foreground mb-8">
                  {currentQuestion.question_text}
                </h2>

                {/* Question Content */}
                <div className="space-y-6">
                  {currentQuestion.question_type === 'MATCHING' ? (
                    <MatchingQuestionUI 
                       question={currentQuestion} 
                       answerStatus={answerStatus} 
                       onQuestionComplete={handleMatchingComplete} 
                    />
                  ) : (
                    // Multiple Choice / True False
                    <div className="grid grid-cols-1 gap-3">
                      {(['MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(currentQuestion.question_type)) && 
                        (currentQuestion.options as string[] || []).map((option) => (
                        <Button
                          key={option}
                          variant="outline"
                          className={cn(
                            "h-auto min-h-16 justify-start text-left px-6 py-4 text-base whitespace-normal transition-all relative overflow-hidden",
                            answerStatus !== 'unanswered' && "pointer-events-none",
                            getOptionClass(option)
                          )}
                          onClick={() => handleAnswerSelect(option)}
                        >
                          <span className="relative z-10">{option}</span>
                        </Button>
                      ))}

                      {/* Fill in Blank */}
                      {currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                         <div className="space-y-4 max-w-md mx-auto">
                            <Input 
                               autoFocus
                               placeholder="Type your answer..."
                               className="h-14 text-lg px-4"
                               value={selectedAnswer || ''}
                               onChange={e => setSelectedAnswer(e.target.value)}
                               onKeyDown={e => e.key === 'Enter' && answerStatus === 'unanswered' && selectedAnswer && handleAnswerSelect(selectedAnswer)}
                               disabled={answerStatus !== 'unanswered'}
                            />
                            <Button 
                               className="w-full h-12"
                               disabled={!selectedAnswer || answerStatus !== 'unanswered'}
                               onClick={() => handleAnswerSelect(selectedAnswer!)}
                            >
                               Submit
                            </Button>
                         </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Explanation Feedback */}
                <AnimatePresence>
                  {answerStatus !== 'unanswered' && (
                    <motion.div
                       initial={{ opacity: 0, height: 0 }}
                       animate={{ opacity: 1, height: 'auto' }}
                       className={cn(
                          "mt-8 p-6 rounded-xl border flex flex-col gap-3",
                          answerStatus === 'correct' ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200"
                       )}
                    >
                       <div className="flex items-center gap-3 font-bold text-lg">
                          {answerStatus === 'correct' 
                             ? <><Check className="w-6 h-6 text-green-600" /><span className="text-green-800">Correct!</span></>
                             : <><X className="w-6 h-6 text-red-600" /><span className="text-red-800">Incorrect</span></>
                          }
                       </div>
                       
                       {answerStatus === 'incorrect' && currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                          <div className="text-foreground font-medium">
                             Answer: {currentQuestion.correct_answer}
                          </div>
                       )}

                       {currentQuestion.explanation && (
                          <div className="text-muted-foreground leading-relaxed">
                             {currentQuestion.explanation}
                          </div>
                       )}
                    </motion.div>
                  )}
                </AnimatePresence>

              </CardContent>
              <CardFooter className="p-6 bg-muted/5 border-t flex justify-between">
                 <Button
                    variant="ghost"
                    onClick={() => setShowHint(true)}
                    disabled={answerStatus !== 'unanswered' || !currentQuestion.explanation}
                    className={cn(!currentQuestion.explanation && "invisible")}
                 >
                    <Lightbulb className="w-4 h-4 mr-2" /> Hint
                 </Button>

                 {showHint && (
                    <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="absolute bottom-20 left-6 right-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg shadow-lg z-20 text-sm">
                       <span className="font-bold">Hint:</span> {currentQuestion.explanation}
                    </motion.div>
                 )}

                 <Button 
                    onClick={handleNext} 
                    disabled={answerStatus === 'unanswered'}
                    size="lg"
                    className="pl-8 pr-6"
                 >
                    {currentQuestionIndex === quizQuestions.length - 1 ? "Finish Quiz" : "Next Question"}
                    <ArrowRight className="ml-2 w-4 h-4" />
                 </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}