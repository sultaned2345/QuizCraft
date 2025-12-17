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
  Calendar, HardDrive, Sparkles
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ documentId: docId, jobType: jobType })
      });
      const result: ApiResponse = await response.json();
      if (response.status === 403) { openModal(); throw new Error(result.message || 'AI generation limit reached.'); } 
      else if (response.status === 400) { throw new Error(result.error || 'Job already in progress.'); } 
      else if (!response.ok || !result.success) { throw new Error(result.error || `Failed to start ${jobName} job.`); }

      setRecentlyQueued(prev => new Set(prev).add(jobKey));
      toast({ title: "Success", description: `${jobName} queued successfully.`, icon: <CheckCircle className="w-5 h-5 text-green-500" /> });
    } catch (e: any) {
      if (!e.message.includes('limit reached')) { toast({ title: "Failed", description: e.message, variant: 'destructive' }); }
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
      case 'pdf': return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-100 dark:border-red-900/20', icon: FileText };
      case 'docx': return { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-100 dark:border-blue-900/20', icon: FileIcon }; 
      case 'pptx': return { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-100 dark:border-orange-900/20', icon: Layers };
      case 'txt': return { color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-950/20', border: 'border-slate-100 dark:border-slate-900/20', icon: FileText };
      default: return { color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-950/20', border: 'border-gray-100 dark:border-gray-900/20', icon: FileText };
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
        <Button variant="outline" onClick={() => refreshFirstPage(undefined, { revalidate: true })}>Try Again</Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-8 pb-10">
        
        {/* --- Header Section --- */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">My Documents</h1>
            <p className="text-sm text-muted-foreground">
              {typeof usage.limit === 'number' && usage.limit !== Infinity 
                ? `${usage.count} of ${usage.limit} documents used` 
                : 'Manage your uploads and study materials'
              }
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
             <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background/50 border-slate-200 dark:border-slate-800"
                />
             </div>
             
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
                 <Button onClick={handleUpload} disabled={!selectedFile || isUploading} className="shrink-0 shadow-sm">
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                 </Button>
             </div>
          </div>
          {uploadError && <p className="text-xs text-destructive absolute top-full mt-1 right-0">{uploadError}</p>}
        </div>

        {/* --- Document Grid (3 Column) --- */}
        {filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
             <div className="bg-background p-4 rounded-full shadow-sm mb-4">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
             </div>
             <h3 className="text-xl font-semibold text-foreground">No documents found</h3>
             <p className="text-sm text-muted-foreground mt-1">
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
                  <Card className={cn(
                      "flex flex-col h-full border hover:border-primary/50 hover:shadow-lg transition-all duration-300 group overflow-hidden bg-card/50",
                      visuals.border
                  )}>
                    
                    {/* --- HEADER --- */}
                    <CardHeader className="pb-3 pt-5 px-5">
                       <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 overflow-hidden w-full">
                             {/* Styled Icon Container */}
                             <div className={cn("p-2.5 rounded-xl shrink-0 shadow-sm border border-black/5 dark:border-white/5", visuals.bg)}>
                                <Icon className={cn("w-5 h-5", visuals.color)} />
                             </div>
                             
                             <div className="min-w-0 flex-1 pt-0.5">
                                <h4 className="font-bold text-base text-foreground truncate leading-tight mb-1.5" title={doc.file_name}>
                                  {doc.file_name}
                                </h4>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                   <span className="flex items-center gap-1 opacity-80"><HardDrive className="w-3 h-3" /> {formatFileSize(doc.file_size)}</span>
                                   <span className="text-border">|</span>
                                   <span className="flex items-center gap-1 opacity-80"><Calendar className="w-3 h-3" /> {new Date(doc.created_at).toLocaleDateString()}</span>
                                </div>
                             </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2 text-muted-foreground hover:bg-muted/80">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => router.push(`/documents/${doc.id}`)}>
                                <Eye className="w-4 h-4 mr-2" /> Open Document
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                          <Trash2 className="w-4 h-4 mr-2" /> Delete File
                                      </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                          <AlertDialogTitle>Delete "{doc.file_name}"?</AlertDialogTitle>
                                          <AlertDialogDescription>This will permanently remove the file and all generated quizzes.</AlertDialogDescription>
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

                    {/* --- SUMMARY BODY --- */}
                    <CardContent className="flex-grow pb-3 px-5">
                        <div className="relative bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/30 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 h-full group-hover:border-slate-200 dark:group-hover:border-slate-700 transition-colors">
                            {doc.ai_summary ? (
                              <>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Sparkles className="w-3 h-3 text-primary" />
                                  <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-wider">AI Insight</span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                                  {doc.ai_summary}
                                </p>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-20 text-center gap-1 opacity-60">
                                <Sparkles className="w-5 h-5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">No insight available</span>
                              </div>
                            )}
                        </div>
                    </CardContent>

                    {/* --- ACTIONS FOOTER --- */}
                    <CardFooter className="bg-muted/10 border-t py-3 px-5 flex items-center justify-between gap-3">
                        <Button 
                            variant="default"
                            size="sm"
                            className="flex-1 text-xs font-medium shadow-sm transition-all active:scale-[0.98] h-8"
                            onClick={() => router.push(`/documents/${doc.id}`)}
                        >
                            View & Chat
                        </Button>
                        
                        <div className="flex items-center gap-0.5">
                             <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" size="icon" 
                                    className="h-8 w-8 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/20 hover:text-purple-600 transition-colors"
                                    onClick={() => handleGenerateQuiz(doc.id)} disabled={isQuizQueued}
                                  >
                                      {isQuizQueued ? <CheckCircle className="w-4 h-4 text-green-500" /> : <HelpCircle className="w-4 h-4 text-muted-foreground group-hover:text-purple-500" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Generate Quiz</TooltipContent>
                             </Tooltip>

                             <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" size="icon" 
                                    className="h-8 w-8 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/20 hover:text-amber-600 transition-colors"
                                    onClick={() => handleGenerateNotes(doc.id)} disabled={isNoteQueued}
                                  >
                                      {isNoteQueued ? <CheckCircle className="w-4 h-4 text-green-500" /> : <FileText className="w-4 h-4 text-muted-foreground group-hover:text-amber-500" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Generate Notes</TooltipContent>
                             </Tooltip>

                             <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" size="icon" 
                                    className="h-8 w-8 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors"
                                    onClick={() => handleGenerateFlashcards(doc.id)} disabled={isCardQueued}
                                  >
                                      {isCardQueued ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Layers className="w-4 h-4 text-muted-foreground group-hover:text-blue-500" />}
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
          <div className="flex justify-center pt-8">
             <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={isLoadingMore} className="min-w-[160px]">
                {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More
             </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}