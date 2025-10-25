'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { FlashcardDeck, ApiResponse } from '@/types/database';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Layers, Edit, Trash2, BookCopy } from 'lucide-react';

// Define expected response structure for pagination API calls
interface PaginatedDecksData {
  decks: FlashcardDeck[];
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}

// Define props for the client component, including initial data
interface FlashcardsClientComponentProps {
  initialData: PaginatedDecksData;
}

export function FlashcardsClientComponent({ initialData }: FlashcardsClientComponentProps) {
  // Initialize state with data passed from the Server Component
  const [decks, setDecks] = useState<FlashcardDeck[]>(initialData.decks);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [usage, setUsage] = useState<{ count: number; limit: number | typeof Infinity }>({ count: initialData.count, limit: initialData.limit });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialData.currentPage);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const decksPerPage = 9; // Should match API limit

  const { session } = useAuth(); // Keep session for actions
  const router = useRouter();
  const { toast } = useToast();

  // --- Fetch More Decks (Client-Side) ---
  const fetchMoreDecks = useCallback(async (page: number) => {
    if (!session || isLoadingMore || page > totalPages) return;
    setIsLoadingMore(true);

    try {
      const response = await fetch(`/api/decks?page=${page}&limit=${decksPerPage}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data: ApiResponse<PaginatedDecksData> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to load more decks.');
      }

      setDecks(prev => [...prev, ...data.data!.decks]); // Append new decks
      setCurrentPage(data.data.currentPage);
      // Update total pages/count if needed
      setTotalPages(data.data.totalPages);
      setUsage({ count: data.data.count, limit: data.data.limit });

    } catch (error: any) {
      toast({ title: 'Error Loading More Decks', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoadingMore(false);
    }
  }, [session, toast, decksPerPage, isLoadingMore, totalPages]);

  const handleLoadMore = () => {
    fetchMoreDecks(currentPage + 1);
  }

  // --- Refresh Function (Refetch Page 1 Client-Side) ---
   const refreshFirstPage = useCallback(async () => {
        if (!session) return;
        // Indicate loading if desired
        try {
            const response = await fetch(`/api/decks?page=1&limit=${decksPerPage}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data: ApiResponse<PaginatedDecksData> = await response.json();
            if (!data.success || !data.data) throw new Error(data.error || 'Failed refresh.');

            setDecks(data.data.decks); // Replace decks with first page
            setCurrentPage(data.data.currentPage);
            setTotalPages(data.data.totalPages);
            setUsage({ count: data.data.count, limit: data.data.limit });
        } catch (error: any) {
            toast({ title: "Error Refreshing Decks", description: error.message, variant: "destructive" });
        } finally {
            // Stop loading indicator
        }
    }, [session, toast, decksPerPage]);

  // --- Create/Delete Handlers (Now call refreshFirstPage) ---
  const handleCreateDeck = async (e: React.FormEvent) => {
      e.preventDefault();
      // ... (API call logic remains the same) ...
       if (!newDeckTitle.trim() || !session) return;
       setIsSaving(true);
       try {
           const response = await fetch('/api/decks', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ title: newDeckTitle }) });
           const result: ApiResponse<FlashcardDeck> = await response.json();
           if (!result.success || !result.data) throw new Error(result.error || 'Failed create.');
           toast({ title: 'Deck Created!', description: `"${result.data.title}" added.` });
           setNewDeckTitle('');
           setIsCreateDialogOpen(false);
           refreshFirstPage(); // Refresh the list
       } catch (error: any) { toast({ title: 'Creation Failed', description: error.message, variant: 'destructive' }); }
       finally { setIsSaving(false); }
  };

  const handleDeleteDeck = async (deckId: string, deckTitle: string) => {
    // ... (API call logic remains the same) ...
     if (!session || !confirm(`Delete "${deckTitle}"? All cards within will be deleted.`)) return;
     try {
         const response = await fetch(`/api/decks/${deckId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
         const result: ApiResponse = await response.json();
         if (!result.success) throw new Error(result.error || 'Failed delete.');
         toast({ title: 'Deck Deleted', description: `"${deckTitle}" removed.` });
         refreshFirstPage(); // Refresh list
     } catch (error: any) { toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' }); }
  };

   // --- Render Logic ---
   // (No top-level loading state needed here)

  return (
    <>
      {/* Header and Create Dialog Trigger */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Flashcard Decks</h1>
          {usage.limit !== Infinity && (
              <p className="text-sm text-muted-foreground mt-1">
                  Total Decks: {usage.count} / {usage.limit}.
                  {/* <Link href="/pricing" className="ml-2 text-primary font-medium hover:underline">Upgrade</Link> */}
              </p>
          )}
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> New Deck
                </Button>
            </DialogTrigger>
            {/* Create Dialog Content remains the same */}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader><DialogTitle>Create New Deck</DialogTitle><DialogDescription>Enter a title.</DialogDescription></DialogHeader>
                <form onSubmit={handleCreateDeck} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="deck-title" className="text-right">Title</Label><Input id="deck-title" value={newDeckTitle} onChange={(e) => setNewDeckTitle(e.target.value)} className="col-span-3" disabled={isSaving} required/></div>
                    <DialogFooter><Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)} disabled={isSaving}>Cancel</Button><Button type="submit" disabled={isSaving || !newDeckTitle.trim()}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </div>

      {/* Grid or Empty State */}
      {decks.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <Layers className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Decks Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first flashcard deck.</p>
          <Button className="mt-6" onClick={() => setIsCreateDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Create a Deck</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map((deck) => (
            <Card key={deck.id} className="flex flex-col">
              <CardHeader>
                <Link href={`/flashcards/${deck.id}`} className="hover:underline"><CardTitle className="text-lg truncate">{deck.title}</CardTitle></Link>
              </CardHeader>
              <CardContent className="flex-grow"><p className="text-sm text-muted-foreground">Contains flashcards...</p></CardContent>
              <CardFooter className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/flashcards/${deck.id}`)}><BookCopy className="w-4 h-4 mr-2" /> View</Button>
                   <Button variant="ghost" size="icon" className="h-8 w-8" disabled><Edit className="w-4 h-4" /><span className="sr-only">Edit</span></Button>
                   <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDeleteDeck(deck.id, deck.title)}><Trash2 className="w-4 h-4" /><span className="sr-only">Delete</span></Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

       {/* Load More Button */}
      {totalPages > currentPage && (
          <div className="mt-8 text-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                  {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More Decks
              </Button>
               <p className="text-xs text-muted-foreground mt-2">Showing {decks.length} of {usage.count} decks</p>
          </div>
      )}
    </>
  );
}