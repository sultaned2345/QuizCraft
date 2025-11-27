// src/app/(app)/notes/NotesClientComponent.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Note, ApiResponse } from '@/types/database';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Sparkles, Edit, Trash2, BookCopy, Search, X, Calendar, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
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

  const handleDeleteNote = async (noteId: string, noteTitle: string) => {
     if (!session) return;

     const originalNotes = [...notes];
     setNotes(prevNotes => prevNotes.filter(n => n.id !== noteId));
     setUsage(prev => ({ ...prev, count: prev.count - 1 }));
     setIsDeleting(true); 

     try {
       const response = await fetch(`/api/notes/${noteId}`, { 
         method: 'DELETE', 
         headers: { 'Authorization': `Bearer ${session.access_token}` } 
       });
       const result: ApiResponse = await response.json();
       
       if (!result.success) {
         throw new Error(result.error || 'Delete failed on server.');
       }
       
       toast({ title: "Note Deleted" });
       refreshFirstPage(); 
       
     } catch (error: any) {
       toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
       setNotes(originalNotes);
       setUsage(prev => ({ ...prev, count: prev.count + 1 }));
     } finally {
       setIsDeleting(false);
     }
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchesSearch = !searchTerm || note.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTag = !selectedTag || (note.tags || []).includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [notes, searchTerm, selectedTag]);

  const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };


  return (
    <>
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
              <Card className="flex flex-col h-full group hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary/60 bg-card">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                     <CardTitle className="text-lg font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {note.title}
                     </CardTitle>
                     <FileText className="w-5 h-5 text-muted-foreground opacity-20 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(note.updated_at || note.created_at)}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                   {note.tags && note.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {note.tags.slice(0, 4).map(tag => (
                        <Badge key={tag} variant="secondary" className="font-normal text-xs bg-muted/60 hover:bg-muted text-muted-foreground">
                          #{tag}
                        </Badge>
                      ))}
                      {note.tags.length > 4 && (
                        <span className="text-xs text-muted-foreground self-center pl-1">+{note.tags.length - 4}</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic mt-2 opacity-50">No tags</p>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between items-center gap-2 pt-0 pb-4">
                     <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => router.push(`/notes/${note.id}`)} 
                      disabled={isDeleting}
                      className="text-muted-foreground hover:text-primary -ml-2"
                    >
                        Read Note
                    </Button>
                    
                    <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => router.push(`/notes/${note.id}`)} 
                          disabled={isDeleting}
                        >
                            <Edit className="w-4 h-4" />
                            <span className="sr-only">Edit</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors" disabled={isDeleting}>
                              <Trash2 className="w-4 h-4" />
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
                                All associated data will also be deleted.
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
                    </div>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

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