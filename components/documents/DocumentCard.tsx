// components/documents/DocumentCard.tsx
'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { 
  MoreHorizontal, 
  FileText, 
  File, 
  Youtube, 
  Trash2, 
  ArrowUpRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface DocumentCardProps {
  doc: any; // Using 'any' briefly to match your DB types, ideally import { Document } from types
  onDelete: (id: string) => void;
}

export function DocumentCard({ doc, onDelete }: DocumentCardProps) {
  // Determine icon and color based on file type
  const isYoutube = doc.file_type === 'youtube';
  const isPdf = doc.file_name?.toLowerCase().endsWith('.pdf');
  
  const Icon = isYoutube ? Youtube : isPdf ? FileText : File;
  const iconColor = isYoutube ? 'text-red-400' : isPdf ? 'text-orange-400' : 'text-zinc-400';
  const bgColor = isYoutube ? 'bg-red-400/10' : isPdf ? 'bg-orange-400/10' : 'bg-zinc-800/50';

  return (
    <div className="group relative flex flex-col gap-0 rounded-xl border border-white/5 bg-zinc-900/40 transition-all hover:bg-zinc-900/80 hover:border-white/10 hover:shadow-2xl overflow-hidden">
      
      {/* 1. Top Section: Visual Icon/Preview */}
      <Link href={`/documents/${doc.id}`} className="relative h-32 w-full bg-white/[0.02] border-b border-white/5 flex items-center justify-center group-hover:bg-white/[0.04] transition-colors">
        <div className={`h-12 w-12 rounded-xl ${bgColor} ${iconColor} flex items-center justify-center border border-white/5 shadow-sm`}>
           <Icon className="w-6 h-6" />
        </div>
        
        {/* Hover Action: "Open" */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <div className="bg-black/50 backdrop-blur-md rounded-full p-1.5 border border-white/10 text-white">
              <ArrowUpRight className="w-3.5 h-3.5" />
           </div>
        </div>
      </Link>

      {/* 2. Bottom Section: Info */}
      <div className="flex flex-col p-4 gap-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/documents/${doc.id}`} className="flex-1 min-w-0">
             <h3 className="font-semibold text-sm text-zinc-200 truncate group-hover:text-white transition-colors">
               {doc.file_name}
             </h3>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-2 -mt-1 text-zinc-500 hover:text-zinc-200"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-zinc-950 border-white/10">
              <DropdownMenuItem 
                onClick={() => onDelete(doc.id)}
                className="text-red-400 focus:text-red-300 focus:bg-red-950/30 font-mono text-xs"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                DELETE FILE
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 mt-2">
           <Badge variant="outline" className="rounded-md border-white/5 bg-white/5 text-[10px] text-zinc-400 px-1.5 py-0 font-mono font-normal">
              {isYoutube ? 'VIDEO' : 'DOC'}
           </Badge>
           <span className="text-[10px] text-zinc-500 font-mono">
             {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
           </span>
        </div>
      </div>
    </div>
  );
}