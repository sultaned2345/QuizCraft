// src/components/AddDocumentDialog.tsx
'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Youtube, Plus, Loader2, FileText, Link as LinkIcon } from 'lucide-react';
import { useTurboGenerator } from '@/hooks/useTurboGenerator';

export function AddDocumentDialog({ children }: { children?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('file');
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  
  // Connect to our new Turbo Hook
  const { generateStudySet, isProcessing, progress } = useTurboGenerator();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    // 1. Determine Input Source
    if (activeTab === 'file' && file) {
      await generateStudySet(file, undefined); // Pass file
    } else if (activeTab === 'youtube' && youtubeUrl) {
      await generateStudySet(null, youtubeUrl); // Pass URL
    }
    
    // Note: We don't close the dialog immediately so the user can see the progress steps.
    // The hook will redirect the user when finished, or we can close it manually if we prefer.
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="gap-2 shadow-lg hover:shadow-xl transition-all bg-primary text-primary-foreground">
            <Plus className="w-4 h-4" /> New Study Set
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle>Create Study Set</DialogTitle>
          <DialogDescription>
            Upload a document or paste a YouTube link. AI will generate Notes, Quizzes, and Flashcards simultaneously.
          </DialogDescription>
        </DialogHeader>

        {/* Input Tabs */}
        <Tabs defaultValue="file" value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">
              <Upload className="w-4 h-4 mr-2" /> Upload File
            </TabsTrigger>
            <TabsTrigger value="youtube">
              <Youtube className="w-4 h-4 mr-2" /> YouTube
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: File Upload */}
          <TabsContent value="file" className="space-y-4 py-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="file">File (PDF, DOCX, TXT)</Label>
              <div className="flex items-center gap-2 border rounded-md p-2 bg-muted/50 transition-colors hover:bg-muted">
                <FileText className="w-4 h-4 text-muted-foreground ml-2" />
                <Input 
                   id="file" 
                   type="file" 
                   accept=".pdf,.docx,.txt,.md,.pptx"
                   onChange={handleFileChange}
                   disabled={isProcessing}
                   className="border-0 shadow-none bg-transparent file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Max size: 10MB</p>
            </div>
          </TabsContent>

          {/* TAB 2: YouTube URL */}
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
                  disabled={isProcessing}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                We'll transcribe the video and generate study materials from the audio.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Progress Feedback Section */}
        {isProcessing && (
          <div className="py-4 space-y-3 bg-muted/30 rounded-lg px-4 border border-border/50">
            <div className="flex items-center gap-2 text-primary font-mono text-sm animate-pulse">
               <Loader2 className="w-4 h-4 animate-spin" />
               <span>PROCESSING DATA STREAMS...</span>
            </div>
            {/* Scrollable Progress Log */}
            <div className="space-y-1.5 pl-1 max-h-[100px] overflow-y-auto custom-scrollbar">
              {progress.map((msg, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full ${msg.includes('❌') ? 'bg-red-500' : msg.includes('✅') ? 'bg-emerald-500' : 'bg-yellow-500 animate-pulse'}`} />
                  <span className={msg.includes('✅') ? 'text-emerald-500' : 'text-muted-foreground'}>{msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isProcessing}>
            Cancel
          </Button>
          
          <Button 
            onClick={handleSubmit} 
            disabled={isProcessing || (activeTab === 'file' ? !file : !youtubeUrl)}
            className="min-w-[140px]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Magic'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}