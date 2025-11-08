// src/app/(app)/notes/NotesClientComponent.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Note, ApiResponse } from '@/types/database';
import { Button, buttonVariants } from '@/components/ui/button'; // <-- Import buttonVariants
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Sparkles, Edit, Trash2, BookCopy, Search, X } from 'lucide-react';
// import { GenerateNotesDialog } from '@/components/GenerateNotesDialog'; // <-- REMOVED
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
// --- 1. IMPORT ALERT DIALOG ---
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
// ---

const GenerateNotesDialog = dynamic(
  () => import('@/components/GenerateNotesDialog').then((mod) => mod.GenerateNotesDialog),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    ),
  }
);

interface NoteListItem {
  id: string;
  user_id: string;
  title: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}
interface PaginatedNotesData {
  notes: NoteListItem[];
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}
interface NotesClientComponentProps {
  initialData: PaginatedNotesData;
}


export function NotesClientComponent({ initialData }: NotesClientComponentProps) {
  const [notes, setNotes] = useState<NoteListItem[]>(initialData.notes);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [usage, setUsage] = useState({ count: initialData.count, limit: initialData.limit });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(initialData.currentPage);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const notesPerPage = 9;
  const [allTags, setAllTags] = useState<Set<string>>(new Set());
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  // --- 2. ADD IS_DELETING STATE ---
  const [isDeleting, setIsDeleting] = useState(false);

  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: 'spring', stiffness: 100 }
    },
  };

  useEffect(() => {
    const tags = new Set<string>();
    notes.forEach(note => {
      (note.tags || []).forEach(tag => tags.add(tag));
    });
    setAllTags(tags);
  }, [notes]);

  const fetchMoreNotes = useCallback(async (page: number) => {
    if (!session || isLoadingMore || page > totalPages) return;
    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/notes?page=${page}&limit=${notesPerPage}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data: ApiResponse<PaginatedNotesData> = await response.json();
      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to load more notes.');
      }
      setNotes(prev => [...prev, ...data.data!.notes]);
      setCurrentPage(data.data.currentPage);
      setTotalPages(data.data.totalPages);
      setUsage({ count: data.data.count, limit: data.data.limit });
    } catch (error: any) {
      toast({ title: "Error Loading More Notes", description: error.message, variant: "destructive" });
    } finally {
      setIsLoadingMore(false);
    }
  }, [session, toast, notesPerPage, isLoadingMore, totalPages]);

  const handleLoadMore = () => {
    fetchMoreNotes(currentPage + 1);
  }

   const refreshFirstPage = useCallback(async () => {
        if (!session) return;
        try {
            const response = await fetch(`/api/notes?page=1&limit=${notesPerPage}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            const data: ApiResponse<PaginatedNotesData> = await response.json();
            if (!data.success || !data.data) throw new Error(data.error || 'Failed refresh.');
            setNotes(data.data.notes);
            setCurrentPage(data.data.currentPage);
            setTotalPages(data.data.totalPages);
            setUsage({ count: data.data.count, limit: data.data.limit });
        } catch (error: any) {
            toast({ title: "Error Refreshing Notes", description: error.message, variant: "destructive" });
        }
    }, [session, toast, notesPerPage]);

  // --- 3. MODIFY handleDeleteNote ---
  const handleDeleteNote = async (noteId: string, noteTitle: string) => {
     if (!session) return; // Removed confirm()

     const originalNotes = [...notes];
     setNotes(prevNotes => prevNotes.filter(n => n.id !== noteId));
     setUsage(prev => ({ ...prev, count: prev.count - 1 }));
     setIsDeleting(true); // <-- Set loading state

     try {
       // Use new noteId route
       const response = await fetch(`/api/notes/${noteId}`, { 
         method: 'DELETE', 
         headers: { 'Authorization': `Bearer ${session.access_token}` } 
       });
       const result: ApiResponse = await response.json();
       
       if (!result.success) {
         throw new Error(result.error || 'Delete failed on server.');
       }
       
       toast({ title: "Note Deleted" });
       // No need to refresh full page on success, optimistic update is fine
       // But we'll refresh to ensure pagination and tags are correct
       refreshFirstPage(); 
       
     } catch (error: any) {
       toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
       setNotes(originalNotes); // Rollback
       setUsage(prev => ({ ...prev, count: prev.count + 1 })); // Rollback
     } finally {
       setIsDeleting(false); // <-- Unset loading state
     }
  };
  // ---

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchesSearch = !searchTerm || note.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTag = !selectedTag || (note.tags || []).includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [notes, searchTerm, selectedTag]);


  return (
    <>
      {/* (Header Section) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
         <div>
          <h1 className="text-3xl font-bold">My Notes</h1>
          {usage.limit !== Infinity && (
              <p className="text-sm text-muted-foreground mt-1">
                  Total Notes: {usage.count} / {usage.limit}.
              </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsGeneratorOpen(true)}>
              <Sparkles className="w-4 h-4 mr-2" /> Generate with AI
          </Button>
          <Button onClick={() => router.push('/notes/new')}>
            <Plus className="w-4 h-4 mr-2" /> New Note
          </Button>
        </div>
      </div>

      {/* (Search Bar, Tag Filter, Empty State all remain the same) */}
      <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search loaded notes by title..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>
      
      {allTags.size > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              variant={!selectedTag ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setSelectedTag(null)}
              className="rounded-full"
            >
              All
            </Button>
            {Array.from(allTags).map(tag => (
              <Button
                key={tag}
                variant={selectedTag === tag ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setSelectedTag(tag)}
                className="rounded-full"
              >
                {tag}
              </Button>
            ))}
          </div>
        )}
      
       {(notes.length === 0) ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <BookCopy className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Notes Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first note or use AI.</p>
          <Button className="mt-6" onClick={() => router.push('/notes/new')}>
            <Plus className="w-4 h-4 mr-2" /> New Note
          </Button>
        </div>
      ) : filteredNotes.length === 0 ? (
         <div className="text-center py-16 border-2 border-dashed rounded-lg">
           <Search className="mx-auto h-12 w-12 text-muted-foreground" />
           <h3 className="mt-4 text-lg font-semibold">No Results Found</h3>
           <p className="mt-1 text-sm text-muted-foreground">Try clearing your search or tag filters.</p>
           <Button className="mt-6" variant="outline" onClick={() => { setSearchTerm(''); setSelectedTag(null); }}>
            <X className="w-4 h-4 mr-2" /> Clear Filters
          </Button>
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredNotes.map((note) => (
            <motion.div key={note.id} variants={itemVariants}>
              <Card className="flex flex-col h-full">
                <CardHeader>
                  <CardTitle className="text-lg truncate">{note.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                   {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {note.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>
                      ))}
                      {note.tags.length > 3 && (
                        <Badge variant="secondary" className="font-normal">+{note.tags.length - 3}</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => router.push(`/notes/${note.id}`)} 
                      disabled={isDeleting} // <-- Disable on delete
                    >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                    </Button>
                    {/* --- 4. REPLACE DELETE BUTTON --- */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isDeleting}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the note:
                            <br />
                            <strong className="py-2 inline-block">{note.title}</strong>
                            <br />
                            All associated data (like embeddings) will also be deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className={cn(buttonVariants({ variant: 'destructive' }))}
                            disabled={isDeleting}
                            onClick={() => handleDeleteNote(note.id, note.title)}
                          >
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete Note
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    {/* --- END REPLACEMENT --- */}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* (Load More Button) */}
      {totalPages > currentPage && (
        <div className="mt-8 text-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
            {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More Notes
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Showing {notes.length} of {usage.count} notes
          </p>
        </div>
      )}

      {/* (Generate Dialog) */}
      {isGeneratorOpen && (
        <GenerateNotesDialog
          isOpen={isGeneratorOpen}
          onClose={() => setIsGeneratorOpen(false)}
          onSuccess={(newNotes) => {
              toast({ title: "AI Notes Generated!"});
              refreshFirstPage();
              setIsGeneratorOpen(false);
          }}
          onError={(errorMessage) => {
              toast({ title: "Generation Failed", description: errorMessage, variant: "destructive" });
          }}
        />
      )}
    </>
  );
}