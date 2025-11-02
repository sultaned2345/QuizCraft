// file: components/NoteEditor.tsx
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
import { Loader2, Eye, Pencil, Link, FileText, StickyNote } from 'lucide-react'; // Added Link icons
import { Note, ApiResponse } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import NextLink from 'next/link'; // Import NextLink

// --- NEW: Related Item Types ---
interface RelatedItem {
  content_id: string;
  content_type: 'note' | 'document';
  content_title: string;
}

interface NoteEditorProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteData: {
    id?: string;
    title: string;
    content: string;
    tags: string[];
  }) => Promise<void>;
  isFetching?: boolean;
}

// --- NEW: Related Content Widget ---
function RelatedContentWidget({ note, onLinkClick }: { note: Note | null, onLinkClick: () => void }) {
    const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { session } = useAuth();

    useEffect(() => {
        if (note && note.content && session) {
            const fetchRelated = async () => {
                setIsLoading(true);
                setRelatedItems([]); // Clear previous
                try {
                    const response = await fetch('/api/content/find-related', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({
                            contentId: note.id,
                            contentType: 'note',
                            textContent: note.content,
                        }),
                    });
                    const result: ApiResponse<RelatedItem[]> = await response.json();
                    if (result.success && result.data) {
                        setRelatedItems(result.data);
                    }
                } catch (error) {
                    console.error("Failed to fetch related content:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchRelated();
        }
    }, [note, session]);

    return (
        <div className="w-full lg:w-64 lg:pl-4 space-y-3 pt-4 lg:pt-0">
            <h4 className="text-sm font-semibold text-muted-foreground">Related Materials</h4>
            {isLoading && (
                <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </div>
            )}
            {!isLoading && relatedItems.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No related content found.</p>
            )}
            {!isLoading && relatedItems.length > 0 && (
                <div className="space-y-2">
                    {relatedItems.map((item) => (
                        <Button key={item.content_id} variant="outline" size="sm" asChild className="w-full justify-start h-auto py-2">
                            <NextLink 
                                href={item.content_type === 'note' ? '/notes' : '/documents'} 
                                title={item.content_title}
                                onClick={onLinkClick} // Close current dialog
                            >
                                {item.content_type === 'note' ? <StickyNote className="w-4 h-4 mr-2 shrink-0" /> : <FileText className="w-4 h-4 mr-2 shrink-0" />}
                                <span className="truncate text-xs">{item.content_title}</span>
                            </NextLink>
                        </Button>
                    ))}
                </div>
            )}
        </div>
    );
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
  const [tags, setTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  useEffect(() => {
    if (isOpen) {
      if (note) {
        setTitle(note.title);
        setContent(note.content);
        setTags(note.tags ? note.tags.join(', ') : '');
      } else {
        setTitle('');
        setContent('');
        setTags('');
      }
      setMode('write');
    }
  }, [note, isOpen]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Title cannot be empty.');
      return;
    }
    const tagsArray = tags.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0);
    setIsSaving(true);
    await onSave({ id: note?.id, title, content, tags: tagsArray });
    setIsSaving(false);
  };

  const isDisabled = isSaving || isFetching;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* --- MODIFIED: Increased width and layout --- */}
      <DialogContent className="sm:max-w-4xl md:max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isFetching ? 'Loading Note...' : note ? 'Edit Note' : 'Create New Note'}
          </DialogTitle>
          <DialogDescription>
            {isFetching ? 'Please wait...' : 'Add a title and content. Markdown is supported.'}
          </DialogDescription>
        </DialogHeader>

        {/* --- MODIFIED: Main content area with flex layout --- */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
          {/* --- Main Editor Area --- */}
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2">
            {isFetching ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-[300px] w-full" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title-input" className="text-right">Title</Label>
                  <Input id="title-input" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" disabled={isDisabled} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="tags-input" className="text-right">Tags</Label>
                  <Input id="tags-input" value={tags} onChange={(e) => setTags(e.target.value)} className="col-span-3" placeholder="e.g. biology, exam1, chapter3" disabled={isDisabled} />
                </div>
                <div className="grid grid-cols-4 items-start gap-4 flex-1 min-h-[300px]">
                  <div className="text-right space-y-2">
                    <Label htmlFor="content-input" className="pt-2">Content</Label>
                    <div className="flex flex-col items-end gap-2">
                      <Button type="button" variant={mode === 'write' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMode('write')} disabled={isDisabled}>
                        <Pencil className="w-4 h-4 mr-2" /> Write
                      </Button>
                      <Button type="button" variant={mode === 'preview' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMode('preview')} disabled={isDisabled}>
                        <Eye className="w-4 h-4 mr-2" /> Preview
                      </Button>
                    </div>
                  </div>
                  <div className="col-span-3 flex-1 h-full min-h-[300px]">
                    {mode === 'write' ? (
                      <Textarea id="content-input" value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-full min-h-[300px] font-mono text-sm" placeholder="Write your note here... # Headings, **bold**, and *italics* are supported!" disabled={isDisabled} />
                    ) : (
                      <div className={cn('w-full min-h-[300px] rounded-md border bg-muted p-4 overflow-y-auto', content ? '' : 'text-muted-foreground')}>
                        {content ? <MarkdownViewer content={content} /> : 'Nothing to preview yet.'}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* --- NEW: Related Content Sidebar --- */}
          <div className="w-full lg:w-64 lg:border-l lg:pl-4 overflow-y-auto">
            {/* Only show related content when editing an existing note and it's not fetching */}
            {!isFetching && note && (
                <RelatedContentWidget note={note} onLinkClick={onClose} />
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose} disabled={isDisabled}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isDisabled}>
            {(isSaving || isFetching) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isFetching ? 'Loading...' : isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}