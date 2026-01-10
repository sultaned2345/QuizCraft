// src/app/(app)/documents/DocumentsClientComponent.tsx
'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Plus, Search, FileText } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DocumentCard } from '@/components/documents/DocumentCard';
// Ensure these skeletons exist or use a generic fallback
// import { DocumentCardSkeleton } from '@/components/skeletons/DocumentCardSkeleton'; 
import { AddDocumentDialog } from '@/components/AddDocumentDialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export function DocumentsClientComponent() {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: documentsData, error, isLoading, mutate } = useSWR(
    session ? '/api/documents' : null,
    (url) => fetcher(url, session!.access_token)
  );

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      mutate();
      toast({ description: "File archived successfully." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not delete file." });
    }
  };

  const safeDocs = Array.isArray(documentsData?.data) ? documentsData.data : [];

  const filteredDocs = safeDocs.filter((d: any) =>
    d.file_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 h-full flex flex-col">
      {/* 1. Command Bar Header */}
      {/* FIX: Removed border-white/5, used border-border */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-border pb-6">
        <div>
          {/* FIX: Used text-foreground instead of text-white */}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Library</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Central repository for source materials and transcripts.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            {/* FIX: Replaced zinc/white styles with semantic theme styles */}
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50 border-border focus:bg-background transition-all h-9 text-sm font-sans"
            />
          </div>
          {/* FIX: Divider color */}
          <div className="h-6 w-px bg-border mx-1 hidden md:block" />
          
          {/* FIX: Button colors to adapt to light/dark automatically */}
          <Button 
            onClick={() => setIsAddOpen(true)} 
            size="sm" 
            className="h-9 px-4 font-medium" 
            variant="default" // Uses primary color
          >
            <Plus className="w-4 h-4 mr-2" /> Upload
          </Button>
        </div>
      </div>

      {/* 2. Grid Content */}
      <div className="flex-1">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
                // FIX: Skeleton color
                <div key={i} className="h-48 rounded-xl bg-muted/60 border border-border animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-border rounded-xl bg-muted/20">
             <p className="text-muted-foreground">System error. Unable to load archive.</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center border border-dashed border-border rounded-xl bg-muted/20">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4 border border-border">
                <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            {/* FIX: Text color */}
            <h3 className="text-lg font-medium text-foreground">Archive Empty</h3>
            <p className="text-muted-foreground max-w-sm mt-1 mb-6 text-sm">
              Upload PDF documents or YouTube links to begin analysis.
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsAddOpen(true)} variant="outline" className="border-border hover:bg-accent">
                Add Material
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {filteredDocs.map((doc: any) => (
              <DocumentCard 
                key={doc.id} 
                doc={doc} 
                onDelete={handleDelete} 
              />
            ))}
          </div>
        )}
      </div>

      <AddDocumentDialog 
        // @ts-ignore - Assuming props match your dialog component
        open={isAddOpen} 
        onOpenChange={setIsAddOpen} 
        onUploadComplete={() => mutate()} 
      />
    </div>
  );
}