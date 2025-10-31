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
import { Loader2, Eye, Pencil } from 'lucide-react';
import { Note } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { MarkdownViewer } from '@/components/MarkdownViewer'; // <-- NEW IMPORT
import { cn } from '@/lib/utils';

interface NoteEditorProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteData: { id?: string; title: string; content: string }) => Promise<void>;
  isFetching?: boolean;
}

export function NoteEditor({
  note,
  isOpen,
  onClose,
  onSave,
  isFetching = false,
}: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<'write' | 'preview'>('write'); // <-- NEW STATE

  useEffect(() => {
    if (isOpen) {
      if (note) {
        setTitle(note.title);
        setContent(note.content);
      } else {
        setTitle('');
        setContent('');
      }
      setMode('write'); // Always default to 'write' mode when opening
    }
  }, [note, isOpen]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Title cannot be empty.');
      return;
    }
    // Allow saving empty content
    setIsSaving(true);
    await onSave({
      id: note?.id,
      title,
      content,
    });
    setIsSaving(false);
  };

  const isDisabled = isSaving || isFetching;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* --- MODIFIED: Made dialog wider --- */}
      <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isFetching ? 'Loading Note...' : note ? 'Edit Note' : 'Create New Note'}
          </DialogTitle>
          <DialogDescription>
            {isFetching
              ? 'Please wait...'
              : 'Add a title and content. Markdown is supported.'}
          </DialogDescription>
        </DialogHeader>

        {/* Show skeletons while fetching full note content */}
        {isFetching ? (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Skeleton className="h-10 col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="content" className="text-right pt-2">
                Content
              </Label>
              <Skeleton className="h-[300px] col-span-3" />
            </div>
          </div>
        ) : (
          // Show the form once fetching is done (or for new notes)
          <div className="grid gap-4 py-4 flex-1 overflow-y-auto">
            {/* --- MODIFIED: Title Input --- */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title-input" className="text-right">
                Title
              </Label>
              <Input
                id="title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="col-span-3"
                disabled={isDisabled}
              />
            </div>

            {/* --- MODIFIED: Content Editor with Toggle --- */}
            <div className="grid grid-cols-4 items-start gap-4 flex-1 min-h-[300px]">
              <div className="text-right space-y-2">
                <Label htmlFor="content-input" className="pt-2">
                  Content
                </Label>
                {/* Toggle Buttons */}
                <div className="flex flex-col items-end gap-2">
                  <Button
                    type="button"
                    variant={mode === 'write' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setMode('write')}
                    disabled={isDisabled}
                  >
                    <Pencil className="w-4 h-4 mr-2" /> Write
                  </Button>
                  <Button
                    type="button"
                    variant={mode === 'preview' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setMode('preview')}
                    disabled={isDisabled}
                  >
                    <Eye className="w-4 h-4 mr-2" /> Preview
                  </Button>
                </div>
              </div>

              {/* Content Area */}
              <div className="col-span-3 flex-1 h-full min-h-[300px]">
                {mode === 'write' ? (
                  <Textarea
                    id="content-input"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-full min-h-[300px] font-mono text-sm"
                    placeholder="Write your note here... # Headings, **bold**, and *italics* are supported!"
                    disabled={isDisabled}
                  />
                ) : (
                  <div
                    className={cn(
                      'w-full min-h-[300px] rounded-md border bg-muted p-4 overflow-y-auto',
                      content ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {content ? (
                      <MarkdownViewer content={content} />
                    ) : (
                      'Nothing to preview yet.'
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isDisabled}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isDisabled}>
            {(isSaving || isFetching) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isFetching ? 'Loading...' : isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}