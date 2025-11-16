// src/app/(app)/flashcards/[deckId]/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { fetcher } from '@/lib/fetcher';
import useSWR from 'swr';
import { Card as Flashcard, Deck } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, RotateCw, Check, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

interface DeckData {
  deck: Deck;
  cards: Flashcard[];
}

interface StudyCard extends Flashcard {
  reviewStatus: 'correct' | 'incorrect' | 'pending';
}

export default function FlashcardStudyPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyDeck, setStudyDeck] = useState<StudyCard[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);

  const router = useRouter();
  const params = useParams();
  const deckId = params.deckId as string;
  const { session } = useAuth();

  // Fetch deck data
  const { data, error, isLoading }_ = useSWR<DeckData>(
    session ? `/api/decks/${deckId}` : null,
    (url: string) => fetcher(url, { headers: { Authorization: `Bearer ${session!.access_token}` } }),
    { revalidateOnFocus: false }
  );

  // Initialize the study deck once data is loaded
  useEffect(() => {
    // FIX: Check for data.cards before shuffling
    if (data?.cards) {
      const shuffled = [...data.cards]
        .sort(() => Math.random() - 0.5)
        .map((card) => ({ ...card, reviewStatus: 'pending' as const }));
      setStudyDeck(shuffled);
    } else if (data && !data.cards) {
      // Handle case where data exists but cards are missing
      setStudyDeck([]);
    }
    
    // Reset state regardless
    setCurrentIndex(0);
    setShowSummary(false);
    setSessionStarted(false);
    setIsFlipped(false);

  }, [data]); // Only depends on data

  // Memoize summary calculations
  const summary = useMemo(() => {
    if (!showSummary) return { correct: 0, incorrect: 0, total: 0, score: 0 };
    const correct = studyDeck.filter((c) => c.reviewStatus === 'correct').length;
    const incorrect = studyDeck.filter((c) => c.reviewStatus === 'incorrect').length;
    const total = studyDeck.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correct, incorrect, total, score };
  }, [studyDeck, showSummary]);


  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading Deck...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <AlertCircle className="h-12 w-12 mb-4" />
        <h2 className="text-2xl font-semibold">Failed to Load Deck</h2>
        <p className="text-center">{error.message}</p>
        <Button onClick={() => router.push('/flashcards')} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
        </Button>
      </div>
    );
  }

  // --- FIX: More robust check for data and deck ---
  // If data or data.deck is missing, or if there are no cards
  if (!data || !data.deck || studyDeck.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4" />
        {/* FIX: Safely access title */}
        <h2 className="text-2xl font-semibold">{data?.deck?.title || 'Flashcard Deck'}</h2>
        <p className="text-center">This deck has no cards in it or failed to load properly.</p>
        <Button onClick={() => router.push('/flashcards')} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
        </Button>
      </div>
    );
  }

  const currentCard = studyDeck[currentIndex];
  
  return (
    <div className="flex flex-col h-full items-center py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" onClick={() => router.push('/flashcards')} className="pl-0">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Decks
          </Button>
          {/* FIX: Safely access title with optional chaining */}
          <h1 className="text-xl font-semibold truncate text-center" title={data?.deck?.title}>
            {data?.deck?.title}
          </h1>
          <div className="w-24"></div> {/* Spacer */}
        </div>
        
        {!showSummary && (
          <p className="text-center text-muted-foreground text-sm mb-4">
            Card {currentIndex + 1} of {studyDeck.length}
          </p>
        )}

        {/* Progress Bar */}
        <Progress 
          value={sessionStarted ? ((currentIndex + 1) / studyDeck.length) * 100 : 0} 
          className="w-full h-2 mb-6" 
        />

        {/* Main Content Area: Study or Summary */}
        <AnimatePresence mode="wait">
          {!showSummary ? (
            <motion.div
              key="study"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              {/* Flippable Card */}
              <div
                className="w-full h-80 [perspective:1000px] cursor-pointer"
                onClick={() => setIsFlipped((prev) => !prev)}
              >
                <motion.div
                  className="relative w-full h-full [transform_style:preserve-3d]"
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {/* Front of Card */}
                  <div className="absolute [backface_visibility:hidden] w-full h-full">
                    <Card className="flex h-full items-center justify-center p-6 shadow-lg">
                      <p className="text-2xl font-medium text-center">{currentCard.question}</p>
                    </Card>
                  </div>
                  {/* Back of Card */}
                  <div className="absolute [backface_visibility:hidden] w-full h-full [transform:rotateY(180deg)]">
                    <Card className="flex h-full items-center justify-center p-6 shadow-lg bg-secondary">
                      <p className="text-xl text-center">{currentCard.answer}</p>
                    </Card>
                  </div>
                </motion.div>
              </div>

              {/* Study Controls */}
              <AnimatePresence>
                {isFlipped && (
                  <motion.div
                    className="flex w-full gap-4 mt-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button
                      variant="outline"
                      className="flex-1 text-destructive hover:border-destructive/80 hover:text-destructive/80 border-2 border-destructive/50 h-14 text-lg"
                      onClick={() => handleReview('incorrect')}
                    >
                      <X className="mr-2 h-6 w-6" /> I didn't know
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white border-2 border-green-600 hover:border-green-700 h-14 text-lg"
                      onClick={() => handleReview('correct')}
                    >
                      <Check className="mr-2 h-6 w-6" /> I knew this
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center"
            >
              <Card className="w-full max-w-md shadow-lg">
                <CardHeader>
                  <CardTitle className="text-center text-2xl">Session Complete!</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <div className="text-6xl font-bold">{summary.score}%</div>
                  <div className="w-full">
                    <div className="flex justify-between text-green-600">
                      <span>Correct</span>
                      <span>{summary.correct}</span>
                    </div>
                    <div className="flex justify-between text-destructive">
                      <span>Incorrect</span>
                      <span>{summary.incorrect}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t mt-2 pt-2">
                      <span>Total Cards</span>
                      <span>{summary.total}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <Button className="w-full" onClick={handleRestart}>
                    <RotateCw className="mr-2 h-4 w-4" /> Study Again
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => router.push('/flashcards')}>
                    Back to Decks
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