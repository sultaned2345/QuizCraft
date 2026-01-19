'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Plus, Search, Filter, Folder } from 'lucide-react';
import { Project } from '@/types/database';
import { fetcher } from '@/lib/fetcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectCardSkeleton } from '@/components/skeletons/ProjectCardSkeleton';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function ProjectsPage() {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // FIX: Explicitly typed 'url' as string and added generic to 'fetcher'
  const { data: projectsData, error, isLoading, mutate } = useSWR<{ data: Project[] }>(
    session ? '/api/projects' : null,
    (url: string) => fetcher<Project[]>(url, { 
      headers: { Authorization: `Bearer ${session?.access_token}` } 
    })
  );

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      mutate();
      toast({ description: "Project deleted." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete project." });
    }
  };

  const filteredProjects = projectsData?.data?.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8 h-full flex flex-col">
      {/* 1. The Header (Command Bar) */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your study collections and assignments.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-900/50 border-white/10 focus:bg-zinc-900 transition-all h-9 text-sm"
            />
          </div>
          <div className="h-6 w-px bg-white/10 mx-1 hidden md:block" />
          <Button 
            onClick={() => setIsCreateOpen(true)} 
            size="sm" 
            className="h-9 bg-white text-black hover:bg-zinc-200 font-medium px-4"
          >
            <Plus className="w-4 h-4 mr-2" /> New Project
          </Button>
        </div>
      </div>

      {/* 2. The Content Area */}
      <div className="flex-1">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => <ProjectCardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-white/10 rounded-xl bg-zinc-900/20">
             <p className="text-muted-foreground">Failed to load projects.</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center border border-dashed border-white/10 rounded-xl bg-zinc-900/20">
            <div className="h-12 w-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4 border border-white/5">
                <Folder className="w-5 h-5 text-zinc-500" />
            </div>
            <h3 className="text-lg font-medium text-white">No projects found</h3>
            <p className="text-muted-foreground max-w-sm mt-1 mb-6 text-sm">
              {searchQuery ? "Try adjusting your search query." : "Create your first project to start organizing your study materials."}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateOpen(true)} variant="outline" className="border-white/10 hover:bg-white/5">
                Create Project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredProjects.map((project) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                onDelete={handleDelete} 
              />
            ))}
          </div>
        )}
      </div>

      <CreateProjectDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        onProjectCreated={() => mutate()} 
      />
    </div>
  );
}