// components/PopQuizModal.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button }ANd { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Question } from '@/types/database';
import { Loader2, Check, X, RotateCw, Trophy, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface PopQuizModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  questions: Question[];
  title?: string;
}

type AnswerStatus = 'unanswered' | 'correct' | 'incorrect';

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

  // Shuffle questions and answers on load
  useEffect(() => {
    if (questions.length > 0) {
      const shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
      const questionsWithShuffledOptions = shuffledQuestions.map((q) => {
        if (q.question_type === 'multiple_choice' && q.options) {
          const options = q.options as { text: string; is_correct: boolean }[];
          return {
            ...q,
            options: [...options].sort(() => Math.random() - 0.5),
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
  }, [isOpen, questions]); // Reruns when modal is opened

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quizQuestions.length) * 100;

  const handleAnswerSelect = (answer: string) => {
    if (answerStatus !== 'unanswered') return; // Already answered

    setSelectedAnswer(answer);
    const isCorrect =
      currentQuestion.question_type === 'multiple_choice'
        ? (currentQuestion.options as { text: string; is_correct: boolean }[]).find(
            (opt) => opt.text === answer
          )?.is_correct
        : currentQuestion.answer === answer; // Assuming True/False has answer field

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
    // Reshuffle and reset
    if (questions.length > 0) {
      const shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
      const questionsWithShuffledOptions = shuffledQuestions.map((q) => {
        if (q.question_type === 'multiple_choice' && q.options) {
          const options = q.options as { text: string; is_correct: boolean }[];
          return {
            ...q,
            options: [...options].sort(() => Math.random() - 0.5),
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
      return 'border-border';
    }

    const isCorrect =
      currentQuestion.question_type === 'multiple_choice'
        ? (currentQuestion.options as { text: string; is_correct: boolean }[]).find(
            (opt) => opt.text === optionText
          )?.is_correct
        : currentQuestion.answer === optionText;

    if (isCorrect) {
      return 'border-green-500 bg-green-500/10 text-green-700 ring-2 ring-green-500'; // Correct answer
    }
    if (selectedAnswer === optionText && !isCorrect) {
      return 'border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive'; // Selected incorrect
    }
    return 'border-border opacity-60'; // Not selected
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0" onInteractOutside={(e) => e.preventDefault()}>
        <AnimatePresence mode="wait">
          {!quizQuestions || quizQuestions.length === 0 ? (
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
                <DialogTitle className="text-2xl text-center">Quiz Complete!</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center p-6 pt-0">
                <Trophy className="w-16 h-16 text-yellow-500" />
                <h3 className="text-4xl font-bold mt-4">
                  {correctAnswers} / {quizQuestions.length}
                </h3>
                <p className="text-lg text-muted-foreground">
                  Your score: {Math.round((correctAnswers / quizQuestions.length) * 100)}%
                </p>
                <div className="flex w-full gap-4 mt-8">
                  <Button variant="outline" className="w-full" onClick={handleRestart}>
                    <RotateCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  <Button className="w-full" onClick={() => onOpenChange(false)}>
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
                    Question {currentQuestionIndex + 1} of {quizQuestions.length}
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
                    <div className="space-y-3">
                      {/* Multiple Choice */}
                      {currentQuestion.question_type === 'multiple_choice' &&
                        (currentQuestion.options as { text: string; is_correct: boolean }[]).map(
                          (option) => (
                            <Button
                              key={option.text}
                              variant="outline"
                              className={cn(
                                'h-auto min-h-12 w-full justify-start text-left p-4 whitespace-normal',
                                answerStatus !== 'unanswered' && 'pointer-events-none',
                                selectedAnswer === option.text && 'ring-2 ring-primary',
                                answerStatus !== 'unanswered' && getOptionClass(option.text)
                              )}
                              onClick={() => handleAnswerSelect(option.text)}
                            >
                              <span className="flex-1">{option.text}</span>
                              {answerStatus === 'correct' && selectedAnswer === option.text && (
                                <Check className="w-5 h-5 ml-2 text-green-600" />
                              )}
                              {answerStatus === 'incorrect' && selectedAnswer === option.text && (
                                <X className="w-5 h-5 ml-2 text-destructive" />
                              )}
                            </Button>
                          )
                        )}

                      {/* True/False */}
                      {currentQuestion.question_type === 'true_false' &&
                        ['True', 'False'].map((option) => (
                          <Button
                            key={option}
                            variant="outline"
                            className={cn(
                              'h-12 w-full text-left p-4',
                              answerStatus !== 'unanswered' && 'pointer-events-none',
                              selectedAnswer === option && 'ring-2 ring-primary',
                              answerStatus !== 'unanswered' && getOptionClass(option)
                            )}
                            onClick={() => handleAnswerSelect(option)}
                          >
                            <span className="flex-1">{option}</span>
                            {answerStatus === 'correct' && selectedAnswer === option && (
                              <Check className="w-5 h-5 ml-2 text-green-600" />
                            )}
                            {answerStatus === 'incorrect' && selectedAnswer === option && (
                              <X className="w-5 h-5 ml-2 text-destructive" />
                            )}
                          </Button>
                        ))}
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
                          {currentQuestion.explanation && (
                            <p className="text-sm font-normal text-muted-foreground ml-7 mt-1">
                              {currentQuestion.explanation}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </div>

              <DialogFooter className="p-6 pt-0">
                <Button
                  className="w-full"
                  disabled={answerStatus === 'unanswered'}
                  onClick={handleNext}
                >
                  {currentQuestionIndex === quizQuestions.length - 1 ? 'Finish Quiz' : 'Next'}
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}