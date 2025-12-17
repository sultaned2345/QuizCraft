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
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr'; // Import global mutate to refresh lists

export function AddDocumentDialog({ children }: { children?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('file');
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  
  const { toast } = useToast();
  const { session } = useAuth(); // Get auth token
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    if (!session) {
      toast({ title: "Authentication Error", description: "Please sign in again.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // --- SCENARIO 1: FILE UPLOAD ---
      if (activeTab === 'file') {
        if (!file) {
          toast({ title: "No file selected", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Call your existing documents route which handles parsing & storage
        const res = await fetch('/api/documents', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${session.access_token}`,
           },
           body: formData
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
      } 

      // --- SCENARIO 2: YOUTUBE VIDEO ---
      else if (activeTab === 'youtube') {
        if (!youtubeUrl) {
          toast({ title: "URL missing", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        // Call the generation route (which now saves a document too!)
        const res = await fetch('/api/generate-from-youtube', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ videoUrl: youtubeUrl })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to process video");
      }

      // --- SUCCESS CLEANUP ---
      toast({ title: "Success", description: "Content added to your library." });
      setIsOpen(false);
      setFile(null);
      setYoutubeUrl('');
      
      // Refresh the SWR cache so the list updates instantly
      mutate((key) => typeof key === 'string' && key.startsWith('/api/documents'));
      router.refresh(); 

    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="gap-2 shadow-lg hover:shadow-xl transition-all">
            <Plus className="w-4 h-4" /> Add Content
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Library</DialogTitle>
          <DialogDescription>
            Upload a document or paste a YouTube link to generate AI study materials.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="file" value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
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
              <Label htmlFor="file">File (PDF, DOCX, TXT, PPTX)</Label>
              <div className="flex items-center gap-2 border rounded-md p-2 bg-muted/50 transition-colors hover:bg-muted">
                <Input 
                   id="file" 
                   type="file" 
                   accept=".pdf,.docx,.txt,.md,.pptx"
                   onChange={handleFileChange}
                   className="border-0 shadow-none bg-transparent file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Max size: 10MB</p>
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
              <p className="text-[10px] text-muted-foreground">
                We'll extract the transcript, generate a summary, and create a quiz.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading || (activeTab === 'file' ? !file : !youtubeUrl)}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {activeTab === 'youtube' ? 'Process Video' : 'Upload'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}