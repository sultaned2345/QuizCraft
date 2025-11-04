// src/app/(app)/projects/[projectId]/ProjectClientComponent.tsx
// NEW FILE

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Project, ProjectContentDetails, ApiResponse } from '@/types/database';
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
  DialogDescription,
  DialogTrigger,
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
import { Loader2, Plus, ArrowLeft, Trash2, FileText, FileQuestion, StickyNote, Layers, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ProjectClientComponentProps {
  initialProject: Project;
  initialContent: ProjectContentDetails;
}

// Helper to get the right icon
const getIcon = (type: string) => {
  switch (type) {
    case 'document': return <FileText className="w-5 h-5 text-blue-500" />;
    case 'quiz': return <FileQuestion className="w-5 h-5 text-green-500" />;
    case 'note': return <StickyNote className="w-5 h-5 text-yellow-500" />;
    case 'deck': return <Layers className="w-5 h-5 text-purple-500" />;
    default: return <FileText className="w-5 h-5" />;
  }
};

// Helper to get the correct link
const getHref = (type: string, id: string) => {
   switch (type) {
    case 'document': return `/documents/${id}`;
    case 'quiz': return `/quiz/${id}`;
    case 'note': return `/notes/${id}`;
    case 'deck': return `/flashcards/${id}`;
    default: return '#';
  }
};

export function ProjectClientComponent({ initialProject, initialContent }: ProjectClientComponentProps) {
  const [project, setProject] = useState(initialProject);
  const [content, setContent] = useState(initialContent);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
  };

  /**
   * Removes a content item *link* from the project.
   * This does not delete the content itself.
   * NOTE: This API route /api/projects/links/[linkId] does not exist yet.
   */
  const handleRemoveLink = async (linkId: string, title: string) => {
    if (!session) return;
    
    const originalLinks = [...content.links];
    setContent(prev => ({ ...prev, links: prev.links.filter(l => l.id !== linkId) }));

    try {
      // const response = await fetch(`/api/projects/links/${linkId}`, {
      //   method: 'DELETE',
      //   headers: { Authorization: `Bearer ${session.access_token}` },
      // });
      // const result: ApiResponse = await response.json();
      // if (!result.success) throw new Error(result.error);

      console.warn(`API route /api/projects/links/${linkId} (DELETE) not implemented.`);
      toast({ title: 'Link Removed (UI)', description: `Removed "${title}" from project.` });
    } catch (error: any) {
      toast({ title: 'Failed to Remove Link', description: error.message, variant: 'destructive' });
      setContent(prev => ({ ...prev, links: originalLinks })); // Rollback
    }
  };

  /**
   * Deletes the entire project.
   * NOTE: This API route /api/projects/[projectId] (DELETE) does not exist yet.
   */
  const handleDeleteProject = async () => {
    if (!session || isDeleting) return;
    setIsDeleting(true);

    try {
      // const response = await fetch(`/api/projects/${project.id}`, {
      //   method: 'DELETE',
      //   headers: { Authorization: `Bearer ${session.access_token}` },
      // });
      // const result: ApiResponse = await response.json();
      // if (!result.success) throw new Error(result.error);
      
      console.warn(`API route /api/projects/${project.id} (DELETE) not implemented.`);
      toast({ title: 'Project Deleted (UI)' });
      router.push('/projects');

    } catch (error: any) {
      toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' });
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4">
        <Button
          variant="ghost"
          onClick={() => router.push('/projects')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>
        <div className="flex gap-2">
          {/* TODO: Add Content Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="w-4 h-4 mr-2" /> Add Content</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Content to Project</DialogTitle>
                <DialogDescription>
                  This feature is not yet implemented. This modal will show a list
                  of your existing documents, quizzes, and notes to link.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{project.title}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action is permanent and only deletes the project folder. 
                  Your documents, quizzes, and notes inside it will NOT be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={cn(buttonVariants({ variant: 'destructive' }))}
                  disabled={isDeleting}
                  onClick={handleDeleteProject}
                >
                  {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete Project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Project Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{project.title}</h1>
        <p className="text-lg text-muted-foreground mt-1">{project.description || 'No description.'}</p>
      </div>

      {/* Content Grid */}
      {content.links.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Project is Empty</h3>
          <p className="mt-1 text-sm text-muted-foreground">Click "Add Content" to get started.</p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {content.links.map((link) => (
            <motion.div key={link.id} variants={itemVariants}>
              <Card className="flex flex-col h-full">
                <CardHeader className="flex-row items-start gap-4 space-y-0 pb-2">
                  <span className="mt-1">{getIcon(link.content_type)}</span>
                  <div className="flex-1 overflow-hidden">
                    <CardTitle className="text-base truncate" title={link.title}>
                      {link.title}
                    </CardTitle>
                    <CardDescription className="text-xs capitalize">{link.content_type}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground italic line-clamp-2">
                    {link.description || 'No details available.'}
                  </p>
                </CardContent>
                <CardFooter className="justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveLink(link.id, link.title)}
                    title="Remove from project"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={getHref(link.content_type, link.content_id)}>
                      View
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </>
  );
}