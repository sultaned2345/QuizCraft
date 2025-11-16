// components/NoteEditor.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Save,
  ArrowLeft,
  FileText,
  StickyNote,
  Link as LinkIcon,
} from 'lucide-react';
import { Note, ApiResponse, RelatedItem } from '@/types/database';
import { useAuth } from '@/components/contexts/AuthContext';
import NextLink from 'next/link';
import { useToast } from '@hooks/use-toast'; // <-- THIS IMPORT IS FIXED
import { RichTextEditor } from '@/components/RichTextEditor';
import { BacklinksWidget } from '@/components/BacklinksWidget';
import { useUpgradeModal } from '@/components/UpgradeModalContext';
import { Skeleton } from '@/components/ui/skeleton';

// (RelatedContentWidget is unchanged)
function RelatedContentWidget({
  note,
  onLinkClick,
}: {
  note: Note | null;
  onLinkClick: () => void;
}) {
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();

  useEffect(() => {
    if (note && note.content && session) {
      const fetchRelated = async () => {
        setIsLoading(true);
        setRelatedItems([]);
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
              textContent: note.content, // This should be text, not HTML
            }),
          });
          const result: ApiResponse<RelatedItem[]> = await response.json();
          if (result.success && result.data) {
            setRelatedItems(result.data);
          }
        } catch (error) {
          console.error('Failed to fetch related content:', error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchRelated();
    }
  }, [note, session]);

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <LinkIcon className="w-4 h-4" />
        Related Materials
      </h4>
      {isLoading && (
        <p className="text-xs text-muted-foreground">Loading...</p>
      )}
      {!isLoading && relatedItems.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No related content found.
        </p>
      )}
      {!isLoading &&
        relatedItems.length > 0 &&
        relatedItems.map((item) => (
          <div key={item.content_id} className="border rounded-md">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full justify-start h-auto py-2 rounded-b-none border-0 border-b"
            >
              <NextLink
                href={
                  item.content_type === 'note'
                    ? `/notes/${item.content_id}`
                    : `/documents/${item.content_id}`
                }
                title={item.content_title}
                onClick={onLinkClick}
              >
                {item.content_type === 'note' ? (
                  <StickyNote className="w-4 h-4 mr-2 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 mr-2 shrink-0" />
                )}
                <span className="truncate text-xs font-semibold">
                  {item.content_title}
                </span>
              </NextLink>
            </Button>
            {item.content_chunk && (
              <p className="text-xs text-muted-foreground italic p-2 bg-muted/50 border-t truncate">
                "...{item.content_chunk}..."
              </p>
            )}
          </div>
        ))}
    </div>
  );
}

interface NoteEditorProps {
  note: Note | null; // Null for a new note
}

export function NoteEditor({ note }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { openModal } = useUpgradeModal();
  const isUpdating = !!note;

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags ? note.tags.join(', ') : '');
    } else {
      // It's a new note
      setTitle('');
      setContent('');
      setTags('');
    }
    setIsLoaded(true);
  }, [note]);

  const parseLinks = (htmlContent: string) => {
    const regex = /href="\/notes\/([0-9a-fA-F-]{36})"/g;
    const ids = new Set<string>();
    let match;
    while ((match = regex.exec(htmlContent)) !== null) {
      ids.add(match[1]);
    }
    return Array.from(ids);
  };

  const handleSave = async () => {
    if (!title.trim() || !session) {
      toast({ title: 'Title is required.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);

    const tagsArray = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    const linkedIds = parseLinks(content);

    const noteData = {
      title,
      content,
      tags: tagsArray,
      linked_note_ids: linkedIds,
    };

    try {
      const url = isUpdating ? `/api/notes?id=${note?.id}` : '/api/notes';
      const method = isUpdating ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData),
      });

      const result: ApiResponse<Note> = await response.json();
      if (!response.ok || !result.success || !result.data) {
        if (result.error === 'limit_exceeded') {
          openModal();
          throw new Error(result.message || 'Note limit reached.');
        }
        throw new Error(result.error);
      }

      toast({ title: `Note ${isUpdating ? 'Updated' : 'Created'}` });

      if (!isUpdating) {
        router.replace(`/notes/${result.data.id}`);
      } else {
        router.refresh();
      }
    } catch (error: any) {
      if (!error.message.includes('limit reached')) {
        toast({
          title: 'Save Failed',
          description: error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isDisabled = isSaving || !isLoaded;

  // (JSX is unchanged)
  return (
    <div className="flex flex-col h-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <Button
          variant="ghost"
          onClick={() => router.push('/notes')}
          disabled={isDisabled}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Notes
        </Button>
        <Button onClick={handleSave} disabled={isDisabled}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isSaving ? 'Saving...' : 'Save Note'}
        </Button>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 overflow-hidden">
        {/* Main Editor */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
          <div className="grid gap-2">
            <Label htmlFor="title-input" className="text-base">
              Title
            </Label>
            <Input
              id="title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold h-12"
              placeholder="My New Note Title"
              disabled={isDisabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tags-input" className="text-base">
              Tags
            </Label>
            <Input
              id="tags-input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. biology, exam1, chapter3"
              disabled={isDisabled}
            />
          </div>
          <div className="grid gap-2 flex-1">
            <Label className="text-base">Content</Label>
            {isLoaded ? (
              <RichTextEditor
                content={content}
                onChange={setContent}
                editable={!isDisabled}
              />
            ) : (
              <Skeleton className="w-full min-h-[300px] rounded-md" />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 overflow-y-auto space-y-6 border-l -ml-4 pl-8">
          <RelatedContentWidget note={note} onLinkClick={() => {}} />
          <BacklinksWidget noteId={note?.id || null} />
        </div>
      </div>
    </div>
  );
}