// src/app/(app)/flashcards/FlashcardsClientComponent.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { FlashcardDeck, ApiResponse } from '@/types/database';
import { Button, buttonVariants } from '@/components/ui/button'; 
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Plus, Layers, Edit, Trash2, BookCopy, Play, 
  ChevronDown, CheckCircle, Clock, MoreVertical, GraduationCap 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { useUpgradeModal } from '@/components/UpgradeModalContext';
import { cn } from '@/lib/utils';

// (Interfaces and StudyQueueCard remain the same)
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

function StudyQueueCard({
  dueCount,
  firstDueDeckId,
}: {
  dueCount: number;
  firstDueDeckId: string | null;
}) {
  const router = useRouter();
  if (dueCount === 0) {
    return null;
  }
  const handleStudyClick = () => {
    if (firstDueDeckId) {
      router.push(`/flashcards/${firstDueDeckId}?mode=due`);
    } else {
      router.push('/flashcards');
    }
  };
  return (
    <div className="mb-8 relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl blur-xl transition-all group-hover:blur-2xl" />
        <Card className="relative border-blue-200 dark:border-blue-800 bg-card/60 backdrop-blur-sm overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <div className="flex flex-col md:flex-row items-center justify-between p-6 gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        <Layers className="w-6 h-6" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">Study Queue</CardTitle>
                        <CardDescription className="mt-1">
                            You have <strong className="text-foreground">{dueCount} flashcard{dueCount > 1 ? 's' : ''}</strong> waiting for review.
                        </CardDescription>
                    </div>
                </div>
                <Button onClick={handleStudyClick} size="lg" className="w-full md:w-auto shadow-md">
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    Start Session
                </Button>
            </div>
        </Card>
    </div>
  );
}

export function FlashcardsClientComponent({ initialData }: FlashcardsClientComponentProps) {
  const [decks, setDecks] = useState<DeckWithStats[]>(initialData.decks);
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
  const [editingDeck, setEditingDeck] = useState<DeckWithStats | null>(null);
  const [editDeckTitle, setEditDeckTitle] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { openModal } = useUpgradeModal();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
  };

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
        if (result.error === 'limit_exceeded') {
          openModal();
          throw new Error(result.message || 'Deck limit reached.');
        }
        throw new Error(result.error || 'Failed create.');
      }

      toast({ title: 'Deck Created!', description: `"${result.data.title}" added.` });
      setNewDeckTitle('');
      setIsCreateDialogOpen(false);
      refreshFirstPage();
    } catch (error: any) {
      if (!error.message.includes('limit reached')) {
        toast({ title: 'Creation Failed', description: error.message, variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEditDialog = (deck: DeckWithStats) => {
    setEditingDeck(deck);
    setEditDeckTitle(deck.title);
    setIsEditDialogOpen(true);
  };

  const handleEditDeck = async (e: React.FormEvent) => {
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
      refreshFirstPage();
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDeck = async (deckId: string, deckTitle: string) => {
    if (!session) return;
    
    const originalDecks = [...decks];
    setDecks((prevDecks) => prevDecks.filter((d) => d.id !== deckId));
    setUsage(prev => ({ ...prev, count: prev.count - 1 }));
    setIsDeleting(true);

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
      setDecks(originalDecks); // Rollback
      setUsage(prev => ({ ...prev, count: prev.count + 1 })); // Rollback
    } finally {
      setIsDeleting(false); 
    }
  };

  return (
    <>
      <StudyQueueCard dueCount={dueCount} firstDueDeckId={firstDueDeckId} />
      
      {/* (Header) */}
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
           <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Deck</DialogTitle>
              <DialogDesc>Enter a title for your new flashcard set.</DialogDesc>
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

      {/* (Empty State) */}
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
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" // Increased gap for stack effect
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {decks.map((deck) => {
             const progress = deck.cardCount > 0 ? ((deck.cardCount - deck.dueCount) / deck.cardCount) * 100 : 0;
             const isComplete = deck.cardCount > 0 && deck.dueCount === 0;

             return (
            <motion.div key={deck.id} variants={itemVariants} className="group relative">
              
              {/* --- STACK EFFECT BACKGROUND --- */}
              <div className="absolute top-2 left-2 w-full h-full bg-slate-200 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 -z-10 transition-transform duration-300 group-hover:rotate-3 group-hover:translate-x-1 group-hover:translate-y-1" />
              
              <Card className="flex flex-col h-full overflow-visible transition-all duration-300 hover:-translate-y-1 bg-card border-blue-100 dark:border-blue-900 shadow-sm hover:shadow-md">
                
                {/* --- NOTIFICATION BADGE --- */}
                {deck.dueCount > 0 && (
                  <div className="absolute -top-2 -right-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-background animate-pulse">
                    {deck.dueCount}
                  </div>
                )}

                <CardHeader className="pb-2 relative">
                   {/* Watermark Icon */}
                   <div className="absolute right-4 top-4 opacity-[0.05] pointer-events-none">
                     <GraduationCap className="w-24 h-24" />
                   </div>

                   <Link href={`/flashcards/${deck.id}?mode=due`} className="hover:underline z-10">
                    <CardTitle className="text-xl font-bold tracking-tight text-blue-950 dark:text-blue-50 truncate pr-6">
                      {deck.title}
                    </CardTitle>
                  </Link>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <span className="flex items-center text-xs font-medium bg-secondary px-2 py-0.5 rounded-full">
                        {deck.cardCount} Cards
                    </span>
                    {isComplete && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" /> All Caught Up
                        </span>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-grow pt-4">
                  <div className="space-y-3">
                     {/* Progress Stat */}
                     <div className="flex justify-between items-end text-sm">
                         <span className="text-muted-foreground text-xs">Mastery</span>
                         <span className="font-bold text-blue-600 dark:text-blue-400">{Math.round(progress)}%</span>
                     </div>
                     <Progress 
                        value={progress} 
                        className="h-1.5 bg-blue-100 dark:bg-blue-950" 
                        indicatorClassName="bg-blue-500"
                      />
                     
                     {/* Mini Stats Grid */}
                     <div className="grid grid-cols-2 gap-2 mt-4">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg text-center">
                            <div className="text-xs text-muted-foreground">Due</div>
                            <div className="font-semibold text-red-500">{deck.dueCount}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg text-center">
                            <div className="text-xs text-muted-foreground">New</div>
                            <div className="font-semibold text-blue-500">{deck.newCount}</div>
                        </div>
                     </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 pb-4 flex justify-between items-center gap-2 border-t bg-slate-50/50 dark:bg-slate-900/20">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => handleOpenEditDialog(deck)}>
                            <Edit className="w-4 h-4 mr-2" /> Rename
                        </DropdownMenuItem>
                        <AlertDialogTrigger asChild>
                             <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                             </DropdownMenuItem>
                        </AlertDialogTrigger>
                    </DropdownMenuContent>
                    
                     {/* Nested Delete Dialog (Needs to be outside Dropdown theoretically, but works with preventDefault) */}
                    <AlertDialog>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete <strong>{deck.title}</strong> and all its cards.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className={cn(buttonVariants({ variant: 'destructive' }))}
                          disabled={isDeleting}
                          onClick={() => handleDeleteDeck(deck.id, deck.title)}
                        >
                          {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  </DropdownMenu>

                  <div className="flex gap-2">
                       {/* Quick Actions Dropdown */}
                       <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                               <Button variant="outline" size="sm" disabled={deck.cardCount === 0} className="h-8">
                                   Options <ChevronDown className="w-3 h-3 ml-1" />
                               </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <Link href={`/flashcards/${deck.id}?mode=new`}>
                                    <CheckCircle className="w-4 h-4 mr-2" /> Learn New ({deck.newCount})
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href={`/flashcards/${deck.id}?mode=cram`}>
                                    <Layers className="w-4 h-4 mr-2" /> Cram All ({deck.cardCount})
                                    </Link>
                                </DropdownMenuItem>
                           </DropdownMenuContent>
                       </DropdownMenu>

                      <Button 
                        size="sm" 
                        disabled={deck.cardCount === 0} 
                        className={cn("h-8 shadow-sm", deck.dueCount > 0 ? "bg-blue-600 hover:bg-blue-700" : "")}
                        asChild
                      >
                         <Link href={`/flashcards/${deck.id}?mode=due`}>
                            Study
                         </Link>
                      </Button>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          )})}
        </motion.div>
      )}

      {/* (Load More and Edit Dialog remain the same) */}
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