// src/components/SmartSearchBar.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, FileText, StickyNote } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

interface SearchResult {
  content_id: string;
  content_type: 'note' | 'document';
  content_title: string;
  content_chunk: string;
  similarity: number;
}

export function SmartSearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.results) {
          setResults(data.results);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full max-w-sm justify-start text-muted-foreground relative">
          <Search className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Search notes & docs...</span>
          <span className="inline sm:hidden">Search...</span>
          <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Smart Search</DialogTitle>
        </DialogHeader>
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground border-none focus-visible:ring-0"
            placeholder="What is the powerhouse of the cell?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
        </div>
        <ScrollArea className="h-[300px] p-4">
          {results.length === 0 && query.length >= 3 && !loading && (
            <p className="text-center text-sm text-muted-foreground pt-10">
              No relevant concepts found.
            </p>
          )}
          {results.length === 0 && query.length < 3 && (
            <p className="text-center text-sm text-muted-foreground pt-10">
              Type a concept, question, or keyword...
            </p>
          )}
          <div className="space-y-2">
            {results.map((result) => (
              <Link
                key={`${result.content_type}-${result.content_id}`}
                href={result.content_type === 'note' ? `/notes/${result.content_id}` : `/documents/${result.content_id}`}
                onClick={handleSelect}
                className="flex flex-col gap-1 rounded-md border p-3 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-2">
                  {result.content_type === 'note' ? (
                    <StickyNote className="h-4 w-4 text-blue-500" />
                  ) : (
                    <FileText className="h-4 w-4 text-orange-500" />
                  )}
                  <span className="font-medium text-sm">{result.content_title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {(result.similarity * 100).toFixed(0)}% match
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {result.content_chunk}
                </p>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}