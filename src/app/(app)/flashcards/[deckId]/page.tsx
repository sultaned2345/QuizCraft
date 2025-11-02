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

// --- Flashcard Display Component (Unchanged) ---
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
export default function DeckViewPage() {
    const [deck, setDeck] = useState<DeckWithCardsResponse | null>(null);
    const [studyCards, setStudyCards] = useState<Flashcard[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [cardToEdit, setCardToEdit] = useState<Flashcard | null>(null);
    const [isReviewing, setIsReviewing] = useState(false);

    const { user, session, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const deckId = params.deckId as string;

    const fetchDeckData = async () => {
        // ... (function remains the same)
        if (!session || !deckId) return;
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/decks/${deckId}/study`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data: ApiResponse<DeckWithCardsResponse> = await response.json();
            if (!data.success || !data.data) {
                throw new Error(data.error || 'Failed to load deck study session.');
            }
            setDeck(data.data);
            setStudyCards(data.data.flashcards);
            setCurrentCardIndex(0); 
            setIsFlipped(false);
        } catch (err: any) {
            setError(err.message || 'Deck not found or access denied.');
            toast({ title: 'Error Loading Deck', description: err.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // ... (function remains the same)
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }
        if (user && deckId) {
            fetchDeckData();
        }
    }, [user, authLoading, deckId, router]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleReview = async (quality: 'again' | 'good' | 'easy') => {
        // ... (function remains the same)
        const card = currentCard;
        if (!card || !session || isReviewing) return;

        setIsReviewing(true);
        try {
            const response = await fetch(`/api/flashcards/${card.id}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ quality }),
            });
            const result: ApiResponse<Flashcard> = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to save review.');
            }
            goToNextCard();
        } catch (error: any) {
            toast({ title: 'Review Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsReviewing(false);
        }
    };

    const goToNextCard = () => {
        // ... (function remains the same)
        if (studyCards.length === 0) return;
        setCurrentCardIndex((prev) => prev + 1);
        setIsFlipped(false);
    };

    // --- MODIFIED: Optimistic Deletion ---
    const handleDeleteCard = async (cardId: string) => {
        if (!session) return;
        const cardToDelete = studyCards.find(c => c.id === cardId);
        
        if (!cardToDelete || !confirm(`Delete card "${cardToDelete.front_content.substring(0, 20)}..."? This will remove it permanently.`)) return;

        // 1. Optimistic Update
        const originalStudyCards = [...studyCards];
        const originalDeck = deck ? { ...deck } : null;
        
        setStudyCards(prev => prev.filter(c => c.id !== cardId));
        if (deck) {
            setDeck(prev => prev ? ({ ...prev, cardCount: prev.cardCount - 1 }) : null);
        }
        // Move to next card immediately
        setIsFlipped(false);
        // Note: The index `currentCardIndex` now points to the *next* card in the 
        // filtered `studyCards` array, which is the desired behavior.

        try {
            // 2. API Call
            const response = await fetch(`/api/flashcards/${cardId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const result: ApiResponse = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to delete card.');

            // 3. Success
            toast({ title: 'Card Deleted' });
            // No fetchDeckData() needed.
            
        } catch (error: any) {
            // 4. Rollback
            toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' });
            setStudyCards(originalStudyCards);
            setDeck(originalDeck);
            // Index is implicitly reset by state rollback
        }
    };


    if (authLoading || isLoading) {
        // ... (render remains the same)
        return <div className="flex h-[calc(100vh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (error) {
        // ... (render remains the same)
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

    const currentCard = studyCards[currentCardIndex];
    const totalCardsInDeck = deck?.cardCount ?? 0;
    const sessionComplete = currentCardIndex >= studyCards.length;

    return (
        <>
            {/* (Rest of JSX remains the same) */}
            <div className="flex items-center justify-between mb-6">
                <Button variant="ghost" onClick={() => router.push('/flashcards')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Decks
                </Button>
                 <Button onClick={() => { setCardToEdit(null); setIsEditorOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Card
                </Button>
            </div>

            <h1 className="text-3xl font-bold mb-2 text-center">{deck?.title}</h1>
            <p className="text-sm text-muted-foreground text-center mb-8">
                 {sessionComplete
                    ? `Session Complete! (Total cards in deck: ${totalCardsInDeck})`
                    : `Card ${currentCardIndex + 1} of ${studyCards.length} in this session. (Total: ${totalCardsInDeck})`
                 }
             </p>

            <div className="max-w-xl mx-auto">
                {sessionComplete ? (
                    <div className="w-full h-64 border bg-card rounded-lg flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                        <Check className="w-16 h-16 text-green-500 mb-4" />
                        <p className="text-xl font-medium mb-4">All done for now!</p>
                        <p className="text-sm mb-6">You've reviewed all cards due today.</p>
                         <Button onClick={fetchDeckData}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Study Again (if any are due)
                        </Button>
                    </div>
                ) : currentCard ? (
                    <FlashcardViewer
                        card={currentCard}
                        isFlipped={isFlipped}
                        onFlip={() => setIsFlipped(!isFlipped)}
                    />
                ) : (
                    <div className="w-full h-64 border bg-card rounded-lg flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                        <Zap className="w-12 h-12 text-primary mb-4" />
                        <p className="text-lg font-medium mb-4">
                            {totalCardsInDeck > 0 ? "No cards due for review!" : "This deck is empty!"}
                        </p>
                         <Button onClick={() => { setCardToEdit(null); setIsEditorOpen(true); }}>
                            <Plus className="w-4 h-4 mr-2" />
                            {totalCardsInDeck > 0 ? "Add a New Card" : "Add the First Card"}
                        </Button>
                    </div>
                )}

                {!sessionComplete && currentCard && (
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
                )}
            </div>

             <FlashcardEditorDialog
                deckId={deckId}
                cardToEdit={cardToEdit}
                isOpen={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                onSaveSuccess={(savedCard) => {
                    fetchDeckData(); 
                    setCurrentCardIndex(0);
                    setIsFlipped(false);
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