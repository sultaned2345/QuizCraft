'use client';

import { useState, useEffect, useMemo, useCallback } from 'react'; // Added useCallback
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Note, ApiResponse } from '@/types/database'; // Import ApiResponse
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Sparkles, Edit, Trash2, BookCopy, Search } from 'lucide-react';
import { NoteEditor } from '@/components/NoteEditor';
import { GenerateNotesDialog } from '@/components/GenerateNotesDialog';
import { USAGE_LIMITS } from '@/lib/usage-limits';

// Define expected response structure for pagination
interface PaginatedNotesData {
  notes: Note[];
  count: number; // Total count of notes for the user
  limit: number | typeof Infinity; // Usage limit for the plan
  totalPages: number;
  currentPage: number;
}


export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false); // For loading more button
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [usage, setUsage] = useState({ count: 0, limit: USAGE_LIMITS.FREE_NOTES });
  const [searchTerm, setSearchTerm] = useState('');

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const notesPerPage = 9; // Match API default or set desired limit

  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // --- Updated fetchNotes with Pagination ---
  const fetchNotes = useCallback(async (page = 1, append = false) => {
    if (!session) return;
    if (append) setIsLoadingMore(true); else setIsLoading(true);

    try {
      const response = await fetch(`/api/notes?page=${page}&limit=${notesPerPage}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data: ApiResponse<PaginatedNotesData> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to load notes.');
      }

      setNotes(prev => append ? [...prev, ...data.data!.notes] : data.data!.notes);
      setUsage({ count: data.data.count, limit: data.data.limit });
      setCurrentPage(data.data.currentPage);
      setTotalPages(data.data.totalPages);

    } catch (error: any) {
      toast({ title: "Error Loading Notes", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [session, toast, notesPerPage]); // Added dependencies

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchNotes(1, false); // Fetch initial page on load
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router]); // Keep fetchNotes out of dependency array here


  const handleLoadMore = () => {
    if (currentPage < totalPages && !isLoadingMore) {
        fetchNotes(currentPage + 1, true); // Fetch next page and append
    }
  }

  // --- Save/Delete Handlers (Need to refetch *first page* after action) ---
  const handleSaveNote = async (noteData: { id?: string; title: string; content: string }) => {
    try {
      const isUpdating = !!noteData.id;
      const url = isUpdating ? `/api/notes?id=${noteData.id}` : '/api/notes';
      const method = isUpdating ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ title: noteData.title, content: noteData.content }),
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      toast({ title: `Note ${isUpdating ? 'Updated' : 'Created'}`, description: "Your note has been saved." });
      setIsEditorOpen(false);
      setSelectedNote(null);
      fetchNotes(1, false); // Refetch first page to show the latest changes at the top

    } catch (error: any) {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    try {
        const response = await fetch(`/api/notes?id=${noteId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session?.access_token}` },
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        toast({ title: "Note Deleted", description: "The note has been removed." });
        // Instead of filtering locally, refetch to maintain pagination integrity
        fetchNotes(1, false);

    } catch (error: any) {
        toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
  };

  // Memoized filtering (applied only to currently loaded notes)
  const filteredNotes = useMemo(() => {
    if (!searchTerm) return notes;
    return notes.filter(note =>
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [notes, searchTerm]);

  // --- Render Logic ---

  if (authLoading || (isLoading && currentPage === 1)) { // Only show full-page loader on initial load
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Header and Search remain the same */}
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Notes</h1>
          {usage.limit !== Infinity && (
              <p className="text-sm text-muted-foreground mt-1">
                  You've used {usage.count}/{usage.limit} notes.
                  {/* <Link href="/pricing" className="ml-2 text-primary font-medium hover:underline">Upgrade to Pro</Link> */}
              </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsGeneratorOpen(true)}>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate with AI
          </Button>
          <Button onClick={() => { setSelectedNote(null); setIsEditorOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Note
          </Button>
        </div>
      </div>

      <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
              placeholder="Search loaded notes..." // Updated placeholder
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
          />
      </div>

      {/* Grid or Empty State */}
      {notes.length === 0 && !isLoading ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <BookCopy className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Notes Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first note or use AI to generate one.
          </p>
        </div>
      ) : filteredNotes.length === 0 && searchTerm ? (
         <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <BookCopy className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Matching Notes Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
              No notes currently loaded match your search term "{searchTerm}".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg truncate">{note.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3">{note.content}</p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
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
      {totalPages > currentPage && !isLoading && !searchTerm && ( // Only show if not searching and more pages exist
          <div className="mt-8 text-center">
              <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
              >
                  {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Load More Notes
              </Button>
          </div>
      )}


      {/* Modals remain the same */}
      <NoteEditor
        note={selectedNote}
        isOpen={isEditorOpen}
        onClose={() => { setIsEditorOpen(false); setSelectedNote(null); }}
        onSave={handleSaveNote}
      />
      <GenerateNotesDialog
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onSuccess={(newNotes) => {
            toast({ title: "Success!", description: `${newNotes.length} notes generated with AI.`});
            fetchNotes(1, false); // Refetch first page
            setIsGeneratorOpen(false);
        }}
        onError={(errorMessage) => {
            toast({ title: "Generation Failed", description: errorMessage, variant: "destructive" });
        }}
      />
    </>
  );
}