// src/app/(app)/notes/NotesClientComponent.tsx
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
  ArrowRight 
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

export function NotesClientComponent() {
  const { session } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data: notesData, error, isLoading, mutate } = useSWR(
    session ? '/api/notes' : null,
    (url) => fetcher(url, session!.access_token)
  );

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          title: 'Untitled Note',
          content: '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/notes/${data.data.id}`);
      }
    } catch (e) {
      toast({ variant: "destructive", description: "Failed to initialize new note." });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();
    try {
      await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      mutate();
      toast({ description: "Note deleted." });
    } catch (e) {
      toast({ variant: "destructive", description: "Could not delete note." });
    }
  };

  const filteredNotes = notesData?.data?.filter((n: any) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8 h-full flex flex-col">
      {/* 1. Command Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Neural Notes</h1>
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
              className="pl-9 bg-zinc-900/50 border-white/10 focus:bg-zinc-900 transition-all h-9 text-sm font-sans"
            />
          </div>
          <div className="h-6 w-px bg-white/10 mx-1 hidden md:block" />
          <Button 
            onClick={handleCreate} 
            disabled={isCreating}
            size="sm" 
            className="h-9 bg-white text-black hover:bg-zinc-200 font-medium px-4"
          >
            <Plus className="w-4 h-4 mr-2" /> {isCreating ? 'Creating...' : 'New Note'}
          </Button>
        </div>
      </div>

      {/* 2. The Note List (Industrial Style) */}
      <div className="flex-1">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
               <div key={i} className="h-16 w-full bg-zinc-900/40 border border-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
           <div className="p-8 text-center text-muted-foreground border border-dashed border-white/10 rounded-xl">
             Failed to load notebook.
           </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center border border-dashed border-white/10 rounded-xl bg-zinc-900/20">
            <div className="h-12 w-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4 border border-white/5">
                <StickyNote className="w-5 h-5 text-zinc-500" />
            </div>
            <h3 className="text-lg font-medium text-white">Notebook Empty</h3>
            <p className="text-muted-foreground max-w-sm mt-1 mb-6 text-sm">
              Capture your thoughts, summaries, and ideas here.
            </p>
            {!searchQuery && (
              <Button onClick={handleCreate} variant="outline" className="border-white/10 hover:bg-white/5">
                Create First Note
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredNotes.map((note: any) => (
              <Link 
                key={note.id} 
                href={`/notes/${note.id}`}
                className="group flex items-center justify-between p-4 rounded-lg border border-white/5 bg-zinc-900/20 hover:bg-zinc-900/60 hover:border-white/10 transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 shrink-0">
                     <StickyNote className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                      {note.title || 'Untitled Note'}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
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
                            className="h-8 w-8 text-zinc-500 hover:text-zinc-200"
                            onClick={(e) => e.preventDefault()}
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 bg-zinc-950 border-white/10">
                        <DropdownMenuItem 
                            onClick={(e) => handleDelete(e as any, note.id)}
                            className="text-red-400 focus:text-red-300 focus:bg-red-950/30 font-mono text-xs"
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            DELETE NOTE
                        </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <div className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center text-zinc-400 group-hover:bg-white/5 group-hover:text-white transition-colors">
                        <ArrowRight className="w-4 h-4" />
                    </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}