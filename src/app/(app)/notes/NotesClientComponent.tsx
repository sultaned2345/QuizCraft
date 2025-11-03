// src/app/(app)/notes/NotesClientComponent.tsx
// REFACTORED
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Keep
import { useAuth } from '@/contexts/AuthContext';
import { Note, ApiResponse } from '@/types/database'; // Keep
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Sparkles, Edit, Trash2, BookCopy, Search, X } from 'lucide-react';
// --- REMOVE NoteEditor ---
// import { NoteEditor } from '@/components/NoteEditor';
import { GenerateNotesDialog } from '@/components/GenerateNotesDialog';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// ... (PaginatedNotesData, NoteListItem, NotesClientComponentProps interfaces remain the same) ...
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
  // --- REMOVE ALL MODAL/FETCHING STATE ---
  // const [isEditorOpen, setIsEditorOpen] = useState(false);
  // const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  // const [isFetchingNote, setIsFetchingNote] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  
  const [usage, setUsage] = useState({ count: initialData.count, limit: initialData.limit });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(initialData.currentPage);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const notesPerPage = 9;

  const [allTags, setAllTags] = useState<Set<string>>(new Set());
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { session } = useAuth();
  const router = useRouter(); // Keep
  const { toast } = useToast();

  // --- REMOVE fetchCache ---
  // const fetchCache = useRef<Map<string, Promise<Note>>>(new Map());

  // --- (Animation Variants remain the same) ---
  const containerVariants = { /* ... */ };
  const itemVariants = { /* ... */ };

  useEffect(() => {
    // ... (this useEffect remains the same) ...
    const tags = new Set<string>();
    notes.forEach(note => {
      (note.tags || []).forEach(tag => tags.add(tag));
    });
    setAllTags(tags);
  }, [notes]);

  const fetchMoreNotes = useCallback(async (page: number) => {
    // ... (this function remains the same) ...
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
        // ... (this function remains the same) ...
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

  // --- REMOVE prefetchNote ---
  // --- REMOVE handleEditClick ---
  // --- REMOVE handleSaveNote ---

  const handleDeleteNote = async (noteId: string, noteTitle: string) => {
     // ... (this function remains the same) ...
     if (!session || !confirm(`Are you sure you want to delete "${noteTitle}"?`)) return;

     const originalNotes = [...notes];
     setNotes(prevNotes => prevNotes.filter(n => n.id !== noteId));
     setUsage(prev => ({ ...prev, count: prev.count - 1 }));

     try {
       const response = await fetch(`/api/notes?id=${noteId}`, { 
         method: 'DELETE', 
         headers: { 'Authorization': `Bearer ${session.access_token}` } 
       });
       const result: ApiResponse = await response.json();
       
       if (!result.success) {
         throw new Error(result.error || 'Delete failed on server.');
       }
       
       toast({ title: "Note Deleted" });
       // We might need to refresh the first page if pagination is off
       refreshFirstPage();
       
     } catch (error: any) {
       toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
       setNotes(originalNotes);
       setUsage(prev => ({ ...prev, count: prev.count + 1 }));
     }
  };

  const filteredNotes = useMemo(() => {
    // ... (this function remains the same) ...
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
          {/* --- MODIFIED: Navigate to new page --- */}
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
      {/* ... (tag filter jsx) ... */}
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
           {/* ... (no results jsx) ... */}
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
                   {/* ... (tag display jsx) ... */}
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    {/* --- MODIFIED: Navigate to edit page --- */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => router.push(`/notes/${note.id}`)} 
                    >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteNote(note.id, note.title)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* (Load More Button remains the same) */}
      {/* ... */}

      {/* --- REMOVE NoteEditor Modal --- */}
      
      {/* (GenerateNotesDialog remains the same) */}
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
    </>
  );
}