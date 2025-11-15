// src/app/(app)/documents/page.tsx
import { Suspense } from 'react';
import { DocumentsClientComponent } from './DocumentsClientComponent';
import DocumentsLoading from './loading'; // We still use this for the initial load

export const dynamic = 'force-dynamic';

// --- Server-Side Data Fetching Function (REMOVED) ---
// async function getInitialDocuments(userId: string, page: number = 1, limit: number = 9): Promise<PaginatedDocumentsData> { ... }

// --- The Page Component (Server Component) ---
export default async function DocumentsPage() {
  // No session or data fetching here.
  // This component just sets up the Suspense boundary.
  
  return (
    <Suspense fallback={<DocumentsLoading />}>
      {/* Render the Client Component. 
        It will no longer receive initialData and will
        fetch its own data using useSWR.
      */}
      <DocumentsClientComponent />
    </Suspense>
  );
}