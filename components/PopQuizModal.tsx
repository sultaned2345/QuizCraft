// components/PopQuizModal.tsx
// NEW FILE

'use client';

import { useState, useEffect } from 'react';
import { Question } from '@/types/database';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, RefreshCw, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

type UserAnswer = {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
};

type ViewMode = 'quiz' | 'results' | 'review';

interface PopQuizModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  questions: Question[];
}

export function PopQuizModal({ isOpen, onOpenChange, questions }: PopQuizModalProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('quiz');
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  
  // Reset state when modal opens or questions change
  useEffect(() => {
    if (isOpen) {
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setViewMode('quiz');
      setUserAnswers([]);
    }
  }, [isOpen, questions]);

  const currentQuestion = questions[currentQuestionIndex];
  const score = userAnswers.filter((a) => a.isCorrect).length;

  const handleAnswerSelect = (answer: string) => {
    if (isAnswered) return;
    if (!currentQuestion) return;

    const isCorrect = answer.toLowerCase().trim() === (currentQuestion.correct_answer || '').toLowerCase().trim();
    
    setSelectedAnswer(answer);
    setIsAnswered(true);
    setUserAnswers([
      ...userAnswers,
      {
        questionId: currentQuestion.id,
        selectedAnswer: answer,
        isCorrect,
      },
    ]);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      setViewMode('results');
    }
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setViewMode('quiz');
    setUserAnswers([]);
  };

  const renderQuestion = () => {
    if (!currentQuestion) return <p>No question to display.</p>;
    
    const options = (currentQuestion.options as string[]) || [];
    
    return (
      <div className="space-y-2">
        {options.map((option, index) => (
          <Button
            key={index}
            variant="outline"
            className={`w-full justify-start h-auto p-4 text-left whitespace-normal ${
              isAnswered && option === currentQuestion.correct_answer
                ? 'bg-green-100 border-green-400 dark:bg-green-900/50' : ''
            } ${
              isAnswered &&
              selectedAnswer === option &&
              option !== currentQuestion.correct_answer
                ? 'bg-red-100 border-red-400 dark:bg-red-900/50' : ''
            }`}
            onClick={() => handleAnswerSelect(option)}
            disabled={isAnswered}
          >
            {option}
          </Button>
        ))}
      </div>
    );
  };
  
  const renderReview = () => (
    <ScrollArea className="h-[450px] pr-4">
      <div className="space-y-4">
        {questions.map((q, index) => {
          const userAnswer = userAnswers.find((a) => a.questionId === q.id);
          const isCorrect = userAnswer?.isCorrect;
          return (
            <div
              key={q.id}
              className={cn(
                'p-4 rounded-lg border',
                isCorrect ? 'border-green-500/50 bg-green-500/5' : 'border-destructive/50 bg-destructive/5'
              )}
            >
              <p className="font-semibold">{index + 1}. {q.question_text}</p>
              <div className="mt-2 text-sm">
                <p className={cn(isCorrect ? 'text-green-700 dark:text-green-400' : 'text-destructive')}>
                  Your answer: {userAnswer?.selectedAnswer || 'Not answered'}
                </p>
                {!isCorrect && (
                  <p className="mt-1 text-green-700 dark:text-green-400">
                    Correct answer: {q.correct_answer}
                  </p>
                )}
              </div>
              {q.explanation && (
                <p className="mt-2 text-xs text-muted-foreground border-t pt-2">
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pop Quiz</DialogTitle>
          {viewMode === 'quiz' && (
            <>
              <DialogDescription>
                Question {currentQuestionIndex + 1} of {questions.length}
              </DialogDescription>
              <Progress value={((currentQuestionIndex + 1) / questions.length) * 100} className="mt-2" />
            </>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {viewMode === 'quiz' && currentQuestion && (
            <div className="space-y-4">
              <div className="text-lg font-semibold mb-4">
                {currentQuestion.question_text}
              </div>
              {renderQuestion()}
              {isAnswered && (
                <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg space-y-3">
                  {userAnswers.find((a) => a.questionId === currentQuestion.id)?.isCorrect ? (
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      <p className="font-semibold">Correct!</p>
                    </div>
                  ) : (
                    <div className="text-red-600 dark:text-red-400">
                      <div className="flex items-center font-semibold">
                        <XCircle className="w-5 h-5 mr-2" />
                        <p>Incorrect. Correct answer: {currentQuestion.correct_answer}</p>
                      </div>
                    </div>
                  )}
                  {currentQuestion.explanation && (
                    <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                  )}
                  <Button className="w-full" onClick={handleNextQuestion}>
                    {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {viewMode === 'results' && (
            <div className="text-center py-8 flex flex-col items-center">
              <h2 className="text-xl font-semibold">Quiz Complete!</h2>
              <p className="text-6xl font-bold my-4">
                {score} / {questions.length}
              </p>
              <div className="flex justify-center gap-2">
                <Button onClick={handleRestart}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button variant="outline" onClick={() => setViewMode('review')}>
                  <Eye className="w-4 h-4 mr-2" />
                  Review
                </Button>
              </div>
            </div>
          )}

          {viewMode === 'review' && renderReview()}
        </div>
        
        {viewMode !== 'quiz' && (
          <div className="pt-4 border-t">
            <Button variant="outline" className="w-full" onClick={handleRestart}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retake Pop Quiz
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}