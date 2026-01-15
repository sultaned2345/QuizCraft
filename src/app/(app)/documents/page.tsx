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
  MoreVertical,
  Trash2,
  Archive,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
// ❌ REMOVED: AddDocumentDialog import

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); // Default to List for Archive
  const { toast } = useToast();
  
  const { data, isLoading, mutate } = useSWR(
    `/api/library?q=${searchQuery}${activeFilter ? `&type=${activeFilter}` : ''}`, 
    fetcher
  );

  const content = data?.data || [];

  const handleDelete = async (e: React.MouseEvent, type: string, id: string) => {
    e.preventDefault();
    if (!confirm('Permanently delete this item?')) return;

    try {
      const endpoint = type === 'document' 
        ? `/api/documents/${id}` 
        : `/api/${type === 'deck' ? 'decks' : type === 'quiz' ? 'quiz' : 'notes'}/${id}`;
        
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      toast({ title: 'Deleted', description: 'Item removed from library.' });
      mutate();
    } catch (err) {
      toast({ title: 'Error', description: 'Could not delete item.', variant: 'destructive' });
    }
  };

  const filters = [
    { id: null, label: 'All', icon: null },
    { id: 'document', label: 'Documents', icon: FileText },
    { id: 'quiz', label: 'Quizzes', icon: BrainCircuit },
    { id: 'note', label: 'Notes', icon: StickyNote },
    { id: 'deck', label: 'Flashcards', icon: Layers },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText className="w-4 h-4 text-blue-500" />;
      case 'quiz': return <BrainCircuit className="w-4 h-4 text-purple-500" />;
      case 'note': return <StickyNote className="w-4 h-4 text-yellow-500" />;
      case 'deck': return <Layers className="w-4 h-4 text-green-500" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getUrl = (item: any) => {
    switch (item.type) {
      case 'document': return `/documents/${item.id}`;
      case 'quiz': return `/quiz/${item.id}`;
      case 'note': return `/notes/${item.id}`;
      case 'deck': return `/flashcards/${item.id}`;
      default: return '#';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-[1600px] h-full flex flex-col animate-in fade-in duration-500">
      
      {/* 1. Archive Header (No Upload Button) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Archive className="w-6 h-6 text-muted-foreground" />
            Library Archive
          </h1>
          <p className="text-sm text-muted-foreground">
            View and manage your entire history of materials.
          </p>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-muted/20 p-3 rounded-lg border border-border">
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto flex-1">
            <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                    placeholder="Search archive..." 
                    className="pl-9 bg-background h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <div className="flex gap-1 overflow-x-auto w-full sm:w-auto no-scrollbar">
            {filters.map((f) => (
                <Button
                key={f.label || 'all'}
                variant={activeFilter === f.id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveFilter(f.id)}
                className={`h-9 px-3 text-xs ${activeFilter === f.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                >
                {f.label}
                </Button>
            ))}
            </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-background rounded-md border p-0.5 shrink-0">
            <Button 
                variant="ghost" 
                size="sm" 
                className={`h-7 px-2 ${viewMode === 'grid' ? 'bg-muted shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setViewMode('grid')}
            >
                <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button 
                variant="ghost" 
                size="sm" 
                className={`h-7 px-2 ${viewMode === 'list' ? 'bg-muted shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setViewMode('list')}
            >
                <ListIcon className="w-4 h-4" />
            </Button>
        </div>
      </div>

      {/* 3. Content Display */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading archive...</p>
        </div>
      ) : content.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border/50 rounded-xl bg-muted/5">
          <Filter className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Archive is empty</h3>
          <p className="text-muted-foreground text-sm">
             Go to <Link href="/dashboard" className="text-primary hover:underline">Dashboard</Link> to create content.
          </p>
        </div>
      ) : (
        <>
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {content.map((item: any) => (
                    <div 
                    key={`${item.type}-${item.id}`}
                    className="group relative flex flex-col bg-card border border-border rounded-lg hover:shadow-md transition-all duration-200 overflow-hidden"
                    >
                    <Link href={getUrl(item)} className="absolute inset-0 z-0" />
                    <div className="p-4 flex flex-col h-full">
                        <div className="flex justify-between items-start mb-3">
                            <div className="p-2 rounded-md bg-muted/50 border border-border/50">
                                {getIcon(item.type)}
                            </div>
                            <div className="pointer-events-auto relative z-10">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                        <MoreVertical className="w-4 h-4" />
                                    </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => handleDelete(e, item.type, item.id)} className="text-destructive focus:text-destructive">
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                        <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                            {item.title}
                        </h3>
                        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
                            <span className="capitalize">{item.type}</span>
                            <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                        </div>
                    </div>
                    </div>
                ))}
                </div>
            ) : (
                <div className="bg-card border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
                        <div className="col-span-6 md:col-span-5 pl-2">Title</div>
                        <div className="col-span-3 md:col-span-2">Type</div>
                        <div className="col-span-3 hidden md:block">Date Added</div>
                        <div className="col-span-3 md:col-span-2 text-right pr-4">Actions</div>
                    </div>
                    {content.map((item: any) => (
                        <div key={`${item.type}-${item.id}`} className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-muted/30 border-b last:border-0 transition-colors group">
                            <div className="col-span-6 md:col-span-5 flex items-center gap-3 pl-2 overflow-hidden">
                                {getIcon(item.type)}
                                <Link href={getUrl(item)} className="font-medium text-sm truncate hover:text-primary hover:underline underline-offset-4">
                                    {item.title}
                                </Link>
                            </div>
                            <div className="col-span-3 md:col-span-2">
                                <Badge variant="outline" className="capitalize text-xs font-normal">
                                    {item.type}
                                </Badge>
                            </div>
                            <div className="col-span-3 hidden md:block text-xs text-muted-foreground">
                                {new Date(item.created_at).toLocaleDateString()}
                            </div>
                            <div className="col-span-3 md:col-span-2 flex justify-end pr-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                        <MoreVertical className="w-4 h-4" />
                                    </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => handleDelete(e, item.type, item.id)} className="text-destructive">
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
      )}
    </div>
  );
}