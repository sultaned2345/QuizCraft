// src/app/(app)/documents/DocumentsClientComponent.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr'; 
import { fetcher } from '@/lib/fetcher'; 
import { useAuth } from '@/contexts/AuthContext';
import { ApiResponse, DocumentMetadata } from '@/types/database'; 
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Upload, FileText, Trash2, Eye, HelpCircle, Layers, 
  AlertCircle, CheckCircle, MoreVertical 
  // Removed File, FileQuestion, StickyNote to prevent Error #130
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from "@/lib/utils";
import { DocumentCardSkeleton } from '@/components/skeletons/DocumentCardSkeleton'; 
import { Skeleton } from '@/components/ui/skeleton'; 
import { Badge } from '@/components/ui/badge';

interface PaginatedDocumentsData {
  documents: DocumentMetadata[];
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}

type GenerationType = 'quiz' | 'note' | 'flashcard';

export function DocumentsClientComponent() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [usage, setUsage] = useState<{ count: number | undefined; limit: number | typeof Infinity | undefined }>({ count: 0, limit: Infinity });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  // Use global File type
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

  const { 
    data: swrData, 
    error: swrError, 
    isLoading: isSWRLoading, 
    mutate: refreshFirstPage 
  } = useSWR<ApiResponse<PaginatedDocumentsData>>(
    session ? `/api/documents?page=1&limit=${documentsPerPage}` : null,
    (url: string) => fetcher(url, { headers: { Authorization: `Bearer ${session!.access_token}` } }),
    {
      revalidateOnFocus: false, 
      dedupingInterval: 5000, 
      revalidateOnReconnect: true, 
    }
  );

  useEffect(() => {
    if (swrData && swrData.success && swrData.data) {
      setDocuments(swrData.data.documents);
      setUsage({ count: swrData.data.count, limit: swrData.data.limit });
      setCurrentPage(swrData.data.currentPage);
      setTotalPages(swrData.data.totalPages);
    }
  }, [swrData]);

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05, }, }, };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }, };
  
  const fetchMoreDocuments = useCallback(async (page: number) => { 
    if (!session || isLoadingMore || page > totalPages) return; 
    setIsLoadingMore(true); 
    try { 
      const response = await fetcher<PaginatedDocumentsData>(
        `/api/documents?page=${page}&limit=${documentsPerPage}`, 
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      
      if (response.success && response.data) {
        setDocuments(prev => [...prev, ...response.data!.documents]); 
        setCurrentPage(response.data.currentPage); 
        setTotalPages(response.data.totalPages); 
      }
    } catch (error: any) { 
      toast({ title: 'Error Loading More', description: error.message, variant: 'destructive' }); 
    } finally { 
      setIsLoadingMore(false); 
    } 
  }, [session, toast, documentsPerPage, isLoadingMore, totalPages]);
  
  const handleLoadMore = () => { fetchMoreDocuments(currentPage + 1); };

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
      await refreshFirstPage(); 
      
    } catch (error: any) { 
      toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' }); 
      await refreshFirstPage();
    } finally { 
      setIsDeleting(false); 
    } 
  };

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
  
  const handleGenerateQuiz = (docId: string) => handleStartGenerationJob(docId, 'quiz', 'Quiz');
  const handleGenerateNotes = (docId: string) => handleStartGenerationJob(docId, 'note', 'Note');
  const handleGenerateFlashcards = (docId: string) => handleStartGenerationJob(docId, 'flashcard', 'Flashcard Deck');

  // Helper to determine file visuals
  // Safe Fallbacks: Use FileText for unknown or older types
  const getFileVisuals = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch(ext) {
      case 'pdf': return { color: 'text-red-500 bg-red-50 dark:bg-red-950/30', label: 'PDF', icon: FileText };
      case 'docx': return { color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30', label: 'DOCX', icon: FileText }; 
      case 'pptx': return { color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/30', label: 'PPTX', icon: Layers };
      case 'txt': return { color: 'text-slate-500 bg-slate-50 dark:bg-slate-950/30', label: 'TXT', icon: FileText };
      default: return { color: 'text-gray-500 bg-gray-50 dark:bg-gray-950/30', label: ext?.toUpperCase() || 'FILE', icon: FileText };
    }
  };

  if (isSWRLoading && documents.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground text-center mb-8 p-8 border border-dashed rounded-lg bg-card/50">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <h2 className="text-2xl font-semibold text-foreground">Loading Documents...</h2>
          <p className="text-sm">Getting your files ready.</p>
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
     return (
      <div className="text-center py-16 border-2 border-dashed border-destructive/50 rounded-lg">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
        <h3 className="mt-4 text-lg font-semibold text-destructive">Failed to Load Documents</h3>
        <p className="mt-1 text-sm text-muted-foreground">{swrError.message}</p>
        <Button className="mt-6" variant="outline" onClick={() => refreshFirstPage(undefined, { revalidate: true })}>
          <Loader2 className="w-4 h-4 mr-2" /> 
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Documents</h1>
          {usage.limit !== Infinity && (<p className="text-sm text-muted-foreground mt-1">Total Docs: {usage.count ?? 0} / {usage.limit}.</p>)}
        </div>
        <Card className="w-full sm:max-w-md bg-card shadow-sm border-dashed">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                  <Input 
                    id="file-upload" 
                    type="file" 
                    accept=".pdf,.txt,.docx,.pptx" 
                    onChange={handleFileChange} 
                    ref={fileInputRef} 
                    disabled={isUploading} 
                    className="flex-1 text-xs file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                  <Button onClick={handleUpload} disabled={!selectedFile || isUploading} size="sm" className="shrink-0">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} 
                  </Button>
              </div>
              {selectedFile ? (
                <p className="text-xs text-muted-foreground truncate">Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})</p>
              ) : (
                <p className="text-[10px] text-muted-foreground text-center">Supported: PDF, DOCX, PPTX, TXT (Max 10MB)</p>
              )}
              {uploadError && <div className="flex items-start gap-2 text-xs text-destructive"><AlertCircle className="h-3 w-3 shrink-0 mt-0.5" /><span>{uploadError}</span></div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {documents.length === 0 && !isSWRLoading ? (
          <div className="text-center py-16 border-2 border-dashed rounded-lg"><FileText className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">No Documents Yet</h3><p className="mt-1 text-sm text-muted-foreground">Upload your first file to get started.</p></div>
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
                const visuals = getFileVisuals(doc.file_name);
                const Icon = visuals.icon;

                return (
                  <motion.div key={doc.id} variants={itemVariants}>
                    <Card className="flex flex-col h-full group transition-all duration-300 hover:shadow-md border-slate-200 dark:border-slate-800">
                      
                      {/* --- HEADER: FILE TYPE & META --- */}
                      <CardHeader className="flex-row items-start justify-between gap-4 pb-2">
                        <div className="flex items-center gap-3">
                            <div className={cn("h-12 w-12 rounded-lg flex items-center justify-center shrink-0", visuals.color)}>
                                <Icon className="h-6 w-6" />
                            </div>
                            <div className="overflow-hidden">
                                <CardTitle className="text-base truncate leading-tight mb-1" title={doc.file_name}>
                                    {doc.file_name}
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] h-5 font-normal text-muted-foreground border-slate-200 dark:border-slate-800">
                                        {visuals.label}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">
                                        {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* --- ACTIONS MENU --- */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/documents/${doc.id}`)}>
                                    <Eye className="w-4 h-4 mr-2" /> View Document
                                </DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete "{doc.file_name}"?</AlertDialogTitle>
                                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction 
                                                className={cn(buttonVariants({ variant: 'destructive' }))}
                                                disabled={isDeleting}
                                                onClick={() => handleDeleteDocument(doc.id, doc.file_name)}
                                            >
                                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                      </CardHeader>

                      {/* --- CONTENT: AI INSIGHT --- */}
                      <CardContent className="flex-grow py-2">
                          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-md p-3 border border-slate-100 dark:border-slate-800">
                                <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60" /> Key Insight
                                </p>
                                <p className="text-sm text-foreground/90 line-clamp-3 italic">
                                    "{doc.ai_summary || 'No summary available yet. Open the document to generate one.'}"
                                </p>
                          </div>
                      </CardContent>

                      {/* --- FOOTER: GENERATION TOOLBAR --- */}
                      <CardFooter className="pt-2 pb-4">
                        <div className="w-full flex items-center justify-between gap-2">
                            <Button 
                                variant="default" 
                                size="sm" 
                                className="flex-1 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800"
                                onClick={() => router.push(`/documents/${doc.id}`)}
                            >
                                <Eye className="w-4 h-4 mr-2" /> View & Chat
                            </Button>
                            
                            <div className="flex gap-1 border-l pl-2 ml-1">
                                <Button 
                                    variant="ghost" size="icon" className="h-8 w-8" 
                                    title="Generate Quiz"
                                    onClick={() => handleGenerateQuiz(doc.id)} 
                                    disabled={isGenerating?.docId === doc.id || isQuizQueued}
                                >
                                    {isGenerating?.type === 'quiz' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : isQuizQueued ? <CheckCircle className="h-4 w-4 text-green-500" /> : <HelpCircle className="h-4 w-4 text-purple-500" />}
                                </Button>
                                <Button 
                                    variant="ghost" size="icon" className="h-8 w-8"
                                    title="Generate Notes"
                                    onClick={() => handleGenerateNotes(doc.id)}
                                    disabled={isGenerating?.docId === doc.id || isNoteQueued}
                                >
                                    {isGenerating?.type === 'note' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : isNoteQueued ? <CheckCircle className="h-4 w-4 text-green-500" /> : <FileText className="h-4 w-4 text-amber-500" />}
                                </Button>
                                <Button 
                                    variant="ghost" size="icon" className="h-8 w-8"
                                    title="Generate Flashcards"
                                    onClick={() => handleGenerateFlashcards(doc.id)}
                                    disabled={isGenerating?.docId === doc.id || isCardQueued}
                                >
                                    {isGenerating?.type === 'flashcard' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/> : isCardQueued ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Layers className="h-4 w-4 text-blue-500" />}
                                </Button>
                            </div>
                        </div>
                      </CardFooter>
                    </Card>
                  </motion.div>
                )
              })}
          </motion.div>
      )}
      
      {totalPages > currentPage && (
          <div className="mt-8 text-center"><Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>{isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More Documents</Button><p className="text-xs text-muted-foreground mt-2">Showing {documents.length} of {usage.count ?? 0} documents</p></div>
      )}
    </>
  );
}