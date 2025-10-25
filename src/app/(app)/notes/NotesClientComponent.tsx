'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext'; // Keep for actions
import { Note, ApiResponse } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Sparkles, Edit, Trash2, BookCopy, Search } from 'lucide-react';
import { NoteEditor } from '@/components/NoteEditor';
import { GenerateNotesDialog } from '@/components/GenerateNotesDialog';

// Define expected response structure for pagination API calls
interface PaginatedNotesData {
  notes: Note[];
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}

// Define props for the client component, including initial data
interface NotesClientComponentProps {
  initialData: PaginatedNotesData;
}

// --- Type for the simplified Note structure from the API ---
interface NoteListItem {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  // content is excluded
}


export function NotesClientComponent({ initialData }: NotesClientComponentProps) {
  // Initialize state with data passed from the Server Component
  const [notes, setNotes] = useState<NoteListItem[]>(initialData.notes);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteListItem | null>(null); // Use NoteListItem here
  const [usage, setUsage] = useState({ count: initialData.count, limit: initialData.limit });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(initialData.currentPage);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const notesPerPage = 9; // Should match API limit

  const { session } = useAuth(); // Keep session for actions
  const router = useRouter(); // Keep for navigation actions
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

      setNotes(prev => [...prev, ...data.data!.notes]); // Append new notes
      setCurrentPage(data.data.currentPage);
      // Update total pages/count if necessary, though usually stable during load more
      setTotalPages(data.data.totalPages);
      setUsage({ count: data.data.count, limit: data.data.limit });


    } catch (error: any) {
      toast({ title: "Error Loading More Notes", description: error.message, variant: "destructive" });
    } finally {
      setIsLoadingMore(false);
    }
  }, [session, toast, notesPerPage, isLoadingMore, totalPages]); // Added dependencies

  const handleLoadMore = () => {
    fetchMoreNotes(currentPage + 1);
  }

  // --- Refresh Function (Refetch Page 1 Client-Side) ---
   const refreshFirstPage = useCallback(async () => {
        if (!session) return;
        // Indicate loading might be good here if needed
        try {
            const response = await fetch(`/api/notes?page=1&limit=${notesPerPage}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            const data: ApiResponse<PaginatedNotesData> = await response.json();
            if (!data.success || !data.data) throw new Error(data.error || 'Failed refresh.');

            setNotes(data.data.notes); // Replace notes with first page
            setCurrentPage(data.data.currentPage);
            setTotalPages(data.data.totalPages);
            setUsage({ count: data.data.count, limit: data.data.limit });
        } catch (error: any) {
            toast({ title: "Error Refreshing Notes", description: error.message, variant: "destructive" });
        } finally {
            // Stop loading indicator if you added one
        }
    }, [session, toast, notesPerPage]);


  // --- Save/Delete Handlers (Now call refreshFirstPage) ---
  const handleSaveNote = async (noteData: { id?: string; title: string; content: string }) => {
     // ... (API call logic remains the same) ...
     try {
       const isUpdating = !!noteData.id;
       const url = isUpdating ? `/api/notes?id=${noteData.id}` : '/api/notes';
       const method = isUpdating ? 'PUT' : 'POST';
       const response = await fetch(url, { method, headers: { /*...*/ 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: noteData.title, content: noteData.content }) });
       const result = await response.json();
       if (!result.success) throw new Error(result.error);
       toast({ title: `Note ${isUpdating ? 'Updated' : 'Created'}` });
       setIsEditorOpen(false);
       setSelectedNote(null);
       refreshFirstPage(); // Use the client-side refresh function
     } catch (error: any) {
       toast({ title: "Save Failed", description: error.message, variant: "destructive" });
     }
  };

  const handleDeleteNote = async (noteId: string) => {
    // ... (API call logic remains the same) ...
     if (!confirm("Delete note?")) return;
     try {
       const response = await fetch(`/api/notes?id=${noteId}`, { method: 'DELETE', headers: { /*...*/ 'Authorization': `Bearer ${session?.access_token}` } });
       const result = await response.json();
       if (!result.success) throw new Error(result.error);
       toast({ title: "Note Deleted" });
       refreshFirstPage(); // Use the client-side refresh function
     } catch (error: any) {
       toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
     }
  };

  // Memoized filtering (applied only to currently loaded notes)
  const filteredNotes = useMemo(() => {
    if (!searchTerm) return notes;
    return notes.filter(note =>
      note.title.toLowerCase().includes(searchTerm.toLowerCase())
      // Cannot filter by content here as it's not fetched
    );
  }, [notes, searchTerm]);

  // --- Render Logic ---
  // (No top-level loading state needed here as initial data is provided)

  return (
    <>
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
         <div>
          <h1 className="text-3xl font-bold">My Notes</h1>
          {usage.limit !== Infinity && (
              <p className="text-sm text-muted-foreground mt-1">
                  Total Notes: {usage.count} / {usage.limit}.
                  {/* <Link href="/pricing" className="ml-2 text-primary font-medium hover:underline">Upgrade</Link> */}
              </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsGeneratorOpen(true)}>
              <Sparkles className="w-4 h-4 mr-2" /> Generate with AI
          </Button>
          <Button onClick={() => { setSelectedNote(null); setIsEditorOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Note
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search loaded notes by title..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {/* Grid or Empty State */}
       {(notes.length === 0) ? ( // Check initialData.notes if using SSR/RSC more directly
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
                 {/* Display placeholder or fetch content on demand if needed */}
                <p className="text-sm text-muted-foreground italic">Content omitted for performance.</p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                  {/* Pass the leaner NoteListItem to the editor */}
                  <Button variant="outline" size="sm" onClick={() => { setSelectedNote(note); setIsEditorOpen(true); }}>
                      <Edit className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteNote(note.id)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {totalPages > currentPage && !searchTerm && ( // Hide Load More when searching
          <div className="mt-8 text-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                  {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More Notes
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Showing {notes.length} of {usage.count} notes</p>
          </div>
      )}

      {/* Modals */}
      {/* NoteEditor needs adjustment if it expects full 'content' */}
      <NoteEditor
        // If NoteEditor needs full note, fetch it when opening edit, otherwise pass subset
        note={selectedNote ? { ...selectedNote, content: '' } : null} // Pass partial note or null
        isOpen={isEditorOpen}
        onClose={() => { setIsEditorOpen(false); setSelectedNote(null); }}
        onSave={handleSaveNote} // Save handler now refreshes page 1
      />
      <GenerateNotesDialog
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onSuccess={(newNotes) => {
            toast({ title: "AI Notes Generated!"});
            refreshFirstPage(); // Use client-side refresh
            setIsGeneratorOpen(false);
        }}
        onError={(errorMessage) => {
            toast({ title: "Generation Failed", description: errorMessage, variant: "destructive" });
        }}
      />
    </>
  );
}