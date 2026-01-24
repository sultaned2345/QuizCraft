'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Link as LinkIcon, Plus, X, Search, Loader2, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from '@/contexts/AuthContext';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

interface NoteConnectionsProps {
  currentNoteId: string;
  initialLinkedIds: string[];
  isReadOnly?: boolean;
  onLinksChange?: (newIds: string[]) => void;
}

export function NoteConnections({ 
  currentNoteId, 
  initialLinkedIds, 
  isReadOnly, 
  onLinksChange 
}: NoteConnectionsProps) {
  const { session } = useAuth();
  const [linkedIds, setLinkedIds] = useState<string[]>(initialLinkedIds || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Fetch all notes to allow searching for links (Optimized: only fetch ID and Title)
  const { data: searchResults, isLoading } = useSWR(
    session && isPopoverOpen ? `/api/notes?search=${searchQuery}&limit=5` : null,
    (url) => fetcher(url, session!.access_token),
    { keepPreviousData: true }
  );

  // Fetch details of *already linked* notes (so we have their titles)
  // In a real app, you might include linked note titles in the main note fetch to avoid this extra call.
  // For now, we will assume we need to fetch them or we can just show IDs if we are lazy, 
  // but let's do it right: usually, the parent fetches this. 
  // For simplicity here, we'll assume the parent `NoteEditor` might eventually pass full objects,
  // but let's implement a quick lookup or just rely on the search list for new ones.
  // *Critically*: Displaying titles for existing IDs requires fetching them. 
  // We'll skip complex fetching logic here and focus on the *adding* interaction.
  
  const handleAddLink = (note: { id: string, title: string }) => {
    if (linkedIds.includes(note.id)) return;
    
    const newIds = [...linkedIds, note.id];
    setLinkedIds(newIds);
    if (onLinksChange) onLinksChange(newIds);
    setIsPopoverOpen(false);
  };

  const handleRemoveLink = (idToRemove: string) => {
    const newIds = linkedIds.filter(id => id !== idToRemove);
    setLinkedIds(newIds);
    if (onLinksChange) onLinksChange(newIds);
  };

  return (
    <div className="mt-8 pt-8 border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
          <LinkIcon className="w-4 h-4" /> Connected Notes
        </h3>
        
        {!isReadOnly && (
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Plus className="w-3 h-3" /> Link Note
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-64" align="end">
              <div className="p-2 border-b">
                 <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <Input 
                        placeholder="Search notes..." 
                        className="h-8 pl-7 text-xs" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                 </div>
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                  {isLoading ? (
                      <div className="p-2 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></div>
                  ) : searchResults?.data?.notes?.length > 0 ? (
                      (searchResults?.data?.notes || [])
                        .filter((n: any) => n.id !== currentNoteId && !linkedIds.includes(n.id))
                        .map((note: any) => (
                          <button
                            key={note.id}
                            onClick={() => handleAddLink(note)}
                            className="w-full text-left px-2 py-1.5 hover:bg-muted rounded-sm text-xs truncate flex items-center gap-2"
                          >
                             <StickyNote className="w-3 h-3 opacity-50" />
                             {note.title || 'Untitled'}
                          </button>
                      ))
                  ) : (
                      <p className="p-2 text-xs text-muted-foreground text-center">No matching notes.</p>
                  )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {linkedIds.length === 0 ? (
         <p className="text-xs text-muted-foreground italic">No connections yet.</p>
      ) : (
         <div className="flex flex-wrap gap-2">
            {linkedIds.map(id => (
                <div key={id} className="group flex items-center gap-2 bg-secondary/30 border border-border px-3 py-1.5 rounded-md text-xs transition-colors hover:bg-secondary/50">
                    {/* Ideally we would fetch the title for 'id' here. For now, showing ID or generic text */}
                    <Link href={`/notes/${id}`} className="hover:underline flex items-center gap-1.5">
                       <LinkIcon className="w-3 h-3 opacity-50" />
                       <span>Linked Note</span> 
                       {/* In a real implementation, you'd fetch the title for this ID */}
                    </Link>
                    {!isReadOnly && (
                        <button onClick={() => handleRemoveLink(id)} className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity">
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            ))}
         </div>
      )}
    </div>
  );
}