// src/app/(app)/documents/page.tsx
'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { 
  Search, 
  Filter, 
  FileText, 
  BrainCircuit, 
  StickyNote, 
  Layers, 
  Loader2, 
  Plus,
  MoreVertical,
  Calendar,
  Trash2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddDocumentDialog } from '@/components/AddDocumentDialog';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null); // null = all
  
  // Debounce search could be added here, currently just passing query directly for simplicity
  const { data, isLoading, mutate } = useSWR(
    `/api/library?q=${searchQuery}${activeFilter ? `&type=${activeFilter}` : ''}`, 
    fetcher
  );

  const content = data?.data || [];

  const filters = [
    { id: null, label: 'All', icon: null },
    { id: 'document', label: 'Documents', icon: FileText },
    { id: 'quiz', label: 'Quizzes', icon: BrainCircuit },
    { id: 'note', label: 'Notes', icon: StickyNote },
    { id: 'deck', label: 'Flashcards', icon: Layers },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'quiz': return <BrainCircuit className="w-5 h-5 text-purple-500" />;
      case 'note': return <StickyNote className="w-5 h-5 text-yellow-500" />;
      case 'deck': return <Layers className="w-5 h-5 text-green-500" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getUrl = (item: any) => {
    switch (item.type) {
      case 'document': return `/documents/${item.id}`;
      case 'quiz': return `/quiz/${item.id}`;
      case 'note': return `/notes/${item.id}`;
      case 'deck': return `/flashcards/${item.id}`; // Assuming deck page
      default: return '#';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-7xl animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Library</h1>
          <p className="text-muted-foreground mt-1">Manage all your study materials in one place.</p>
        </div>
        <AddDocumentDialog onUploadSuccess={() => mutate()} />
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-card/50 p-2 rounded-xl border border-border/40 backdrop-blur-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search title..." 
            className="pl-9 bg-background/50 border-transparent focus:border-primary transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-1 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          {filters.map((f) => {
            const Icon = f.icon;
            return (
              <Button
                key={f.label}
                variant={activeFilter === f.id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveFilter(f.id)}
                className={`gap-2 rounded-full px-4 ${activeFilter === f.id ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground'}`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {f.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your library...</p>
        </div>
      ) : content.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border/50 rounded-xl bg-muted/5">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-semibold">No content found</h3>
          <p className="text-muted-foreground mb-6">
            {searchQuery ? "Try adjusting your search or filters." : "Upload a document to get started!"}
          </p>
          {!searchQuery && <AddDocumentDialog onUploadSuccess={() => mutate()} />}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {content.map((item: any) => (
            <div 
              key={`${item.type}-${item.id}`}
              className="group relative flex flex-col bg-card border border-border/50 rounded-xl hover:shadow-md transition-all duration-200 hover:-translate-y-1 overflow-hidden"
            >
              <Link href={getUrl(item)} className="absolute inset-0 z-0" />
              
              <div className="p-4 flex items-start justify-between gap-3 relative z-10 pointer-events-none">
                <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                  {getIcon(item.type)}
                </div>
                {/* Actions Dropdown */}
                <div className="pointer-events-auto">
                   <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="px-4 pb-4 flex-1 flex flex-col pointer-events-none">
                <h3 className="font-semibold text-base line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                
                <div className="mt-auto pt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="capitalize bg-muted px-2 py-0.5 rounded-md font-medium">
                    {item.type}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}