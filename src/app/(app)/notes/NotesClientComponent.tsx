// src/app/(app)/notes/NotesClientComponent.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Note, ApiResponse } from '@/types/database'; // Import FULL Note type
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Sparkles, Edit, Trash2, BookCopy, Search, X } from 'lucide-react';
import { NoteEditor } from '@/components/NoteEditor';
import { GenerateNotesDialog } from '@/components/GenerateNotesDialog';
import { cn } from '@/lib/utils';

// Type for the simplified Note structure from the API
interface NoteListItem {
  id: string;
  user_id: string;
  title: string;
  tags: string[];
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
  
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isFetchingNote, setIsFetchingNote] = useState(false);
  
  const [usage, setUsage] = useState({ count: initialData.count, limit: initialData.limit });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(initialData.currentPage);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const notesPerPage = 9;

  const [allTags, setAllTags] = useState<Set<string>>(new Set());
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const tags = new Set<string>();
    notes.forEach(note => {
      (note.tags || []).forEach(tag => tags.add(tag));
    });
    setAllTags(tags);
  }, [notes]);

  const fetchMoreNotes = useCallback(async (page: number) => {
    // ... (function remains the same)
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
        // ... (function remains the same)
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

  const handleEditClick = async (noteItem: NoteListItem) => {
    // ... (function remains the same)
    if (!session) return;
    setIsFetchingNote(true);
    setSelectedNote(null);
    setIsEditorOpen(true);

    try {
        const response = await fetch(`/api/notes/${noteItem.id}`, {
             headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const result: ApiResponse<Note> = await response.json();

        if (!result.success || !result.data) {
             throw new Error(result.error || 'Failed to fetch note content.');
        }
        
        setSelectedNote(result.data);

    } catch (error: any) {
        toast({ title: "Error", description: `Could not load note content: ${error.message}`, variant: "destructive" });
        setIsEditorOpen(false);
    } finally {
        setIsFetchingNote(false);
    }
  };

  const handleSaveNote = async (noteData: { id?: string; title: string; content: string; tags: string[] }) => {
     // ... (function remains the same)
     try {
       const isUpdating = !!noteData.id;
       const url = isUpdating ? `/api/notes?id=${noteData.id}` : '/api/notes';
       const method = isUpdating ? 'PUT' : 'POST';
       
       const response = await fetch(url, { 
         method, 
         headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }, 
         body: JSON.stringify({ 
           title: noteData.title, 
           content: noteData.content,
           tags: noteData.tags
         }) 
       });
       
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

  // --- MODIFIED: Optimistic Deletion ---
  const handleDeleteNote = async (noteId: string, noteTitle: string) => {
     if (!session || !confirm(`Are you sure you want to delete "${noteTitle}"?`)) return;

     // 1. Optimistic Update
     const originalNotes = [...notes];
     setNotes(prevNotes => prevNotes.filter(n => n.id !== noteId));
     setUsage(prev => ({ ...prev, count: prev.count - 1 }));

     try {
       // 2. API Call
       const response = await fetch(`/api/notes?id=${noteId}`, { 
         method: 'DELETE', 
         headers: { 'Authorization': `Bearer ${session.access_token}` } 
       });
       const result: ApiResponse = await response.json();
       
       if (!result.success) {
         throw new Error(result.error || 'Delete failed on server.');
       }
       
       // 3. Success
       toast({ title: "Note Deleted" });
       // No refresh needed
       
     } catch (error: any) {
       // 4. Rollback on Failure
       toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
       setNotes(originalNotes);
       setUsage(prev => ({ ...prev, count: prev.count + 1 }));
     }
  };

  const filteredNotes = useMemo(() => {
    // ... (function remains the same)
    return notes.filter(note => {
      const matchesSearch = !searchTerm || note.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTag = !selectedTag || (note.tags || []).includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [notes, searchTerm, selectedTag]);


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
          <Button onClick={() => { setSelectedNote(null); setIsEditorOpen(true); setIsFetchingNote(false); }}>
            <Plus className="w-4 h-4 mr-2" /> New Note
          </Button>
        </div>
      </div>

      {/* Search Bar (remains the same) */}
      <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search loaded notes by title..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {/* Tag Filter (remains the same) */}
      {allTags.size > 0 && (
        <div className="mb-6 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">Filter by tag:</span>
          {Array.from(allTags).sort().map(tag => (
            <Button
              key={tag}
              variant={selectedTag === tag ? "secondary" : "outline"}
              size="sm"
              onClick={() => setSelectedTag(tag)}
              className="h-7 px-2 py-1 text-xs"
            >
              {tag}
            </Button>
          ))}
          {selectedTag && (
             <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTag(null)}
              className="h-7 px-2 py-1 text-xs text-muted-foreground"
            >
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      )}

      {/* Grid or Empty State (remains the same) */}
       {(notes.length === 0) ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <BookCopy className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Notes Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first note or use AI.</p>
        </div>
      ) : filteredNotes.length === 0 ? (
         <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <BookCopy className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Matching Notes Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm && selectedTag ? `No loaded notes match "${searchTerm}" with tag "${selectedTag}".`
            : searchTerm ? `No loaded notes match "${searchTerm}".`
            : selectedTag ? `No loaded notes have the tag "${selectedTag}".`
            : 'No notes found.'}
          </p>
          {selectedTag && (
             <Button
              variant="link"
              onClick={() => setSelectedTag(null)}
            >
              Clear tag filter
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg truncate">{note.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                 {(note.tags || []).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {(note.tags || []).map(tag => (
                        <Badge key={tag} variant="secondary" className="font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No tags.</p>
                  )}
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditClick(note)} disabled={isFetchingNote}>
                      {isFetchingNote && selectedNote?.id === note.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Edit className="w-4 h-4 mr-2" />}
                      {isFetchingNote && selectedNote?.id === note.id ? '' : 'Edit'}
                  </Button>
                  {/* --- MODIFIED: Pass title to delete handler --- */}
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteNote(note.id, note.title)} disabled={isFetchingNote}>
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Load More Button (remains the same) */}
      {totalPages > currentPage && !searchTerm && !selectedTag && (
          <div className="mt-8 text-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                  {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More Notes
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Showing {notes.length} of {usage.count} notes</p>
          </div>
      )}

      {/* Modals (remain the same) */}
      <NoteEditor
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