import { Suspense } from 'react';
import { DocumentsClientComponent } from './DocumentsClientComponent';
import { AddDocumentDialog } from '@/components/AddDocumentDialog';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function DocumentsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl h-full flex flex-col">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Library</h1>
          <p className="text-muted-foreground mt-1">
            Manage your PDFs, notes, and video transcripts.
          </p>
        </div>
        
        {/* The New Unified Dialog Button */}
        <AddDocumentDialog />
      </div>

      {/* Content List */}
      <Suspense fallback={
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <DocumentsClientComponent />
      </Suspense>
    </div>
  );
}