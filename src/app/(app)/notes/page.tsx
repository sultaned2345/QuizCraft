'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Note } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Sparkles, Edit, Trash2, BookCopy, Search } from 'lucide-react';
import { NoteEditor } from '@/components/NoteEditor';
import { GenerateNotesDialog } from '@/components/GenerateNotesDialog';
import { USAGE_LIMITS } from '@/lib/usage-limits';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [usage, setUsage] = useState({ count: 0, limit: USAGE_LIMITS.FREE_NOTES });
  const [searchTerm, setSearchTerm] = useState('');

  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchNotes();
    }
  }, [user, authLoading, router]);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/notes', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      setNotes(data.data.notes);
      setUsage({ count: data.data.count, limit: data.data.limit });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

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
      
      toast({ title: `Note ${isUpdating ? 'Updated' : 'Created'}`, description: "Your note has been saved successfully." });
      
      // THIS IS THE LINE THAT WAS ADDED
      await fetchNotes(); 
      
      setIsEditorOpen(false);
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
        setNotes(prev => prev.filter(note => note.id !== noteId));
        setUsage(prev => ({ ...prev, count: prev.count - 1 }));
    } catch (error: any) {
        toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(note =>
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [notes, searchTerm]);

  if (authLoading || isLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Notes</h1>
          {usage.limit !== Infinity && (
              <p className="text-sm text-muted-foreground mt-1">
                  You've used {usage.count}/{usage.limit} notes.
                  <Link href="/pricing" className="ml-2 text-primary font-medium hover:underline">Upgrade to Pro</Link>
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
              placeholder="Search notes..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
          />
      </div>

      {filteredNotes.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <BookCopy className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">{searchTerm ? 'No Matching Notes' : 'No Notes Yet'}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm ? 'Try a different search term.' : 'Create your first note or use AI to generate one.'}
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

      {/* Modals */}
      <NoteEditor
        note={selectedNote}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveNote}
      />
      <GenerateNotesDialog
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onSuccess={(newNotes) => {
            toast({ title: "Success!", description: `${newNotes.length} notes generated with AI.`});
            fetchNotes();
            setIsGeneratorOpen(false);
        }}
        onError={(errorMessage) => {
            toast({ title: "Generation Failed", description: errorMessage, variant: "destructive" });
        }}
      />
    </>
  );
}