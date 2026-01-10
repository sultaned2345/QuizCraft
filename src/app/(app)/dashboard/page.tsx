'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  FileText, 
  Clock, 
  MoreVertical, 
  Loader2,
  Sparkles,
  BookOpen,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { AddDocumentDialog } from '@/components/AddDocumentDialog';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

export default function Dashboard() {
  const { session } = useAuth();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Documents (Study Sets)
  const { data: documents, error, isLoading } = useSWR(
    session ? '/api/documents' : null,
    (url) => fetcher(url, session?.access_token || '')
  );

  // FIX: Ensure documents.data is actually an array before filtering.
  // API might return an error object or unexpected structure.
  const safeDocs = Array.isArray(documents?.data) ? documents.data : [];

  const filteredDocs = safeDocs.filter((doc: any) => 
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 animate-fade-in-up">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">My Workspace</h1>
            <p className="text-muted-foreground">
              Manage your AI-generated study sets.
            </p>
          </div>
          
          <AddDocumentDialog>
            <Button size="lg" className="shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
              <Plus className="w-5 h-5 mr-2" />
              New Study Set
            </Button>
          </AddDocumentDialog>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 sticky top-16 z-20 bg-background/80 backdrop-blur-md py-2 -mx-2 px-2 rounded-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search documents..." 
              className="pl-9 bg-muted/50 border-transparent focus:bg-background transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border border-border/50">
             <Button 
               variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
               size="sm" 
               onClick={() => setViewMode('grid')}
               className="h-8 w-8 p-0"
             >
               <LayoutGrid className="w-4 h-4" />
             </Button>
             <Button 
               variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
               size="sm" 
               onClick={() => setViewMode('list')}
               className="h-8 w-8 p-0"
             >
               <ListIcon className="w-4 h-4" />
             </Button>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[1,2,3].map(i => (
               <div key={i} className="h-48 rounded-xl bg-muted/20 animate-pulse border border-border/50" />
             ))}
          </div>
        ) : filteredDocs.length > 0 ? (
          <div className={
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
              : "flex flex-col gap-3"
          }>
            {filteredDocs.map((doc: any) => (
              <DocumentCard key={doc.id} doc={doc} viewMode={viewMode} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-muted-foreground/20 rounded-xl bg-muted/5">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No documents found</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              Upload a PDF or paste a YouTube link to generate your first AI study set.
            </p>
            <AddDocumentDialog />
          </div>
        )}
      </main>
    </div>
  );
}