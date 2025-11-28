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
import { 
  Loader2, Plus, Sparkles, Edit, Trash2, BookCopy, Search, X, 
  StickyNote, Calendar, MoreVertical, ArrowUpRight, Book 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
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

  // Helper for generating consistent colors based on tags
  const getTagColor = (tag: string) => {
    const colors = [
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
      "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
      "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    ];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

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

      {/* (Search Bar & Filters) */}
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
              className="rounded-full transition-all"
            >
              All
            </Button>
            {Array.from(allTags).map(tag => (
              <Button
                key={tag}
                variant={selectedTag === tag ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setSelectedTag(tag)}
                className={cn(
                    "rounded-full transition-all border border-transparent",
                    selectedTag === tag ? "shadow-md" : "hover:border-primary/20"
                )}
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
              <Card 
                className={cn(
                    "flex flex-col h-full relative group transition-all duration-300",
                    "hover:-translate-y-1 hover:shadow-lg",
                    "border-l-4 border-l-amber-400 dark:border-l-amber-600" // Notebook accent
                )}
                // Clicking the card body navigates (improves UX)
                onClick={() => router.push(`/notes/${note.id}`)}
              >
                {/* Background Decoration (Binder Holes or Watermark) */}
                <div className="absolute top-4 left-0 w-4 flex flex-col gap-2 items-center opacity-20 pointer-events-none">
                     <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
                     <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
                     <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
                </div>
                
                <div className="absolute -right-8 -bottom-8 opacity-[0.03] pointer-events-none transition-transform group-hover:scale-110">
                   <StickyNote className="w-40 h-40" />
                </div>

                <CardHeader className="pl-6 pb-2">
                   <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(note.updated_at).toLocaleDateString()}
                            </span>
                            <CardTitle className="text-xl font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2 cursor-pointer">
                                {note.title}
                            </CardTitle>
                        </div>

                        {/* Actions Dropdown (Stop propagation to prevent navigating when clicking menu) */}
                        <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-background/80">
                                        <MoreVertical className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => router.push(`/notes/${note.id}`)}>
                                        <Edit className="w-4 h-4 mr-2" /> Edit Note
                                    </DropdownMenuItem>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem 
                                            className="text-destructive focus:text-destructive" 
                                            onSelect={(e) => e.preventDefault()} // Prevent closing for alert dialog
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                </DropdownMenuContent>
                                {/* Nested Alert Dialog for Delete */}
                                <AlertDialog>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete the note <strong>"{note.title}"</strong>.
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
                            </DropdownMenu>
                        </div>
                   </div>
                </CardHeader>

                <CardContent className="flex-grow pl-6 pt-2">
                   {note.tags && note.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      {note.tags.slice(0, 4).map(tag => (
                        <Badge 
                            key={tag} 
                            variant="secondary" 
                            className={cn("font-normal text-[10px] px-2 py-0.5 border-0", getTagColor(tag))}
                        >
                            #{tag}
                        </Badge>
                      ))}
                      {note.tags.length > 4 && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
                            +{note.tags.length - 4}
                        </Badge>
                      )}
                    </div>
                  ) : (
                      <p className="text-xs text-muted-foreground italic mt-2">No tags</p>
                  )}
                </CardContent>

                <CardFooter className="pl-6 pt-0 pb-4">
                     <div className="w-full flex items-center justify-between">
                         <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-muted-foreground hover:text-primary p-0 h-auto font-normal text-xs group/btn"
                         >
                             Open Note <ArrowUpRight className="w-3 h-3 ml-1 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                         </Button>
                     </div>
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