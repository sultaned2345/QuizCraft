'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ApiResponse } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Upload, FileText, Trash2, Eye, Sparkles, FileQuestion, StickyNote, Layers, AlertCircle } from 'lucide-react';
import { formatFileSize } from '@/lib/file-parser';

// Types (keep as defined before)
interface DocumentMetadata { id: string; file_name: string; file_type: string; file_size: number; created_at: string; storage_path: string; }
interface GeneratedDeckInfo { id: string; title: string; }
interface PaginatedDocumentsData { documents: DocumentMetadata[]; count: number; limit: number | typeof Infinity; totalPages: number; currentPage: number; }

// Props for client component
interface DocumentsClientComponentProps {
  initialData: PaginatedDocumentsData;
}

export function DocumentsClientComponent({ initialData }: DocumentsClientComponentProps) {
  // Initialize state with initialData
  const [documents, setDocuments] = useState<DocumentMetadata[]>(initialData.documents);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [usage, setUsage] = useState<{ count: number | undefined; limit: number | typeof Infinity | undefined }>({ count: initialData.count, limit: initialData.limit });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewingContent, setViewingContent] = useState<{ title: string; text: string | null }>({ title: '', text: '' });
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isGenerating, setIsGenerating] = useState<{ type: 'quiz' | 'notes' | 'flashcards'; docId: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(initialData.currentPage);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const documentsPerPage = 9;

  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Fetch More Documents (Client-Side) ---
  const fetchMoreDocuments = useCallback(async (page: number) => {
    if (!session || isLoadingMore || page > totalPages) return;
    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/documents?page=${page}&limit=${documentsPerPage}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data: ApiResponse<PaginatedDocumentsData> = await response.json();
      if (!data.success || !data.data) throw new Error(data.error || 'Failed load more.');

      setDocuments(prev => [...prev, ...data.data!.documents]);
      setCurrentPage(data.data.currentPage);
      setTotalPages(data.data.totalPages);
      setUsage({ count: data.data.count, limit: data.data.limit });
    } catch (error: any) { toast({ title: 'Error Loading More', description: error.message, variant: 'destructive' }); }
    finally { setIsLoadingMore(false); }
  }, [session, toast, documentsPerPage, isLoadingMore, totalPages]);

  const handleLoadMore = () => {
    fetchMoreDocuments(currentPage + 1);
  }

  // --- Refresh Function ---
  const refreshFirstPage = useCallback(async () => {
    if (!session) return;
    // Indicate loading if needed
    try {
        const response = await fetch(`/api/documents?page=1&limit=${documentsPerPage}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const data: ApiResponse<PaginatedDocumentsData> = await response.json();
        if (!data.success || !data.data) throw new Error(data.error || 'Failed refresh.');

        setDocuments(data.data.documents);
        setCurrentPage(data.data.currentPage);
        setTotalPages(data.data.totalPages);
        setUsage({ count: data.data.count, limit: data.data.limit });
    } catch (error: any) { toast({ title: "Error Refreshing", description: error.message, variant: "destructive" }); }
    finally { /* Stop loading */ }
  }, [session, toast, documentsPerPage]);


  // --- File Handling & Upload (Refresh on success) ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... (same validation) ... */
     const file = e.target.files?.[0]; if (file) { setUploadError(''); const maxSize = 3 * 1024 * 1024; const isValidType = ['.pdf', '.txt'].some(ext => file.name.toLowerCase().endsWith(ext)); if (!isValidType) { setUploadError("PDF/TXT only."); setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; return; } if (file.size > maxSize) { setUploadError(`Max 3MB (${formatFileSize(file.size)}).`); setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; return; } setSelectedFile(file); } else { setSelectedFile(null); }
   };

  const handleUpload = async () => { /* ... (same API call logic) ... */
     if (!selectedFile || !session) return; setIsUploading(true); setUploadError(''); const formData = new FormData(); formData.append('file', selectedFile); try { const response = await fetch('/api/documents', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: formData }); const result: ApiResponse<DocumentMetadata> = await response.json(); if (!response.ok || !result.success || !result.data) throw new Error(result.error || `Upload failed ${response.status}`); toast({ title: 'Uploaded!', description: `"${result.data.file_name}" added.` }); setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; refreshFirstPage(); } catch (error: any) { setUploadError(error.message || 'Upload error.'); toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' }); } finally { setIsUploading(false); }
   };

  // --- Document Actions (Delete refreshes) ---
  const handleViewContent = async (doc: DocumentMetadata) => { /* ... (same logic) ... */
     if (!session) return; setIsViewerOpen(true); setIsLoadingContent(true); setViewingContent({ title: doc.file_name, text: 'Loading...' }); try { const response = await fetch(`/api/documents/${doc.id}/content`, { headers: { Authorization: `Bearer ${session.access_token}` } }); const result: ApiResponse<{ extracted_text: string | null; file_name: string }> = await response.json(); if (!result.success || !result.data) throw new Error(result.error || 'Failed fetch.'); setViewingContent({ title: result.data.file_name, text: result.data.extracted_text }); } catch (error: any) { toast({ title: 'Error Fetching', description: error.message, variant: 'destructive' }); setViewingContent({ title: doc.file_name, text: `Error: ${error.message}` }); } finally { setIsLoadingContent(false); }
   };

  const handleDeleteDocument = async (docId: string, docName: string) => { /* ... (same API call logic) ... */
     if (!session || !confirm(`Delete "${docName}"?`)) return; try { const response = await fetch(`/api/documents/${docId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } }); const result: ApiResponse = await response.json(); if (!result.success) throw new Error(result.error || 'Delete failed.'); toast({ title: 'Deleted', description: `"${docName}" removed.` }); refreshFirstPage(); } catch (error: any) { toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' }); }
   };

  // --- AI Generation Handlers (Remain the same) ---
  const handleGenerateQuiz = async (docId: string) => { /* ... (same logic) ... */ if(!session) return; setIsGenerating({type:'quiz', docId}); toast({title:'Preparing Quiz...'}); try{ router.push(`/create?docId=${docId}`); } catch(e:any){ toast({title:'Failed Prep', description:e.message, variant:'destructive'}); setIsGenerating(null); } };
  const handleGenerateNotes = async (docId: string) => { /* ... (same logic) ... */ if(!session) return; setIsGenerating({type:'notes', docId}); toast({title:'Generating Notes...'}); try { const cRes = await fetch(`/api/documents/${docId}/content`, {headers:{Authorization:`Bearer ${session.access_token}`}}); const cResult: ApiResponse<{extracted_text:string|null}> = await cRes.json(); if(!cResult.success || !cResult.data?.extracted_text) throw new Error(cResult.error||'Failed content fetch.'); const gRes = await fetch(`/api/generate-notes`, {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}`}, body: JSON.stringify({text: cResult.data.extracted_text, number_of_notes: 5})}); const gResult: ApiResponse = await gRes.json(); if(!gRes.ok || !gResult.success) throw new Error(gResult.error||'Failed generate.'); toast({title:'Notes Generated!'}); router.push('/notes'); } catch(e:any){ toast({title:'Note Gen Failed', description:e.message, variant:'destructive'}); } finally { setIsGenerating(null); } };
  const handleGenerateFlashcards = async (docId: string) => { /* ... (same logic) ... */ if(!session) return; setIsGenerating({type:'flashcards', docId}); toast({title:'Generating Flashcards...'}); try { const response = await fetch(`/api/generate-flashcards`, {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}`}, body: JSON.stringify({documentId:docId, numberOfCards:15})}); const result: ApiResponse<GeneratedDeckInfo> = await response.json(); if(!response.ok || !result.success || !result.data) throw new Error(result.error||'Failed generate.'); toast({title:'Flashcards Generated!', description:`Deck "${result.data.title}" created.`}); router.push(`/flashcards/${result.data.id}`); } catch(e:any){ toast({title:'Card Gen Failed', description:e.message, variant:'destructive'}); } finally { setIsGenerating(null); } };

  // --- Render Logic ---
  // (No top-level loading needed)

  return (
    <>
      {/* Header & Upload Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Documents</h1>
          {usage.limit !== Infinity && (<p className="text-sm text-muted-foreground mt-1">Total Docs: {usage.count ?? 0} / {usage.limit}.</p>)}
        </div>
        {/* Upload Card remains the same */}
        <Card className="w-full sm:max-w-md"><CardHeader className="pb-2"><CardTitle className="text-lg">Upload New</CardTitle></CardHeader><CardContent><div className="flex flex-col gap-2"><Label htmlFor="file-upload" className="sr-only">Choose</Label><Input id="file-upload" type="file" accept=".pdf,.txt" onChange={handleFileChange} ref={fileInputRef} disabled={isUploading} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"/>{selectedFile && <p className="text-xs text-muted-foreground truncate">Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})</p>}{uploadError && <div className="flex items-start gap-2 text-xs text-destructive"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{uploadError}</span></div>}<Button onClick={handleUpload} disabled={!selectedFile || isUploading || (usage.limit !== Infinity && (usage.count ?? 0) >= (usage.limit ?? Infinity))} className="mt-2 w-full sm:w-auto" size="sm">{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} {isUploading ? 'Uploading...' : 'Upload'}</Button>{usage.limit !== Infinity && (usage.count ?? 0) >= (usage.limit ?? Infinity) && <p className="text-xs text-destructive mt-1">Limit reached.</p>}</div></CardContent></Card>
      </div>

       {/* Document List or Empty State */}
        {documents.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-lg"><FileText className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">No Documents Yet</h3><p className="mt-1 text-sm text-muted-foreground">Upload PDF or TXT.</p></div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Document Card mapping remains the same */}
                {documents.map((doc) => (<Card key={doc.id} className="flex flex-col"><CardHeader className="flex-row items-start justify-between gap-4 pb-2"><div className="space-y-1 overflow-hidden"><CardTitle className="text-base truncate" title={doc.file_name}>{doc.file_name}</CardTitle><CardDescription className="text-xs">{doc.file_type} &bull; {formatFileSize(doc.file_size)}</CardDescription><CardDescription className="text-xs">Uploaded: {new Date(doc.created_at).toLocaleDateString()}</CardDescription></div><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDeleteDocument(doc.id, doc.file_name)} disabled={isGenerating?.docId === doc.id}><Trash2 className="w-4 h-4 text-destructive" /><span className="sr-only">Delete</span></Button></CardHeader><CardContent className="flex-grow"></CardContent><CardFooter className="flex flex-col items-stretch gap-2 pt-2"><Button variant="outline" size="sm" onClick={() => handleViewContent(doc)} disabled={isGenerating?.docId === doc.id}><Eye className="w-4 h-4 mr-2" /> View</Button><div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><Button title="Gen Quiz" variant="secondary" size="sm" onClick={() => handleGenerateQuiz(doc.id)} disabled={isGenerating?.docId === doc.id}>{isGenerating?.type === 'quiz' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/>:<FileQuestion className="w-4 h-4" />}<span className="ml-1 sm:ml-0 sm:sr-only">Quiz</span></Button><Button title="Gen Notes" variant="secondary" size="sm" onClick={() => handleGenerateNotes(doc.id)} disabled={isGenerating?.docId === doc.id}>{isGenerating?.type === 'notes' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/>:<StickyNote className="w-4 h-4" />}<span className="ml-1 sm:ml-0 sm:sr-only">Notes</span></Button><Button title="Gen Cards" variant="secondary" size="sm" onClick={() => handleGenerateFlashcards(doc.id)} disabled={isGenerating?.docId === doc.id}>{isGenerating?.type === 'flashcards' && isGenerating.docId === doc.id ? <Loader2 className="h-4 w-4 animate-spin"/>:<Layers className="w-4 h-4" />}<span className="ml-1 sm:ml-0 sm:sr-only">Cards</span></Button></div></CardFooter></Card>))}
            </div>
        )}

        {/* Load More Button */}
        {totalPages > currentPage && (
            <div className="mt-8 text-center">
                <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                    {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More Documents
                </Button>
                 <p className="text-xs text-muted-foreground mt-2">Showing {documents.length} of {usage.count ?? 0} documents</p>
            </div>
        )}

      {/* Content Viewer Dialog (Remains the same) */}
      <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}><DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col"><DialogHeader><DialogTitle className="truncate">Content: {viewingContent.title}</DialogTitle><DialogDescription>Extracted text.</DialogDescription></DialogHeader><div className="flex-1 overflow-hidden pr-1"><ScrollArea className="h-full max-h-[60vh] pr-3 border rounded-md p-4">{isLoadingContent ? <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div> : <pre className="text-sm whitespace-pre-wrap break-words">{viewingContent.text || "Empty."}</pre>}</ScrollArea></div><DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Close</Button></DialogClose></DialogFooter></DialogContent></Dialog>
    </>
  );
}