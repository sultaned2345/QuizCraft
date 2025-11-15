// src/app/(app)/documents/DocumentsClientComponent.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr'; // <-- 1. IMPORT useSWR
import { fetcher } from '@/lib/fetcher'; // <-- 2. IMPORT fetcher
import { ApiResponse, DocumentMetadata } from '@/types/database'; 
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Upload, FileText, Trash2, Eye, Sparkles, FileQuestion, StickyNote, Layers, AlertCircle, CheckCircle } from 'lucide-react';
import { formatFileSize } from '@/lib/file-parser';
import { usePageContext } from '@/contexts/PageContext';
import { motion } from 'framer-motion';
import { useUpgradeModal } from '@/components/UpgradeModalContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { DocumentCardSkeleton } from '@/components/skeletons/DocumentCardSkeleton'; // <-- 8. IMPORT SKELETON
import { Skeleton } from '@/components/ui/skeleton'; // <-- 8. IMPORT SKELETON

interface PaginatedDocumentsData {
  documents: DocumentMetadata[];
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}

// --- 3. REMOVE initialData PROP ---
// interface DocumentsClientComponentProps {
//   initialData: PaginatedDocumentsData;
// }

type GenerationType = 'quiz' | 'note' | 'flashcard';

// export function DocumentsClientComponent({ initialData }: DocumentsClientComponentProps) {
export function DocumentsClientComponent() {
  // --- 4. MANAGE STATE, STARTING EMPTY ---
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [usage, setUsage] = useState<{ count: number | undefined; limit: number | typeof Infinity | undefined }>({ count: 0, limit: Infinity });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState<{ type: GenerationType; docId: string } | null>(null);
  const [recentlyQueued, setRecentlyQueued] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);

  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setPageContext } = usePageContext();
  const { openModal } = useUpgradeModal();

  const documentsPerPage = 9;

  // --- 5. USE SWR FOR INITIAL DATA FETCHING ---
  const { 
    data: swrData, 
    error: swrError, 
    isLoading: isSWRLoading, 
    mutate: refreshFirstPage // alias mutate to refreshFirstPage
  } = useSWR<PaginatedDocumentsData>(
    // Only fetch if session is available
    session ? `/api/documents?page=1&limit=${documentsPerPage}` : null,
    // Pass the fetcher and authorization token
    (url: string) => fetcher(url, { headers: { Authorization: `Bearer ${session!.access_token}` } }),
    {
      revalidateOnFocus: true, // This is the key! It will refetch on tab focus.
      dedupingInterval: 5000, // Don't refetch more than once every 5s
      revalidateOnReconnect: true, // Refetch on network recovery
    }
  );

  // --- 6. SYNC SWR DATA WITH STATE ---
  useEffect(() => {
    // When SWR finishes loading, update our local state.
    // This will happen on initial load AND on re-focus re-fetches.
    if (swrData) {
      setDocuments(swrData.documents);
      setUsage({ count: swrData.count, limit: swrData.limit });
      setCurrentPage(swrData.currentPage);
      setTotalPages(swrData.totalPages);
    }
  }, [swrData]); // This effect runs whenever SWR's `data` changes

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05, }, }, };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }, };
  
  const fetchMoreDocuments = useCallback(async (page: number) => { 
    if (!session || isLoadingMore || page > totalPages) return; 
    setIsLoadingMore(true); 
    try { 
      // This "load more" logic remains a standard fetch, as it *appends* data
      const data = await fetcher<PaginatedDocumentsData>(
        `/api/documents?page=${page}&limit=${documentsPerPage}`, 
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      // Append new documents to the existing list
      setDocuments(prev => [...prev, ...data.documents]); 
      setCurrentPage(data.currentPage); 
      setTotalPages(data.totalPages); 
      // Note: SWR's data is now out of sync, but that's okay.
      // A full refresh (mutate) will reset this.
    } catch (error: any) { 
      toast({ title: 'Error Loading More', description: error.message, variant: 'destructive' }); 
    } finally { 
      setIsLoadingMore(false); 
    } 
  }, [session, toast, documentsPerPage, isLoadingMore, totalPages]);
  
  const handleLoadMore = () => { fetchMoreDocuments(currentPage + 1); };

  // --- 7. REFRESH IS NOW `mutate` from useSWR ---
  // The `refreshFirstPage` const is already defined by `useSWR`
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setUploadError(''); const maxSize = 10 * 1024 * 1024; const isValidType = ['.pdf', '.txt', '.docx', '.pptx'].some(ext => file.name.toLowerCase().endsWith(ext)); if (!isValidType) { setUploadError("PDF, TXT, DOCX, or PPTX only."); setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; return; } if (file.size > maxSize) { setUploadError(`Max 10MB (${formatFileSize(file.size)}).`); setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; return; } setSelectedFile(file); } else { setSelectedFile(null); } };
  
  const handleUpload = async () => { 
    if (!selectedFile || !session) return; 
    setIsUploading(true); 
    setUploadError(''); 
    const formData = new FormData(); 
    formData.append('file', selectedFile); 
    try { 
      const response = await fetch('/api/documents', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: formData }); 
      const result: ApiResponse<DocumentMetadata> = await response.json(); 
      if (!response.ok || !result.success || !result.data) { 
        if (result.error === 'limit_exceeded') { openModal(); throw new Error(result.message || 'Document limit reached.'); } 
        throw new Error(result.error || `Upload failed ${response.status}`); 
      } 
      toast({ title: 'Uploaded!', description: `"${result.data.file_name}" added.` }); 
      setSelectedFile(null); 
      if(fileInputRef.current) fileInputRef.current.value = ''; 
      
      // Tell SWR to re-fetch the first page.
      // `false` means don't use stale data, fetch immediately.
      await refreshFirstPage(); 
      
      router.push(`/documents/${result.data.id}`); 
    } catch (error: any) { 
      if (!error.message.includes('limit reached')) { setUploadError(error.message || 'Upload error.'); toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' }); } 
    } finally { 
      setIsUploading(false); 
    } 
  };
  
  const handleDeleteDocument = async (docId: string, docName: string) => { 
    if (!session) return; 
    
    // Optimistic UI update: remove the document from state immediately
    setDocuments(prevDocs => prevDocs.filter(d => d.id !== docId)); 
    setUsage(prev => ({ ...prev, count: (prev.count ?? 1) - 1 })); 
    setIsDeleting(true); 
    
    try { 
      const response = await fetch(`/api/documents/${docId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } }); 
      const result: ApiResponse = await response.json(); 
      if (!result.success) { 
        throw new Error(result.error || 'Delete failed.'); 
      } 
      toast({ title: 'Deleted', description: `"${docName}" removed.` });
      
      // Tell SWR to re-fetch data to confirm the state.
      // SWR is smart and will likely de-dupe this request if one is in-flight.
      await refreshFirstPage(); 
      
    } catch (error: any) { 
      toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' }); 
      
      // Rollback: Manually trigger a refresh to get the "real" state
      // which will add the failed-to-delete item back.
      await refreshFirstPage();
      
    } finally { 
      setIsDeleting(false); 
    } 
  };

  const handleStartGenerationJob = async (docId: string, jobType: GenerationType, jobName: string) => {
    // ... (this function remains unchanged)
    if (!session) return;
    const jobKey = `${docId}-${jobType}`;
    if (recentlyQueued.has(jobKey)) {
      toast({ title: "Job Already Queued", description: `We're still working on the last request for this document.` });
      return;
    }

    setIsGenerating({ type: jobType, docId });
    toast({ title: `${jobName} Generation Started`, description: "Your file is being processed. This may take a few minutes." });

    try {
      const response = await fetch('/api/generation-jobs/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ documentId: docId, jobType: jobType })
      });

      const result: ApiResponse = await response.json();

      if (response.status === 403) { 
        openModal();
        throw new Error(result.message || 'AI generation limit reached.');
      } else if (response.status === 400) { 
        throw new Error(result.error || 'A job for this item is already in progress.');
      } else if (!response.ok || !result.success) {
        throw new Error(result.error || `Failed to start ${jobName} job.`);
      }

      setRecentlyQueued(prev => new Set(prev).add(jobKey));
      toast({
        title: "Request Queued!",
        description: `Your ${jobName.toLowerCase()} will appear on its page when ready.`,
        icon: <CheckCircle className="w-5 h-5 text-green-500" />
      });

    } catch (e: any) {
      if (!e.message.includes('limit reached')) {
        toast({ title: `${jobName} Job Failed`, description: e.message, variant: 'destructive' });
      }
    } finally {
      setIsGenerating(null);
    }
  };
  
  const handleGenerateQuiz = (docId: string) => { 
    handleStartGenerationJob(docId, 'quiz', 'Quiz');
  };
  
  const handleGenerateNotes = (docId: string) => { 
    handleStartGenerationJob(docId, 'note', 'Note');
  };
  
  const handleGenerateFlashcards = (docId: string) => { 
    handleStartGenerationJob(docId, 'flashcard', 'Flashcard Deck');
  };

  // --- 9. ADD INTERNAL LOADING/ERROR STATE ---
  if (isSWRLoading && documents.length === 0) {
    // This shows the skeleton on the *very first* load.
    // On re-focus, `isSWRLoading` will be true, but `documents` will *not* be empty,
    // so this block is skipped, preventing the loading UI flash.
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground text-center mb-8 p-8 border border-dashed rounded-lg bg-card/50">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <h2 className="text-2xl font-semibold text-foreground">Loading Documents...</h2>
          <p className="text-sm">Getting your files ready.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <Skeleton className="h-9 w-48 rounded mb-2" />
            <Skeleton className="h-4 w-56 rounded" />
          </div>
          <div className="w-full sm:max-w-md p-6 border rounded-xl shadow-sm bg-card">
            <Skeleton className="h-5 w-3/5 rounded mb-4" />
            <Skeleton className="h-10 w-full rounded-md mb-2" />
            <Skeleton className="h-4 w-4/5 rounded mb-3" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <DocumentCardSkeleton key={i} />
          ))}
        </div>
      </>
    );
  }

  if (swrError && documents.length === 0) {
     // Only show a full-page error if we have no data at all
     return (
      <div className="text-center py-16 border-2 border-dashed border-destructive/50 rounded-lg">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
        <h3 className="mt-4 text-lg font-semibold text-destructive">Failed to Load Documents</h3>
        <p className="mt-1 text-sm text-muted-foreground">{swrError.message}</p>
        <Button className="mt-6" variant="outline" onClick={() => refreshFirstPage()}>
          <RefreshCw className="w-4 h-4 mr-2" /> {/* Changed to RefreshCw */}
          Try Again
        </Button>
      </div>
    );
  }
  // --- END LOADING/ERROR STATE ---

  return (
    <>
      {/* (Header and Upload Card) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Documents</h1>
          {usage.limit !== Infinity && (<p className="text-sm text-muted-foreground mt-1">Total Docs: {usage.count ?? 0} / {usage.limit}.</p>)}
        </div>
        <Card className="w-full sm:max-w-md bg-card-foreground/5 dark:bg-card-foreground/10">
          <CardHeader className="pb-2"><CardTitle className="text-lg">Upload New</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Label htmlFor="file-upload" className="sr-only">Choose</Label>
              <Input 
                id="file-upload" 
                type="file" 
                accept=".pdf,.txt,.docx,.pptx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation" 
                onChange={handleFileChange} 
                ref={fileInputRef} 
                disabled={isUploading} 
                className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              {selectedFile ? (
                <p className="text-xs text-muted-foreground truncate">Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})</p>
              ) : (
                <p className="text-xs text-muted-foreground">PDF, TXT, DOCX, PPTX (Max 10MB)</p>
              )}
              {uploadError && <div className="flex items-start gap-2 text-xs text-destructive"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{uploadError}</span></div>}
              <Button onClick={handleUpload} disabled={!selectedFile || isUploading || (usage.limit !== Infinity && (usage.count ?? 0) >= (usage.limit ?? Infinity))} className="mt-2 w-full sm:w-auto" size="sm">
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} 
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
              {usage.limit !== Infinity && (usage.count ?? 0) >= (usage.limit ?? Infinity) && <p className="text-xs text-destructive mt-1">Limit reached.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* (Document List) */}
      {documents.length === 0 && !isSWRLoading ? (
          <div className="text-center py-16 border-2 border-dashed rounded-lg"><FileText className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">No Documents Yet</h3><p className="mt-1 text-sm text-muted-foreground">Upload your first PDF, TXT, DOCX, or PPTX file.</p></div>
      ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
              {documents.map((doc) => {
                const isQuizQueued = recentlyQueued.has(`${doc.id}-quiz`);
                const isNoteQueued = recentlyQueued.has(`${doc.id}-note`);
                const isCardQueued = recentlyQueued.has(`${doc.id}-flashcard`);

                return (
                  <motion.div key={doc.id} variants={itemVariants}>
                    <Card className="flex flex-col h-full">
                      <CardHeader className="flex-row items-start justify-between gap-4 pb-2">
                        <div className="space-y-1 overflow-hidden">
                          <CardTitle className="text-base truncate" title={doc.file_name}>{doc.file_name}</CardTitle>
                          <CardDescription className="text-xs">{doc.file_type} &bull; {formatFileSize(doc.file_size)}</CardDescription>
                          <CardDescription className="text-xs">Uploaded: {new Date(doc.created_at).toLocaleDateString()}</CardDescription>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={isGenerating?.docId === doc.id || isDeleting}>
                              <Trash2 className="w-4 h-4 text-destructive" /><span className="sr-only">Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the document:
                                <br />
                                <strong className="py-2 inline-block">{doc.file_name}</strong>
                                <br />
                                All associated data (summaries, insights, embeddings) will also be deleted. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className={cn(buttonVariants({ variant: 'destructive' }))}
                                disabled={isDeleting}
                                onClick={() => handleDeleteDocument(doc.id, doc.file_name)}
                              >
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </CardHeader>
                      <CardContent className="flex-grow">
                          <p className="text-sm text-muted-foreground italic line-clamp-2" title={doc.ai_summary || 'No summary available.'}>
                              {doc.ai_summary || 'No summary available.'}
                          </p>
                      </CardContent>
                      <CardFooter className="flex flex-col items-stretch gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => router.push(`/documents/${doc.id}`)} disabled={isGenerating?.docId === doc.id || isDeleting}>
                          <Eye className="w-4 h-4 mr-2" /> View & Chat
                        </Button>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Button title={isQuizQueued ? "Quiz is being generated" : "Generate Quiz"} variant="secondary" size="sm" onClick={() => handleGenerateQuiz(doc.id)} disabled={isGenerating?.docId === doc.id || isDeleting || isQuizQueued}>{isGenerating?.type === 'quiz' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : isQuizQueued ? <CheckCircle className="h-4 w-4 text-green-500" /> : <FileQuestion className="w-4 h-4" />}<span className="ml-1 sm:ml-0 sm:sr-only">Quiz</span></Button>
                          <Button title={isNoteQueued ? "Note is being generated" : "Generate Notes"} variant="secondary" size="sm" onClick={() => handleGenerateNotes(doc.id)} disabled={isGenerating?.docId === doc.id || isDeleting || isNoteQueued}>{isGenerating?.type === 'note' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : isNoteQueued ? <CheckCircle className="h-4 w-4 text-green-500" /> : <StickyNote className="w-4 h-4" />}<span className="ml-1 sm:ml-0 sm:sr-only">Notes</span></Button>
                          <Button title={isCardQueued ? "Cards are being generated" : "Generate Cards"} variant="secondary" size="sm" onClick={() => handleGenerateFlashcards(doc.id)} disabled={isGenerating?.docId === doc.id || isDeleting || isCardQueued}>{isGenerating?.type === 'flashcard' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : isCardQueued ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Layers className="w-4 h-4" />}<span className="ml-1 sm:ml-0 sm:sr-only">Cards</span></Button>
                        </div>
                      </CardFooter>
                    </Card>
                  </motion.div>
                )
              })}
          </motion.div>
      )}
      
      {/* (Load More Button) */}
      {totalPages > currentPage && (
          <div className="mt-8 text-center"><Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>{isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More Documents</Button><p className="text-xs text-muted-foreground mt-2">Showing {documents.length} of {usage.count ?? 0} documents</p></div>
      )}
    </>
  );
}