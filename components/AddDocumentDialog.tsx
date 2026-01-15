// src/components/AddDocumentDialog.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  UploadCloud,
  Youtube, 
  Plus, 
  Loader2, 
  FileText, 
  Sparkles, 
  Type, 
  X,
  Link as LinkIcon 
} from 'lucide-react';
import { useTurboGenerator } from '@/hooks/useTurboGenerator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface AddDocumentDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onUploadComplete?: () => void;
}

export function AddDocumentDialog({ 
  children, 
  open: controlledOpen, 
  onOpenChange: setControlledOpen,
  onUploadComplete 
}: AddDocumentDialogProps) {
  const router = useRouter();
  
  // --- STATE ---
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalIsOpen;
  const setIsOpen = isControlled ? setControlledOpen : setInternalIsOpen;

  // Form State
  const [activeTab, setActiveTab] = useState('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  
  // Status State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState(''); 
  
  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  // We pass a no-op onSuccess so individual generate calls don't trigger redirects.
  // We will handle the redirect manually after all promises resolve.
  const { generate, isGenerating, progress, status: genStatus } = useTurboGenerator({
    onSuccess: () => {} 
  });
  
  const { toast } = useToast();
  const { session } = useAuth(); 

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setFile(null);
        setText('');
        setYoutubeUrl('');
        setIsProcessing(false);
        setProcessStatus('');
        setActiveTab('file');
        setIsDragging(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // --- HANDLERS ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
        setFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = async () => {
    try {
      setIsProcessing(true);
      
      let content = '';
      let title = '';
      let type = 'text/plain';
      let source = 'user_upload';

      // 1. Prepare Content based on Tab
      if (activeTab === 'file' && file) {
        setProcessStatus('Parsing file...');
        
        const formData = new FormData();
        formData.append('file', file);
        
        const headers: Record<string, string> = {};
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

        const parseRes = await fetch('/api/parse-file', {
          method: 'POST',
          headers, 
          body: formData
        });

        if (!parseRes.ok) {
           const err = await parseRes.json();
           throw new Error(err.error || 'Failed to parse file');
        }

        const data = await parseRes.json();
        content = data.data?.text || ''; 
        title = file.name;
        type = file.type;

      } else if (activeTab === 'text' && text) {
        content = text;
        title = 'Study Notes';
        type = 'text/plain';

      } else if (activeTab === 'youtube' && youtubeUrl) {
        content = youtubeUrl;
        title = 'YouTube Video';
        type = 'youtube';
        source = 'youtube';
      }

      if (!content) {
        throw new Error('Please provide content to process.');
      }

      // 2. Save Document to Database to get ID
      setProcessStatus('Saving to library...');
      
      const saveHeaders: Record<string, string> = {
          'Content-Type': 'application/json'
      };
      if (session?.access_token) saveHeaders['Authorization'] = `Bearer ${session.access_token}`;

      const saveRes = await fetch('/api/documents', {
          method: 'POST',
          headers: saveHeaders,
          body: JSON.stringify({
              title,
              content,
              fileType: type,
              source
          })
      });

      if (!saveRes.ok) {
          throw new Error('Failed to save document to library');
      }

      const savedDoc = await saveRes.json();
      const documentId = savedDoc.id || savedDoc.data?.id;

      if (!documentId) {
          throw new Error('Server did not return a Document ID');
      }

      // 3. Start ALL Generations (Parallel)
      // Using singular types ('note', 'flashcard') to match backend expectation
      setProcessStatus('Igniting engines...');
      
      await Promise.all([
        generate('quiz', documentId, { fileName: title }),
        generate('note' as any, documentId, { fileName: title }),     
        generate('flashcard' as any, documentId, { fileName: title }) 
      ]);

      // 4. Cleanup & Success
      toast({ 
        title: "Workspace Ready", 
        description: "Redirecting you to your new study session..." 
      });

      if (onUploadComplete) onUploadComplete();
      if (setIsOpen) setIsOpen(false);
      
      // Redirect to the Workspace page
      router.push(`/documents/${documentId}`);
      
    } catch (error: any) {
      console.error("Process failed", error);
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  const isBusy = isProcessing || isGenerating;
  const canSubmit = 
    (activeTab === 'file' && !!file) ||
    (activeTab === 'text' && !!text.trim()) ||
    (activeTab === 'youtube' && !!youtubeUrl.trim());

  // Use the hook's status if generating, otherwise local status
  const currentStatus = isGenerating ? genStatus : processStatus;

  return (
    <Dialog open={isOpen} onOpenChange={isBusy ? undefined : setIsOpen}>
      {(!isControlled || children) && (
        <DialogTrigger asChild>
          {children || (
            <Button className="gap-2 shadow-lg hover:shadow-primary/25 transition-all bg-primary text-primary-foreground">
              <Plus className="w-4 h-4" /> New Study Set
            </Button>
          )}
        </DialogTrigger>
      )}
      
      <DialogContent className="sm:max-w-[500px] bg-background/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Create Study Set
          </DialogTitle>
          <DialogDescription>
            Upload content to generate Quizzes, Notes, and Flashcards instantly.
          </DialogDescription>
        </DialogHeader>

        {/* --- TABS --- */}
        <Tabs defaultValue="file" value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="file" disabled={isBusy}>
              <Upload className="w-4 h-4 mr-2" /> File
            </TabsTrigger>
            <TabsTrigger value="text" disabled={isBusy}>
              <Type className="w-4 h-4 mr-2" /> Text
            </TabsTrigger>
            <TabsTrigger value="youtube" disabled={isBusy}>
              <Youtube className="w-4 h-4 mr-2" /> YouTube
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: File Upload */}
          <TabsContent value="file" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file-drop">Upload Document</Label>
              
              {!file ? (
                <div
                  onClick={() => !isBusy && fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "relative group cursor-pointer flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed transition-all duration-200 ease-in-out",
                    isDragging 
                      ? "border-primary bg-primary/5 ring-4 ring-primary/10" 
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                    isBusy ? "opacity-50 cursor-not-allowed" : ""
                  )}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.docx,.txt,.md"
                    disabled={isBusy}
                  />
                  <div className="flex flex-col items-center justify-center space-y-3 text-center p-4">
                    <div className={cn(
                      "p-3 rounded-full transition-colors",
                      isDragging ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    )}>
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PDF, DOCX, TXT or MD (max 10MB)
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 border rounded-xl bg-card animate-in fade-in zoom-in-95 duration-200">
                   <div className="flex items-center gap-4 overflow-hidden">
                     <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                       <FileText className="w-6 h-6" />
                     </div>
                     <div className="min-w-0 space-y-1">
                       <p className="text-sm font-medium truncate max-w-[200px] sm:max-w-[260px]">{file.name}</p>
                       <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                     </div>
                   </div>
                   <Button 
                     variant="ghost" 
                     size="icon" 
                     onClick={() => setFile(null)} 
                     disabled={isBusy}
                     className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                   >
                     <X className="w-5 h-5" />
                   </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab 2: Raw Text */}
          <TabsContent value="text" className="space-y-4 py-4">
             <div className="space-y-2">
                <Label htmlFor="text-content">Paste Notes or Essay</Label>
                <Textarea 
                   id="text-content"
                   placeholder="Paste your lecture notes, essay, or summary here..."
                   className="min-h-[150px] resize-none"
                   value={text}
                   onChange={(e) => setText(e.target.value)}
                   disabled={isBusy}
                />
             </div>
          </TabsContent>

          {/* Tab 3: YouTube */}
          <TabsContent value="youtube" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="youtube-url">Video URL</Label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="youtube-url" 
                  placeholder="https://youtube.com/watch?v=..." 
                  className="pl-9"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={isBusy}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Only English videos with captions are currently supported.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* --- PROGRESS SECTION --- */}
        {isBusy && (
          <div className="py-4 space-y-3 bg-muted/30 rounded-lg px-4 border border-border/50 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2 text-primary font-medium">
                 {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                 {currentStatus}
              </span>
              <span className="text-muted-foreground text-xs font-mono">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* --- FOOTER --- */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => setIsOpen && setIsOpen(false)} 
            disabled={isBusy}
          >
            Cancel
          </Button>
          
          <Button 
            onClick={handleSubmit} 
            disabled={isBusy || !canSubmit}
            className="min-w-[140px] shadow-md transition-all hover:shadow-primary/20"
          >
            {isBusy ? 'Processing...' : 'Generate Workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}