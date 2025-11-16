// src/app/(app)/flashcards/[deckId]/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { fetcher } from '@/lib/fetcher'; // <-- FIX: Was '@/types/fetcher'
import useSWR from 'swr';
import { Card as Flashcard, Deck, ApiResponse } from '@/types/database'; // <-- Import ApiResponse
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, RotateCw, Check, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

// --- MODIFIED: This is the structure returned by the /api/decks/[deckId] GET route ---
interface DeckData {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  flashcards: Flashcard[]; // The cards are nested
  cardCount: number;
  cardLimit: number | typeof Infinity;
}
// ---

interface StudyCard extends Flashcard {
  reviewStatus: 'correct' | 'incorrect' | 'pending';
}

// --- NEW: Study Mode type ---
type StudyMode = 'due' | 'new' | 'cram';

export default function FlashcardStudyPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyDeck, setStudyDeck] = useState<StudyCard[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false); // For API calls

  const router = useRouter();
  const params = useParams();
  const deckId = params.deckId as string;
  const { session } = useAuth();
  
  // --- NEW: Get study mode from URL ---
  const searchParams = new URLSearchParams(window.location.search);
  const studyMode: StudyMode = (searchParams.get('mode') as StudyMode) || 'due';

  // --- MODIFIED: Fetch study session data from the specific /study endpoint ---
  const { data, error, isLoading } = useSWR<DeckData>(
    session ? `/api/decks/${deckId}/study?mode=${studyMode}` : null, // <-- Use the /study endpoint
    (url: string) => fetcher(url, { headers: { Authorization: `Bearer ${session!.access_token}` } }),
    { revalidateOnFocus: false }
  );
  
  // (shuffleArray helper)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };
  
  // Initialize the study deck once data is loaded
  useEffect(() => {
    if (data?.flashcards) {
      // Shuffle the deck for a study session
      const shuffled = shuffleArray(data.flashcards)
        .map((card) => ({ ...card, reviewStatus: 'pending' as const }));
      setStudyDeck(shuffled);
      setCurrentIndex(0);
      setShowSummary(false);
      setSessionStarted(false);
      setIsFlipped(false);
      setIsSubmittingReview(false);
    }
  }, [data]); // Reruns when data loads

  const handleCardFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  // --- MODIFIED: handleReview to call API ---
  const handleReview = (quality: 'again' | 'good' | 'easy') => {
    if (!sessionStarted) setSessionStarted(true);
    if (isSubmittingReview) return; // Prevent double-clicks

    setIsSubmittingReview(true); // Set loading
    
    const currentCard = studyDeck[currentIndex];
    
    // 1. Optimistic UI update
    const status = (quality === 'again' ? 'incorrect' : 'correct');
    setStudyDeck((prev) =>
      prev.map((card, index) =>
        index === currentIndex ? { ...card, reviewStatus: status } : card
      )
    );
    
    // 2. Send review to API (fire-and-forget, but handle errors)
    // Only send API update if *not* in 'cram' mode
    if (studyMode !== 'cram') {
      fetch(`/api/flashcards/${currentCard.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session!.access_token}`
        },
        body: JSON.stringify({ quality: quality })
      })
      .then(async res => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to save review');
        }
        // console.log(`Review for ${currentCard.id} saved.`);
      })
      .catch(err => {
        console.error("Failed to save review status:", err);
        // Here you could add a toast message, but for a study session,
        // we might just log it and move on to not interrupt the user's flow.
        // For now, we'll just log it.
      });
    }

    // 3. Move to the next card
    setTimeout(() => {
      if (currentIndex < studyDeck.length - 1) {
        setIsFlipped(false); // Flip back to front for next card
        setCurrentIndex(currentIndex + 1);
        setIsSubmittingReview(false);
      } else {
        // End of deck
        setIsFlipped(false);
        setShowSummary(true);
        setIsSubmittingReview(false);
      }
    }, 150); // Short delay so user can register the flip
  };
  // --- END MODIFICATION ---

  const handleRestart = () => {
    // Re-shuffle and reset all state
    if (data?.flashcards) {
      setStudyDeck(shuffleArray(data.flashcards).map((card) => ({ ...card, reviewStatus: 'pending' as const })));
    }
    setCurrentIndex(0);
    setShowSummary(false);
    setSessionStarted(false);
    setIsFlipped(false);
  };

  // Memoize summary calculations
  const summary = useMemo(() => {
    if (!showSummary) return { correct: 0, incorrect: 0, total: 0, score: 0 };
    const correct = studyDeck.filter((c) => c.reviewStatus === 'correct').length;
    const incorrect = studyDeck.filter((c) => c.reviewStatus === 'incorrect').length;
    const total = correct + incorrect; // Only count reviewed cards
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

  // --- MODIFIED: Check data.flashcards, not studyDeck ---
  if (!data || !data.flashcards || data.flashcards.length === 0) {
    let emptyMessage = "This deck has no cards in it.";
    if (studyMode === 'due') emptyMessage = "You have no cards due for review in this deck!";
    if (studyMode === 'new') emptyMessage = "You have no new cards to learn in this deck!";
    
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4" />
        <h2 className="text-2xl font-semibold">{data?.title || 'Flashcard Deck'}</h2>
        <p className="text-center">{emptyMessage}</p>
        <Button onClick={() => router.push('/flashcards')} variant="outline" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
        </Button>
      </div>
    );
  }
  // --- END MODIFICATION ---
  
  // --- NEW: Handle case where studyDeck is not yet initialized ---
  const currentCard = studyDeck[currentIndex];
  if (!currentCard) {
    return (
       <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Shuffling cards...</p>
      </div>
    );
  }
  // --- END NEW ---

  const progress = sessionStarted ? ((currentIndex + 1) / studyDeck.length) * 100 : 0;
  
  return (
    <div className="flex flex-col h-full items-center py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" onClick={() => router.push('/flashcards')} className="pl-0">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Decks
          </Button>
          <h1 className="text-xl font-semibold truncate text-center" title={data.title}>
            {data.title}
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
          value={progress} 
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
                onClick={handleCardFlip}
              >
                <motion.div
                  className="relative w-full h-full [transform_style:preserve-3d]"
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {/* Front of Card */}
                  <div className="absolute [backface_visibility:hidden] w-full h-full">
                    <Card className="flex h-full items-center justify-center p-6 shadow-lg">
                      <p className="text-2xl font-medium text-center">{currentCard.front_content}</p>
                    </Card>
                  </div>
                  {/* Back of Card */}
                  <div className="absolute [backface_visibility:hidden] w-full h-full [transform:rotateY(180deg)]">
                    <Card className="flex h-full items-center justify-center p-6 shadow-lg bg-secondary">
                      <p className="text-xl text-center">{currentCard.back_content}</p>
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
                      onClick={() => handleReview('again')}
                      disabled={isSubmittingReview}
                    >
                      <X className="mr-2 h-6 w-6" /> Again
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-primary hover:border-primary/80 hover:text-primary/80 border-2 border-primary/50 h-14 text-lg"
                      onClick={() => handleReview('good')}
                      disabled={isSubmittingReview}
                    >
                      <Check className="mr-2 h-6 w-6" /> Good
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white border-2 border-green-600 hover:border-green-700 h-14 text-lg"
                      onClick={() => handleReview('easy')}
                      disabled={isSubmittingReview}
                    >
                      <Check className="mr-2 h-6 w-6" /> Easy
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
                      <span>Total Reviewed</span>
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