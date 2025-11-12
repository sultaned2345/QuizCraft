// src/app/(app)/projects/[projectId]/ProjectClientComponent.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Project, ApiResponse, ProjectContentDetails } from '@/types/database';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  ArrowLeft,
  Trash2,
  Edit,
  FileText,
  FileQuestion,
  StickyNote,
  Layers,
  Plus,
  Play, // <-- IMPORT PLAY ICON
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageContext, PageContextType } from '@/contexts/PageContext';

interface ProjectClientComponentProps {
  initialProject: Project;
  initialContent: ProjectContentDetails;
}

type ContentLinkItem = ProjectContentDetails['links'][0];
type ContentType = 'document' | 'quiz' | 'note' | 'deck' | '';

// Helper to get the correct icon
const getIcon = (type: string) => {
  if (type === 'document') return <FileText className="w-5 h-5 text-blue-500" />;
  // --- FIX: Change quiz icon ---
  if (type === 'quiz') return <FileQuestion className="w-5 h-5 text-green-500" />;
  if (type === 'note') return <StickyNote className="w-5 h-5 text-yellow-500" />;
  if (type === 'deck') return <Layers className="w-5 h-5 text-purple-500" />;
  return <FileText className="w-5 h-5" />;
};

// Helper to get the correct link
const getHref = (type: string, id: string) => {
  if (type === 'document') return `/documents/${id}`;
  // --- FIX: Change quiz link ---
  if (type === 'quiz') return `/quiz/${id}`; // Link to quiz-taking page
  // --- END FIX ---
  if (type === 'note') return `/notes/${id}`;
  if (type === 'deck') return `/flashcards/${id}`;
  return '#';
};

export function ProjectClientComponent({
  initialProject,
  initialContent,
}: ProjectClientComponentProps) {
  const [project, setProject] = useState(initialProject);
  const [content, setContent] = useState<ContentLinkItem[]>(
    initialContent.links
  );
  const [isDeleting, setIsDeleting] = useState(false); // For deleting links
  const [isSaving, setIsSaving] = useState(false); // For modal saves

  // Edit Project Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDescription, setEditDescription] = useState(
    project.description || ''
  );

  // Add Item Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addItemType, setAddItemType] = useState<ContentType>('');
  const [availableItems, setAvailableItems] = useState<
    { id: string; title: string }[]
  >([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [isFetchingItems, setIsFetchingItems] = useState(false);

  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // --- (Page Context, EditSave, FetchItems, AddItem, RemoveItem handlers are unchanged) ---
  const { setPageContext } = usePageContext();
  const pageContext = useMemo(
    (): PageContextType => ({
      type: 'project',
      id: project.id,
      name: project.title,
    }),
    [project.id, project.title]
  );

  useEffect(() => {
    setPageContext(pageContext);
    return () => setPageContext(null);
  }, [setPageContext, pageContext]);

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !session || isSaving) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
        }),
      });
      const result: ApiResponse<Project> = await response.json();
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Failed to update project.');
      }
      setProject(result.data); 
      toast({ title: 'Project Updated' });
      setIsEditModalOpen(false);
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const fetchAvailableItems = useCallback(
    async (type: ContentType) => {
      if (!type || !session) return;
      setIsFetchingItems(true);
      setAvailableItems([]);
      setSelectedItemId('');
      try {
        const response = await fetch(`/api/content/list?type=${type}&excludeProject=${project.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const result: ApiResponse<{ id: string; title: string }[]> =
          await response.json();
        if (!result.success || !result.data) {
          throw new Error(result.error || `Failed to fetch ${type}s.`);
        }
        setAvailableItems(result.data);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setIsFetchingItems(false);
      }
    },
    [session, project.id, toast]
  );

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !addItemType || !session || isSaving) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          contentId: selectedItemId,
          contentType: addItemType,
        }),
      });
      const result: ApiResponse<ContentLinkItem> = await response.json();
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Failed to add item.');
      }
      setContent((prev) => [...prev, result.data!]);
      toast({ title: 'Item Added', description: `Added to project.` });
      setIsAddModalOpen(false);
      setAddItemType('');
      setSelectedItemId('');
    } catch (error: any) {
      toast({
        title: 'Add Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveItem = async (linkId: string, title: string) => {
    if (isDeleting || !session) return;
    setIsDeleting(true);

    const originalContent = [...content];
    setContent((prev) => prev.filter((item) => item.id !== linkId));

    try {
      const response = await fetch(`/api/projects/links/${linkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result: ApiResponse = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to remove item.');
      }
      toast({ title: 'Item Removed', description: `"${title}" removed.` });
    } catch (error: any) {
      toast({
        title: 'Remove Failed',
        description: error.message,
        variant: 'destructive',
      });
      setContent(originalContent);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* --- (Header and Empty State are unchanged) --- */}
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" onClick={() => router.push('/projects')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditTitle(project.title);
              setEditDescription(project.description || '');
              setIsEditModalOpen(true);
            }}
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{project.title}</h1>
        <p className="text-lg text-muted-foreground mt-2">
          {project.description || 'No description for this project.'}
        </p>
      </div>

      {content.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <CardTitle>This project is empty</CardTitle>
          <CardDescription className="mt-2">
            Add your documents, quizzes, and notes to get started.
          </CardDescription>
          <Button className="mt-6" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Item
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {content.map((item) => (
            <Card key={item.id} className="flex flex-col h-full">
              <CardHeader className="flex-row items-start gap-4 space-y-0">
                <span className="p-2 bg-muted rounded-full">
                  {getIcon(item.icon)}
                </span>
                <div className="flex-1">
                  <CardTitle className="text-base truncate" title={item.title}>
                    {item.title}
                  </CardTitle>
                  <CardDescription className="text-xs capitalize">
                    {item.content_type}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                {/* --- FIX: Prettier note preview --- */}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {item.description 
                    ? item.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() // Strip HTML and normalize whitespace
                    : 'No details available.'}
                </p>
                {/* --- END FIX --- */}
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      disabled={isDeleting}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove "{item.title}" from this project. The
                        item itself will not be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className={cn(
                          buttonVariants({ variant: 'destructive' })
                        )}
                        disabled={isDeleting}
                        onClick={() => handleRemoveItem(item.id, item.title)}
                      >
                        {isDeleting && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                {/* --- FIX: Change button for quiz --- */}
                {item.content_type === 'quiz' ? (
                  <Button asChild size="sm">
                    <Link href={getHref(item.content_type, item.content_id)}>
                      <Play className="w-4 h-4 mr-2" />
                      Start Quiz
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={getHref(item.content_type, item.content_id)}>
                      View
                    </Link>
                  </Button>
                )}
                {/* --- END FIX --- */}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* --- (Modals are unchanged) --- */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={isSaving}
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={isSaving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSaving || !editTitle.trim()}>
                {isSaving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item to Project</DialogTitle>
            <DialogDescription>
              Select an existing item to add to this project.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="item-type">Item Type</Label>
              <Select
                value={addItemType}
                onValueChange={(val) => {
                  const type = val as ContentType;
                  setAddItemType(type);
                  fetchAvailableItems(type);
                }}
                disabled={isSaving}
              >
                <SelectTrigger id="item-type">
                  <SelectValue placeholder="Select a type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="deck">Flashcard Deck</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="item-select">Item</Label>
              <Select
                value={selectedItemId}
                onValueChange={setSelectedItemId}
                disabled={isSaving || isFetchingItems || !addItemType}
              >
                <SelectTrigger id="item-select">
                  <SelectValue placeholder="Select an item..." />
                </SelectTrigger>
                <SelectContent>
                  {isFetchingItems ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : availableItems.length > 0 ? (
                    availableItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">
                      No available {addItemType}s found.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={isSaving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isSaving || isFetchingItems || !selectedItemId}
              >
                {isSaving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add to Project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}