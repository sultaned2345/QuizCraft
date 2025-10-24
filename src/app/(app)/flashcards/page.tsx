'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { FlashcardDeck, ApiResponse, DecksResponse } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger, // Added DialogTrigger
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Layers, Edit, Trash2, BookCopy } from 'lucide-react'; // Replaced FileSignature with Layers/BookCopy
import { USAGE_LIMITS } from '@/lib/usage-limits';

export default function FlashcardsPage() {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usage, setUsage] = useState<{ count: number; limit: number | typeof Infinity }>({ count: 0, limit: USAGE_LIMITS.FREE_FLASHCARD_DECKS });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchDecks();
    }
  }, [user, authLoading, router]);

  const fetchDecks = async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/decks', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data: ApiResponse<DecksResponse> = await response.json();
      if (!data.success || !data.data) throw new Error(data.error || 'Failed to load decks.');
      setDecks(data.data.decks);
      setUsage({ count: data.data.count, limit: data.data.limit });
    } catch (error: any) {
      toast({ title: 'Error Loading Decks', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDeck = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newDeckTitle.trim() || !session) return;
      setIsSaving(true);
      try {
          const response = await fetch('/api/decks', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ title: newDeckTitle }),
          });
          const result: ApiResponse<FlashcardDeck> = await response.json();
          if (!result.success || !result.data) {
              throw new Error(result.error || 'Failed to create deck.');
          }
          toast({ title: 'Deck Created!', description: `Deck "${result.data.title}" added.` });
          setNewDeckTitle('');
          setIsCreateDialogOpen(false);
          fetchDecks(); // Refresh the list
      } catch (error: any) {
          toast({ title: 'Creation Failed', description: error.message, variant: 'destructive' });
      } finally {
          setIsSaving(false);
      }
  };

  // Placeholder for future delete functionality
  const handleDeleteDeck = async (deckId: string, deckTitle: string) => {
    if (!session) return;
    if (!confirm(`Are you sure you want to delete the deck "${deckTitle}"? All cards within it will also be deleted.`)) return;

    try {
        const response = await fetch(`/api/decks/${deckId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const result: ApiResponse = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to delete deck.');
        }
        toast({ title: 'Deck Deleted', description: `Deck "${deckTitle}" removed.` });
        fetchDecks(); // Refresh list
    } catch (error: any) {
         toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' });
    }
  };

   if (authLoading || isLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Flashcard Decks</h1>
          {usage.limit !== Infinity && (
              <p className="text-sm text-muted-foreground mt-1">
                  You've created {usage.count}/{usage.limit} decks.
                  {/* Link to pricing page if available */}
                  {/* <Link href="/pricing" className="ml-2 text-primary font-medium hover:underline">Upgrade to Pro</Link> */}
              </p>
          )}
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Deck
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                <DialogTitle>Create New Deck</DialogTitle>
                <DialogDescription>
                    Enter a title for your new flashcard deck.
                </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateDeck} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="deck-title" className="text-right">
                        Title
                        </Label>
                        <Input
                        id="deck-title"
                        value={newDeckTitle}
                        onChange={(e) => setNewDeckTitle(e.target.value)}
                        className="col-span-3"
                        disabled={isSaving}
                        required
                        />
                    </div>
                     <DialogFooter>
                         <Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)} disabled={isSaving}>Cancel</Button>
                        <Button type="submit" disabled={isSaving || !newDeckTitle.trim()}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Deck
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </div>

      {decks.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <Layers className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Decks Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by creating your first flashcard deck.
          </p>
          <Button className="mt-6" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create a Deck
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map((deck) => (
            <Card key={deck.id} className="flex flex-col">
              <CardHeader>
                {/* Wrap title in Link to navigate to deck view page (to be created) */}
                <Link href={`/flashcards/${deck.id}`} className="hover:underline">
                     <CardTitle className="text-lg truncate">{deck.title}</CardTitle>
                </Link>
              </CardHeader>
              <CardContent className="flex-grow">
                 {/* Placeholder for card count - Needs adjustment if API provides it */}
                 <p className="text-sm text-muted-foreground">Contains flashcards...</p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/flashcards/${deck.id}`)}>
                      <BookCopy className="w-4 h-4 mr-2" /> View Cards
                  </Button>
                  {/* Add Edit/Delete buttons later */}
                   <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                       <Edit className="w-4 h-4" />
                       <span className="sr-only">Edit Deck</span>
                   </Button>
                   <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDeleteDeck(deck.id, deck.title)}>
                       <Trash2 className="w-4 h-4" />
                       <span className="sr-only">Delete Deck</span>
                   </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}