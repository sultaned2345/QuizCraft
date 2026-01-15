// src/app/(app)/flashcards/[deckId]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  Layers, 
  Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

// --- Fetcher ---
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// --- Types ---
interface Flashcard {
  id: string;
  front_content: string;
  back_content: string;
}

interface DeckData {
  id: string;
  title: string;
  flashcards: Flashcard[];
}

export default function TurboFlashcardsPage() {
  const router = useRouter();
  const params = useParams();
  const { session } = useAuth();
  const deckId = params.deckId as string;

  // --- State ---
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right
  const [isFinished, setIsFinished] = useState(false);

  // --- Data Fetching ---
  const { data: deckData, isLoading, error } = useSWR<DeckData>(
    session && deckId ? `/api/decks/${deckId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      onSuccess: (data) => {
        if (data?.flashcards) {
          setCards(data.flashcards);
        }
      }
    }
  );

  // --- Handlers ---

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setDirection(1);
      setTimeout(() => setCurrentIndex((prev) => prev + 1), 150); // Delay for animation
    } else {
      setIsFinished(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#8b5cf6', '#10b981']
      });
    }
  }, [currentIndex, cards.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setDirection(-1);
      setTimeout(() => setCurrentIndex((prev) => prev - 1), 150);
    }
  }, [currentIndex]);

  const handleRestart = () => {
    setIsFinished(false);
    setCurrentIndex(0);
    setIsFlipped(false);
    setDirection(0);
  };

  // --- Keyboard Support ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;
      
      switch (e.key) {
        case ' ':
        case 'Enter':
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          handleFlip();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleNext, handlePrev, isFinished]);


  // --- Render: Loading ---
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
         <div className="flex flex-col items-center space-y-6 w-full max-w-xl px-6">
            <Skeleton className="h-8 w-1/3 rounded-lg" />
            <Skeleton className="w-full aspect-[3/2] rounded-3xl" />
            <div className="flex gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-14 w-14 rounded-full" />
            </div>
         </div>
      </div>
    );
  }

  // --- Render: Error / Empty ---
  if (error || !cards || cards.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4 p-4 text-center">
        <div className="p-4 bg-muted/50 rounded-full">
           <Layers className="w-12 h-12 text-muted-foreground opacity-50" />
        </div>
        <h2 className="text-xl font-semibold">Empty Deck</h2>
        <p className="text-muted-foreground">This deck has no flashcards yet.</p>
        <Button onClick={() => router.back()} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  // --- Render: Finished ---
  if (isFinished) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background p-4">
        <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md text-center"
        >
           <div className="relative inline-block mb-8">
             <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
             <div className="relative p-6 rounded-full bg-background border-2 border-primary/20">
                <Trophy className="w-16 h-16 text-primary" />
             </div>
           </div>

           <h2 className="text-3xl font-bold mb-2">Deck Complete!</h2>
           <p className="text-muted-foreground mb-8">You've reviewed all {cards.length} cards.</p>

           <div className="flex gap-4 justify-center">
              <Button onClick={handleRestart} variant="outline" className="h-12 px-6 rounded-xl border-2">
                 <RotateCw className="w-4 h-4 mr-2" /> Review Again
              </Button>
              <Button onClick={() => router.push('/dashboard')} className="h-12 px-6 rounded-xl shadow-lg shadow-primary/25">
                 Back to Dashboard
              </Button>
           </div>
        </motion.div>
      </div>
    );
  }

  // --- Render: Active Card ---
  const currentCard = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden text-foreground">
      
      {/* 1. Header */}
      <header className="h-16 px-6 flex items-center justify-between shrink-0 z-10 max-w-6xl mx-auto w-full">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-muted/80">
            <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <div className="flex flex-col items-center">
            <h1 className="text-sm font-bold tracking-tight">{deckData?.title || 'Flashcards'}</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
               Card {currentIndex + 1} of {cards.length}
            </p>
        </div>
        
        <div className="w-10" /> {/* Spacer */}
      </header>

      {/* 2. Progress Line */}
      <div className="w-full max-w-md mx-auto px-6 mb-2">
        <Progress value={progress} className="h-1" />
      </div>

      {/* 3. Main Card Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 perspective-1000">
         
         <div className="relative w-full max-w-3xl aspect-[1.6/1] md:aspect-[1.8/1] perspective-1000 group cursor-pointer" onClick={handleFlip}>
            <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                    key={currentIndex}
                    custom={direction}
                    initial={{ x: direction * 100, opacity: 0, rotateY: direction * 10 }}
                    animate={{ x: 0, opacity: 1, rotateY: 0 }}
                    exit={{ x: direction * -100, opacity: 0, rotateY: direction * -10 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="w-full h-full relative preserve-3d transition-transform duration-500"
                    style={{ 
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)', 
                        transformStyle: 'preserve-3d' 
                    }}
                >
                    {/* --- FRONT SIDE --- */}
                    <div className="absolute inset-0 backface-hidden bg-card border shadow-2xl rounded-[2rem] flex flex-col items-center justify-center p-8 md:p-16 text-center hover:shadow-primary/10 transition-shadow">
                        <div className="absolute top-8 left-8">
                           <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest border border-border px-2 py-1 rounded-md">
                             Front
                           </span>
                        </div>
                        
                        <div className="flex-1 flex items-center justify-center overflow-y-auto w-full no-scrollbar">
                             <h3 className="text-2xl md:text-4xl font-medium leading-snug text-balance">
                                {currentCard.front_content}
                             </h3>
                        </div>

                        <div className="absolute bottom-8 text-xs text-muted-foreground/40 font-medium uppercase tracking-widest animate-pulse">
                           Tap or Press Space to Flip
                        </div>
                    </div>

                    {/* --- BACK SIDE --- */}
                    <div 
                        className="absolute inset-0 backface-hidden bg-primary/5 border-2 border-primary/10 shadow-2xl rounded-[2rem] flex flex-col items-center justify-center p-8 md:p-16 text-center"
                        style={{ transform: 'rotateY(180deg)' }}
                    >
                         <div className="absolute top-8 left-8">
                           <span className="text-xs font-bold text-primary/70 uppercase tracking-widest border border-primary/20 bg-primary/5 px-2 py-1 rounded-md">
                             Back
                           </span>
                        </div>

                        <div className="flex-1 flex items-center justify-center overflow-y-auto w-full no-scrollbar">
                             <h3 className="text-xl md:text-3xl font-medium leading-snug text-foreground/90 text-balance">
                                {currentCard.back_content}
                             </h3>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
         </div>

         {/* 4. Controls */}
         <div className="mt-12 flex items-center gap-8 z-10">
             <Button 
                variant="outline" 
                size="icon" 
                className="h-14 w-14 rounded-full border-2 hover:bg-muted"
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                disabled={currentIndex === 0}
                title="Previous (Left Arrow)"
             >
                <ArrowLeft className="w-6 h-6" />
             </Button>

             <Button 
                className="h-20 w-20 rounded-full shadow-xl bg-primary text-primary-foreground hover:scale-105 hover:shadow-primary/25 transition-all"
                onClick={(e) => { e.stopPropagation(); handleFlip(); }}
                title="Flip (Space)"
             >
                <RotateCw className={cn("w-8 h-8 transition-transform duration-500", isFlipped && "rotate-180")} />
             </Button>

             <Button 
                variant="outline" 
                size="icon" 
                className="h-14 w-14 rounded-full border-2 hover:bg-muted"
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                disabled={currentIndex === cards.length - 1}
                title="Next (Right Arrow)"
             >
                <ArrowRight className="w-6 h-6" />
             </Button>
         </div>

      </main>
      
      {/* Keyboard Hint Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground/50 pointer-events-none">
         Use <span className="font-bold">Arrow Keys</span> to navigate • <span className="font-bold">Space</span> to flip
      </footer>
    </div>
  );
}