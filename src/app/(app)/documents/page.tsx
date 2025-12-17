// src/app/(app)/documents/page.tsx
import { Suspense } from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/getServerSession';
import { prisma } from '@/lib/prisma';
import DocumentsClientComponent from './DocumentsClientComponent';
import { AddDocumentDialog } from '@/components/AddDocumentDialog'; // Import the new component
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Documents - QuizCraft',
  description: 'Manage your uploaded documents and study materials.',
};

export default async function DocumentsPage() {
  const session = await getServerSession();

  if (!session || !session.user) {
    redirect('/login');
  }

  // Fetch documents
  const documents = await prisma.documents.findMany({
    where: {
      user_id: session.user.id,
    },
    orderBy: {
      created_at: 'desc',
    },
    select: {
      id: true,
      file_name: true,
      file_type: true,
      created_at: true,
      file_size: true,
      // We don't need extracted_text for the list view to keep it light
    },
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Library</h1>
          <p className="text-muted-foreground mt-1">
            Manage your PDFs, notes, and video transcripts.
          </p>
        </div>
        
        {/* NEW: Replaces standard button with the Dialog */}
        <AddDocumentDialog>
           <Button className="shadow-lg hover:shadow-xl transition-all">
              <Plus className="w-4 h-4 mr-2" /> Add New Document
           </Button>
        </AddDocumentDialog>
      </div>

      <Suspense fallback={<div className="text-center py-10">Loading documents...</div>}>
        <DocumentsClientComponent initialDocuments={documents as any} />
      </Suspense>
    </div>
  );
}