// src/app/(app)/documents/DocumentsClientComponent.tsx
// MODIFIED FILE

'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ApiResponse, DocumentMetadata } from '@/types/database'; 
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Upload, FileText, Trash2, Eye, Sparkles, FileQuestion, StickyNote, Layers, AlertCircle, CheckCircle } from 'lucide-react'; // <-- Import CheckCircle
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

interface PaginatedDocumentsData {
  documents: DocumentMetadata[];
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}

interface DocumentsClientComponentProps {
  initialData: PaginatedDocumentsData;
}

// --- NEW TYPE ---
type GenerationType = 'quiz' | 'notes' | 'flashcards';

export function DocumentsClientComponent({ initialData }: DocumentsClientComponentProps) {
  const [documents, setDocuments] = useState<DocumentMetadata[]>(initialData.documents);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [usage, setUsage] = useState<{ count: number | undefined; limit: number | typeof Infinity | undefined }>({ count: initialData.count, limit: initialData.limit });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // --- MODIFIED STATE ---
  const [isGenerating, setIsGenerating] = useState<{ type: GenerationType; docId: string } | null>(null);
  const [recentlyQueued, setRecentlyQueued] = useState<Set<string>>(new Set()); // Tracks docId + type
  // ---
  
  const [currentPage, setCurrentPage] = useState(initialData.currentPage);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const documentsPerPage = 9;
  const [isDeleting, setIsDeleting] = useState(false);

  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setPageContext } = usePageContext();
  const { openModal } = useUpgradeModal();

  // (containerVariants, itemVariants, fetchMoreDocuments, handleLoadMore, refreshFirstPage, handleFileChange, handleUpload, handleDeleteDocument are all unchanged)
  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05, }, }, };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }, };
  const fetchMoreDocuments = useCallback(async (page: number) => { if (!session || isLoadingMore || page > totalPages) return; setIsLoadingMore(true); try { const response = await fetch(`/api/documents?page=${page}&limit=${documentsPerPage}`, { headers: { Authorization: `Bearer ${session.access_token}` } }); const data: ApiResponse<PaginatedDocumentsData> = await response.json(); if (!data.success || !data.data) throw new Error(data.error || 'Failed load more.'); setDocuments(prev => [...prev, ...data.data!.documents]); setCurrentPage(data.data.currentPage); setTotalPages(data.data.totalPages); setUsage({ count: data.data.count, limit: data.data.limit }); } catch (error: any) { toast({ title: 'Error Loading More', description: error.message, variant: 'destructive' }); } finally { setIsLoadingMore(false); } }, [session, toast, documentsPerPage, isLoadingMore, totalPages]);
  const handleLoadMore = () => { fetchMoreDocuments(currentPage + 1); };
  const refreshFirstPage = useCallback(async () => { if (!session) return; try { const response = await fetch(`/api/documents?page=1&limit=${documentsPerPage}`, { headers: { Authorization: `Bearer ${session.access_token}` } }); const data: ApiResponse<PaginatedDocumentsData> = await response.json(); if (!data.success || !data.data) throw new Error(data.error || 'Failed refresh.'); setDocuments(data.data.documents); setCurrentPage(data.data.currentPage); setTotalPages(data.data.totalPages); setUsage({ count: data.data.count, limit: data.data.limit }); } catch (error: any) { toast({ title: "Error Refreshing", description: error.message, variant: "destructive" }); } }, [session, toast, documentsPerPage]);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setUploadError(''); const maxSize = 10 * 1024 * 1024; const isValidType = ['.pdf', '.txt', '.docx', '.pptx'].some(ext => file.name.toLowerCase().endsWith(ext)); if (!isValidType) { setUploadError("PDF, TXT, DOCX, or PPTX only."); setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; return; } if (file.size > maxSize) { setUploadError(`Max 10MB (${formatFileSize(file.size)}).`); setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; return; } setSelectedFile(file); } else { setSelectedFile(null); } };
  const handleUpload = async () => { if (!selectedFile || !session) return; setIsUploading(true); setUploadError(''); const formData = new FormData(); formData.append('file', selectedFile); try { const response = await fetch('/api/documents', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: formData }); const result: ApiResponse<DocumentMetadata> = await response.json(); if (!response.ok || !result.success || !result.data) { if (result.error === 'limit_exceeded') { openModal(); throw new Error(result.message || 'Document limit reached.'); } throw new Error(result.error || `Upload failed ${response.status}`); } toast({ title: 'Uploaded!', description: `"${result.data.file_name}" added.` }); setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; await refreshFirstPage(); router.push(`/documents/${result.data.id}`); } catch (error: any) { if (!error.message.includes('limit reached')) { setUploadError(error.message || 'Upload error.'); toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' }); } } finally { setIsUploading(false); } };
  const handleDeleteDocument = async (docId: string, docName: string) => { if (!session) return; const originalDocuments = [...documents]; setDocuments(prevDocs => prevDocs.filter(d => d.id !== docId)); setUsage(prev => ({ ...prev, count: (prev.count ?? 1) - 1 })); setIsDeleting(true); try { const response = await fetch(`/api/documents/${docId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } }); const result: ApiResponse = await response.json(); if (!result.success) { throw new Error(result.error || 'Delete failed.'); } toast({ title: 'Deleted', description: `"${docName}" removed.` }); } catch (error: any) { toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' }); setDocuments(originalDocuments); setUsage(prev => ({ ...prev, count: (prev.count ?? 0) + 1 })); } finally { setIsDeleting(false); } };

  // --- NEW: Generic Job Starter Function ---
  const handleStartGenerationJob = async (docId: string, jobType: GenerationType, jobName: string) => {
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

      if (response.status === 403) { // 403 Forbidden (Limit Exceeded)
        openModal();
        throw new Error(result.message || 'AI generation limit reached.');
      } else if (response.status === 400) { // 400 Bad Request (Already processing)
        throw new Error(result.error || 'A job for this item is already in progress.');
      } else if (!response.ok || !result.success) {
        throw new Error(result.error || `Failed to start ${jobName} job.`);
      }

      // Success
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
  
  // --- MODIFIED: Update handlers to use the new job starter ---
  const handleGenerateQuiz = (docId: string) => { 
    handleStartGenerationJob(docId, 'quiz', 'Quiz');
  };
  
  const handleGenerateNotes = (docId: string) => { 
    handleStartGenerationJob(docId, 'note', 'Note');
  };
  
  const handleGenerateFlashcards = (docId: string) => { 
    handleStartGenerationJob(docId, 'flashcard', 'Flashcard Deck');
  };
  // --- END OF MODIFICATIONS ---

  return (
    <>
      {/* (Header and Upload Card are unchanged) */}
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

      {/* (Document List is unchanged) */}
      {documents.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-lg"><FileText className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">No Documents Yet</h3><p className="mt-1 text-sm text-muted-foreground">Upload PDF, TXT, DOCX, or PPTX.</p></div>
      ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
              {documents.map((doc) => {
                // --- NEW: Check if job is queued for this doc ---
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
                          {/* --- MODIFIED BUTTONS --- */}
                          <Button title={isQuizQueued ? "Quiz is being generated" : "Generate Quiz"} variant="secondary" size="sm" onClick={() => handleGenerateQuiz(doc.id)} disabled={isGenerating?.docId === doc.id || isDeleting || isQuizQueued}>{isGenerating?.type === 'quiz' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : isQuizQueued ? <CheckCircle className="h-4 w-4 text-green-500" /> : <FileQuestion className="w-4 h-4" />}<span className="ml-1 sm:ml-0 sm:sr-only">Quiz</span></Button>
                          <Button title={isNoteQueued ? "Note is being generated" : "Generate Notes"} variant="secondary" size="sm" onClick={() => handleGenerateNotes(docId)} disabled={isGenerating?.docId === doc.id || isDeleting || isNoteQueued}>{isGenerating?.type === 'notes' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : isNoteQueued ? <CheckCircle className="h-4 w-4 text-green-500" /> : <StickyNote className="w-4 h-4" />}<span className="ml-1 sm:ml-0 sm:sr-only">Notes</span></Button>
                          <Button title={isCardQueued ? "Cards are being generated" : "Generate Cards"} variant="secondary" size="sm" onClick={() => handleGenerateFlashcards(docId)} disabled={isGenerating?.docId === doc.id || isDeleting || isCardQueued}>{isGenerating?.type === 'flashcards' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : isCardQueued ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Layers className="w-4 h-4" />}<span className="ml-1 sm:ml-0 sm:sr-only">Cards</span></Button>
                          {/* --- END MODIFIED BUTTONS --- */}
                        </div>
                      </CardFooter>
                    </Card>
                  </motion.div>
                )
              })}
          </motion.div>
      )}
      {/* (Load More Button is unchanged) */}
      {totalPages > currentPage && (
          <div className="mt-8 text-center"><Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>{isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More Documents</Button><p className="text-xs text-muted-foreground mt-2">Showing {documents.length} of {usage.count ?? 0} documents</p></div>
      )}
    </>
  );
}