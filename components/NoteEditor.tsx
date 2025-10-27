// components/NoteEditor.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { Note } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

interface NoteEditorProps {
  note: Note | null; // Pass a note to edit, or null to create
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteData: { id?: string; title: string; content: string }) => Promise<void>;
  // Add a prop to indicate if content is still being fetched
  isFetching?: boolean; 
}

export function NoteEditor({ note, isOpen, onClose, onSave, isFetching = false }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
        if (note) {
          // If we have a note object, populate fields
          setTitle(note.title);
          setContent(note.content);
        } else {
          // If note is null (for creating new or while fetching), clear fields
          setTitle('');
          setContent('');
        }
    }
  }, [note, isOpen]); // Effect runs when 'note' object changes (from null to full note)
  
  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      alert('Title and content cannot be empty.');
      return;
    }
    setIsSaving(true);
    await onSave({
      id: note?.id,
      title,
      content,
    });
    setIsSaving(false);
  };
  
  // Helper to determine if fields should be disabled
  const isDisabled = isSaving || isFetching;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{(note && !isFetching) ? 'Edit Note' : 'Create New Note'}</DialogTitle>
          <DialogDescription>
            {(note && !isFetching) ? 'Update your note details.' : 'Add a new note to your collection.'}
          </DialogDescription>
        </DialogHeader>
        
        {/* Show skeletons while fetching full note content */}
        {isFetching ? (
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">Title</Label>
                    <Skeleton className="h-10 col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="content" className="text-right pt-2">Content</Label>
                    <Skeleton className="h-[150px] col-span-3" />
                </div>
            </div>
        ) : (
        // Show the form once fetching is done (or for new notes)
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  Title
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="col-span-3"
                  disabled={isDisabled}
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="content" className="text-right pt-2">
                  Content
                </Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="col-span-3 min-h-[150px]"
                  placeholder="Write your note here..."
                  disabled={isDisabled}
                />
              </div>
            </div>
        )}
        
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isDisabled}>Cancel</Button>
          <Button onClick={handleSave} disabled={isDisabled}>
            {(isSaving || isFetching) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isFetching ? 'Loading...' : isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}