'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ApiResponse } from '@/types/database'; // Assuming Document type is defined here
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
import { formatFileSize, validateFileType } from '@/lib/file-parser'; // Reuse utilities

// Define Document type based on API response for listing
interface DocumentMetadata {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    created_at: string;
    storage_path: string;
}

export default function DocumentsPage() {
    const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [usage, setUsage] = useState<{ count: number | undefined; limit: number | typeof Infinity | undefined }>({ count: 0, limit: 5 }); // Default free limit
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewingContent, setViewingContent] = useState<{ title: string; text: string | null }>({ title: '', text: '' });
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    // State for AI generation dialog/modal (optional)
    const [isGenerating, setIsGenerating] = useState< { type: 'quiz' | 'notes' | 'flashcards'; docId: string } | null>(null);


    const { user, session, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Data Fetching ---
    const fetchDocuments = useCallback(async () => {
        if (!session) return;
        setIsLoading(true);
        try {
            const response = await fetch('/api/documents', {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data: ApiResponse<{ documents: DocumentMetadata[]; count: number | undefined; limit: number | typeof Infinity | undefined }> = await response.json();
            if (!data.success || !data.data) throw new Error(data.error || 'Failed to load documents.');
            setDocuments(data.data.documents);
            setUsage({ count: data.data.count, limit: data.data.limit });
        } catch (error: any) {
            toast({ title: 'Error Loading Documents', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [session, toast]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }
        if (user) {
            fetchDocuments();
        }
    }, [user, authLoading, router, fetchDocuments]); // Added fetchDocuments to deps

    // --- File Handling & Upload ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadError(''); // Clear previous errors
            // Validate type and size on client-side first
            const maxSize = 3 * 1024 * 1024; // 3MB
             const isValidType = ['.pdf', '.txt'].some(ext => file.name.toLowerCase().endsWith(ext)); // Basic extension check

            if (!isValidType) {
                 setUploadError("Invalid file type. Only PDF and TXT allowed.");
                 setSelectedFile(null);
                 if(fileInputRef.current) fileInputRef.current.value = ''; // Reset input
                 return;
            }
             if (file.size > maxSize) {
                 setUploadError(`File exceeds 3MB limit (${formatFileSize(file.size)}).`);
                 setSelectedFile(null);
                  if(fileInputRef.current) fileInputRef.current.value = ''; // Reset input
                 return;
             }
            setSelectedFile(file);
        } else {
             setSelectedFile(null);
        }
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
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    // Content-Type is set automatically by browser for FormData
                },
                body: formData,
            });
            const result: ApiResponse<DocumentMetadata> = await response.json();

            if (!response.ok || !result.success || !result.data) {
                 throw new Error(result.error || `Upload failed with status ${response.status}`);
            }

            toast({ title: 'Upload Successful!', description: `"${result.data.file_name}" added.` });
            setSelectedFile(null); // Clear selection
            if(fileInputRef.current) fileInputRef.current.value = ''; // Reset input field
            fetchDocuments(); // Refresh list
        } catch (error: any) {
            console.error("Upload error:", error);
            setUploadError(error.message || 'An unknown error occurred during upload.');
            toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsUploading(false);
        }
    };

    // --- Document Actions ---
    const handleViewContent = async (doc: DocumentMetadata) => {
        if (!session) return;
        setIsViewerOpen(true);
        setIsLoadingContent(true);
        setViewingContent({ title: doc.file_name, text: 'Loading content...' });
        try {
            const response = await fetch(`/api/documents/${doc.id}/content`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
             const result: ApiResponse<{ extracted_text: string | null; file_name: string }> = await response.json();
             if (!result.success || !result.data) {
                 throw new Error(result.error || 'Failed to fetch content.');
             }
            setViewingContent({ title: result.data.file_name, text: result.data.extracted_text });
        } catch (error: any) {
             toast({ title: 'Error Fetching Content', description: error.message, variant: 'destructive' });
             setViewingContent({ title: doc.file_name, text: `Error: ${error.message}` });
        } finally {
            setIsLoadingContent(false);
        }
    };

    const handleDeleteDocument = async (docId: string, docName: string) => {
        if (!session || !confirm(`Are you sure you want to delete "${docName}"? This cannot be undone.`)) return;
        // Optionally add a loading state specific to the item being deleted
        try {
            const response = await fetch(`/api/documents/${docId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const result: ApiResponse = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to delete document.');
            toast({ title: 'Document Deleted', description: `"${docName}" removed.` });
            fetchDocuments(); // Refresh list
        } catch (error: any) {
             toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' });
        }
    };

     // --- AI Generation Handlers (Placeholders/Navigation for MVP) ---
     const handleGenerateQuiz = async (docId: string) => {
         // Option 1: Navigate to create page, passing docId to pre-fill
         toast({ title: 'Redirecting...', description: 'Fetching content to generate quiz.' });
         // Fetch content first, then redirect with content in state or query param (can be large!)
         // Or modify /create page to accept docId and fetch content itself.
         // Let's use the simpler redirect for now, assuming /create can handle a potential docId param.
         router.push(`/create?docId=${docId}`); // /create page needs to handle this
     };

     const handleGenerateNotes = async (docId: string) => {
         // Option 2: Trigger API directly (Example, requires /api/generate-notes to accept docId)
         if (!session) return;
         setIsGenerating({ type: 'notes', docId }); // Show loading state
         toast({ title: 'Generating Notes...', description: 'AI is processing the document.' });
         try {
             // We need an API route like POST /api/generate-notes?docId=...
             // For now, let's assume it exists and handles fetching the text.
             // const response = await fetch(`/api/generate-notes?docId=${docId}`, { // Needs implementation
             //     method: 'POST',
             //     headers: { Authorization: `Bearer ${session.access_token}` },
             //     body: JSON.stringify({ number_of_notes: 5 }) // Example config
             // });
             // const result = await response.json();
             // if (!result.success) throw new Error(result.error);
             // toast({ title: 'Notes Generated!', description: `Notes created from document.` });
             // router.push('/notes'); // Navigate to notes page
             alert('AI Note Generation from Document - API Endpoint Not Implemented Yet'); // Placeholder
         } catch (error: any) {
             toast({ title: 'Note Generation Failed', description: error.message, variant: 'destructive' });
         } finally {
             setIsGenerating(null);
         }
     };

     const handleGenerateFlashcards = async (docId: string) => {
         if (!session) return;
         setIsGenerating({ type: 'flashcards', docId });
         toast({ title: 'Generating Flashcards...', description: 'AI is processing the document.' });
         try {
             // Call the new API endpoint (requires implementation)
              const response = await fetch(`/api/generate-flashcards`, { // Needs implementation
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     Authorization: `Bearer ${session.access_token}`
                 },
                 body: JSON.stringify({ documentId: docId, numberOfCards: 10 }) // Example config
             });
             const result: ApiResponse<{ id: string; title: string; /* other deck data */ }> = await response.json();
             if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Failed to generate flashcards.');
             toast({ title: 'Flashcards Generated!', description: `New deck "${result.data.title}" created.` });
             router.push(`/flashcards/${result.data.id}`); // Navigate to the new deck
         } catch (error: any) {
             toast({ title: 'Flashcard Generation Failed', description: error.message, variant: 'destructive' });
         } finally {
             setIsGenerating(null);
         }
     };


    // --- Render Logic ---
   if (authLoading || isLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Documents</h1>
          {usage.limit !== Infinity && (
              <p className="text-sm text-muted-foreground mt-1">
                  You've uploaded {usage.count ?? 0}/{usage.limit} documents.
                  {/* <Link href="/pricing" className="ml-2 text-primary font-medium hover:underline">Upgrade</Link> */}
              </p>
          )}
        </div>
        {/* Upload Section */}
        <Card className="w-full sm:max-w-md">
             <CardHeader className="pb-2">
                 <CardTitle className="text-lg">Upload New Document</CardTitle>
             </CardHeader>
             <CardContent>
                 <div className="flex flex-col gap-2">
                     <Label htmlFor="file-upload" className="sr-only">Choose file</Label>
                     <Input
                        id="file-upload"
                        type="file"
                        accept=".pdf,.txt"
                        onChange={handleFileChange}
                        ref={fileInputRef}
                        disabled={isUploading}
                        className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                      />
                     {selectedFile && <p className="text-xs text-muted-foreground truncate">Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})</p>}
                     {uploadError && (
                          <div className="flex items-start gap-2 text-xs text-destructive">
                             <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                             <span>{uploadError}</span>
                         </div>
                     )}
                     <Button
                         onClick={handleUpload}
                         disabled={!selectedFile || isUploading}
                         className="mt-2 w-full sm:w-auto"
                         size="sm"
                      >
                         {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                         {isUploading ? 'Uploading...' : 'Upload'}
                      </Button>
                 </div>
             </CardContent>
        </Card>
      </div>

       {/* Document List */}
        {documents.length === 0 && !isLoading ? (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Documents Yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
                Upload your first PDF or TXT file to get started.
            </p>
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
                     <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => handleDeleteDocument(doc.id, doc.file_name)} disabled={isGenerating?.docId === doc.id}>
                         <Trash2 className="w-4 h-4 text-destructive" />
                         <span className="sr-only">Delete</span>
                     </Button>
                </CardHeader>
                <CardContent className="flex-grow">
                    {/* Placeholder for preview? */}
                </CardContent>
                <CardFooter className="flex flex-col items-stretch gap-2 pt-2">
                     <Button variant="outline" size="sm" onClick={() => handleViewContent(doc)} disabled={isGenerating?.docId === doc.id}>
                         <Eye className="w-4 h-4 mr-2" /> View Content
                     </Button>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                         <Button variant="secondary" size="sm" onClick={() => handleGenerateQuiz(doc.id)} disabled={isGenerating?.docId === doc.id}>
                            {isGenerating?.type === 'quiz' && isGenerating?.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileQuestion className="w-4 h-4" />}
                            <span className="ml-1 sm:ml-0 sm:sr-only">Quiz</span>
                         </Button>
                         <Button variant="secondary" size="sm" onClick={() => handleGenerateNotes(doc.id)} disabled={isGenerating?.docId === doc.id}>
                              {isGenerating?.type === 'notes' && isGenerating?.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}
                             <span className="ml-1 sm:ml-0 sm:sr-only">Notes</span>
                         </Button>
                         <Button variant="secondary" size="sm" onClick={() => handleGenerateFlashcards(doc.id)} disabled={isGenerating?.docId === doc.id}>
                             {isGenerating?.type === 'flashcards' && isGenerating?.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                             <span className="ml-1 sm:ml-0 sm:sr-only">Cards</span>
                         </Button>
                     </div>
                </CardFooter>
                </Card>
            ))}
            </div>
        )}

      {/* Content Viewer Dialog */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="truncate">Content: {viewingContent.title}</DialogTitle>
                <DialogDescription>
                    Extracted text from the uploaded document.
                </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden pr-1">
                 <ScrollArea className="h-full max-h-[60vh] pr-3 border rounded-md p-4">
                     {isLoadingContent ? (
                         <div className="flex justify-center items-center h-full">
                             <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                         </div>
                     ) : (
                        <pre className="text-sm whitespace-pre-wrap break-words">
                            {viewingContent.text || "No text could be extracted or content is empty."}
                        </pre>
                     )}
                </ScrollArea>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}