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

interface NoteEditorProps {
  note: Note | null; // Pass a note to edit, or null to create
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteData: { id?: string; title: string; content: string }) => Promise<void>;
}

export function NoteEditor({ note, isOpen, onClose, onSave }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
        if (note) {
          setTitle(note.title);
          setContent(note.content);
        } else {
          setTitle('');
          setContent('');
        }
    }
  }, [note, isOpen]);
  
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{note ? 'Edit Note' : 'Create New Note'}</DialogTitle>
          <DialogDescription>
            {note ? 'Update your note details.' : 'Add a new note to your collection.'}
          </DialogDescription>
        </DialogHeader>
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
              disabled={isSaving}
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
              disabled={isSaving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}