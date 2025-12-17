'use client';

import { useState } from 'react';
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Youtube, Upload, Plus, Link as LinkIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export function AddDocumentDialog({ children, onSuccess }: { children?: React.ReactNode, onSuccess?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('file');
  
  // Form States
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  
  const { toast } = useToast();
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      let result;

      // --- 1. HANDLE FILE UPLOAD ---
      if (activeTab === 'file') {
        if (!file) {
          toast({ title: "No file selected", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Uses your existing parse-file route (or create a specific upload doc route)
        // Assuming we adapt /api/upload or similar to just save as document
        // For now, let's assume we use a dedicated route or reuse the logic
        // We'll use a direct upload endpoint concept here:
        const res = await fetch('/api/documents/upload', { // We might need to create this simple route
           method: 'POST',
           body: formData
        });
        
        if (!res.ok) throw new Error("Upload failed");
        result = await res.json();
      } 

      // --- 2. HANDLE YOUTUBE ---
      else if (activeTab === 'youtube') {
        if (!youtubeUrl) {
          toast({ title: "URL missing", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        // Reuse your generate-from-youtube route but simpler? 
        // Actually, your generate-from-youtube route ALREADY creates a document now!
        // We just call it and ignore the quiz part if we only want the doc, 
        // or we accept that it makes a quiz too.
        const res = await fetch('/api/generate-from-youtube', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl: youtubeUrl })
        });

        if (!res.ok) {
           const err = await res.json();
           throw new Error(err.message || "Failed to process video");
        }
        result = await res.json();
      }

      toast({ title: "Success", description: "Document added to your library." });
      setIsOpen(false);
      setFile(null);
      setYoutubeUrl('');
      
      router.refresh(); // Refresh server components
      if (onSuccess) onSuccess();

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="gap-2">
            <Plus className="w-4 h-4" /> Add Content
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Library</DialogTitle>
          <DialogDescription>
            Upload a file or paste a YouTube link to generate a study document.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="file" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">
              <Upload className="w-4 h-4 mr-2" /> Upload File
            </TabsTrigger>
            <TabsTrigger value="youtube">
              <Youtube className="w-4 h-4 mr-2" /> YouTube
            </TabsTrigger>
          </TabsList>

          {/* Tab: File Upload */}
          <TabsContent value="file" className="space-y-4 py-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="file">Document (PDF, DOCX, TXT)</Label>
              <div className="flex items-center gap-2 border rounded-md p-2 bg-muted/50">
                <Input 
                   id="file" 
                   type="file" 
                   accept=".pdf,.docx,.txt,.md"
                   onChange={handleFileChange}
                   className="border-0 shadow-none bg-transparent"
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab: YouTube */}
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
                />
              </div>
              <p className="text-xs text-muted-foreground">
                We'll extract the transcript and create a study guide.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading || (!file && !youtubeUrl)}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {activeTab === 'youtube' ? 'Process Video' : 'Upload'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}