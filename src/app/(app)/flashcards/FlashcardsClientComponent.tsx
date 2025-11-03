// src/app/(app)/flashcards/FlashcardsClientComponent.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { FlashcardDeck, ApiResponse } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription as DialogDesc,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Layers, Edit, Trash2, BookCopy, Play } from 'lucide-react';
import { motion } from 'framer-motion';
// --- NEW: Import Progress component ---
import { Progress } from '@/components/ui/progress';
import { useUpgradeModal } from '@/components/UpgradeModalContext'; // <-- 1. FIXED IMPORT PATH

// --- NEW: Define enhanced types locally ---
interface DeckWithStats extends FlashcardDeck {
  cardCount: number;
  dueCount: number;
  newCount: number;
}
interface PaginatedDecksData {
  decks: DeckWithStats[];
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}
interface FlashcardsPageData extends PaginatedDecksData {
  dueCount: number;
  firstDueDeckId: string | null;
}
interface FlashcardsClientComponentProps {
  initialData: FlashcardsPageData;
}
// --- END NEW ---


function StudyQueueCard({
  dueCount,
  firstDueDeckId,
}: {
  dueCount: number;
  firstDueDeckId: string | null;
}) {
  // ... (component remains the same)
  const router = useRouter();
  if (dueCount === 0) {
    return null;
  }
  const handleStudyClick = () => {
    if (firstDueDeckId) {
      router.push(`/flashcards/${firstDueDeckId}`);
    } else {
      router.push('/flashcards');
    }
  };
  return (
    <Card className="mb-8 bg-primary/10 border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <span>Study Queue</span>
        </CardTitle>
        <CardDescription>
          You have <strong>{dueCount} flashcard{dueCount > 1 ? 's' : ''}</strong> due for
          review.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button className="w-full" onClick={handleStudyClick}>
          <Play className="w-4 h-4 mr-2" />
          Start Review Session
        </Button>
      </CardFooter>
    </Card>
  );
}

export function FlashcardsClientComponent({ initialData }: FlashcardsClientComponentProps) {
  // --- MODIFIED: Use DeckWithStats type ---
  const [decks, setDecks] = useState<DeckWithStats[]>(initialData.decks);
  // ... (rest of state is the same)
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [usage, setUsage] = useState<{ count: number; limit: number | typeof Infinity }>({
    count: initialData.count,
    limit: initialData.limit,
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialData.currentPage);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const decksPerPage = 9;
  const [dueCount, setDueCount] = useState(initialData.dueCount);
  const [firstDueDeckId, setFirstDueDeckId] = useState(initialData.firstDueDeckId);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<DeckWithStats | null>(null); // Use DeckWithStats
  const [editDeckTitle, setEditDeckTitle] = useState('');

  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { openModal } = useUpgradeModal(); // <-- 2. GET MODAL FUNCTION

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
  };

  // --- MODIFIED: Update types for fetch/refresh functions ---
  const fetchMoreDecks = useCallback(async (page: number) => {
    if (!session || isLoadingMore || page > totalPages) return;
    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/decks?page=${page}&limit=${decksPerPage}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      // --- Use new type ---
      const data: ApiResponse<PaginatedDecksData> = await response.json();
      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to load more decks.');
      }
      setDecks((prev) => [...prev, ...data.data!.decks]);
      setCurrentPage(data.data.currentPage);
      setTotalPages(data.data.totalPages);
      setUsage({ count: data.data.count, limit: data.data.limit });
    } catch (error: any) {
      toast({ title: 'Error Loading More Decks', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoadingMore(false);
    }
  }, [session, toast, decksPerPage, isLoadingMore, totalPages]);

  const handleLoadMore = () => { fetchMoreDecks(currentPage + 1); };

  const refreshFirstPage = useCallback(async () => {
    if (!session) return;
    try {
      const [decksResponse, queueResponse] = await Promise.all([
        fetch(`/api/decks?page=1&limit=${decksPerPage}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`/api/flashcards/study-queue`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);
      // --- Use new type ---
      const decksData: ApiResponse<PaginatedDecksData> = await decksResponse.json();
      if (!decksData.success || !decksData.data)
        throw new Error(decksData.error || 'Failed refresh.');
      setDecks(decksData.data.decks);
      setCurrentPage(decksData.data.currentPage);
      setTotalPages(decksData.data.totalPages);
      setUsage({ count: decksData.data.count, limit: decksData.data.limit });
      
      const queueData: ApiResponse<{ dueCount: number; firstDueDeckId: string | null }> =
        await queueResponse.json();
      if (queueData.success && queueData.data) {
        setDueCount(queueData.data.dueCount);
        setFirstDueDeckId(queueData.data.firstDueDeckId);
      }
    } catch (error: any) {
      toast({ title: 'Error Refreshing Decks', description: error.message, variant: 'destructive' });
    }
  }, [session, toast, decksPerPage]);

  const handleCreateDeck = async (e: React.FormEvent) => {
    // ... (function remains same, but refreshFirstPage will pull new stats)
    e.preventDefault();
    if (!newDeckTitle.trim() || !session) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ title: newDeckTitle }),
      });
      const result: ApiResponse<FlashcardDeck> = await response.json();
      
      if (!response.ok || !result.success || !result.data) {
        // --- 3. CATCH LIMIT ERROR ---
        if (result.error === 'limit_exceeded') {
          openModal();
          throw new Error(result.message || 'Deck limit reached.');
        }
        // ---
        throw new Error(result.error || 'Failed create.');
      }

      toast({ title: 'Deck Created!', description: `"${result.data.title}" added.` });
      setNewDeckTitle('');
      setIsCreateDialogOpen(false);
      refreshFirstPage(); // This will now pull the deck with stats
    } catch (error: any) {
      // --- 4. AVOID DOUBLE-TOASTING ---
      if (!error.message.includes('limit reached')) {
        toast({ title: 'Creation Failed', description: error.message, variant: 'destructive' });
      }
      // ---
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEditDialog = (deck: DeckWithStats) => { // Use new type
    setEditingDeck(deck);
    setEditDeckTitle(deck.title);
    setIsEditDialogOpen(true);
  };

  const handleEditDeck = async (e: React.FormEvent) => {
    // ... (function remains same, but refreshFirstPage will pull new stats)
    e.preventDefault();
    if (!editDeckTitle.trim() || !session || !editingDeck) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/decks/${editingDeck.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ title: editDeckTitle.trim() }),
      });
      const result: ApiResponse<FlashcardDeck> = await response.json();
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to update deck.');
      toast({ title: 'Deck Updated!', description: `Renamed to "${result.data.title}".` });
      setIsEditDialogOpen(false);
      setEditingDeck(null);
      refreshFirstPage(); // This will now pull the deck with new stats
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDeck = async (deckId: string, deckTitle: string) => {
    // ... (function remains the same)
    if (!session || !confirm(`Delete "${deckTitle}"? All cards within will be deleted.`)) return;
    const originalDecks = [...decks];
    setDecks((prevDecks) => prevDecks.filter((d) => d.id !== deckId));
    setUsage(prev => ({ ...prev, count: prev.count - 1 }));
    try {
      const response = await fetch(`/api/decks/${deckId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result: ApiResponse = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed delete.');
      }
      toast({ title: 'Deck Deleted', description: `"${deckTitle}" removed.` });
    } catch (error: any) {
      toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' });
      setDecks(originalDecks); 
      setUsage(prev => ({ ...prev, count: prev.count + 1 }));
    }
  };

  return (
    <>
      <StudyQueueCard dueCount={dueCount} firstDueDeckId={firstDueDeckId} />
      
      {/* (Header and Create Dialog Trigger remain the same) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Flashcard Decks</h1>
          {usage.limit !== Infinity && (
            <p className="text-sm text-muted-foreground mt-1">
              Total Decks: {usage.count} / {usage.limit}.
            </p>
          )}
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Deck
            </Button>
          </DialogTrigger>
          {/* ... (Create Dialog Content) ... */}
           <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Deck</DialogTitle>
              <DialogDesc>Enter a title.</DialogDesc>
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
                <DialogClose asChild>
                  <Button type="button" variant="ghost" disabled={isSaving}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSaving || !newDeckTitle.trim()}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* (Empty state remains the same) */}
      {decks.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <Layers className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Decks Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first flashcard deck.</p>
          <Button className="mt-6" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create a Deck
          </Button>
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* --- MODIFIED: Deck Card Rendering --- */}
          {decks.map((deck) => (
            <motion.div key={deck.id} variants={itemVariants}>
              <Card className="flex flex-col h-full">
                <CardHeader>
                  <Link href={`/flashcards/${deck.id}`} className="hover:underline">
                    <CardTitle className="text-lg truncate">{deck.title}</CardTitle>
                  </Link>
                  {/* --- NEW: Display Stats --- */}
                  <CardDescription className="text-xs pt-1">
                    {deck.cardCount} Card{deck.cardCount !== 1 ? 's' : ''}
                    {deck.cardCount > 0 && (
                      <span className="text-muted-foreground/80">
                        {' '}&bull; {deck.dueCount} Due &bull; {deck.newCount} New
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  {/* --- NEW: Progress Bar --- */}
                  {deck.cardCount > 0 && (
                    <div>
                      <Progress 
                        value={(deck.dueCount / deck.cardCount) * 100} 
                        className="h-2" 
                        title={`${deck.dueCount} cards due`}
                      />
                    </div>
                  )}
                  {deck.cardCount === 0 && (
                     <p className="text-sm text-muted-foreground italic">Deck is empty.</p>
                  )}
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/flashcards/${deck.id}`)}>
                    <BookCopy className="w-4 h-4 mr-2" /> Study
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleOpenEditDialog(deck)}
                  >
                    <Edit className="w-4 h-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDeleteDeck(deck.id, deck.title)}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
          {/* --- END MODIFICATION --- */}
        </motion.div>
      )}

      {/* (Load More Button and Edit Dialog remain the same) */}
      {totalPages > currentPage && (
        <div className="mt-8 text-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
            {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More Decks
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Showing {decks.length} of {usage.count} decks
          </p>
        </div>
      )}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        {/* ... (Edit Dialog Content) ... */}
         <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Deck Title</DialogTitle>
            <DialogDesc>Rename your flashcard deck.</DialogDesc>
          </DialogHeader>
          <form onSubmit={handleEditDeck} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-deck-title" className="text-right">
                Title
              </Label>
              <Input
                id="edit-deck-title"
                value={editDeckTitle}
                onChange={(e) => setEditDeckTitle(e.target.value)}
                className="col-span-3"
                disabled={isSaving}
                required
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={isSaving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={
                  isSaving || !editDeckTitle.trim() || editDeckTitle.trim() === editingDeck?.title
                }
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}