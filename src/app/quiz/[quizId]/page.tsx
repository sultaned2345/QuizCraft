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
import {
  Loader2,
  ArrowLeft,
  RotateCw,
  Check,
  X,
  AlertCircle,
  Trophy,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizData {
  quiz: Quiz;
  questions: Question[];
}

type AnswerStatus = 'unanswered' | 'correct' | 'incorrect';

// This is the type for the question state, including our new shuffled property
type QuizQuestion = Question & { shuffledOptions?: string[] };

// Helper function to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// --- NEW SUB-COMPONENT ---
/**
 * A self-contained component to render the Matching Question UI.
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
  // userMatches[promptIndex] = optionIndex
  const [userMatches, setUserMatches] = useState<(number | null)[]>([]);

  const {
    prompts,
    options: correctOptions, // This is the unshuffled answer key
    shuffledOptions, // This is the shuffled list for display
  } = useMemo(() => ({
    prompts: (question.prompts as string[]) || [],
    options: (question.options as string[]) || [],
    shuffledOptions: question.shuffledOptions || [],
  }), [question]);

  // Reset state when the question changes
  useEffect(() => {
    setUserMatches(new Array(prompts.length).fill(null));
    setSelectedPromptIdx(null);
  }, [prompts]);

  const handlePromptClick = (promptIdx: number) => {
    if (answerStatus !== 'unanswered') return;

    if (userMatches[promptIdx] !== null) {
      // This prompt is already matched, clear its match
      const newUserMatches = [...userMatches];
      newUserMatches[promptIdx] = null;
      setUserMatches(newUserMatches);
      setSelectedPromptIdx(promptIdx); // Reselect it
    } else {
      setSelectedPromptIdx(promptIdx);
    }
  };

  const handleOptionClick = (optionIdx: number) => {
    if (answerStatus !== 'unanswered' || selectedPromptIdx === null) return;

    const newUserMatches = [...userMatches];
    // Clear if this option was used elsewhere
    const existingMatchIdx = newUserMatches.indexOf(optionIdx);
    if (existingMatchIdx > -1) {
      newUserMatches[existingMatchIdx] = null;
    }
    // Set new match
    newUserMatches[selectedPromptIdx] = optionIdx;
    setUserMatches(newUserMatches);
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Prompts Column */}
        <div className="space-y-2">
          {prompts.map((prompt, pIdx) => {
            const isSelected = selectedPromptIdx === pIdx;
            const isMatched = userMatches[pIdx] !== null;
            let state: 'default' | 'selected' | 'matched' | 'correct' | 'incorrect' = 'default';

            if (answerStatus === 'unanswered') {
              if (isSelected) state = 'selected';
              else if (isMatched) state = 'matched';
            } else {
              // After submission
              const correctAns = correctOptions[pIdx];
              const userAns = userMatches[pIdx] !== null ? shuffledOptions[userMatches[pIdx]!] : null;
              state = userAns === correctAns ? 'correct' : 'incorrect';
            }

            return (
              <Button
                key={pIdx}
                variant="outline"
                onClick={() => handlePromptClick(pIdx)}
                className={cn(
                  "h-auto min-h-12 w-full justify-start text-left p-3 whitespace-normal",
                  state === 'selected' && 'ring-2 ring-primary',
                  state === 'matched' && 'bg-primary/10 text-primary-foreground',
                  state === 'correct' && 'border-green-500 bg-green-500/10 text-green-700 pointer-events-none',
                  state === 'incorrect' && 'border-destructive bg-destructive/10 text-destructive pointer-events-none'
                )}
                disabled={answerStatus !== 'unanswered'}
              >
                {prompt}
              </Button>
            );
          })}
        </div>
        
        {/* Options Column */}
        <div className="space-y-2">
          {shuffledOptions.map((option, oIdx) => {
            const isMatched = userMatches.includes(oIdx);
            let state: 'default' | 'matched' | 'correct' | 'incorrect' = 'default';

            if (answerStatus === 'unanswered') {
              if (isMatched) state = 'matched';
            } else {
              // After submission
              const promptIdx = userMatches.indexOf(oIdx);
              if (promptIdx > -1) {
                const correctAns = correctOptions[promptIdx];
                state = option === correctAns ? 'correct' : 'incorrect';
              } else {
                state = 'default'; // This option wasn't even selected
              }
            }
            
            return (
              <Button
                key={oIdx}
                variant="outline"
                onClick={() => handleOptionClick(oIdx)}
                className={cn(
                  "h-auto min-h-12 w-full justify-start text-left p-3 whitespace-normal",
                  state === 'matched' && 'bg-primary/10 text-primary-foreground opacity-50',
                  state === 'correct' && 'border-green-500 bg-green-500/10 text-green-700 pointer-events-none',
                  state === 'incorrect' && 'border-destructive bg-destructive/10 text-destructive pointer-events-none',
                  answerStatus === 'unanswered' && selectedPromptIdx === null && 'cursor-not-allowed opacity-60'
                )}
                disabled={answerStatus !== 'unanswered' || selectedPromptIdx === null}
              >
                {option}
              </Button>
            );
          })}
        </div>
      </div>
      
      {/* Submit Button */}
      {answerStatus === 'unanswered' && (
         <Button
           className="w-full"
           disabled={!allMatched}
           onClick={handleSubmit}
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

  // FIX: Updated generic to match fetcher's ApiResponse wrapper
  const { data: apiResponse, error, isLoading } = useSWR<ApiResponse<QuizData>>(
    session ? `/api/quiz/${quizId}` : null,
    (url: string) =>
      fetcher(url, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      }),
    { revalidateOnFocus: false }
  );

  // FIX: Extract the actual data object safely
  const quizData = apiResponse?.data;

  useEffect(() => {
    // FIX: Use quizData instead of raw data variable
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
    // FIX: Use quizData here as well
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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading Quiz...</p>
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

  // FIX: Use quizData to check for existence
  if (!quizData || quizQuestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4" />
        {/* FIX: Use optional chaining on quizData.quiz */}
        <h2 className="text-2xl font-semibold">{quizData?.quiz?.title || 'Quiz'}</h2>
        <p className="text-center">This quiz has no questions in it.</p>
        <Button onClick={() => router.push('/quizzes')} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quizzes
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full items-center py-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            onClick={() => router.push('/quizzes')}
            className="pl-0"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Quizzes
          </Button>
          <h1
            className="text-xl font-semibold truncate text-center"
            // FIX: Use quizData.quiz.title
            title={quizData.quiz.title}
          >
            {quizData.quiz.title}
          </h1>
          <div className="w-24"></div>
        </div>
        {!isFinished && (
          <div className="flex items-center gap-4 mb-6">
            <span className="text-sm font-medium text-muted-foreground">
              Question {currentQuestionIndex + 1} of {quizQuestions.length}
            </span>
            <Progress value={progress} className="flex-1 h-2" />
          </div>
        )}
        <AnimatePresence mode="wait">
          {isFinished ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
              <Card className="w-full max-w-md shadow-lg">
                <CardHeader>
                  <CardTitle className="text-center text-2xl">
                    Quiz Complete!
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <Trophy className="w-16 h-16 text-yellow-500" />
                  <h3 className="text-4xl font-bold mt-4">
                    {correctAnswers} / {quizQuestions.length}
                  </h3>
                  <p className="text-lg text-muted-foreground">
                    Your score:{' '}
                    {Math.round(
                      (correctAnswers / quizQuestions.length) * 100
                    )}
                    %
                  </p>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <Button className="w-full" onClick={handleRestart}>
                    <RotateCw className="mr-2 h-4 w-4" />
                    Take Again
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/quizzes')}
                  >
                    Back to Quizzes
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="shadow-lg">
                <CardContent className="p-6">
                  <p className="text-lg font-semibold mb-4 min-h-[60px]">
                    {currentQuestion.question_text}
                  </p>
                  <div className="space-y-3">
                    {currentQuestion.question_type === 'MULTIPLE_CHOICE' &&
                      (currentQuestion.options as string[]).map((option) => (
                        <Button
                          key={option}
                          variant="outline"
                          className={cn(
                            'h-auto min-h-12 w-full justify-start text-left p-4 whitespace-normal',
                            answerStatus !== 'unanswered' &&
                              'pointer-events-none',
                            getOptionClass(option)
                          )}
                          onClick={() => handleAnswerSelect(option)}
                        >
                          <span className="flex-1">{option}</span>
                          {answerStatus !== 'unanswered' &&
                            getOptionClass(option).includes('green') && (
                              <Check className="w-5 h-5 ml-2 text-green-600" />
                            )}
                          {answerStatus !== 'unanswered' &&
                            getOptionClass(option).includes('destructive') && (
                              <X className="w-5 h-5 ml-2 text-destructive" />
                            )}
                        </Button>
                      ))}

                    {currentQuestion.question_type === 'TRUE_FALSE' &&
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
                          onClick={() => handleAnswerSelect(option)}
                        >
                          <span className="flex-1">{option}</span>
                          {answerStatus !== 'unanswered' &&
                            getOptionClass(option).includes('green') && (
                              <Check className="w-5 h-5 ml-2 text-green-600" />
                            )}
                          {answerStatus !== 'unanswered' &&
                            getOptionClass(option).includes('destructive') && (
                              <X className="w-5 h-5 ml-2 text-destructive" />
                            )}
                        </Button>
                      ))}
                      
                    {currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                      <div className="space-y-3">
                        <Input
                          type="text"
                          placeholder="Type your answer..."
                          value={selectedAnswer || ''}
                          onChange={(e) => setSelectedAnswer(e.target.value)}
                          disabled={answerStatus !== 'unanswered'}
                          className="text-base"
                          onKeyDown={(e) => {
                            if (
                              e.key === 'Enter' &&
                              answerStatus === 'unanswered' &&
                              selectedAnswer
                            ) {
                              handleAnswerSelect(selectedAnswer.trim());
                            }
                          }}
                        />
                        <Button
                          className="w-full"
                          disabled={
                            answerStatus !== 'unanswered' ||
                            !selectedAnswer?.trim()
                          }
                          onClick={() =>
                            handleAnswerSelect(selectedAnswer!.trim())
                          }
                        >
                          Submit Answer
                        </Button>
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

                  <AnimatePresence>
                    {answerStatus === 'unanswered' &&
                      showHint &&
                      currentQuestion.explanation && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 flex flex-col font-medium text-yellow-600"
                        >
                          <div className="flex items-center">
                            <Lightbulb className="w-5 h-5 mr-2" />
                            Hint:
                          </div>
                          <p className="text-sm font-normal text-muted-foreground ml-7 mt-1">
                            {currentQuestion.explanation}
                          </p>
                        </motion.div>
                      )}

                    {answerStatus === 'correct' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 flex flex-col font-medium text-green-600"
                      >
                        <div className="flex items-center">
                          <Check className="w-5 h-5 mr-2" />
                          That's correct!
                        </div>
                        {currentQuestion.explanation && (
                          <p className="text-sm font-normal text-muted-foreground ml-7 mt-1">
                            {currentQuestion.explanation}
                          </p>
                        )}
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

                        {currentQuestion.question_type ===
                          'FILL_IN_THE_BLANK' && (
                          <p className="text-sm font-normal text-muted-foreground ml-7 mt-1">
                            Correct answer(s):{' '}
                            {Array.isArray(currentQuestion.options) &&
                            currentQuestion.options.length > 0
                              ? currentQuestion.options.join(', ')
                              : currentQuestion.correct_answer}
                          </p>
                        )}

                        {currentQuestion.explanation && (
                          <p className="text-sm font-normal text-muted-foreground ml-7 mt-1">
                            {currentQuestion.explanation}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
                <CardFooter className="p-6 pt-0 flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setShowHint(true)}
                    disabled={
                      answerStatus !== 'unanswered' ||
                      showHint ||
                      !currentQuestion.explanation
                    }
                    className={cn(
                      'transition-all',
                      answerStatus !== 'unanswered' ||
                        showHint ||
                        !currentQuestion.explanation
                        ? 'opacity-0'
                        : 'opacity-100'
                    )}
                  >
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Show Hint
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
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}