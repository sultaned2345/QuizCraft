// src/app/(app)/flashcards/[deckId]/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { fetcher } from '@/lib/fetcher';
import useSWR from 'swr';
import { Card as Flashcard } from '@/types/database';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Loader2,
  ArrowLeft,
  RotateCw,
  Check,
  X,
  AlertCircle,
  BookOpen,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

// --- Interfaces ---
interface DeckData {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  flashcards: Flashcard[];
  cardCount: number;      // Total cards in deck
  cardLimit: number | typeof Infinity;
}

interface StudyCard extends Flashcard {
  reviewStatus: 'correct' | 'incorrect' | 'pending';
}

type StudyMode = 'due' | 'new' | 'cram';

// --- Helper: Shuffle Array ---
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export default function FlashcardStudyPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyDeck, setStudyDeck] = useState<StudyCard[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const router = useRouter();
  const params = useParams();
  const deckId = params.deckId as string;
  const { session } = useAuth();

  // Get Mode from URL (default to 'due')
  const searchParams = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const studyMode: StudyMode = (searchParams.get('mode') as StudyMode) || 'due';

  const { data, error, isLoading } = useSWR<DeckData>(
    session ? `/api/decks/${deckId}/study?mode=${studyMode}` : null,
    (url: string) => fetcher(url, { headers: { Authorization: `Bearer ${session!.access_token}` } }),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (data?.flashcards) {
      const shuffled = shuffleArray(data.flashcards).map((card) => ({
        ...card,
        reviewStatus: 'pending' as const,
      }));
      setStudyDeck(shuffled);
      setCurrentIndex(0);
      setShowSummary(false);
      setSessionStarted(false);
      setIsFlipped(false);
      setIsSubmittingReview(false);
    }
  }, [data]);

  const handleCardFlip = () => setIsFlipped((prev) => !prev);

  const handleReview = (quality: 'again' | 'good' | 'easy') => {
    if (!sessionStarted) setSessionStarted(true);
    if (isSubmittingReview) return;

    setIsSubmittingReview(true);
    const currentCard = studyDeck[currentIndex];
    const status = quality === 'again' ? 'incorrect' : 'correct';

    setStudyDeck((prev) =>
      prev.map((card, index) =>
        index === currentIndex ? { ...card, reviewStatus: status } : card
      )
    );

    const isCramming = studyMode === 'cram';

    fetch(`/api/flashcards/${currentCard.id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session!.access_token}`,
      },
      body: JSON.stringify({ quality, isCramming }),
    }).catch((err) => console.error('Failed to save review:', err));

    setTimeout(() => {
      if (currentIndex < studyDeck.length - 1) {
        setIsFlipped(false);
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsFlipped(false);
        setShowSummary(true);
      }
      setIsSubmittingReview(false);
    }, 150);
  };

  const handleRestart = () => {
    if (data?.flashcards) {
      setStudyDeck(
        shuffleArray(data.flashcards).map((card) => ({
          ...card,
          reviewStatus: 'pending' as const,
        }))
      );
    }
    setCurrentIndex(0);
    setShowSummary(false);
    setSessionStarted(false);
    setIsFlipped(false);
  };

  const handleSwitchToCram = () => {
    router.push(`/flashcards/${deckId}?mode=cram`);
  };

  const summary = useMemo(() => {
    if (!showSummary) return { correct: 0, incorrect: 0, total: 0, score: 0 };
    const correct = studyDeck.filter((c) => c.reviewStatus === 'correct').length;
    const incorrect = studyDeck.filter((c) => c.reviewStatus === 'incorrect').length;
    const total = correct + incorrect;
    return { correct, incorrect, total, score: total > 0 ? Math.round((correct / total) * 100) : 0 };
  }, [studyDeck, showSummary]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Preparing session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive p-4 text-center">
        <AlertCircle className="h-10 w-10 mb-2" />
        <h2 className="text-xl font-semibold">Error Loading Deck</h2>
        <p className="text-sm opacity-80 mb-4">{error.message}</p>
        <Button onClick={() => router.push('/flashcards')} variant="outline">Back to Decks</Button>
      </div>
    );
  }

  // --- IMPROVED EMPTY STATE LOGIC ---
  if (!data || !data.flashcards || data.flashcards.length === 0) {
    const totalCardsInDeck = data?.cardCount || 0;
    
    // Case 1: Deck is actually empty (0 cards total)
    if (totalCardsInDeck === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 max-w-md mx-auto text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Layers className="h-8 w-8 opacity-50" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">This deck is empty</h2>
                <p className="mb-6">Add some flashcards to start studying.</p>
                <Button onClick={() => router.push('/flashcards')} variant="outline">
                    Back to Decks
                </Button>
            </div>
        );
    }

    // Case 2: Deck has cards, but none are due (All caught up)
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">All Caught Up!</h2>
        <p className="mb-6 text-sm">
            You've finished all your reviews for now. 
            ({totalCardsInDeck} cards total in deck)
        </p>
        
        <div className="flex flex-col gap-3 w-full">
            <Button onClick={handleSwitchToCram} className="w-full">
                <BookOpen className="mr-2 h-4 w-4" /> Study Anyway (Cram Mode)
            </Button>
            <Button onClick={() => router.push('/flashcards')} variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
            </Button>
        </div>
      </div>
    );
  }

  const currentCard = studyDeck[currentIndex];
  if (!currentCard) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-2">Shuffling...</p>
        </div>
    );
  }

  const progress = sessionStarted ? ((currentIndex + 1) / studyDeck.length) * 100 : 0;

  return (
    <div className="flex flex-col h-full items-center py-8 px-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/flashcards')} className="pl-0 gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Decks
          </Button>
          <div className="flex flex-col items-center">
             <h1 className="text-sm font-semibold truncate max-w-[200px]">{data.title}</h1>
             <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{studyMode === 'cram' ? 'Cram Mode' : 'Review Session'}</span>
          </div>
          <div className="w-16"></div>
        </div>

        {!showSummary && (
          <p className="text-center text-muted-foreground text-xs mb-4 font-mono">
            {currentIndex + 1} / {studyDeck.length}
          </p>
        )}

        <Progress value={progress} className="w-full h-1.5 mb-8" />

        <AnimatePresence mode="wait">
          {!showSummary ? (
            <motion.div
              key="study"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center"
            >
              <div className="w-full h-80 [perspective:1000px] cursor-pointer group" onClick={handleCardFlip}>
                <motion.div
                  className="relative w-full h-full [transform-style:preserve-3d] transition-all duration-500"
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                >
                  {/* Front */}
                  <div className="absolute backface-hidden w-full h-full">
                    <Card className="flex h-full items-center justify-center p-8 shadow-md hover:shadow-lg transition-shadow border-2 border-border/50">
                      <p className="text-2xl font-medium text-center leading-relaxed">{currentCard.front_content}</p>
                      <span className="absolute bottom-4 text-[10px] text-muted-foreground uppercase tracking-widest">Front</span>
                    </Card>
                  </div>
                  
                  {/* Back */}
                  <div className="absolute backface-hidden w-full h-full [transform:rotateY(180deg)]">
                    <Card className="flex h-full items-center justify-center p-8 shadow-md bg-secondary/20 border-2 border-primary/10">
                      <p className="text-xl text-center leading-relaxed text-foreground/90">{currentCard.back_content}</p>
                      <span className="absolute bottom-4 text-[10px] text-muted-foreground uppercase tracking-widest">Back</span>
                    </Card>
                  </div>
                </motion.div>
              </div>

              <div className="h-24 w-full mt-8">
                <AnimatePresence>
                    {isFlipped && (
                    <motion.div
                        className="flex w-full gap-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                    >
                        <Button variant="outline" className="flex-1 h-12 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20" onClick={() => handleReview('again')} disabled={isSubmittingReview}>
                            Again
                        </Button>
                        <Button variant="outline" className="flex-1 h-12 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/20" onClick={() => handleReview('good')} disabled={isSubmittingReview}>
                            Good
                        </Button>
                        <Button variant="outline" className="flex-1 h-12 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-900/30 dark:text-green-400 dark:hover:bg-green-900/20" onClick={() => handleReview('easy')} disabled={isSubmittingReview}>
                            Easy
                        </Button>
                    </motion.div>
                    )}
                </AnimatePresence>
                {!isFlipped && (
                    <div className="flex justify-center items-center h-full text-sm text-muted-foreground animate-pulse">
                        Tap card to flip
                    </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="summary" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center w-full">
              <Card className="w-full max-w-sm border-none shadow-xl bg-gradient-to-br from-background to-secondary/10">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <RotateCw className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle>Session Complete</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <span className="text-5xl font-bold text-primary">{summary.score}%</span>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Accuracy Score</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex flex-col items-center p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                        <span className="font-bold text-green-600 dark:text-green-400">{summary.correct}</span>
                        <span className="text-muted-foreground text-xs">Correct</span>
                    </div>
                    <div className="flex flex-col items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                        <span className="font-bold text-red-600 dark:text-red-400">{summary.incorrect}</span>
                        <span className="text-muted-foreground text-xs">Incorrect</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-3 pt-2">
                  <Button className="w-full" onClick={handleRestart}>Study Again</Button>
                  <Button variant="ghost" className="w-full" onClick={() => router.push('/flashcards')}>Back to Decks</Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}