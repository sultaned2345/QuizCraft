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
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  X, 
  AlertCircle, 
  Trophy, 
  RotateCcw,
  Loader2 
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

interface QuizData {
  quiz: {
    id: string;
    title: string;
    description?: string;
  };
  questions: Question[];
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
          console.log("Score saved!");
        } catch (err) {
          console.error("Failed to save score", err);
        } finally {
          setIsSaving(false);
        }
      };
      
      saveAttempt();
      
      // Trigger Celebration if score is good (> 70%)
      if ((score / questions.length) > 0.7) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#f59e0b']
        });
      }
    }
  }, [isFinished, session, quizId, score, questions.length]);

  // --- Handlers ---

  const handleSelect = (option: string) => {
    if (isAnswered) return; // Prevent changing answer
    
    setSelectedOption(option);
    const currentQ = questions[currentIndex];
    
    // Check Answer
    // Note: You might want to normalize strings (trim/lowercase) if needed
    const correct = option === currentQ.correct_answer;
    
    setIsCorrect(correct);
    setIsAnswered(true);

    if (correct) {
      setScore((prev) => prev + 1);
      // Mini confetti for correct answer
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.8 },
        disableForReducedMotion: true,
        colors: ['#22c55e'] 
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      // Go to next question
      setCurrentIndex((prev) => prev + 1);
      // Reset state
      setSelectedOption(null);
      setIsAnswered(false);
      setIsCorrect(false);
    } else {
      // Finish Quiz
      setIsFinished(true);
    }
  };

  // --- Loading / Error Views ---

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="space-y-6 w-full max-w-md px-6 animate-pulse">
          <div className="flex justify-between items-center">
             <Skeleton className="h-4 w-20" />
             <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-8 w-3/4 mx-auto rounded-lg" />
          <Skeleton className="h-64 w-full rounded-3xl" />
          <div className="space-y-3">
             <Skeleton className="h-14 w-full rounded-2xl" />
             <Skeleton className="h-14 w-full rounded-2xl" />
             <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !questions || questions.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4 p-4 text-center">
        <div className="p-4 bg-destructive/10 rounded-full">
           <AlertCircle className="w-10 h-10 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">Unable to load quiz</h2>
        <p className="text-muted-foreground max-w-xs">
          The quiz could not be found or has no questions.
        </p>
        <Button onClick={() => router.back()} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  // --- Results View ---
  if (isFinished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md"
        >
          <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-xl ring-1 ring-border">
            <CardContent className="pt-10 pb-8 text-center space-y-8">
               
               {/* Icon */}
               <div className="relative inline-block">
                 <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                 <div className="relative inline-flex items-center justify-center p-6 rounded-full bg-background border-2 border-primary/20">
                    <Trophy className="w-12 h-12 text-primary" />
                 </div>
               </div>
               
               {/* Score Text */}
               <div className="space-y-2">
                 <h2 className="text-4xl font-bold tracking-tight">{percentage}%</h2>
                 <p className="text-muted-foreground font-medium text-lg">
                    You scored {score} out of {questions.length}
                 </p>
               </div>

               {/* Progress Bar */}
               <div className="space-y-2">
                 <div className="flex justify-between text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    <span>Performance</span>
                    <span>{percentage >= 70 ? 'Excellent' : 'Keep Practicing'}</span>
                 </div>
                 <Progress value={percentage} className="h-3 w-full rounded-full" />
               </div>
               
               {/* Actions */}
               <div className="grid grid-cols-2 gap-4 pt-4">
                 <Button variant="outline" onClick={() => window.location.reload()} className="h-12 rounded-xl border-2">
                    <RotateCcw className="w-4 h-4 mr-2" /> Retry
                 </Button>
                 <Button onClick={() => router.push('/dashboard')} className="h-12 rounded-xl shadow-lg shadow-primary/20">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                    Done
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      
      {/* 1. Header (Progress) */}
      <header className="px-6 h-20 flex items-center justify-between max-w-5xl mx-auto w-full shrink-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-muted/80">
            <ArrowLeft className="w-5 h-5" />
        </Button>
        
        {/* Progress Pill */}
        <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-3 bg-muted/40 backdrop-blur-md border px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm">
                <span className="text-muted-foreground uppercase tracking-wide">
                    Question {currentIndex + 1} <span className="text-border mx-1">|</span> {questions.length}
                </span>
            </div>
            {/* Slim progress line below pill */}
            <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div 
                    className="h-full bg-primary" 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                />
            </div>
        </div>
        
        <div className="w-9" /> {/* Spacer for visual balance with back button */}
      </header>

      {/* 2. Main Question Area */}
      <main className="flex-1 flex flex-col items-center justify-start pt-4 md:pt-12 pb-10 px-4">
        <div className="w-full max-w-2xl relative min-h-[400px] flex flex-col">
            
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -50, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="flex-1 flex flex-col"
                >
                    {/* Badge */}
                    <div className="mb-6 flex justify-center">
                        <Badge variant="outline" className="uppercase tracking-widest text-[10px] py-1 px-3 border-primary/20 text-primary bg-primary/5">
                            {currentQ.question_type.replace(/_/g, ' ')}
                        </Badge>
                    </div>

                    {/* Question Text */}
                    <h2 className="text-2xl md:text-3xl font-semibold text-center leading-relaxed mb-10 text-pretty">
                        {currentQ.question_text}
                    </h2>

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 gap-3 w-full">
                        {currentQ.options?.map((option: string, idx: number) => {
                            const isSelected = selectedOption === option;
                            const isCorrectAnswer = option === currentQ.correct_answer;
                            
                            // Determine Style based on state
                            let styleClass = "border-border bg-card hover:border-primary/50 hover:bg-muted/50 shadow-sm";
                            
                            if (isAnswered) {
                                if (isCorrectAnswer) {
                                    styleClass = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 ring-1 ring-green-500";
                                } else if (isSelected && !isCorrectAnswer) {
                                    styleClass = "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
                                } else {
                                    styleClass = "opacity-50 grayscale border-border bg-muted/20";
                                }
                            } else if (isSelected) {
                                styleClass = "border-primary ring-1 ring-primary bg-primary/5 shadow-md";
                            }

                            return (
                                <motion.button
                                    key={idx} 
                                    whileTap={!isAnswered ? { scale: 0.98 } : {}}
                                    onClick={() => handleSelect(option)}
                                    disabled={isAnswered}
                                    className={cn(
                                        "relative p-4 md:p-5 rounded-2xl text-left transition-all duration-200 text-base md:text-lg font-medium flex items-center justify-between group outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        styleClass
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className={cn(
                                            "w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold text-muted-foreground group-hover:border-primary/50 transition-colors",
                                            isAnswered && isCorrectAnswer && "border-green-500 text-green-600 bg-green-100 dark:bg-green-900/30",
                                            isAnswered && isSelected && !isCorrectAnswer && "border-red-500 text-red-600 bg-red-100 dark:bg-red-900/30"
                                        )}>
                                            {String.fromCharCode(65 + idx)}
                                        </span>
                                        <span>{option}</span>
                                    </div>
                                    
                                    {/* Status Icons */}
                                    {isAnswered && isCorrectAnswer && <Check className="w-5 h-5 text-green-600 animate-in zoom-in spin-in-90 duration-300" />}
                                    {isAnswered && isSelected && !isCorrectAnswer && <X className="w-5 h-5 text-red-600 animate-in zoom-in duration-300" />}
                                </motion.button>
                            );
                        })}
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
      </main>

      {/* 3. Footer Area (Feedback & Next Button) */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-transparent pointer-events-none flex justify-center">
        <AnimatePresence>
            {isAnswered && (
                <motion.div 
                    initial={{ y: 100, opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 50, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="w-full max-w-2xl bg-card border shadow-2xl rounded-3xl p-4 md:p-5 pointer-events-auto flex items-center justify-between gap-4 ring-1 ring-black/5 dark:ring-white/10"
                >
                    <div className="flex items-start gap-3.5 overflow-hidden">
                        <div className={cn(
                            "p-2.5 rounded-full shrink-0 flex items-center justify-center", 
                            isCorrect ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}>
                            {isCorrect ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                        </div>
                        <div className="space-y-0.5">
                            <p className={cn("font-bold text-sm md:text-base", isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
                                {isCorrect ? "Correct!" : "Incorrect"}
                            </p>
                            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 md:line-clamp-1 leading-snug">
                                {currentQ.explanation || (isCorrect ? "Well done!" : `The correct answer was: ${currentQ.correct_answer}`)}
                            </p>
                        </div>
                    </div>
                    
                    <Button onClick={handleNext} size="lg" className="rounded-xl px-6 h-12 text-base shadow-md shrink-0">
                        {currentIndex === questions.length - 1 ? 'Finish' : 'Next'} 
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
      </footer>
    </div>
  );
}