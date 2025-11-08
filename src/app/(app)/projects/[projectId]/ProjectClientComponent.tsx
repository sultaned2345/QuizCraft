// src/app/(app)/projects/ProjectsClientComponent.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Project, ApiResponse } from '@/types/database';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
// --- MODIFICATION: Import FolderKanban directly ---
import { Loader2, Plus, ArrowRight, Trash2 } from 'lucide-react';
import FolderKanban from 'lucide-react/dist/esm/icons/folder-kanban'; // <-- FIX
// --- END MODIFICATION ---
import { motion } from 'framer-motion';
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
import { cn } from '@/lib/utils';

interface ProjectsClientComponentProps {
  initialData: Project[];
}

export function ProjectsClientComponent({ initialData }: ProjectsClientComponentProps) {
  const [projects, setProjects] = useState<Project[]>(initialData);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim() || !session) return;
    setIsSaving(true);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ title: newProjectTitle, description: newProjectDesc }),
      });
      const result: ApiResponse<Project> = await response.json();
      
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Failed to create project.');
      }

      toast({ title: 'Project Created!', description: `"${result.data.title}" added.` });
      // Add new project to top of the list
      setProjects(prev => [result.data!, ...prev.filter(p => p.id !== result.data!.id)]);
      setNewProjectTitle('');
      setNewProjectDesc('');
      setIsCreateDialogOpen(false);
      
    } catch (error: any) {
      toast({ title: 'Creation Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Note: This needs /api/projects/[projectId] DELETE route to be created
  // I will add that in a future batch if you'd like.
  const handleDeleteProject = async (projectId: string, projectTitle: string) => {
    if (!session || isDeleting) return;
    setIsDeleting(true);

    const originalProjects = [...projects];
    setProjects(prev => prev.filter(p => p.id !== projectId));

    try {
      // We need to create this API route
      // const response = await fetch(`/api/projects/${projectId}`, {
      //   method: 'DELETE',
      //   headers: { Authorization: `Bearer ${session.access_token}` },
      // });
      // const result: ApiResponse = await response.json();
      // if (!result.success) {
      //   throw new Error(result.error || 'Failed to delete project.');
      // }
      
      // Placeholder toast until API is built
      toast({ title: 'Project Deleted (UI)', description: `"${projectTitle}" removed.` });
      console.warn(`Delete API route for /api/projects/${projectId} not yet implemented.`);

    } catch (error: any) {
      toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' });
      setProjects(originalProjects); // Rollback
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Projects ({projects.length})</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>Group your study materials by topic or course.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateProject} className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="project-title">Title</Label>
                <Input
                  id="project-title"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="e.g., Biology Midterm"
                  disabled={isSaving}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="project-desc">Description (Optional)</Label>
                <Textarea
                  id="project-desc"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Notes and materials for..."
                  disabled={isSaving}
                  className="min-h-[100px]"
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost" disabled={isSaving}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSaving || !newProjectTitle.trim()}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Projects Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create a project to organize your materials.</p>
          <Button className="mt-6" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create a Project
          </Button>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {projects.map((project) => (
            <motion.div key={project.id} variants={itemVariants}>
              <Card className="flex flex-col h-full">
                <CardHeader>
                  <CardTitle className="text-lg truncate">{project.title}</CardTitle>
                  <CardDescription>
                    {project._count?.links || 0} items
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description || 'No description.'}
                  </p>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button asChild>
                    {/* This link will 404 until we build the [projectId] page, but is correct */}
                    <Link href={`/projects/${project.id}`}>
                      View Project <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-9 w-9">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will delete the project "{project.title}". 
                          The items inside it (documents, quizzes, etc.) will NOT be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className={cn(buttonVariants({ variant: 'destructive' }))}
                          disabled={isDeleting}
                          onClick={() => handleDeleteProject(project.id, project.title)}
                        >
                          {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Delete Project
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </>
  );
}