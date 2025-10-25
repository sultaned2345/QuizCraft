'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ApiResponse } from '@/types/database'; // Base ApiResponse type
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose
} from '@/components/ui/dialog';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import {
    Loader2, Plus, Upload, FileText, Trash2, Eye, Sparkles, FileQuestion, StickyNote, Layers, AlertCircle
} from 'lucide-react';
import { formatFileSize } from '@/lib/file-parser';

// Define DocumentMetadata type based on API response for listing
interface DocumentMetadata {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    created_at: string;
    storage_path: string;
}

// Define the structure of the AI generation response data
interface GeneratedDeckInfo {
    id: string;
    title: string;
}

// Define expected response structure for pagination
interface PaginatedDocumentsData {
  documents: DocumentMetadata[];
  count: number; // Total count of documents for the user
  limit: number | typeof Infinity; // Usage limit for the plan
  totalPages: number;
  currentPage: number;
}


export default function DocumentsPage() {
    const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false); // For loading more
    const [usage, setUsage] = useState<{ count: number | undefined; limit: number | typeof Infinity | undefined }>({ count: 0, limit: 5 });
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewingContent, setViewingContent] = useState<{ title: string; text: string | null }>({ title: '', text: '' });
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [isGenerating, setIsGenerating] = useState< { type: 'quiz' | 'notes' | 'flashcards'; docId: string } | null>(null);

    // --- Pagination State ---
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const documentsPerPage = 9; // Match API default or set desired limit

    const { user, session, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- UPDATED Data Fetching with Pagination ---
    const fetchDocuments = useCallback(async (page = 1, append = false) => {
        if (!session) return;
        if (append) setIsLoadingMore(true); else setIsLoading(true);

        try {
            const response = await fetch(`/api/documents?page=${page}&limit=${documentsPerPage}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data: ApiResponse<PaginatedDocumentsData> = await response.json(); // Use PaginatedDocumentsData

            if (!data.success || !data.data) {
                throw new Error(data.error || 'Failed to load documents.');
            }

            setDocuments(prev => append ? [...prev, ...data.data!.documents] : data.data!.documents);
            setUsage({ count: data.data.count, limit: data.data.limit });
            setCurrentPage(data.data.currentPage);
            setTotalPages(data.data.totalPages);

        } catch (error: any) {
            toast({ title: 'Error Loading Documents', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [session, toast, documentsPerPage]); // Added dependencies

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }
        if (user) {
            fetchDocuments(1, false); // Fetch initial page
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading, router]); // Keep fetchDocuments out here


    const handleLoadMore = () => {
        if (currentPage < totalPages && !isLoadingMore) {
            fetchDocuments(currentPage + 1, true); // Fetch next page and append
        }
    }

    // --- File Handling & Upload (Refetch first page on success) ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // ... (validation logic remains the same)
        const file = e.target.files?.[0];
        if (file) {
            setUploadError('');
            const maxSize = 3 * 1024 * 1024;
             const isValidType = ['.pdf', '.txt'].some(ext => file.name.toLowerCase().endsWith(ext));
            if (!isValidType) { setUploadError("PDF/TXT only."); setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; return; }
             if (file.size > maxSize) { setUploadError(`Max 3MB (${formatFileSize(file.size)}).`); setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; return; }
            setSelectedFile(file);
        } else { setSelectedFile(null); }
    };

    const handleUpload = async () => {
        if (!selectedFile || !session) return;
        setIsUploading(true);
        setUploadError('');
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch('/api/documents', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: formData,
            });
            const result: ApiResponse<DocumentMetadata> = await response.json();
            if (!response.ok || !result.success || !result.data) { throw new Error(result.error || `Upload failed ${response.status}`); }

            toast({ title: 'Upload Successful!', description: `"${result.data.file_name}" added.` });
            setSelectedFile(null);
            if(fileInputRef.current) fileInputRef.current.value = '';
            fetchDocuments(1, false); // Refetch first page
        } catch (error: any) {
            setUploadError(error.message || 'Upload error.');
            toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsUploading(false);
        }
    };

    // --- Document Actions (View Content remains same, Delete refetches first page) ---
    const handleViewContent = async (doc: DocumentMetadata) => {
        // ... (logic remains the same)
        if (!session) return;
        setIsViewerOpen(true); setIsLoadingContent(true); setViewingContent({ title: doc.file_name, text: 'Loading...' });
        try {
            const response = await fetch(`/api/documents/${doc.id}/content`, { headers: { Authorization: `Bearer ${session.access_token}` } });
             const result: ApiResponse<{ extracted_text: string | null; file_name: string }> = await response.json();
             if (!result.success || !result.data) throw new Error(result.error || 'Failed fetch.');
            setViewingContent({ title: result.data.file_name, text: result.data.extracted_text });
        } catch (error: any) { toast({ title: 'Error Fetching', description: error.message, variant: 'destructive' }); setViewingContent({ title: doc.file_name, text: `Error: ${error.message}` }); }
        finally { setIsLoadingContent(false); }
    };

    const handleDeleteDocument = async (docId: string, docName: string) => {
        if (!session || !confirm(`Delete "${docName}"?`)) return;
        try {
            const response = await fetch(`/api/documents/${docId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
            const result: ApiResponse = await response.json();
            if (!result.success) throw new Error(result.error || 'Delete failed.');
            toast({ title: 'Deleted', description: `"${docName}" removed.` });
            fetchDocuments(1, false); // Refetch first page
        } catch (error: any) { toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' }); }
    };

     // --- AI Generation Handlers (Remain the same) ---
     const handleGenerateQuiz = async (docId: string) => {
         if (!session) return;
          setIsGenerating({ type: 'quiz', docId });
          toast({ title: 'Preparing Quiz...', description: 'Fetching content.' });
          try { router.push(`/create?docId=${docId}`); }
          catch (error: any) { toast({ title: 'Failed Prep', description: error.message, variant: 'destructive' }); setIsGenerating(null); }
     };

     const handleGenerateNotes = async (docId: string) => {
         if (!session) return;
         setIsGenerating({ type: 'notes', docId });
         toast({ title: 'Generating Notes...', description: 'AI processing...' });
         try {
             const contentRes = await fetch(`/api/documents/${docId}/content`, { headers: { Authorization: `Bearer ${session.access_token}` } });
             const contentResult: ApiResponse<{ extracted_text: string | null }> = await contentRes.json();
             if (!contentResult.success || !contentResult.data?.extracted_text) throw new Error(contentResult.error || 'Failed fetch content.');

             const genRes = await fetch(`/api/generate-notes`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ text: contentResult.data.extracted_text, number_of_notes: 5 }) });
             const genResult: ApiResponse = await genRes.json();
             if (!genRes.ok || !genResult.success) throw new Error(genResult.error || 'Failed generate.');
             toast({ title: 'Notes Generated!' }); router.push('/notes');
         } catch (error: any) { toast({ title: 'Note Gen Failed', description: error.message, variant: 'destructive' }); }
         finally { setIsGenerating(null); }
     };

     const handleGenerateFlashcards = async (docId: string) => {
         if (!session) return;
         setIsGenerating({ type: 'flashcards', docId });
         toast({ title: 'Generating Flashcards...', description: 'AI processing...' });
         try {
             const response = await fetch(`/api/generate-flashcards`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ documentId: docId, numberOfCards: 15 }) });
             const result: ApiResponse<GeneratedDeckInfo> = await response.json();
             if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Failed generate.');
             toast({ title: 'Flashcards Generated!', description: `Deck "${result.data.title}" created.` });
             router.push(`/flashcards/${result.data.id}`);
         } catch (error: any) { toast({ title: 'Card Gen Failed', description: error.message, variant: 'destructive' }); }
         finally { setIsGenerating(null); }
     };


    // --- Render Logic ---
   if (authLoading || (isLoading && currentPage === 1)) { // Only show full page loader initially
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Header & Upload Section (Remains the same) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Documents</h1>
          {usage.limit !== Infinity && (
              <p className="text-sm text-muted-foreground mt-1">
                  You've uploaded {usage.count ?? 0}/{usage.limit} documents.
              </p>
          )}
        </div>
        <Card className="w-full sm:max-w-md">
             <CardHeader className="pb-2"><CardTitle className="text-lg">Upload New Document</CardTitle></CardHeader>
             <CardContent>
                 <div className="flex flex-col gap-2">
                     <Label htmlFor="file-upload" className="sr-only">Choose file</Label>
                     <Input id="file-upload" type="file" accept=".pdf,.txt" onChange={handleFileChange} ref={fileInputRef} disabled={isUploading} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"/>
                     {selectedFile && <p className="text-xs text-muted-foreground truncate">Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})</p>}
                     {uploadError && <div className="flex items-start gap-2 text-xs text-destructive"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{uploadError}</span></div>}
                     <Button onClick={handleUpload} disabled={!selectedFile || isUploading || (usage.limit !== Infinity && (usage.count ?? 0) >= (usage.limit ?? Infinity))} className="mt-2 w-full sm:w-auto" size="sm">
                         {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} {isUploading ? 'Uploading...' : 'Upload'}
                      </Button>
                      {usage.limit !== Infinity && (usage.count ?? 0) >= (usage.limit ?? Infinity) && <p className="text-xs text-destructive mt-1">Limit reached.</p>}
                 </div>
             </CardContent>
        </Card>
      </div>

       {/* Document List or Empty State */}
        {documents.length === 0 && !isLoading ? (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No Documents Yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Upload your first PDF or TXT file.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
                <Card key={doc.id} className="flex flex-col">
                    <CardHeader className="flex-row items-start justify-between gap-4 pb-2">
                        <div className="space-y-1 overflow-hidden">
                             <CardTitle className="text-base truncate" title={doc.file_name}>{doc.file_name}</CardTitle>
                             <CardDescription className="text-xs">{doc.file_type} &bull; {formatFileSize(doc.file_size)}</CardDescription>
                             <CardDescription className="text-xs">Uploaded: {new Date(doc.created_at).toLocaleDateString()}</CardDescription>
                        </div>
                         <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDeleteDocument(doc.id, doc.file_name)} disabled={isGenerating?.docId === doc.id}>
                             <Trash2 className="w-4 h-4 text-destructive" /> <span className="sr-only">Delete</span>
                         </Button>
                    </CardHeader>
                    <CardContent className="flex-grow">{/* Placeholder */}</CardContent>
                    <CardFooter className="flex flex-col items-stretch gap-2 pt-2">
                         <Button variant="outline" size="sm" onClick={() => handleViewContent(doc)} disabled={isGenerating?.docId === doc.id}>
                             <Eye className="w-4 h-4 mr-2" /> View Content
                         </Button>
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                             <Button title="Generate Quiz" variant="secondary" size="sm" onClick={() => handleGenerateQuiz(doc.id)} disabled={isGenerating?.docId === doc.id}>
                                {isGenerating?.type === 'quiz' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileQuestion className="w-4 h-4" />} <span className="ml-1 sm:ml-0 sm:sr-only">Quiz</span>
                             </Button>
                             <Button title="Generate Notes" variant="secondary" size="sm" onClick={() => handleGenerateNotes(doc.id)} disabled={isGenerating?.docId === doc.id}>
                                  {isGenerating?.type === 'notes' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <StickyNote className="w-4 h-4" />} <span className="ml-1 sm:ml-0 sm:sr-only">Notes</span>
                             </Button>
                             <Button title="Generate Flashcards" variant="secondary" size="sm" onClick={() => handleGenerateFlashcards(doc.id)} disabled={isGenerating?.docId === doc.id}>
                                 {isGenerating?.type === 'flashcards' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Layers className="w-4 h-4" />} <span className="ml-1 sm:ml-0 sm:sr-only">Cards</span>
                             </Button>
                         </div>
                    </CardFooter>
                </Card>
            ))}
            </div>
        )}

        {/* Load More Button */}
        {totalPages > currentPage && !isLoading && (
            <div className="mt-8 text-center">
                <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                >
                    {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Load More Documents
                </Button>
            </div>
        )}

      {/* Content Viewer Dialog (Remains the same) */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="truncate">Content: {viewingContent.title}</DialogTitle>
                <DialogDescription>Extracted text from the document.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden pr-1">
                 <ScrollArea className="h-full max-h-[60vh] pr-3 border rounded-md p-4">
                     {isLoadingContent ? <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : <pre className="text-sm whitespace-pre-wrap break-words">{viewingContent.text || "No text extracted or empty."}</pre>}
                </ScrollArea>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Close</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}