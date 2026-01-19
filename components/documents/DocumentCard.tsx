// components/documents/DocumentCard.tsx
'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { 
  FileText, 
  MoreVertical, 
  Clock, 
  CheckCircle2, 
  BookOpen, 
  Layers, 
  Cpu, 
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface DocumentCardProps {
  doc: any;
  viewMode?: 'grid' | 'list'; // FIX: Made optional
  onDelete?: (id: string) => void; // FIX: Added onDelete prop
}

export function DocumentCard({ doc, viewMode = 'grid', onDelete }: DocumentCardProps) {
  const isProcessing = doc.processing_status === 'processing' || doc.processing_status === 'pending';
  const isFailed = doc.processing_status === 'failed';

  // Determine Icon based on type
  const isPdf = doc.file_type?.includes('pdf');
  const Icon = isPdf ? FileText : Cpu;

  if (viewMode === 'list') {
    return (
      <div className="group flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/30 hover:border-primary/20 transition-all shadow-sm">
        <div className={cn("p-2 rounded-md", isProcessing ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary")}>
          <Icon className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <Link href={`/documents/${doc.id}`} className="hover:underline focus:underline outline-none">
            <h3 className="font-semibold truncate">{doc.file_name}</h3>
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
             <span className="flex items-center gap-1">
               <Clock className="w-3 h-3" />
               {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
             </span>
             {isProcessing && <Badge variant="secondary" className="text-[10px] h-4">Processing</Badge>}
          </div>
        </div>

        {/* Asset Indicators (Mini) */}
        <div className="hidden sm:flex items-center gap-2 mr-4">
           {/* We can check if related objects exist if passed in props, for now simplified */}
        </div>

        <Link href={`/documents/${doc.id}`}>
          <Button variant="outline" size="sm">Open</Button>
        </Link>
        
        {/* List View Menu - Added Delete */}
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(doc.id);
                  }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
    );
  }

  // GRID VIEW
  return (
    <div className="group relative flex flex-col h-full rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:shadow-md hover:border-primary/30 transition-all overflow-hidden">
      {/* Top Decoration */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
            isProcessing ? "bg-amber-500/10 text-amber-500 animate-pulse" : 
            isFailed ? "bg-red-500/10 text-red-500" : 
            "bg-primary/10 text-primary"
          )}>
            {isProcessing ? <Cpu className="w-5 h-5" /> : 
             isFailed ? <AlertCircle className="w-5 h-5" /> :
             <Icon className="w-5 h-5" />}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(doc.id);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Link href={`/documents/${doc.id}`} className="flex-1 block group-hover:text-primary transition-colors outline-none">
          <h3 className="font-bold text-lg mb-2 line-clamp-2 leading-tight">
            {doc.file_name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 h-10">
            {doc.ai_summary || "AI-generated study set including notes, quiz, and flashcards."}
          </p>
        </Link>
      </div>

      {/* Footer / Asset Badges */}
      <div className="px-5 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {formatDistanceToNow(new Date(doc.created_at))} ago
        </span>
        
        {/* Visual indicators of what's inside */}
        <div className="flex gap-2">
           <div className="flex items-center gap-1" title="Notes">
             <BookOpen className="w-3.5 h-3.5" />
           </div>
           <div className="flex items-center gap-1" title="Quiz">
             <CheckCircle2 className="w-3.5 h-3.5" />
           </div>
           <div className="flex items-center gap-1" title="Cards">
             <Layers className="w-3.5 h-3.5" />
           </div>
        </div>
      </div>
    </div>
  );
}