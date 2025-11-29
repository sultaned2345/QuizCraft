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
  MousePointerClick,
  Link as LinkIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizData {
  quiz: Quiz;
  questions: Question[];
}

type AnswerStatus = 'unanswered' | 'correct' | 'incorrect';
type QuizQuestion = Question & { shuffledOptions?: string[] };

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// --- IMPROVED MATCHING UI ---
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

  const { prompts, correctOptions, shuffledOptions } = useMemo(() => ({
    prompts: (question.prompts as string[]) || [],
    correctOptions: (question.options as string[]) || [],
    shuffledOptions: question.shuffledOptions || [],
  }), [question]);

  useEffect(() => {
    setUserMatches(new Array(prompts.length).fill(null));
    setSelectedPromptIdx(null);
  }, [prompts]);

  const handlePromptClick = (promptIdx: number) => {
    if (answerStatus !== 'unanswered') return;
    if (userMatches[promptIdx] !== null) {
      const newUserMatches = [...userMatches];
      newUserMatches[promptIdx] = null; // Unmatch
      setUserMatches(newUserMatches);
      setSelectedPromptIdx(promptIdx); // Reselect for new match
    } else {
      setSelectedPromptIdx(promptIdx === selectedPromptIdx ? null : promptIdx);
    }
  };

  const handleOptionClick = (optionIdx: number) => {
    if (answerStatus !== 'unanswered' || selectedPromptIdx === null) return;
    const newUserMatches = [...userMatches];
    
    // Remove option if used elsewhere
    const existingMatchIdx = newUserMatches.indexOf(optionIdx);
    if (existingMatchIdx > -1) newUserMatches[existingMatchIdx] = null;
    
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
      if (userOptionIdx !== null && shuffledOptions[userOptionIdx] === correctAns) {
        correctCount++;
      }
    }
    onQuestionComplete(correctCount === prompts.length);
  };

  const allMatched = userMatches.every((m) => m !== null);

  return (
    <div className="space-y-6">
      {/* Helper Instruction Bar */}
      {answerStatus === 'unanswered' && (
        <div className={cn(
          "text-sm font-medium px-4 py-2 rounded-full text-center transition-colors",
          selectedPromptIdx !== null 
            ? "bg-primary/10 text-primary animate-pulse" 
            : "bg-muted text-muted-foreground"
        )}>
          {selectedPromptIdx !== null 
            ? `Select the matching definition for "${prompts[selectedPromptIdx]}"` 
            : "Tap a term on the left to start matching"}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
        {/* Prompts (Left) */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest text-center md:text-left">Terms</h4>
          {prompts.map((prompt, pIdx) => {
            const isSelected = selectedPromptIdx === pIdx;
            const isMatched = userMatches[pIdx] !== null;
            const matchedOptionIdx = userMatches[pIdx];
            
            // Determine styling state
            let borderColor = "border-border";
            let bgColor = "bg-card";
            let textColor = "text-card-foreground";

            if (answerStatus !== 'unanswered') {
               const correctAns = correctOptions[pIdx];
               const userAns = matchedOptionIdx !== null ? shuffledOptions[matchedOptionIdx] : null;
               if (userAns === correctAns) {
                 borderColor = "border-green-500";
                 bgColor = "bg-green-50";
                 textColor = "text-green-700";
               } else {
                 borderColor = "border-red-500";
                 bgColor = "bg-red-50";
                 textColor = "text-red-700";
               }
            } else {
              if (isSelected) {
                borderColor = "border-primary";
                bgColor = "bg-primary/5";
                textColor = "text-primary";
              } else if (isMatched) {
                borderColor = "border-primary/50";
                bgColor = "bg-muted/30";
              }
            }

            return (
              <div 
                key={pIdx}
                onClick={() => handlePromptClick(pIdx)}
                className={cn(
                  "relative p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between group shadow-sm",
                  borderColor, bgColor, textColor,
                  answerStatus !== 'unanswered' && "pointer-events-none"
                )}
              >
                <span className="font-medium text-sm">{prompt}</span>
                {isMatched && answerStatus === 'unanswered' && (
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                    <LinkIcon className="w-3 h-3" />
                  </div>
                )}
                {isSelected && (
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full md:block hidden" />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Options (Right) */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest text-center md:text-left">Definitions</h4>
          {shuffledOptions.map((option, oIdx) => {
            const isUsed = userMatches.includes(oIdx);
            // Logic to highlight correct matches after submit
            let statusClass = "border-border bg-card hover:border-primary/50";
            
            if (answerStatus !== 'unanswered') {
               // Find which prompt matched this option
               const promptIdx = userMatches.indexOf(oIdx);
               if (promptIdx !== -1) {
                  const correctAns = correctOptions[promptIdx];
                  statusClass = option === correctAns 
                    ? "border-green-500 bg-green-50 text-green-700 opacity-100" 
                    : "border-red-500 bg-red-50 text-red-700 opacity-100";
               } else {
                  statusClass = "opacity-40 grayscale";
               }
            } else {
               if (isUsed) statusClass = "border-primary/30 bg-primary/5 text-primary opacity-60";
               if (selectedPromptIdx !== null && !isUsed) statusClass = "border-primary ring-1 ring-primary/20 cursor-pointer shadow-md scale-[1.02]";
            }

            return (
              <div
                key={oIdx}
                onClick={() => handleOptionClick(oIdx)}
                className={cn(
                  "p-4 rounded-xl border transition-all text-sm shadow-sm",
                  statusClass,
                  answerStatus !== 'unanswered' && "pointer-events-none"
                )}
              >
                {option}
              </div>
            );
          })}
        </div>
      </div>
      
      {answerStatus === 'unanswered' && (
         <Button className="w-full h-12 text-lg mt-4" disabled={!allMatched} onClick={handleSubmit}>
           Submit Matches
         </Button>
      )}
    </div>
  );
}

export default function TakeQuizPage() {
  // ... (State setup remains mostly the same) ...
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

  useEffect(() => {
    if (quizData?.questions?.length) {
      const shuffledQuestions = shuffleArray(quizData.questions);
      const processed = shuffledQuestions.map((q) => {
        if (q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
          return { ...q, options: shuffleArray(q.options as string[]) };
        }
        if (q.question_type === 'MATCHING' && Array.isArray(q.options)) {
          return { ...q, shuffledOptions: shuffleArray(q.options as string[]) };
        }
        return q;
      });
      setQuizQuestions(processed as QuizQuestion[]);
    }
  }, [quizData]);

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const progress = quizQuestions.length > 0 ? ((currentQuestionIndex + 1) / quizQuestions.length) * 100 : 0;

  const handleAnswerSelect = (answer: string) => {
    if (answerStatus !== 'unanswered') return;
    const trimmed = answer.trim();
    setSelectedAnswer(trimmed);

    let isCorrect = false;
    const type = currentQuestion.question_type;
    
    // Robust Type Checking
    if (type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE') {
      isCorrect = currentQuestion.correct_answer === trimmed;
    } else if (type === 'FILL_IN_THE_BLANK') {
      const opts = (currentQuestion.options as string[]) || [];
      if (opts.length > 0) isCorrect = opts.some(a => a.toLowerCase() === trimmed.toLowerCase());
      else isCorrect = currentQuestion.correct_answer.toLowerCase() === trimmed.toLowerCase();
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
    window.location.reload(); 
  };

  const getOptionClass = (opt: string) => {
    if (answerStatus === 'unanswered') return 'hover:border-primary hover:bg-muted/50';
    if (currentQuestion.correct_answer === opt) return 'border-green-500 bg-green-50 text-green-900 ring-1 ring-green-500';
    if (selectedAnswer === opt) return 'border-red-500 bg-red-50 text-red-900 ring-1 ring-red-500';
    return 'opacity-50';
  };

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading...</div>;
  if (error || !quizData || !quizQuestions.length) return <div className="p-8 text-center text-muted-foreground">Quiz not found or empty.</div>;

  return (
    <div className="flex flex-col h-full items-center py-8">
      <div className="w-full max-w-2xl px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => router.push('/quizzes')} className="pl-0"><ArrowLeft className="mr-2 h-4 w-4" /> Exit</Button>
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-muted-foreground">Question {currentQuestionIndex + 1}/{quizQuestions.length}</span>
            <Progress value={progress} className="w-32 h-2 mt-2" />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isFinished ? (
            <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
              <Card className="w-full max-w-md shadow-lg text-center p-6">
                <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-3xl font-bold mb-2">{Math.round((correctAnswers/quizQuestions.length)*100)}%</h2>
                <p className="text-muted-foreground mb-6">You got {correctAnswers} out of {quizQuestions.length} correct.</p>
                <div className="space-y-2 w-full">
                  <Button onClick={handleRestart} className="w-full"><RotateCw className="mr-2 h-4 w-4"/> Try Again</Button>
                  <Button variant="outline" onClick={() => router.push('/quizzes')} className="w-full">Dashboard</Button>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="shadow-md border-t-4 border-t-primary">
                <CardContent className="p-6 md:p-8">
                  <h2 className="text-xl font-semibold mb-8 whitespace-pre-wrap">{currentQuestion.question_text}</h2>

                  {/* --- RENDER QUESTION TYPES --- */}
                  <div className="space-y-4">
                    {/* 1. Multiple Choice / True False */}
                    {(['MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(currentQuestion.question_type)) && (
                      <div className="grid grid-cols-1 gap-3">
                        {(currentQuestion.options as string[] || []).map((option) => (
                          <Button
                            key={option}
                            variant="outline"
                            className={cn("justify-start text-left p-4 h-auto text-base", answerStatus !== 'unanswered' && "pointer-events-none", getOptionClass(option))}
                            onClick={() => handleAnswerSelect(option)}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* 2. Fill in the Blank - IMPROVED */}
                    {currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                      <div className="py-6">
                        <div className="relative group">
                           <Input
                             autoFocus
                             type="text"
                             placeholder="Type your answer here..."
                             value={selectedAnswer || ''}
                             onChange={(e) => setSelectedAnswer(e.target.value)}
                             disabled={answerStatus !== 'unanswered'}
                             className="text-2xl h-16 border-0 border-b-2 border-primary/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary placeholder:text-muted-foreground/30 text-center font-medium bg-transparent transition-all"
                             onKeyDown={(e) => e.key === 'Enter' && answerStatus === 'unanswered' && selectedAnswer && handleAnswerSelect(selectedAnswer.trim())}
                           />
                           <div className="text-xs text-muted-foreground text-center mt-2 uppercase tracking-widest">Your Answer</div>
                        </div>
                        <Button 
                           className="w-full mt-8 h-12 text-lg" 
                           disabled={answerStatus !== 'unanswered' || !selectedAnswer?.trim()}
                           onClick={() => handleAnswerSelect(selectedAnswer!.trim())}
                        >
                          Submit Answer
                        </Button>
                      </div>
                    )}

                    {/* 3. Matching - IMPROVED */}
                    {currentQuestion.question_type === 'MATCHING' && (
                      <MatchingQuestionUI
                        question={currentQuestion}
                        answerStatus={answerStatus}
                        onQuestionComplete={handleMatchingComplete}
                      />
                    )}

                    {/* 4. Fallback for Unknown Types */}
                    {!['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'MATCHING'].includes(currentQuestion.question_type) && (
                      <div className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
                        <AlertCircle className="w-5 h-5 mb-2 inline-block mr-2" />
                        <strong>Error:</strong> Unsupported Question Type ("{currentQuestion.question_type}").
                        <br />Please report this issue.
                      </div>
                    )}
                  </div>
                  
                  {/* Feedback Section */}
                  <AnimatePresence>
                    {answerStatus !== 'unanswered' && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className={cn("mt-6 p-4 rounded-lg border", answerStatus === 'correct' ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
                        <div className="font-bold flex items-center mb-1">
                          {answerStatus === 'correct' ? <><Check className="w-5 h-5 mr-2 text-green-600"/> Correct!</> : <><X className="w-5 h-5 mr-2 text-red-600"/> Incorrect</>}
                        </div>
                        {answerStatus === 'incorrect' && currentQuestion.question_type === 'FILL_IN_THE_BLANK' && (
                          <p className="text-sm text-muted-foreground mb-2">Correct Answer: <strong>{currentQuestion.correct_answer}</strong></p>
                        )}
                        <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
                
                <CardFooter className="flex justify-between bg-muted/20 p-6">
                  <Button variant="ghost" onClick={() => setShowHint(true)} disabled={answerStatus !== 'unanswered' || !currentQuestion.explanation} className={cn(!currentQuestion.explanation && "invisible")}>
                    <Lightbulb className="w-4 h-4 mr-2" /> Hint
                  </Button>
                  {showHint && answerStatus === 'unanswered' && (
                    <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="absolute bottom-20 left-8 right-8 bg-yellow-50 border border-yellow-200 p-3 rounded shadow-lg text-sm text-yellow-800 z-10">
                      <strong>Hint:</strong> {currentQuestion.explanation}
                    </motion.div>
                  )}
                  <Button onClick={handleNext} disabled={answerStatus === 'unanswered'}>
                    {currentQuestionIndex === quizQuestions.length - 1 ? 'Finish' : 'Next'} <ArrowLeft className="ml-2 w-4 h-4 rotate-180" />
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