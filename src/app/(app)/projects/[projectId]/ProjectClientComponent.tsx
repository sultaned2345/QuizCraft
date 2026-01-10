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
  Play,
  Mic, // Icon for recording
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
import { usePageContext, PageContextType } from '@/contexts/PageContext';

// IMPORT THE RECORDER
import { AudioRecorder } from '@/components/AudioRecorder';

interface ProjectClientComponentProps {
  initialProject: Project;
  initialContent: ProjectContentDetails;
}

type ContentLinkItem = ProjectContentDetails['links'][0];
type ContentType = 'document' | 'quiz' | 'note' | 'deck' | 'recording' | '';

// Helper to get the correct icon
const getIcon = (type: string) => {
  if (type === 'document') return <FileText className="w-5 h-5 text-blue-500" />;
  if (type === 'quiz') return <FileQuestion className="w-5 h-5 text-green-500" />;
  if (type === 'note') return <StickyNote className="w-5 h-5 text-yellow-500" />;
  if (type === 'deck') return <Layers className="w-5 h-5 text-purple-500" />;
  if (type === 'recording') return <Mic className="w-5 h-5 text-red-500" />;
  return <FileText className="w-5 h-5" />;
};

// Helper to get the correct link
const getHref = (type: string, id: string) => {
  if (type === 'document') return `/documents/${id}`;
  if (type === 'quiz') return `/quiz/${id}`;
  if (type === 'note') return `/notes/${id}`;
  if (type === 'deck') return `/flashcards/${id}`;
  if (type === 'recording') return `/recordings/${id}`; // Or open in modal
  return '#';
};

export function ProjectClientComponent({
  initialProject,
  initialContent,
}: ProjectClientComponentProps) {
  const [project, setProject] = useState(initialProject);
  const [content, setContent] = useState<ContentLinkItem[]>(initialContent.links);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit Project Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDescription, setEditDescription] = useState(project.description || '');

  // Add Item Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Record Audio Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // Add Existing Item State
  const [addItemType, setAddItemType] = useState<ContentType>('');
  const [availableItems, setAvailableItems] = useState<{ id: string; title: string }[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [isFetchingItems, setIsFetchingItems] = useState(false);

  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
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

  // --- Handlers ---

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
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
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
        const result: ApiResponse<{ id: string; title: string }[]> = await response.json();
        if (!result.success || !result.data) {
          throw new Error(result.error || `Failed to fetch ${type}s.`);
        }
        setAvailableItems(result.data);
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Add Failed', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Remove Failed', description: error.message, variant: 'destructive' });
      setContent(originalContent);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRecordingComplete = (newRecording: any) => {
    // Add the new recording to the content list optimistically
    // Note: The object structure might vary, adapting to ContentLinkItem shape
    const newLink: ContentLinkItem = {
      id: `temp-${Date.now()}`, // Temp ID until refresh
      content_id: newRecording.id,
      content_type: 'recording',
      title: newRecording.title || 'New Recording',
      description: 'Audio Recording',
      icon: 'recording',
      created_at: new Date().toISOString()
    };
    
    setContent((prev) => [newLink, ...prev]);
    setIsRecordModalOpen(false);
    router.refresh(); // Fetch authoritative data
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" onClick={() => router.push('/projects')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>
        <div className="flex gap-2">
          {/* New Record Button */}
          <Button variant="default" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setIsRecordModalOpen(true)}>
            <Mic className="w-4 h-4 mr-2" />
            Record Lecture
          </Button>

          <Button variant="outline" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Existing
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
        <div className="text-center py-16 border-2 border-dashed rounded-lg bg-muted/10">
          <CardTitle>This project is empty</CardTitle>
          <CardDescription className="mt-2">
            Record a lecture, upload documents, or add existing quizzes.
          </CardDescription>
          <div className="flex gap-3 justify-center mt-6">
            <Button onClick={() => setIsRecordModalOpen(true)} variant="default">
              <Mic className="w-4 h-4 mr-2" />
              Record Now
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {content.map((item) => (
            <Card key={item.id} className="flex flex-col h-full hover:shadow-md transition-shadow">
              <CardHeader className="flex-row items-start gap-4 space-y-0">
                <span className={cn("p-2 rounded-full", item.content_type === 'recording' ? 'bg-red-100 dark:bg-red-900/20' : 'bg-muted')}>
                  {getIcon(item.content_type || item.icon)}
                </span>
                <div className="flex-1 overflow-hidden">
                  <CardTitle className="text-base truncate" title={item.title}>
                    {item.title}
                  </CardTitle>
                  <CardDescription className="text-xs capitalize">
                    {item.content_type}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {item.description 
                    ? item.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() 
                    : 'No details available.'}
                </p>
              </CardContent>
              <CardFooter className="justify-end gap-2 pt-0 pb-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove from project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove "{item.title}" from this project view.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className={buttonVariants({ variant: 'destructive' })}
                        onClick={() => handleRemoveItem(item.id, item.title)}
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <Button asChild size="sm" variant={item.content_type === 'quiz' ? 'default' : 'secondary'}>
                  <Link href={getHref(item.content_type, item.content_id)}>
                    {item.content_type === 'quiz' ? (
                        <> <Play className="w-3 h-3 mr-2" /> Start </>
                    ) : (
                        "Open"
                    )}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* --- RECORDING MODAL --- */}
      <Dialog open={isRecordModalOpen} onOpenChange={setIsRecordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Lecture</DialogTitle>
            <DialogDescription>
              Record your class or meeting. We will transcribe it and generate notes automatically.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 flex justify-center">
            <AudioRecorder 
              projectId={project.id} 
              onUploadComplete={handleRecordingComplete}
            />
          </div>

          <DialogFooter className="sm:justify-start">
            <DialogClose asChild>
              <Button type="button" variant="ghost">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- ADD EXISTING ITEM MODAL --- */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Existing Content</DialogTitle>
            <DialogDescription>Link content you created previously.</DialogDescription>
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
                  <SelectValue placeholder="Select type..." />
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
              <Label htmlFor="item-select">Select Item</Label>
              <Select
                value={selectedItemId}
                onValueChange={setSelectedItemId}
                disabled={isSaving || isFetchingItems || !addItemType}
              >
                <SelectTrigger id="item-select">
                  <SelectValue placeholder="Choose item..." />
                </SelectTrigger>
                <SelectContent>
                  {availableItems.length > 0 ? (
                    availableItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">None found.</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!selectedItemId || isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Modal (Preserved but hidden for brevity) */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
             <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
             <form onSubmit={handleEditSave} className="grid gap-4 py-4">
                 <div className="grid gap-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                 </div>
                 <div className="grid gap-2">
                    <Label htmlFor="desc">Description</Label>
                    <Textarea id="desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                 </div>
                 <DialogFooter>
                    <Button type="submit">Save</Button>
                 </DialogFooter>
             </form>
        </DialogContent>
      </Dialog>
    </>
  );
}