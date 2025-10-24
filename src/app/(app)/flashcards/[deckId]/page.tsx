'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
// Error: Types not found/exported correctly
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
import { Loader2, ArrowLeft, ArrowRight, RotateCcw, Plus, Edit, Trash2, FlipVertical } from 'lucide-react';
// Error: Layers not imported (but used later)
import { cn } from '@/lib/utils';

// --- Flashcard Display Component ---
interface FlashcardViewerProps {
  card: Flashcard;
  isFlipped: boolean;
  onFlip: () => void;
}

function FlashcardViewer({ card, isFlipped, onFlip }: FlashcardViewerProps) {
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

// --- Add/Edit Flashcard Dialog Component ---
interface FlashcardEditorDialogProps {
    deckId: string;
    cardToEdit?: Flashcard | null; // Pass card for editing, null/undefined for creating
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSaveSuccess: (savedCard: Flashcard) => void; // Callback after successful save
}

function FlashcardEditorDialog({ deckId, cardToEdit, isOpen, onOpenChange, onSaveSuccess }: FlashcardEditorDialogProps) {
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
            onSaveSuccess(result.data); // Pass saved card back
            onOpenChange(false); // Close dialog on success
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
                        <Textarea
                            id="front-content"
                            value={front}
                            onChange={(e) => setFront(e.target.value)}
                            placeholder="Term, question, concept..."
                            disabled={isSaving}
                            required
                            className="min-h-[100px]"
                        />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="back-content">Back</Label>
                        <Textarea
                            id="back-content"
                            value={back}
                            onChange={(e) => setBack(e.target.value)}
                            placeholder="Definition, answer, explanation..."
                            disabled={isSaving}
                            required
                             className="min-h-[100px]"
                        />
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
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [cardToEdit, setCardToEdit] = useState<Flashcard | null>(null);

    const { user, session, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const deckId = params.deckId as string;

    const fetchDeckData = async () => {
        if (!session || !deckId) return;
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/decks/${deckId}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data: ApiResponse<DeckWithCardsResponse> = await response.json();
            if (!data.success || !data.data) {
                throw new Error(data.error || 'Failed to load deck.');
            }
            setDeck(data.data);
            setCurrentCardIndex(0); // Reset index when loading/reloading
            setIsFlipped(false);    // Reset flip state
        } catch (err: any) {
            setError(err.message || 'Deck not found or access denied.');
            toast({ title: 'Error Loading Deck', description: err.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }
        if (user && deckId) {
            fetchDeckData();
        }
    }, [user, authLoading, deckId, router]);

    const goToNextCard = () => {
        if (!deck || deck.flashcards.length === 0) return;
        setCurrentCardIndex((prev) => (prev + 1) % deck.flashcards.length);
        setIsFlipped(false);
    };

    const goToPrevCard = () => {
        if (!deck || deck.flashcards.length === 0) return;
        setCurrentCardIndex((prev) => (prev - 1 + deck.flashcards.length) % deck.flashcards.length);
        setIsFlipped(false);
    };

     const handleDeleteCard = async (cardId: string) => {
        if (!session) return;
        // Error: Parameter 'c' implicitly has an 'any' type. (Problem 1/2)
        const cardToDelete = deck?.flashcards.find(c => c.id === cardId);
        if (!cardToDelete || !confirm(`Delete card "${cardToDelete.front_content.substring(0, 20)}..."?`)) return;

        try {
            const response = await fetch(`/api/flashcards/${cardId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const result: ApiResponse = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to delete card.');

            toast({ title: 'Card Deleted' });
            fetchDeckData(); // Refresh deck data
        } catch (error: any) {
            toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' });
        }
    };


    if (authLoading || isLoading) {
        return <div className="flex h-[calc(100vh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (error) {
        return (
             <div className="flex flex-col h-[calc(100vh-8rem)] items-center justify-center text-center">
                {/* Error: Cannot find name 'Layers'. (Problem 3) */}
                <Layers className="mx-auto h-16 w-16 text-destructive" />
                <h1 className="mt-6 text-2xl font-bold text-destructive">Error Loading Deck</h1>
                <p className="mt-2 text-muted-foreground">{error}</p>
                 <Button variant="outline" className="mt-4" onClick={() => router.push('/flashcards')}>
                     <ArrowLeft className="w-4 h-4 mr-2" /> Back to Decks
                 </Button>
            </div>
        );
    }

    const currentCard = deck?.flashcards?.[currentCardIndex];
    const totalCards = deck?.flashcards?.length ?? 0;

    return (
        <>
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
                 Card {totalCards > 0 ? currentCardIndex + 1 : 0} of {totalCards}
             </p>

            <div className="max-w-xl mx-auto">
                {currentCard ? (
                    <FlashcardViewer
                        card={currentCard}
                        isFlipped={isFlipped}
                        onFlip={() => setIsFlipped(!isFlipped)}
                    />
                ) : (
                    <div className="w-full h-64 border bg-card rounded-lg flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                        <p className="text-lg font-medium mb-4">This deck is empty!</p>
                         <Button onClick={() => { setCardToEdit(null); setIsEditorOpen(true); }}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add the First Card
                        </Button>
                    </div>
                )}

                {totalCards > 0 && (
                    <div className="flex justify-between items-center mt-6">
                        <Button variant="outline" size="icon" onClick={goToPrevCard} disabled={totalCards <= 1}>
                            <ArrowLeft className="w-5 h-5" />
                            <span className="sr-only">Previous Card</span>
                        </Button>

                         <div className="flex gap-2">
                             <Button variant="outline" size="sm" onClick={() => { setCardToEdit(currentCard); setIsEditorOpen(true); }} disabled={!currentCard}>
                                 <Edit className="w-4 h-4 mr-2" /> Edit
                             </Button>
                             <Button variant="destructive" size="sm" onClick={() => currentCard && handleDeleteCard(currentCard.id)} disabled={!currentCard}>
                                 <Trash2 className="w-4 h-4 mr-2" /> Delete
                             </Button>
                         </div>

                        <Button variant="outline" size="icon" onClick={goToNextCard} disabled={totalCards <= 1}>
                            <ArrowRight className="w-5 h-5" />
                             <span className="sr-only">Next Card</span>
                        </Button>
                    </div>
                )}
            </div>

             {/* Add/Edit Dialog */}
             <FlashcardEditorDialog
                deckId={deckId}
                cardToEdit={cardToEdit}
                isOpen={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                onSaveSuccess={(savedCard) => {
                    // Refresh data after save
                    fetchDeckData();
                    // Optionally try to find the saved card's index, otherwise reset
                    // Error: Parameter 'c' implicitly has an 'any' type. (Problem 2/2)
                    const savedIndex = deck?.flashcards.findIndex(c => c.id === savedCard.id) ?? -1;
                    if (savedIndex !== -1) {
                        setCurrentCardIndex(savedIndex);
                        setIsFlipped(false);
                    }
                }}
             />

              {/* Add CSS for flip animation (can be in globals.css or here) */}
             <style jsx global>{`
                .perspective { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
            `}</style>
        </>
    );
}