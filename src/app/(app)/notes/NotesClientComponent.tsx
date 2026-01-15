'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Search, 
  StickyNote, 
  MoreHorizontal, 
  Trash2, 
  Clock, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GenerateNotesDialog } from '@/components/GenerateNotesDialog';

// Types matching the server response
interface NoteListItem {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  tags: string[];
}

interface PaginatedNotesData {
  notes: NoteListItem[];
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}

interface NotesClientComponentProps {
  initialData?: PaginatedNotesData;
}

export function NotesClientComponent({ initialData }: NotesClientComponentProps) {
  const { session } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for the AI Generation Dialog
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);

  // SWR Hook with correct fallback structure
  const { data: notesData, error, isLoading, mutate } = useSWR(
    session ? '/api/notes' : null,
    (url) => fetcher(url, session!.access_token),
    {
      // We wrap initialData to match the API response shape: { success: true, data: ... }
      fallbackData: initialData ? { success: true, data: initialData } : undefined,
    }
  );

  // Safely extract the notes array from the paginated response object
  const notes = notesData?.data?.notes || initialData?.notes || [];

  // Handler for successful AI generation
  const handleGenerateSuccess = (newNoteId?: string) => {
    setIsGenerateOpen(false);
    mutate(); // Refresh the list to show the new note
    
    if (newNoteId) {
      toast({ title: "Note Created", description: "Redirecting to your new note..." });
      router.push(`/notes/${newNoteId}`);
    } else {
      toast({ title: "Note Created", description: "Your new note is ready." });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      mutate(); // Refresh the list
      toast({ description: "Note deleted." });
    } catch (e) {
      toast({ variant: "destructive", description: "Could not delete note." });
    }
  };

  // Safe filtering (ensuring notes is actually an array)
  const filteredNotes = Array.isArray(notes) 
    ? notes.filter((n: any) => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="space-y-8 h-full flex flex-col">
      {/* 1. Command Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Neural Notes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your personal knowledge graph and thoughts.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50 border-white/10 focus:bg-muted transition-all h-9 text-sm font-sans"
            />
          </div>
          <div className="h-6 w-px bg-border mx-1 hidden md:block" />
          
          {/* Main Action: Open AI Generator */}
          <Button 
            onClick={() => setIsGenerateOpen(true)} 
            size="sm" 
            className="h-9 px-4 gap-2 shadow-lg shadow-primary/20"
          >
            <Sparkles className="w-4 h-4" /> Generate Note
          </Button>
        </div>
      </div>

      {/* 2. The Note List */}
      <div className="flex-1">
        {isLoading && !notes.length ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
               <div key={i} className="h-16 w-full bg-muted/40 border border-border rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
           <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
             Failed to load notebook.
           </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center border border-dashed border-border rounded-xl bg-muted/20">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4 border border-border">
                <StickyNote className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground">Notebook Empty</h3>
            <p className="text-muted-foreground max-w-sm mt-1 mb-6 text-sm">
              Use AI to generate your first note from a topic, YouTube video, or article.
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsGenerateOpen(true)} variant="outline" className="border-border hover:bg-muted/50 gap-2">
                <Sparkles className="w-4 h-4" /> Generate First Note
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredNotes.map((note: any) => (
              <Link 
                key={note.id} 
                href={`/notes/${note.id}`}
                className="group flex items-center justify-between p-4 rounded-lg border border-border/40 bg-card hover:bg-muted/50 hover:border-border transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 shrink-0">
                     <StickyNote className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {note.title || 'Untitled Note'}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                         <Clock className="w-3 h-3" />
                         {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.preventDefault()}
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                            onClick={(e) => handleDelete(e as any, note.id)}
                            className="text-destructive focus:text-destructive cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete Note
                        </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <div className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <ArrowRight className="w-4 h-4" />
                    </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 3. AI Generation Dialog */}
      <GenerateNotesDialog 
        open={isGenerateOpen} 
        onOpenChange={setIsGenerateOpen}
        onGenerate={handleGenerateSuccess} 
      />
    </div>
  );
}