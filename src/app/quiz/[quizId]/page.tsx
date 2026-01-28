// src/app/quiz/[quizId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  X, 
  AlertCircle, 
  Trophy, 
  RotateCcw,
  Loader2,
  Sparkles,
  Brain,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

// --- Types ---
interface Question {
  id: string;
  question_text: string;
  question_type: string;
  correct_answer: string;
  options: string[];
  explanation?: string;
}

// --- Fetcher ---
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TurboQuizPage() {
  const router = useRouter();
  const params = useParams();
  const { session } = useAuth();
  const quizId = params.quizId as string;

  // --- State ---
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Selection State
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState<string>("");
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  
  // Progress State
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- Data Fetching ---
  const { data: apiResponse, isLoading, error } = useSWR(
    session && quizId ? `/api/quiz/${quizId}` : null,
    fetcher,
    { 
      revalidateOnFocus: false,
      onSuccess: (data) => {
        if (data?.data?.questions) {
          setQuestions(data.data.questions);
        }
      }
    }
  );

  // --- Logic: Save Score on Finish ---
  useEffect(() => {
    if (isFinished && session && quizId) {
      const saveAttempt = async () => {
        setIsSaving(true);
        try {
          await fetch('/api/quiz/attempt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              quizId,
              score,
              total: questions.length
            }),
          });
        } catch (err) {
          console.error("Failed to save score", err);
        } finally {
          setIsSaving(false);
        }
      };
      
      saveAttempt();
      
      // Trigger Celebration if score is good (> 70%)
      if ((score / questions.length) > 0.7) {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function() {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
      }
    }
  }, [isFinished, session, quizId, score, questions.length]);

  // --- Handlers ---

  const handleOptionSelect = (option: string) => {
    if (isAnswered) return;
    
    setSelectedOption(option);
    const currentQ = questions[currentIndex];
    
    const correct = option === currentQ.correct_answer;
    
    setIsCorrect(correct);
    setIsAnswered(true);

    if (correct) {
      setScore((prev) => prev + 1);
      triggerMiniConfetti();
    }
  };

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isAnswered || !textAnswer.trim()) return;

    const currentQ = questions[currentIndex];
    // Normalize for case-insensitive comparison
    const correct = textAnswer.trim().toLowerCase() === currentQ.correct_answer.trim().toLowerCase();

    setIsCorrect(correct);
    setIsAnswered(true);

    if (correct) {
      setScore((prev) => prev + 1);
      triggerMiniConfetti();
    }
  };

  const triggerMiniConfetti = () => {
    confetti({
      particleCount: 40,
      spread: 70,
      origin: { y: 0.8 },
      disableForReducedMotion: true,
      colors: ['#22c55e', '#10b981'] 
    });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      // Reset state
      setSelectedOption(null);
      setTextAnswer("");
      setIsAnswered(false);
      setIsCorrect(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isAnswered && questions[currentIndex].question_type === 'FILL_IN_THE_BLANK') {
      handleTextSubmit();
    } else if (e.key === 'Enter' && isAnswered) {
      handleNext();
    }
  };

  // --- Loading / Error Views ---

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-8 w-full max-w-lg px-6">
          <div className="flex justify-between items-center">
             <Skeleton className="h-4 w-24 rounded-full" />
             <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <Skeleton className="h-12 w-3/4 mx-auto rounded-xl" />
          <div className="space-y-4">
             {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
             ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !questions || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-6 p-4 text-center bg-background">
        <div className="p-6 bg-destructive/5 rounded-full ring-1 ring-destructive/20">
           <AlertCircle className="w-12 h-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-medium">Unable to load quiz</h2>
          <p className="text-muted-foreground max-w-xs mx-auto">
            We couldn't find any questions for this quiz. It might be empty or deleted.
          </p>
        </div>
        <Button onClick={() => router.back()} variant="outline" className="rounded-xl">
          Return Home
        </Button>
      </div>
    );
  }

  // --- Results View ---
  if (isFinished) {
    const percentage = Math.round((score / questions.length) * 100);
    const isPass = percentage >= 70;

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 overflow-hidden relative">
        {/* Background blobs similar to landing */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl -z-10" />

        <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="w-full max-w-md"
        >
          <Card className="border-border/40 shadow-[0_8px_30px_rgba(0,0,0,0.06)] bg-card/80 backdrop-blur-xl rounded-[2rem]">
            <CardContent className="pt-12 pb-10 text-center space-y-8 px-8">
               
               {/* Icon */}
               <div className="relative inline-block">
                 <div className={cn(
                   "absolute inset-0 blur-2xl rounded-full opacity-50",
                   isPass ? "bg-green-500/30" : "bg-orange-500/30"
                 )} />
                 <div className={cn(
                   "relative inline-flex items-center justify-center p-6 rounded-2xl border mb-2",
                   isPass ? "bg-green-500/10 border-green-500/20" : "bg-orange-500/10 border-orange-500/20"
                 )}>
                    {isPass ? (
                      <Trophy className="w-10 h-10 text-green-600 dark:text-green-400" />
                    ) : (
                      <Brain className="w-10 h-10 text-orange-600 dark:text-orange-400" />
                    )}
                 </div>
               </div>
               
               {/* Score Text */}
               <div className="space-y-3">
                 <h2 className="text-5xl font-serif text-foreground">{percentage}%</h2>
                 <p className="text-muted-foreground text-lg">
                    You scored {score} out of {questions.length}
                 </p>
               </div>

               {/* Stats Grid */}
               <div className="grid grid-cols-2 gap-3 py-2">
                 <div className="bg-muted/30 rounded-2xl p-4 border border-border/40">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Status</div>
                    <div className={cn("font-medium", isPass ? "text-green-600" : "text-orange-600")}>
                      {isPass ? 'Passed' : 'Study More'}
                    </div>
                 </div>
                 <div className="bg-muted/30 rounded-2xl p-4 border border-border/40">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Total</div>
                    <div className="font-medium text-foreground">{questions.length} Qs</div>
                 </div>
               </div>
               
               {/* Actions */}
               <div className="grid grid-cols-2 gap-4 pt-2">
                 <Button variant="outline" onClick={() => window.location.reload()} className="h-12 rounded-xl border-border/60 hover:bg-muted/50">
                    <RotateCcw className="w-4 h-4 mr-2" /> Retry
                 </Button>
                 <Button onClick={() => router.push('/dashboard')} className="h-12 rounded-xl shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Complete
                 </Button>
               </div>

            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // --- Active Quiz View ---
  const currentQ = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const isFillBlank = currentQ.question_type === 'FILL_IN_THE_BLANK';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-hidden relative" onKeyDown={handleKeyDown}>
      
      {/* Background Decor */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -z-10 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[100px] -z-10 -translate-x-1/3 translate-y-1/3 pointer-events-none" />

      {/* 1. Header (Progress) */}
      <header className="px-6 h-24 flex items-center justify-between max-w-5xl mx-auto w-full shrink-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
        </Button>
        
        {/* Elegant Progress */}
        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
             <div className="flex justify-between w-full text-xs font-medium text-muted-foreground px-1">
                <span>Progress</span>
                <span>{currentIndex + 1} / {questions.length}</span>
             </div>
             <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                <motion.div 
                    className="h-full bg-primary" 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "circOut" }}
                />
             </div>
        </div>
        
        <div className="w-9" /> {/* Spacer */}
      </header>

      {/* 2. Main Question Area */}
      <main className="flex-1 flex flex-col items-center justify-center -mt-10 pb-24 px-4 w-full max-w-4xl mx-auto">
         <AnimatePresence mode="wait">
            <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full max-w-2xl flex flex-col items-center"
            >
                {/* Question Type Badge */}
                <div className="mb-8">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-[10px] font-bold tracking-widest uppercase text-primary">
                        <Sparkles className="w-3 h-3" />
                        {currentQ.question_type.replace(/_/g, ' ')}
                    </span>
                </div>

                {/* Question Text */}
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-center leading-[1.15] text-foreground text-balance mb-12">
                    {currentQ.question_text}
                </h2>

                {/* --- Input Area Based on Type --- */}
                
                {isFillBlank ? (
                  /* Fill in the Blank Layout */
                  <div className="w-full max-w-md space-y-6">
                    <div className="relative group">
                       <Input 
                          autoFocus
                          placeholder="Type your answer here..."
                          value={textAnswer}
                          onChange={(e) => !isAnswered && setTextAnswer(e.target.value)}
                          disabled={isAnswered}
                          className={cn(
                            "h-16 text-lg md:text-xl text-center rounded-2xl border-2 transition-all shadow-sm",
                            isAnswered 
                              ? isCorrect 
                                ? "border-green-500 bg-green-50 dark:bg-green-900/10 text-green-700" 
                                : "border-red-500 bg-red-50 dark:bg-red-900/10 text-red-700"
                              : "border-border/60 focus-visible:ring-primary/20 focus-visible:border-primary"
                          )}
                       />
                       {isAnswered && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                             {isCorrect 
                               ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                               : <AlertCircle className="w-6 h-6 text-red-500" />
                             }
                          </div>
                       )}
                    </div>
                    
                    {!isAnswered && (
                      <Button 
                        size="lg" 
                        className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20"
                        onClick={() => handleTextSubmit()}
                        disabled={!textAnswer.trim()}
                      >
                        Check Answer
                      </Button>
                    )}
                  </div>
                ) : (
                  /* Multiple Choice Layout */
                  <div className="grid grid-cols-1 gap-3 w-full">
                      {currentQ.options?.map((option: string, idx: number) => {
                          const isSelected = selectedOption === option;
                          const isCorrectAnswer = option === currentQ.correct_answer;
                          
                          let styleClass = "border-border/60 bg-card hover:border-primary/50 hover:bg-muted/30 hover:shadow-md";
                          
                          if (isAnswered) {
                              if (isCorrectAnswer) {
                                  styleClass = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 ring-1 ring-green-500";
                              } else if (isSelected && !isCorrectAnswer) {
                                  styleClass = "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
                              } else {
                                  styleClass = "opacity-50 grayscale border-border/40 bg-muted/10";
                              }
                          } else if (isSelected) {
                              styleClass = "border-primary ring-1 ring-primary bg-primary/5 shadow-md";
                          }

                          return (
                              <motion.button
                                  key={idx} 
                                  whileHover={!isAnswered ? { scale: 1.01, y: -2 } : {}}
                                  whileTap={!isAnswered ? { scale: 0.98 } : {}}
                                  onClick={() => handleOptionSelect(option)}
                                  disabled={isAnswered}
                                  className={cn(
                                      "relative p-5 rounded-2xl text-left transition-all duration-200 text-lg font-medium flex items-center justify-between group outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                      "shadow-[0_2px_10px_rgba(0,0,0,0.03)] border",
                                      styleClass
                                  )}
                              >
                                  <div className="flex items-center gap-5">
                                      <span className={cn(
                                          "w-8 h-8 rounded-lg border-2 flex items-center justify-center text-sm font-bold text-muted-foreground transition-colors",
                                          isAnswered && isCorrectAnswer ? "border-green-500 bg-green-500 text-white border-none" : "group-hover:border-primary/40 group-hover:text-primary"
                                      )}>
                                          {String.fromCharCode(65 + idx)}
                                      </span>
                                      <span>{option}</span>
                                  </div>
                                  
                                  {isAnswered && isCorrectAnswer && <Check className="w-5 h-5 text-green-600 animate-in zoom-in spin-in-90 duration-300" />}
                                  {isAnswered && isSelected && !isCorrectAnswer && <X className="w-5 h-5 text-red-600 animate-in zoom-in duration-300" />}
                              </motion.button>
                          );
                      })}
                  </div>
                )}
            </motion.div>
         </AnimatePresence>
      </main>

      {/* 3. Footer Area (Feedback & Next Button) */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 pointer-events-none flex justify-center z-20">
        <AnimatePresence>
            {isAnswered && (
                <motion.div 
                    initial={{ y: 100, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 100, opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="w-full max-w-2xl bg-card/95 backdrop-blur-md border border-border/60 shadow-[0_20px_60px_rgba(0,0,0,0.15)] rounded-3xl p-5 pointer-events-auto flex flex-col md:flex-row items-center justify-between gap-5 ring-1 ring-black/5"
                >
                    <div className="flex items-start gap-4 w-full md:w-auto">
                        <div className={cn(
                            "p-3 rounded-2xl shrink-0 flex items-center justify-center shadow-inner", 
                            isCorrect ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                            {isCorrect ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
                        </div>
                        <div className="space-y-1">
                            <p className={cn("font-bold text-lg", isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
                                {isCorrect ? "Correct!" : "Incorrect"}
                            </p>
                            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                                {currentQ.explanation || (isCorrect ? "Great job!" : `The correct answer was: ${currentQ.correct_answer}`)}
                            </p>
                        </div>
                    </div>
                    
                    <Button 
                      onClick={handleNext} 
                      size="lg" 
                      className="w-full md:w-auto rounded-xl px-8 h-12 text-base font-medium shadow-md bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                    >
                        {currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'} 
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
      </footer>
    </div>
  );
}