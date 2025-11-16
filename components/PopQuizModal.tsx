// components/PopQuizModal.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Question } from '@/types/database';
import { Loader2, Check, X, RotateCw, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface PopQuizModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  questions: Question[];
  title?: string;
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

  // Shuffle questions and answers when modal opens
  useEffect(() => {
    if (isOpen && questions.length > 0) {
      const shuffledQuestions = shuffleArray(questions);

      const questionsWithShuffledOptions = shuffledQuestions.map((q) => {
        if (q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
          // The API returns options as simple strings for Pop Quiz
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
  }, [isOpen, questions]); // Reruns when modal is opened or questions change

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quizQuestions.length) * 100;

  const handleAnswerSelect = (answer: string) => {
    if (answerStatus !== 'unanswered') return; // Already answered

    setSelectedAnswer(answer);

    let isCorrect = false;
    // --- FIX: PopQuiz data is simple, just check correct_answer ---
    if (
      currentQuestion.question_type === 'MULTIPLE_CHOICE' ||
      currentQuestion.question_type === 'TRUE_FALSE'
    ) {
      isCorrect = currentQuestion.correct_answer === answer;
    }
    // --- END FIX ---

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
    if (questions.length > 0) {
      const shuffledQuestions = shuffleArray(questions);
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
    
    // --- FIX: PopQuiz data is simple ---
    const isCorrect = currentQuestion.correct_answer === optionText;
    // --- END FIX ---

    if (isCorrect) {
      // Is the correct answer
      return 'border-green-500 bg-green-500/10 text-green-700 ring-2 ring-green-500';
    }
    if (selectedAnswer === optionText && !isCorrect) {
      // Is the selected, incorrect answer
      return 'border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive';
    }

    // Is neither selected nor correct (an incorrect option)
    return 'border-border opacity-60';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <AnimatePresence mode="wait">
          {!currentQuestion ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : isFinished ? (
            // --- Summary Screen ---
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <DialogHeader className="p-6 pb-4">
                <DialogTitle className="text-2xl text-center">
                  Quiz Complete!
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center p-6 pt-0">
                <Trophy className="w-16 h-16 text-yellow-500" />
                <h3 className="text-4xl font-bold mt-4">
                  {correctAnswers} / {quizQuestions.length}
                </h3>
                <p className="text-lg text-muted-foreground">
                  Your score:{' '}
                  {Math.round((correctAnswers / quizQuestions.length) * 100)}%
                </p>
                <div className="flex w-full gap-4 mt-8">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleRestart}
                  >
                    <RotateCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  <Button
                    className="w-full"
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
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
              <DialogHeader className="p-6 pb-2">
                <DialogTitle className="text-xl">{title}</DialogTitle>
                <div className="flex items-center gap-4 pt-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Question {currentQuestionIndex + 1} of{' '}
                    {quizQuestions.length}
                  </span>
                  <Progress value={progress} className="flex-1 h-2" />
                </div>
              </DialogHeader>

              <div className="p-6">
                <Card className="border-none shadow-none">
                  <CardContent className="p-0">
                    <p className="text-lg font-semibold mb-4 min-h-[60px]">
                      {currentQuestion.question_text}
                    </p>
                    {/* Flippable Card Container */}
                    <div
                      className="w-full h-64 [perspective:1000px] cursor-pointer"
                      onClick={handleCardFlip}
                    >
                      {/* --- FIX: Use standard Tailwind classes --- */}
                      <motion.div
                        className="relative w-full h-full transform-style-preserve-3d"
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                        transition={{ duration: 0.5 }}
                      >
                        {/* Front of Card (Shows Options) */}
                        <div className="absolute backface-hidden w-full h-full">
                          {/* --- END FIX --- */}
                          <Card className="flex h-full items-center justify-center p-6 shadow-lg">
                            <div className="space-y-3 w-full">
                              {/* --- FIX: PopQuiz data is simple --- */}
                              {/* Multiple Choice */}
                              {currentQuestion.question_type ===
                                'MULTIPLE_CHOICE' &&
                                (currentQuestion.options as string[]).map(
                                  (option) => (
                                    <Button
                                      key={option}
                                      variant="outline"
                                      className={cn(
                                        'h-auto min-h-12 w-full justify-start text-left p-4 whitespace-normal',
                                        answerStatus !== 'unanswered' &&
                                          'pointer-events-none',
                                        getOptionClass(option)
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation(); // Don't flip card
                                        handleAnswerSelect(option);
                                      }}
                                    >
                                      <span className="flex-1">{option}</span>
                                      {answerStatus !== 'unanswered' &&
                                        getOptionClass(option).includes(
                                          'green'
                                        ) && (
                                          <Check className="w-5 h-5 ml-2 text-green-600" />
                                        )}
                                      {answerStatus !== 'unanswered' &&
                                        getOptionClass(option).includes(
                                          'destructive'
                                        ) && (
                                          <X className="w-5 h-5 ml-2 text-destructive" />
                                        )}
                                    </Button>
                                  )
                                )}

                              {/* True/False */}
                              {currentQuestion.question_type ===
                                'TRUE_FALSE' &&
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
                                    onClick={(e) => {
                                      e.stopPropagation(); // Don't flip card
                                      handleAnswerSelect(option);
                                    }}
                                  >
                                    <span className="flex-1">{option}</span>
                                    {answerStatus !== 'unanswered' &&
                                      getOptionClass(option).includes(
                                        'green'
                                      ) && (
                                        <Check className="w-5 h-5 ml-2 text-green-600" />
                                      )}
                                    {answerStatus !== 'unanswered' &&
                                      getOptionClass(option).includes(
                                        'destructive'
                                      ) && (
                                        <X className="w-5 h-5 ml-2 text-destructive" />
                                      )}
                                  </Button>
                                ))}
                              {/* --- END FIX --- */}
                            </div>
                          </Card>
                        </div>
                        {/* Back of Card (Shows Explanation) */}
                        {/* --- FIX: Use standard Tailwind classes --- */}
                        <div className="absolute backface-hidden w-full h-full [transform:rotateY(180deg)]">
                          {/* --- END FIX --- */}
                          <Card className="flex h-full items-center justify-center p-6 shadow-lg bg-secondary">
                            {/* --- FIX: Use correct property --- */}
                            <p className="text-xl text-center">
                              {currentQuestion.explanation ||
                                'No explanation provided.'}
                            </p>
                            {/* --- END FIX --- */}
                          </Card>
                        </div>
                      </motion.div>
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
                          That's correct! (Click card for explanation)
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
                            That's not right. (Click card for explanation)
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </div>

              <div className="p-6 pt-0 flex justify-between items-center">
                <Button variant="ghost" onClick={handleCardFlip}>
                  {isFlipped ? 'Show Question' : 'Show Explanation'}
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  disabled={answerStatus === 'unanswered'}
                  onClick={handleNext}
                >
                  {currentQuestionIndex === quizQuestions.length - 1
                    ? 'Finish Quiz'
                    : 'Next Question'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}