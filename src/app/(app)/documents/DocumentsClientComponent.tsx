// src/app/(app)/documents/DocumentsClientComponent.tsx
'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr'; 
import { fetcher } from '@/lib/fetcher'; 
import { useAuth } from '@/contexts/AuthContext';
import { ApiResponse, DocumentMetadata } from '@/types/database'; 
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Upload, FileText, Trash2, Eye, HelpCircle, Layers, 
  AlertCircle, CheckCircle, MoreVertical, Search, File as FileIcon,
  Calendar, HardDrive
} from 'lucide-react';
import { formatFileSize } from '@/lib/file-parser';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from "@/lib/utils";
import { DocumentCardSkeleton } from '@/components/skeletons/DocumentCardSkeleton'; 
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState<{ type: GenerationType; docId: string } | null>(null);
  const [recentlyQueued, setRecentlyQueued] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Client-side search filtering
  const filteredDocuments = useMemo(() => {
    if (!searchTerm) return documents;
    return documents.filter(doc => 
      doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [documents, searchTerm]);

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05, }, }, };
  const itemVariants = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }, };
  
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
    const file = e.target.files?.[0]; 
    if (file) { 
      setUploadError(''); 
      const maxSize = 10 * 1024 * 1024; 
      const isValidType = ['.pdf', '.txt', '.docx', '.pptx'].some(ext => file.name.toLowerCase().endsWith(ext)); 
      if (!isValidType) { 
        setUploadError("PDF, TXT, DOCX, or PPTX only."); 
        setSelectedFile(null); 
        if(fileInputRef.current) fileInputRef.current.value = ''; 
        return; 
      } 
      if (file.size > maxSize) { 
        setUploadError(`Max 10MB (${formatFileSize(file.size)}).`); 
        setSelectedFile(null); 
        if(fileInputRef.current) fileInputRef.current.value = ''; 
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
      if (!error.message.includes('limit reached')) { 
        setUploadError(error.message || 'Upload error.'); 
        toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' }); 
      } 
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
      if (!result.success) throw new Error(result.error || 'Delete failed.'); 
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
      toast({ title: "Processing", description: `A ${jobName} is already being generated.` });
      return;
    }

    setIsGenerating({ type: jobType, docId });
    toast({ title: "Started", description: `Generating ${jobName}...` });

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
        throw new Error(result.error || 'Job already in progress.');
      } else if (!response.ok || !result.success) {
        throw new Error(result.error || `Failed to start ${jobName} job.`);
      }

      setRecentlyQueued(prev => new Set(prev).add(jobKey));
      toast({ title: "Success", description: `${jobName} queued successfully.`, icon: <CheckCircle className="w-5 h-5 text-green-500" /> });

    } catch (e: any) {
      if (!e.message.includes('limit reached')) {
        toast({ title: "Failed", description: e.message, variant: 'destructive' });
      }
    } finally {
      setIsGenerating(null);
    }
  };
  
  const handleGenerateQuiz = (docId: string) => handleStartGenerationJob(docId, 'quiz', 'Quiz');
  const handleGenerateNotes = (docId: string) => handleStartGenerationJob(docId, 'note', 'Note');
  const handleGenerateFlashcards = (docId: string) => handleStartGenerationJob(docId, 'flashcard', 'Flashcard Deck');

  const getFileVisuals = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch(ext) {
      case 'pdf': return { color: 'text-red-600 dark:text-red-400', border: 'border-l-red-500', bg: 'bg-red-50 dark:bg-red-900/10', label: 'PDF', icon: FileText };
      case 'docx': return { color: 'text-blue-600 dark:text-blue-400', border: 'border-l-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/10', label: 'DOCX', icon: FileIcon }; 
      case 'pptx': return { color: 'text-orange-600 dark:text-orange-400', border: 'border-l-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/10', label: 'PPTX', icon: Layers };
      case 'txt': return { color: 'text-slate-600 dark:text-slate-400', border: 'border-l-slate-500', bg: 'bg-slate-50 dark:bg-slate-900/10', label: 'TXT', icon: FileText };
      default: return { color: 'text-gray-600 dark:text-gray-400', border: 'border-l-gray-500', bg: 'bg-gray-50 dark:bg-gray-900/10', label: ext?.toUpperCase() || 'FILE', icon: FileText };
    }
  };

  if (isSWRLoading && documents.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="flex gap-4">
             <div className="h-10 flex-1 bg-muted animate-pulse rounded" />
             <div className="h-10 w-32 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <DocumentCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (swrError && documents.length === 0) {
     return (
      <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-destructive/5">
        <AlertCircle className="h-10 w-10 text-destructive mb-4" />
        <h3 className="text-lg font-semibold text-destructive">Error Loading Documents</h3>
        <p className="text-sm text-muted-foreground mb-6">{swrError.message}</p>
        <Button variant="outline" onClick={() => refreshFirstPage(undefined, { revalidate: true })}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-8 pb-10">
        
        {/* --- Header Section --- */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">My Documents</h1>
            {/* Reverted Usage Vis: Simple Text */}
            <p className="text-sm text-muted-foreground">
              {typeof usage.limit === 'number' && usage.limit !== Infinity 
                ? `${usage.count} of ${usage.limit} documents used` 
                : 'Manage your uploads and study materials'
              }
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
             {/* Search */}
             <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background"
                />
             </div>
             
             {/* Standard Input & Upload Button */}
             <div className="flex gap-2 w-full sm:w-auto">
                 <div className="relative flex-1 sm:w-auto">
                   <Input 
                      type="file" 
                      accept=".pdf,.txt,.docx,.pptx" 
                      onChange={handleFileChange} 
                      ref={fileInputRef} 
                      disabled={isUploading} 
                      className="cursor-pointer file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                   />
                 </div>
                 <Button onClick={handleUpload} disabled={!selectedFile || isUploading} className="shrink-0">
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                 </Button>
             </div>
          </div>
          {uploadError && <p className="text-xs text-destructive absolute top-full mt-1 right-0">{uploadError}</p>}
        </div>

        {/* --- Document Grid --- */}
        {filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-xl bg-muted/20">
             <div className="bg-background p-4 rounded-full shadow-sm mb-4">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
             </div>
             <h3 className="text-lg font-semibold text-foreground">No documents found</h3>
             <p className="text-sm text-muted-foreground">
               {searchTerm ? "No files match your search." : "Upload a file to generate quizzes and notes."}
             </p>
          </div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filteredDocuments.map((doc) => {
              const isQuizQueued = recentlyQueued.has(`${doc.id}-quiz`);
              const isNoteQueued = recentlyQueued.has(`${doc.id}-note`);
              const isCardQueued = recentlyQueued.has(`${doc.id}-flashcard`);
              const visuals = getFileVisuals(doc.file_name);
              const Icon = visuals.icon;

              return (
                <motion.div key={doc.id} variants={itemVariants}>
                  <Card className={cn("flex flex-col h-full overflow-hidden hover:shadow-lg transition-shadow duration-300 group border-l-4", visuals.border)}>
                    
                    {/* --- HEADER --- */}
                    <CardHeader className="pb-3 pt-5">
                       <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 overflow-hidden">
                             <div className={cn("p-2 rounded-lg shrink-0", visuals.bg)}>
                                <Icon className={cn("w-5 h-5", visuals.color)} />
                             </div>
                             <div className="min-w-0">
                                <h4 className="font-semibold text-sm truncate leading-tight" title={doc.file_name}>
                                  {doc.file_name}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                                   <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> {formatFileSize(doc.file_size)}</span>
                                   <span>•</span>
                                   <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(doc.created_at).toLocaleDateString()}</span>
                                </div>
                             </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/documents/${doc.id}`)}>
                                <Eye className="w-4 h-4 mr-2" /> Open
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                                      </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                          <AlertDialogTitle>Delete file?</AlertDialogTitle>
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
                       </div>
                    </CardHeader>

                    {/* --- BODY --- */}
                    <CardContent className="flex-grow pb-3">
                        <div className="text-xs text-muted-foreground line-clamp-3 bg-muted/30 p-3 rounded-md border border-border/40 italic h-full">
                            {doc.ai_summary ? `"${doc.ai_summary}"` : "No summary generated yet."}
                        </div>
                    </CardContent>

                    {/* --- FOOTER ACTIONS --- */}
                    <CardFooter className="bg-muted/10 border-t pt-3 pb-3 px-4 flex items-center justify-between gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 text-xs h-8 bg-background hover:bg-muted/50"
                            onClick={() => router.push(`/documents/${doc.id}`)}
                        >
                            View
                        </Button>
                        <div className="flex items-center gap-1">
                             <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleGenerateQuiz(doc.id)} disabled={isQuizQueued}>
                                      {isQuizQueued ? <CheckCircle className="w-4 h-4 text-green-500" /> : <HelpCircle className="w-4 h-4 text-purple-500" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Generate Quiz</TooltipContent>
                             </Tooltip>
                             <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleGenerateNotes(doc.id)} disabled={isNoteQueued}>
                                      {isNoteQueued ? <CheckCircle className="w-4 h-4 text-green-500" /> : <FileText className="w-4 h-4 text-amber-500" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Generate Notes</TooltipContent>
                             </Tooltip>
                             <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleGenerateFlashcards(doc.id)} disabled={isCardQueued}>
                                      {isCardQueued ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Layers className="w-4 h-4 text-blue-500" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Generate Flashcards</TooltipContent>
                             </Tooltip>
                        </div>
                    </CardFooter>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        )}
        
        {totalPages > currentPage && (
          <div className="flex justify-center pt-6">
             <Button variant="ghost" onClick={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More
             </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}