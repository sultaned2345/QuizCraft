// src/app/(app)/flashcards/[deckId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Flashcard, ApiResponse, DeckWithCardsResponse, CreateFlashcardData, UpdateFlashcardData } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ArrowRight, RotateCcw, Plus, Edit, Trash2, FlipVertical, Layers, Check, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- FlashcardViewer Component (Unchanged) ---
interface FlashcardViewerProps {
  card: Flashcard;
  isFlipped: boolean;
  onFlip: () => void;
}
function FlashcardViewer({ card, isFlipped, onFlip }: FlashcardViewerProps) {
    // ... (component remains the same)
    return (
        <div
            className="w-full h-64 border bg-card rounded-lg flex items-center justify-center p-6 text-center cursor-pointer perspective preserve-3d transition-transform duration-700 relative"
            onClick={onFlip}
            style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
            {/* Front */}
            <div className="absolute inset-0 p-6 flex items-center justify-center backface-hidden">
                <p className="text-xl font-medium">{card.front_content}</p>
            </div>
            {/* Back */}
            <div className="absolute inset-0 p-6 flex items-center justify-center backface-hidden rotate-y-180">
                <p className="text-lg">{card.back_content}</p>
            </div>
            <FlipVertical className="absolute bottom-2 right-2 w-4 h-4 text-muted-foreground opacity-50" />
        </div>
    );
}

// --- Add/Edit Flashcard Dialog Component (Unchanged) ---
interface FlashcardEditorDialogProps {
    deckId: string;
    cardToEdit?: Flashcard | null; 
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSaveSuccess: (savedCard: Flashcard) => void; 
}
function FlashcardEditorDialog({ deckId, cardToEdit, isOpen, onOpenChange, onSaveSuccess }: FlashcardEditorDialogProps) {
    // ... (component remains the same)
    const [front, setFront] = useState('');
    const [back, setBack] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { session } = useAuth();
    const { toast } = useToast();
    const isEditing = !!cardToEdit;

    useEffect(() => {
        if (isOpen) {
            if (isEditing && cardToEdit) {
                setFront(cardToEdit.front_content);
                setBack(cardToEdit.back_content);
            } else {
                setFront('');
                setBack('');
            }
        }
    }, [isOpen, cardToEdit, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!front.trim() || !back.trim() || !session) return;
        setIsSaving(true);

        const url = isEditing ? `/api/flashcards/${cardToEdit?.id}` : '/api/flashcards';
        const method = isEditing ? 'PUT' : 'POST';
        const body: CreateFlashcardData | UpdateFlashcardData = isEditing
            ? { front_content: front, back_content: back }
            : { deck_id: deckId, front_content: front, back_content: back };

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
            });
            const result: ApiResponse<Flashcard> = await response.json();
            if (!result.success || !result.data) {
                throw new Error(result.error || `Failed to ${isEditing ? 'update' : 'create'} flashcard.`);
            }
            toast({ title: `Flashcard ${isEditing ? 'Updated' : 'Created'}!`, description: `"${result.data.front_content}" saved.` });
            onSaveSuccess(result.data);
            onOpenChange(false);
        } catch (error: any) {
            toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit Flashcard' : 'Add New Flashcard'}</DialogTitle>
                    <DialogDescription>
                        Enter the content for the front and back of the card.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="front-content">Front</Label>
                        <Textarea id="front-content" value={front} onChange={(e) => setFront(e.target.value)} placeholder="Term, question, concept..." disabled={isSaving} required className="min-h-[100px]"/>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="back-content">Back</Label>
                        <Textarea id="back-content" value={back} onChange={(e) => setBack(e.target.value)} placeholder="Definition, answer, explanation..." disabled={isSaving} required className="min-h-[100px]"/>
                    </div>
                     <DialogFooter>
                         <DialogClose asChild>
                            <Button type="button" variant="ghost" disabled={isSaving}>Cancel</Button>
                         </DialogClose>
                        <Button type="submit" disabled={isSaving || !front.trim() || !back.trim()}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditing ? 'Save Changes' : 'Add Card'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}


// --- Main Deck View Page Component ---
type StudyMode = 'due' | 'new' | 'all';
type ViewState = 'loading' | 'error' | 'menu' | 'studying' | 'complete';

export default function DeckViewPage() {
    // --- NEW: Updated State ---
    const [deckTitle, setDeckTitle] = useState('');
    const [studyCards, setStudyCards] = useState<Flashcard[]>([]);
    const [viewState, setViewState] = useState<ViewState>('loading');
    const [error, setError] = useState('');
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [cardToEdit, setCardToEdit] = useState<Flashcard | null>(null);
    const [isReviewing, setIsReviewing] = useState(false);
    // This state will require enhancing the /api/decks/[deckId] route
    const [deckStats, setDeckStats] = useState({ total: 0, due: 0, new: 0 }); 
    // --- END NEW ---

    const { user, session, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const deckId = params.deckId as string;

    // --- NEW: Fetch deck info and stats on load ---
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }
        if (user && deckId && session) {
            setViewState('loading');
            // We need an API route that returns deck info + stats
            // For now, we'll use the existing /api/decks/[deckId]
            fetch(`/api/decks/${deckId}`, { 
                 headers: { Authorization: `Bearer ${session.access_token}` },
            })
            .then(res => res.json())
            .then((data: ApiResponse<DeckWithCardsResponse>) => {
                if (!data.success || !data.data) {
                    throw new Error(data.error || 'Failed to load deck.');
                }
                setDeckTitle(data.data.title);
                // TODO: Enhance /api/decks/[deckId] to return due/new counts
                setDeckStats({ total: data.data.cardCount, due: 0, new: 0 }); // Placeholder
                setViewState('menu');
            })
            .catch(err => {
                setError(err.message);
                setViewState('error');
            });
        }
    }, [user, authLoading, deckId, session, router]);

    // --- NEW: Function to start a study session ---
    const startStudySession = async (mode: StudyMode) => {
        if (!session || !deckId) return;
        setViewState('loading');
        setError('');
        try {
            const response = await fetch(`/api/decks/${deckId}/study?mode=${mode}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data: ApiResponse<DeckWithCardsResponse> = await response.json();
            if (!data.success || !data.data) {
                throw new Error(data.error || 'Failed to load study session.');
            }
            setStudyCards(data.data.flashcards);
            setCurrentCardIndex(0); 
            setIsFlipped(false);
            // Go to 'complete' state if no cards are returned
            setViewState(data.data.flashcards.length > 0 ? 'studying' : 'complete');
        } catch (err: any) {
            setError(err.message || 'Deck not found or access denied.');
            setViewState('error');
        }
    };
    
    // --- (handleReview remains the same) ---
    const handleReview = async (quality: 'again' | 'good' | 'easy') => {
        const card = currentCard;
        if (!card || !session || isReviewing) return;
        setIsReviewing(true);
        try {
            const response = await fetch(`/api/flashcards/${card.id}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ quality }),
            });
            const result: ApiResponse<Flashcard> = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to save review.');
            goToNextCard();
        } catch (error: any) {
            toast({ title: 'Review Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsReviewing(false);
        }
    };

    // --- MODIFIED: goToNextCard ---
    const goToNextCard = () => {
        if (studyCards.length === 0) return;
        // Check if we are on the last card
        if (currentCardIndex + 1 >= studyCards.length) {
            setViewState('complete'); // Go to complete state
        } else {
            setCurrentCardIndex((prev) => prev + 1);
            setIsFlipped(false);
        }
    };
    
    // --- (handleDeleteCard remains the same - it's already optimistic) ---
    const handleDeleteCard = async (cardId: string) => {
        if (!session) return;
        const cardToDelete = studyCards.find(c => c.id === cardId);
        if (!cardToDelete || !confirm(`Delete card "${cardToDelete.front_content.substring(0, 20)}..."? This will remove it permanently.`)) return;
        const originalStudyCards = [...studyCards];
        setStudyCards(prev => prev.filter(c => c.id !== cardId));
        setIsFlipped(false);
        try {
            const response = await fetch(`/api/flashcards/${cardId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const result: ApiResponse = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to delete card.');
            toast({ title: 'Card Deleted' });
        } catch (error: any) {
            toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' });
            setStudyCards(originalStudyCards); // Rollback
        }
    };


    // --- RENDER LOGIC ---

    if (viewState === 'loading' || authLoading) {
        return <div className="flex h-[calc(100vh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (viewState === 'error') {
        return (
             <div className="flex flex-col h-[calc(100vh-8rem)] items-center justify-center text-center">
                <Layers className="mx-auto h-16 w-16 text-destructive" />
                <h1 className="mt-6 text-2xl font-bold text-destructive">Error Loading Deck</h1>
                <p className="mt-2 text-muted-foreground">{error}</p>
                 <Button variant="outline" className="mt-4" onClick={() => router.push('/flashcards')}>
                     <ArrowLeft className="w-4 h-4 mr-2" /> Back to Decks
                 </Button>
            </div>
        );
    }

    // --- NEW: Study Menu View ---
    if (viewState === 'menu') {
        return (
             <>
                <Button variant="ghost" onClick={() => router.push('/flashcards')}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Decks
                </Button>
                <div className="max-w-xl mx-auto text-center mt-8">
                    <h1 className="text-3xl font-bold mb-2">{deckTitle}</h1>
                    <p className="text-lg text-muted-foreground mb-8">
                        {deckStats.total} cards total.
                        {/* TODO: Add stats: ({deckStats.due} due, {deckStats.new} new) */}
                    </p>
                    <Card>
                        <CardHeader>
                            <CardTitle>Start Studying</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4">
                            <Button size="lg" onClick={() => startStudySession('due')}>
                                Review Due Cards
                                {/* ({deckStats.due}) */}
                            </Button>
                            <Button size="lg" variant="secondary" onClick={() => startStudySession('new')}>
                                Learn New Cards
                                {/* ({deckStats.new}) */}
                            </Button>
                             <Button size="lg" variant="outline" onClick={() => startStudySession('all')}>
                                Cram All Cards
                            </Button>
                        </CardContent>
                    </Card>
                </div>
             </>
        );
    }
    
    // --- NEW: Session Complete View ---
    if (viewState === 'complete') {
         return (
            <>
                <Button variant="ghost" onClick={() => router.push('/flashcards')}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Decks
                </Button>
                <div className="max-w-xl mx-auto text-center mt-8">
                    <div className="w-full h-64 border bg-card rounded-lg flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                        <Check className="w-16 h-16 text-green-500 mb-4" />
                        <p className="text-xl font-medium mb-4">Session Complete!</p>
                        <p className="text-sm mb-6">You've finished this batch of cards.</p>
                        <Button onClick={() => setViewState('menu')}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Deck Menu
                        </Button>
                    </div>
                </div>
            </>
         );
    }
    
    // --- Studying View (Modified) ---
    const currentCard = studyCards[currentCardIndex];
    // This case handles if the card list becomes empty during study (e.g., deleting last card)
    if (!currentCard) {
        setViewState('complete');
        return null; 
    }

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <Button variant="ghost" onClick={() => setViewState('menu')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Menu
                </Button>
                 <Button onClick={() => { setCardToEdit(null); setIsEditorOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Card
                </Button>
            </div>

            <h1 className="text-3xl font-bold mb-2 text-center">{deckTitle}</h1>
            <p className="text-sm text-muted-foreground text-center mb-8">
                Card {currentCardIndex + 1} of {studyCards.length} in this session.
             </p>

            <div className="max-w-xl mx-auto">
                <FlashcardViewer
                    card={currentCard}
                    isFlipped={isFlipped}
                    onFlip={() => setIsFlipped(!isFlipped)}
                />

                <div className="flex justify-between items-center mt-6">
                    {isFlipped ? (
                        <div className="w-full grid grid-cols-3 gap-2 sm:gap-4">
                            <Button variant="outline" className="bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400" onClick={() => handleReview('again')} disabled={isReviewing}>
                                Again
                            </Button>
                            <Button variant="outline" className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400" onClick={() => handleReview('good')} disabled={isReviewing}>
                                Good
                            </Button>
                             <Button variant="outline" className="bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400" onClick={() => handleReview('easy')} disabled={isReviewing}>
                                Easy
                            </Button>
                        </div>
                    ) : (
                        <div className="w-full grid grid-cols-3 gap-4">
                            <Button variant="ghost" size="sm" onClick={() => { setCardToEdit(currentCard); setIsEditorOpen(true); }} disabled={!currentCard || isReviewing}>
                                <Edit className="w-4 h-4 mr-2" /> Edit Card
                            </Button>
                            <div className="flex justify-center">
                                <Button className="w-full" onClick={() => setIsFlipped(true)}>
                                    Show Answer
                                </Button>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => currentCard && handleDeleteCard(currentCard.id)} disabled={!currentCard || isReviewing} className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </Button>
                        </div>
                    )}
                </div>
            </div>

             {/* --- MODIFIED onSaveSuccess --- */}
             <FlashcardEditorDialog
                deckId={deckId}
                cardToEdit={cardToEdit}
                isOpen={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                onSaveSuccess={(savedCard) => {
                    if (cardToEdit) {
                        // We edited an existing card
                        setStudyCards(prev => 
                            prev.map(c => c.id === savedCard.id ? savedCard : c)
                        );
                        toast({ title: "Card Updated!" });
                    } else {
                        // We added a new card.
                        // Don't add to the current session, just update stats.
                        setDeckStats(prev => ({ ...prev, total: prev.total + 1, new: prev.new + 1 }));
                        toast({ title: "Card Added!" });
                    }
                }}
             />

             <style jsx global>{`
                .perspective { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
            `}</style>
        </>
    );
}