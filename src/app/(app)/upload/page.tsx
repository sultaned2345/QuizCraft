'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUp, Youtube, FileText, Loader2, Mic } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AudioInput } from '@/components/AudioInput';

export default function UploadPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('file');
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // 1. Handle File Upload (Backend Driven)
  const handleFileUpload = async () => {
    if (!file || !session) return;
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      
      // Success: Redirect immediately. The backend is doing the work.
      toast({ title: "Upload Complete", description: "We are generating your study materials in the background." });
      router.push(`/documents/${data.documentId}`);
      
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  // 2. Handle Text Upload (Backend Driven)
  const handleTextUpload = async () => {
    if (!textTitle || !textContent || !session) return;
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/documents/create-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ title: textTitle, content: textContent }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      
      toast({ title: "Saved", description: "Processing your text..." });
      router.push(`/documents/${data.documentId}`);
      
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  // 3. Handle YouTube (Backend Driven)
  const handleYoutubeUpload = async () => {
    if (!youtubeUrl || !session) return;
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/generate-from-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Processing failed');

      if (data.documentId) {
          router.push(`/documents/${data.documentId}`);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  // 4. Audio Handler
  const handleAudioComplete = async (documentId: string) => {
    // Audio component handles the upload, we just redirect
    router.push(`/documents/${documentId}`);
  };

  // Loading Overlay
  if (isProcessing) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
        <div className="flex flex-col items-center gap-4">
           <Loader2 className="w-12 h-12 text-primary animate-spin" />
           <h2 className="text-xl font-medium">Uploading & Starting AI...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-10 text-center">
         <h1 className="text-4xl font-serif font-medium mb-3">Upload Content</h1>
         <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Upload content and we'll process it in the background.
         </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8 h-14 p-1 bg-muted/50 rounded-2xl">
          <TabsTrigger value="file" className="rounded-xl h-12"><FileUp className="w-4 h-4 mr-2" /> File</TabsTrigger>
          <TabsTrigger value="text" className="rounded-xl h-12"><FileText className="w-4 h-4 mr-2" /> Text</TabsTrigger>
          <TabsTrigger value="youtube" className="rounded-xl h-12"><Youtube className="w-4 h-4 mr-2" /> YouTube</TabsTrigger>
          <TabsTrigger value="audio" className="rounded-xl h-12"><Mic className="w-4 h-4 mr-2" /> Audio</TabsTrigger>
        </TabsList>
        
        {/* File Tab */}
        <TabsContent value="file" className="mt-0">
          <Card className="border-2 border-dashed border-border/60 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                 <FileUp className="w-10 h-10 text-primary" />
              </div>
              <Input id="document" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".pdf,.docx,.txt,.md" className="hidden" />
              <label htmlFor="document" className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 rounded-xl flex items-center">
                Select File
              </label>
              {file && (
                 <div className="flex items-center gap-4 p-4 bg-background border rounded-xl w-full max-w-sm mt-4">
                    <span className="truncate flex-1">{file.name}</span>
                    <Button onClick={handleFileUpload} size="sm">Upload</Button>
                 </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Text Tab */}
        <TabsContent value="text" className="mt-0">
          <Card>
            <CardHeader><CardTitle>Paste Text</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Title" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} />
              <Textarea placeholder="Paste content..." className="min-h-[200px]" value={textContent} onChange={(e) => setTextContent(e.target.value)} />
              <Button onClick={handleTextUpload} disabled={!textTitle || !textContent} className="w-full">Process Text</Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* YouTube Tab */}
        <TabsContent value="youtube" className="mt-0">
          <Card>
            <CardHeader><CardTitle>YouTube URL</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="https://youtube.com/..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
              <Button onClick={handleYoutubeUpload} disabled={!youtubeUrl} className="w-full">Process Video</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audio Tab */}
        <TabsContent value="audio" className="mt-0">
           <AudioInput onTranscriptionComplete={handleAudioComplete} />
        </TabsContent>
      </Tabs>
    </div>
  );
}