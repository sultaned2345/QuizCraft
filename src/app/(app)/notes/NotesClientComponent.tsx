// src/app/(app)/notes/NotesClientComponent.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Note, ApiResponse } from '@/types/database'; // Import FULL Note type
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Sparkles, Edit, Trash2, BookCopy, Search } from 'lucide-react';
import { NoteEditor } from '@/components/NoteEditor';
import { GenerateNotesDialog } from '@/components/GenerateNotesDialog';

// Type for the simplified Note structure from the API
interface NoteListItem {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  // content is excluded
}

// Define expected response structure for pagination API calls
interface PaginatedNotesData {
  notes: NoteListItem[]; // Use the leaner type
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}

// Define props for the client component, including initial data
interface NotesClientComponentProps {
  initialData: PaginatedNotesData;
}


export function NotesClientComponent({ initialData }: NotesClientComponentProps) {
  const [notes, setNotes] = useState<NoteListItem[]>(initialData.notes);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  
  // *** CHANGED: State now holds the full Note object for the editor ***
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isFetchingNote, setIsFetchingNote] = useState(false); // Loading state for single note
  
  const [usage, setUsage] = useState({ count: initialData.count, limit: initialData.limit });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(initialData.currentPage);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const notesPerPage = 9;

  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // --- Fetch More Notes (Client-Side) ---
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

  // --- Refresh Function (Refetch Page 1 Client-Side) ---
   const refreshFirstPage = useCallback(async () => {
        if (!session) return;
        try {
            const response = await fetch(`/api/notes?page=1&limit=${notesPerPage}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
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

  // --- *** NEW: Handler for clicking Edit button *** ---
  const handleEditClick = async (noteItem: NoteListItem) => {
    if (!session) return;
    setIsFetchingNote(true);
    setSelectedNote(null); // Clear previous
    setIsEditorOpen(true); // Open dialog to show loader

    try {
        // Fetch the full note content from the new endpoint
        const response = await fetch(`/api/notes/${noteItem.id}`, {
             headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const result: ApiResponse<Note> = await response.json();

        if (!result.success || !result.data) {
             throw new Error(result.error || 'Failed to fetch note content.');
        }
        
        setSelectedNote(result.data); // Set the full note object

    } catch (error: any) {
        toast({ title: "Error", description: `Could not load note content: ${error.message}`, variant: "destructive" });
        setIsEditorOpen(false); // Close dialog on error
    } finally {
        setIsFetchingNote(false);
    }
  };


  // --- Save/Delete Handlers (Remain the same) ---
  const handleSaveNote = async (noteData: { id?: string; title: string; content: string }) => {
     try {
       const isUpdating = !!noteData.id;
       const url = isUpdating ? `/api/notes?id=${noteData.id}` : '/api/notes';
       const method = isUpdating ? 'PUT' : 'POST';
       const response = await fetch(url, { method, headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: noteData.title, content: noteData.content }) });
       const result = await response.json();
       if (!result.success) throw new Error(result.error);
       toast({ title: `Note ${isUpdating ? 'Updated' : 'Created'}` });
       setIsEditorOpen(false);
       setSelectedNote(null);
       refreshFirstPage();
     } catch (error: any) {
       toast({ title: "Save Failed", description: error.message, variant: "destructive" });
     }
  };

  const handleDeleteNote = async (noteId: string) => {
     if (!confirm("Delete note?")) return;
     try {
       const response = await fetch(`/api/notes?id=${noteId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token}` } });
       const result = await response.json();
       if (!result.success) throw new Error(result.error);
       toast({ title: "Note Deleted" });
       refreshFirstPage();
     } catch (error: any) {
       toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
     }
  };

  // Memoized filtering (remains the same)
  const filteredNotes = useMemo(() => {
    if (!searchTerm) return notes;
    return notes.filter(note =>
      note.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [notes, searchTerm]);


  return (
    <>
      {/* Header Section (remains the same) */}
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
          <Button onClick={() => { setSelectedNote(null); setIsEditorOpen(true); setIsFetchingNote(false); /* Set fetching false for new notes */ }}>
            <Plus className="w-4 h-4 mr-2" /> New Note
          </Button>
        </div>
      </div>

      {/* Search Bar (remains the same) */}
      <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search loaded notes by title..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {/* Grid or Empty State (remains the same) */}
       {(notes.length === 0) ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <BookCopy className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Notes Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first note or use AI.</p>
        </div>
      ) : filteredNotes.length === 0 && searchTerm ? (
         <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <BookCopy className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Matching Notes Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">No loaded notes match "{searchTerm}".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg truncate">{note.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground italic">Content omitted for performance.</p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                  {/* *** CHANGED: Use new handleEditClick function *** */}
                  <Button variant="outline" size="sm" onClick={() => handleEditClick(note)} disabled={isFetchingNote}>
                      {isFetchingNote && selectedNote?.id === note.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Edit className="w-4 h-4 mr-2" />}
                      {isFetchingNote && selectedNote?.id === note.id ? '' : 'Edit'}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteNote(note.id)} disabled={isFetchingNote}>
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Load More Button (remains the same) */}
      {totalPages > currentPage && !searchTerm && (
          <div className="mt-8 text-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                  {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More Notes
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Showing {notes.length} of {usage.count} notes</p>
          </div>
      )}

      {/* Modals */}
      <NoteEditor
        // *** CHANGED: Pass the full 'selectedNote' and loading state ***
        note={selectedNote}
        isFetching={isFetchingNote}
        isOpen={isEditorOpen}
        onClose={() => { setIsEditorOpen(false); setSelectedNote(null); }}
        onSave={handleSaveNote}
      />
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