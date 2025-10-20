'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Loader2, Bold, Italic, Underline } from 'lucide-react';
import { Note } from '@/types/database';
import { cn } from '@/lib/utils';

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
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
        if (note) {
          setTitle(note.title);
          setContent(note.content);
          if(editorRef.current) {
            editorRef.current.innerHTML = note.content;
          }
        } else {
          setTitle('');
          setContent('');
          if(editorRef.current) {
            editorRef.current.innerHTML = '';
          }
        }
    }
  }, [note, isOpen]);
  
  const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
    setContent(e.currentTarget.innerHTML);
  };

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

  const execCommand = (command: string) => {
    document.execCommand(command, false, undefined);
    editorRef.current?.focus();
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
            <div className="col-span-3">
                <div className="flex items-center gap-2 border border-input rounded-t-md p-2 bg-transparent">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => execCommand('bold')}><Bold className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => execCommand('italic')}><Italic className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => execCommand('underline')}><Underline className="h-4 w-4" /></Button>
                </div>
                <div
                    ref={editorRef}
                    id="content"
                    contentEditable={!isSaving}
                    onInput={handleContentChange}
                    className="w-full min-h-[150px] rounded-b-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    dangerouslySetInnerHTML={{ __html: content }}
                />
            </div>
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