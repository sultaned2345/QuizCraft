// components/PopQuizModal.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Question } from '@/types/database';
import { Loader2, Check, X, RotateCw, Trophy, AlertCircle, ArrowRight, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PopQuizModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  questions: Question[];
  title?: string;
}

type AnswerStatus = 'unanswered' | 'correct' | 'incorrect';

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function PopQuizModal({
  isOpen,
  onOpenChange,
  questions,
  title = 'Pop Quiz!',
}: PopQuizModalProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>('unanswered');
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);

  // Initialize and Shuffle
  useEffect(() => {
    if (isOpen && questions.length > 0) {
      const shuffledQuestions = shuffleArray(questions).map((q) => {
        if (q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
          return { ...q, options: shuffleArray(q.options as string[]) };
        }
        return q;
      });
      setQuizQuestions(shuffledQuestions);
      resetState();
    }
  }, [isOpen, questions]);

  const resetState = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setAnswerStatus('unanswered');
    setCorrectAnswers(0);
    setIsFinished(false);
  };

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const progress =
    quizQuestions.length > 0
      ? ((currentQuestionIndex + 1) / quizQuestions.length) * 100
      : 0;

  const handleAnswerSelect = (answer: string) => {
    if (answerStatus !== 'unanswered') return;

    setSelectedAnswer(answer);
    const isCorrect = currentQuestion.correct_answer === answer;

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
      setIsFinished(true);
    }
  };

  const getOptionClass = (optionText: string) => {
    if (answerStatus === 'unanswered') {
      return 'border-border hover:bg-accent hover:text-accent-foreground';
    }
    const isCorrect = currentQuestion.correct_answer === optionText;
    
    if (isCorrect) return 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 ring-1 ring-green-500';
    if (selectedAnswer === optionText && !isCorrect) return 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 ring-1 ring-red-500';
    
    return 'border-border opacity-50';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]">
        <AnimatePresence mode="wait">
          {!currentQuestion ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isFinished ? (
            // --- Results Screen ---
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center p-8 text-center"
            >
              <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mb-6">
                <Trophy className="w-10 h-10 text-yellow-600 dark:text-yellow-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
              <p className="text-muted-foreground mb-6">
                You scored {correctAnswers} out of {quizQuestions.length}
              </p>
              <div className="text-5xl font-black text-primary mb-8">
                {Math.round((correctAnswers / quizQuestions.length) * 100)}%
              </div>
              <div className="flex w-full gap-3">
                <Button variant="outline" className="flex-1" onClick={() => {
                   const reshuffled = shuffleArray(quizQuestions);
                   setQuizQuestions(reshuffled);
                   resetState();
                }}>
                  <RotateCw className="mr-2 h-4 w-4" /> Retry
                </Button>
                <Button className="flex-1" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </motion.div>
          ) : (
            // --- Question Screen ---
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full"
            >
              {/* Header */}
              <DialogHeader className="p-6 pb-4 border-b bg-muted/10">
                <div className="flex justify-between items-center mb-4">
                  <DialogTitle className="text-xl">{title}</DialogTitle>
                  <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-md">
                    {currentQuestionIndex + 1} / {quizQuestions.length}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </DialogHeader>

              {/* Scrollable Content */}
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  <p className="text-lg font-medium leading-relaxed">
                    {currentQuestion.question_text}
                  </p>

                  <div className="grid gap-3">
                    {/* Options Loop */}
                    {currentQuestion.question_type === 'MULTIPLE_CHOICE' &&
                      (currentQuestion.options as string[]).map((option) => (
                        <Button
                          key={option}
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left h-auto p-4 whitespace-normal transition-all text-base",
                            getOptionClass(option)
                          )}
                          disabled={answerStatus !== 'unanswered'}
                          onClick={() => handleAnswerSelect(option)}
                        >
                          <div className="flex items-center w-full gap-3">
                             {/* Circle Indicator */}
                            <div className={cn(
                                "w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                selectedAnswer === option ? "border-current" : "border-muted-foreground/30"
                            )}>
                                {answerStatus !== 'unanswered' && getOptionClass(option).includes('green') && <Check className="w-3.5 h-3.5" />}
                                {answerStatus !== 'unanswered' && getOptionClass(option).includes('red') && <X className="w-3.5 h-3.5" />}
                            </div>
                            <span className="flex-1">{option}</span>
                          </div>
                        </Button>
                      ))}
                      
                      {/* True/False Loop */}
                      {currentQuestion.question_type === 'TRUE_FALSE' &&
                      ['True', 'False'].map((option) => (
                        <Button
                          key={option}
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left h-auto p-4 text-base",
                            getOptionClass(option)
                          )}
                          disabled={answerStatus !== 'unanswered'}
                          onClick={() => handleAnswerSelect(option)}
                        >
                           <span className="flex-1 font-medium">{option}</span>
                           {answerStatus !== 'unanswered' && getOptionClass(option).includes('green') && <Check className="w-4 h-4 ml-auto" />}
                           {answerStatus !== 'unanswered' && getOptionClass(option).includes('red') && <X className="w-4 h-4 ml-auto" />}
                        </Button>
                      ))}
                  </div>

                  {/* Enhanced Explanation Feedback */}
                  <AnimatePresence>
                    {answerStatus !== 'unanswered' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, y: 10 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            className={cn(
                                "rounded-xl border p-5 overflow-hidden",
                                answerStatus === 'correct' 
                                    ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900" 
                                    : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
                            )}
                        >
                            <div className={cn(
                                "flex items-center gap-2 font-bold text-lg mb-2",
                                answerStatus === 'correct' ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                            )}>
                                {answerStatus === 'correct' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                                {answerStatus === 'correct' ? "Correct!" : "Incorrect"}
                            </div>
                            
                            <div className={cn(
                                "pl-3 border-l-2",
                                answerStatus === 'correct' ? "border-emerald-200 dark:border-emerald-800" : "border-red-200 dark:border-red-800"
                            )}>
                                <p className="text-sm text-foreground/80 leading-relaxed">
                                    {currentQuestion.explanation || "No explanation provided."}
                                </p>
                            </div>
                        </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="p-6 pt-4 border-t bg-muted/5 flex justify-end">
                <Button 
                  onClick={handleNext} 
                  disabled={answerStatus === 'unanswered'}
                  className="w-full sm:w-auto gap-2"
                  size="lg"
                >
                  {currentQuestionIndex === quizQuestions.length - 1 ? "View Results" : "Next Question"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}