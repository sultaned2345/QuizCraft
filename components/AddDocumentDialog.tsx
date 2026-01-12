// src/components/AddDocumentDialog.tsx
'use client';

import { useState, useEffect } from 'react';
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
  Youtube, 
  Plus, 
  Loader2, 
  FileText, 
  Link as LinkIcon, 
  Sparkles,
  Type
} from 'lucide-react';
import { useTurboGenerator } from '@/hooks/useTurboGenerator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext'; // Added: Auth Context for token
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
  // --- STATE ---
  // Internal state for uncontrolled usage
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalIsOpen;
  const setIsOpen = isControlled ? setControlledOpen : setInternalIsOpen;

  // Form State
  const [activeTab, setActiveTab] = useState('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  // Hooks
  const { generate, isGenerating, progress, status } = useTurboGenerator();
  const { toast } = useToast();
  const { session } = useAuth(); // Get active session

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      // Small delay to allow animation to finish before clearing
      const timer = setTimeout(() => {
        setFile(null);
        setText('');
        setYoutubeUrl('');
        setIsParsing(false);
        setActiveTab('file');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    try {
      let contentToProcess = '';
      let metadata = {};

      // 1. Prepare Content
      if (activeTab === 'file' && file) {
        setIsParsing(true);
        const formData = new FormData();
        formData.append('file', file);
        
        // FIX: Add Authorization Header
        const headers: Record<string, string> = {};
        if (session?.access_token) {
           headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const parseRes = await fetch('/api/parse-file', {
          method: 'POST',
          headers, // Pass headers to authorize request
          body: formData
        });

        if (!parseRes.ok) {
           // Handle 401 specifically or generic errors
           if (parseRes.status === 401) throw new Error("Unauthorized: Please sign in.");
           const err = await parseRes.json();
           throw new Error(err.error || 'Failed to parse file');
        }

        const data = await parseRes.json();
        // The API returns { success: true, data: { text: "..." } } based on your route file
        contentToProcess = data.data?.text || ''; 
        metadata = { fileName: file.name, fileType: file.type };
        setIsParsing(false);

      } else if (activeTab === 'text' && text) {
        contentToProcess = text;
        metadata = { fileName: 'Untitled Notes', fileType: 'text/plain' };

      } else if (activeTab === 'youtube' && youtubeUrl) {
        contentToProcess = youtubeUrl;
        metadata = { source: 'youtube' };
      }

      if (!contentToProcess) {
        throw new Error('Please provide content to process.');
      }

      // 2. Start Generation
      // Note: useTurboGenerator should also be updated to use the session token if it isn't already.
      await generate('quiz', contentToProcess, metadata);

      // 3. Success
      if (onUploadComplete) onUploadComplete();
      
      // Close dialog only if successful
      if (setIsOpen) setIsOpen(false);
      
    } catch (error: any) {
      console.error("Generation failed", error);
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
      setIsParsing(false);
    }
  };

  const isBusy = isParsing || isGenerating;
  const canSubmit = 
    (activeTab === 'file' && !!file) ||
    (activeTab === 'text' && !!text.trim()) ||
    (activeTab === 'youtube' && !!youtubeUrl.trim());

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
            <div className="grid w-full items-center gap-3">
              <Label htmlFor="file">Document (PDF, DOCX, TXT)</Label>
              <div className={cn(
                  "flex items-center gap-3 border-2 border-dashed rounded-xl p-6 transition-colors",
                  file ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20 hover:border-primary/30 hover:bg-muted/30"
                )}>
                <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center border shadow-sm shrink-0">
                  {file ? <FileText className="w-5 h-5 text-primary" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  {file ? (
                     <div className="space-y-1">
                       <p className="text-sm font-medium truncate">{file.name}</p>
                       <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                     </div>
                  ) : (
                    <div className="relative">
                       <p className="text-sm text-muted-foreground font-medium">Click to browse or drop file</p>
                       <Input 
                        id="file" 
                        type="file" 
                        accept=".pdf,.docx,.txt,.md"
                        onChange={handleFileChange}
                        disabled={isBusy}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                       />
                    </div>
                  )}
                </div>
                {file && (
                  <Button variant="ghost" size="icon" onClick={() => setFile(null)} disabled={isBusy}>
                     <span className="sr-only">Remove</span>
                     <div className="w-4 h-4 rounded-full bg-muted-foreground/30 hover:bg-destructive hover:text-white transition-colors flex items-center justify-center">×</div>
                  </Button>
                )}
              </div>
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
                 {isParsing ? 'Parsing Document...' : status}
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
            {isBusy ? 'Processing...' : 'Generate Magic'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}