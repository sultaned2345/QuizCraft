// src/app/(app)/documents/DocumentsClientComponent.tsx
'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr'; 
import { fetcher } from '@/lib/fetcher'; 
import { useAuth } from '@/contexts/AuthContext';
import { ApiResponse, DocumentMetadata } from '@/types/database'; 
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Upload, FileText, Trash2, Eye, HelpCircle, Layers, 
  AlertCircle, CheckCircle, MoreVertical, Search, FileIcon,
  HardDrive, Calendar
} from 'lucide-react';
import { formatFileSize } from '@/lib/file-parser';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Progress } from '@/components/ui/progress';
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

  // Filter documents client-side for search
  const filteredDocuments = useMemo(() => {
    if (!searchTerm) return documents;
    return documents.filter(doc => 
      doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [documents, searchTerm]);

  // Usage Progress Calculation
  const usagePercentage = useMemo(() => {
    if (typeof usage.limit === 'number' && usage.limit > 0) {
      return ((usage.count || 0) / usage.limit) * 100;
    }
    return 0;
  }, [usage]);

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
    
    // Optimistic UI update
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
      toast({ title: "Job Already Queued", description: `We're still working on the last request for this document.` });
      return;
    }

    setIsGenerating({ type: jobType, docId });
    toast({ title: `${jobName} Generation Started`, description: "Processing..." });

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
      toast({
        title: "Queued",
        description: `${jobName} will appear shortly.`,
        icon: <CheckCircle className="w-5 h-5 text-green-500" />
      });

    } catch (e: any) {
      if (!e.message.includes('limit reached')) {
        toast({ title: "Failed", description: e.message, variant: 'destructive' });
      }
    } finally {
      setIsGenerating(null);
    }
  };
  
  // Visual Helpers
  const getFileVisuals = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch(ext) {
      case 'pdf': return { color: 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400', label: 'PDF', icon: FileText };
      case 'docx': return { color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400', label: 'DOCX', icon: FileIcon }; 
      case 'pptx': return { color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400', label: 'PPTX', icon: Layers };
      case 'txt': return { color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400', label: 'TXT', icon: FileText };
      default: return { color: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400', label: ext?.toUpperCase() || 'FILE', icon: FileText };
    }
  };

  if (isSWRLoading && documents.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-end gap-4">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Documents</h2>
            <p className="text-muted-foreground">Manage your study materials.</p>
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
      <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-destructive/20 bg-destructive/5 rounded-xl">
        <AlertCircle className="h-10 w-10 text-destructive mb-4" />
        <h3 className="text-lg font-semibold text-destructive">Unable to load documents</h3>
        <p className="text-sm text-muted-foreground mb-6">{swrError.message}</p>
        <Button variant="outline" onClick={() => refreshFirstPage(undefined, { revalidate: true })}>
          <Loader2 className="w-4 h-4 mr-2" /> Try Again
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-8 pb-10">
        
        {/* --- Header Section --- */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Library</h1>
              <p className="text-muted-foreground mt-1">
                Manage your uploads and generate AI study aids.
              </p>
            </div>
            
            {/* Usage Stats */}
            {typeof usage.limit === 'number' && usage.limit !== Infinity && (
              <div className="max-w-xs space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                  <span>Storage Used</span>
                  <span>{usage.count} / {usage.limit} Docs</span>
                </div>
                <Progress value={usagePercentage} className="h-2" />
              </div>
            )}

            {/* Search Bar */}
            <div className="relative max-w-sm mt-4">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input 
                 placeholder="Search documents..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-9 bg-background/50 border-slate-200 dark:border-slate-800"
               />
            </div>
          </div>

          {/* --- Upload Area --- */}
          <Card className="w-full lg:w-[400px] border-dashed border-2 bg-slate-50/50 dark:bg-slate-900/20 shadow-none relative overflow-hidden group">
            <CardContent className="p-0">
               <div className="flex flex-col items-center justify-center py-6 px-4 text-center space-y-3">
                  <div className="p-3 bg-background rounded-full shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 group-hover:scale-110 transition-transform duration-200">
                    {isUploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-primary" />}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {selectedFile ? selectedFile.name : "Click to upload or drag & drop"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, DOCX, PPTX, TXT (Max 10MB)
                    </p>
                  </div>
                  
                  {/* Real Input Overlay */}
                  <Input 
                    type="file" 
                    accept=".pdf,.txt,.docx,.pptx" 
                    onChange={handleFileChange} 
                    ref={fileInputRef} 
                    disabled={isUploading} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  
                  <AnimatePresence>
                    {selectedFile && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="z-20 pt-2"
                      >
                         <Button size="sm" onClick={handleUpload} disabled={isUploading} className="w-full">
                           {isUploading ? "Uploading..." : "Confirm Upload"}
                         </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {uploadError && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-2">
                      <AlertCircle className="w-3 h-3" /> {uploadError}
                    </p>
                  )}
               </div>
            </CardContent>
          </Card>
        </div>

        {/* --- Document Grid --- */}
        {filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
             <div className="bg-background p-4 rounded-full shadow-sm mb-4">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
             </div>
             <h3 className="text-lg font-semibold text-foreground">No documents found</h3>
             <p className="text-sm text-muted-foreground">
               {searchTerm ? "Try adjusting your search terms." : "Upload your first file to get started."}
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
                  <Card className="h-full flex flex-col hover:shadow-lg hover:border-primary/20 transition-all duration-300 group bg-card">
                    <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                       <div className="flex gap-4 w-full">
                          {/* File Icon */}
                          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/10", visuals.color)}>
                             <Icon className="h-5 w-5" />
                          </div>
                          
                          {/* Title & Metadata */}
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm truncate pr-2" title={doc.file_name}>
                                  {doc.file_name}
                                </h4>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 text-muted-foreground hover:text-foreground">
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
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete file?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  This will permanently delete "{doc.file_name}" and all associated data.
                                                </AlertDialogDescription>
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
                             
                             <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                                <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] font-normal">{visuals.label}</Badge>
                                <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> {formatFileSize(doc.file_size)}</span>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                             </div>
                          </div>
                       </div>
                    </CardHeader>

                    <CardContent className="flex-grow py-3">
                       {doc.ai_summary ? (
                         <div className="bg-muted/40 p-3 rounded-md border border-border/50">
                           <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1.5">
                             <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> AI Insight
                           </p>
                           <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed italic">
                             "{doc.ai_summary}"
                           </p>
                         </div>
                       ) : (
                         <div className="h-full flex items-center justify-center p-4 bg-muted/20 rounded-md border border-dashed border-border/50">
                            <p className="text-xs text-muted-foreground text-center">Open to generate summary</p>
                         </div>
                       )}
                    </CardContent>

                    <CardFooter className="pt-2 pb-4 px-4 flex gap-2">
                        <Button 
                            className="flex-1 h-9 text-xs font-medium shadow-sm"
                            variant="default"
                            onClick={() => router.push(`/documents/${doc.id}`)}
                        >
                            <Eye className="w-3.5 h-3.5 mr-2" /> View & Chat
                        </Button>

                        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md border border-border/50">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" size="icon" className="h-7 w-7 rounded-sm hover:bg-background hover:shadow-sm"
                                onClick={() => handleGenerateQuiz(doc.id)} 
                                disabled={isGenerating?.docId === doc.id || isQuizQueued}
                              >
                                {isGenerating?.type === 'quiz' && isGenerating.docId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : isQuizQueued ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <HelpCircle className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Generate Quiz</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" size="icon" className="h-7 w-7 rounded-sm hover:bg-background hover:shadow-sm"
                                onClick={() => handleGenerateNotes(doc.id)}
                                disabled={isGenerating?.docId === doc.id || isNoteQueued}
                              >
                                {isGenerating?.type === 'note' && isGenerating.docId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : isNoteQueued ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <FileText className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Generate Notes</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" size="icon" className="h-7 w-7 rounded-sm hover:bg-background hover:shadow-sm"
                                onClick={() => handleGenerateFlashcards(doc.id)}
                                disabled={isGenerating?.docId === doc.id || isCardQueued}
                              >
                                {isGenerating?.type === 'flashcard' && isGenerating.docId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : isCardQueued ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
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
          <div className="flex flex-col items-center pt-8">
             <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore} className="w-full max-w-xs">
                {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More
             </Button>
             <p className="text-xs text-muted-foreground mt-2">Showing {documents.length} of {usage.count ?? 0} documents</p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}