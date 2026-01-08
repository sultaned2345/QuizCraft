// components/projects/ProjectCard.tsx
'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Folder, Clock, ArrowRight } from 'lucide-react';
import { Project } from '@/types/database';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  // Generate a consistent gradient based on the project ID (deterministic)
  const gradients = [
    'from-zinc-800 to-zinc-900',
    'from-slate-800 to-zinc-900',
    'from-neutral-800 to-stone-900',
  ];
  const gradient = gradients[project.id.charCodeAt(0) % gradients.length];

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-white/5 bg-zinc-900/40 p-1 transition-all hover:bg-zinc-900/80 hover:border-white/10 hover:shadow-2xl">
      {/* 1. Visual Cover (Minimal) */}
      <Link
        href={`/projects/${project.id}`}
        className={`relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-gradient-to-br ${gradient} transition-all`}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 text-white font-medium text-sm">
                Open Project <ArrowRight className="w-4 h-4" />
            </div>
        </div>
        
        {/* Fallback Icon if no image (kept subtle) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:opacity-0 transition-opacity">
           <Folder className="w-12 h-12 text-white" />
        </div>
      </Link>

      {/* 2. Metadata */}
      <div className="flex flex-col gap-1 px-2 pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/projects/${project.id}`} className="flex-1 min-w-0">
            <h3 className="font-semibold text-zinc-100 truncate group-hover:text-white transition-colors">
              {project.title}
            </h3>
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-2 text-zinc-500 hover:text-zinc-200"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-zinc-950 border-white/10">
              <DropdownMenuItem 
                onClick={() => onDelete(project.id)}
                className="text-red-400 focus:text-red-300 focus:bg-red-950/30"
              >
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
           <span className="flex items-center gap-1">
             <Clock className="w-3 h-3" />
             {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
           </span>
           {/* You can add item counts here later if available in data */}
           {/* <span>• 3 Files</span> */}
        </div>
      </div>
    </div>
  );
}