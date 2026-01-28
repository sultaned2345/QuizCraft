// src/app/(app)/upload/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUp, Youtube, FileText, CheckCircle2, Sparkles, Mic } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AudioInput from '@/components/AudioInput';

export default function UploadPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('file');
  
  // Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  
  // Inputs
  const [file, setFile] = useState<File | null>(null);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // --- Helper: Auto-Generate Content ---
  const generateAllContent = async (documentId: string) => {
    if (!session) return;

    try {
      // 1. Generate Notes
      setProcessingStep('Creating smart notes...');
      await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ documentId }),
      });

      // 2. Generate Quiz
      setProcessingStep('Crafting quiz questions...');
      await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ documentId }),
      });

      // 3. Generate Flashcards
      setProcessingStep('Building flashcards...');
      await fetch('/api/generate-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ documentId }),
      });

      setProcessingStep('Finalizing...');
      return true;
    } catch (error) {
      console.error("Generation warning:", error);
      return false;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // --- Handlers ---

  const handleFileUpload = async () => {
    if (!file || !session) return;
    
    setIsProcessing(true);
    setProcessingStep('Uploading document...');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      
      // Trigger Generations
      await generateAllContent(data.documentId);
      
      toast({ title: "Success", description: "Content generated successfully!" });
      
      // REDIRECT TO DOCUMENT PAGE
      router.push(`/documents/${data.documentId}`);
      
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to upload document", variant: "destructive" });
      setIsProcessing(false);
    }
  };

  const handleTextUpload = async () => {
    if (!textTitle || !textContent || !session) return;
    
    setIsProcessing(true);
    setProcessingStep('Saving text...');
    
    try {
      const response = await fetch('/api/documents/create-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ title: textTitle, content: textContent }),
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      
      await generateAllContent(data.documentId);
      
      // REDIRECT TO DOCUMENT PAGE
      router.push(`/documents/${data.documentId}`);
      
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to save text", variant: "destructive" });
      setIsProcessing(false);
    }
  };

  const handleYoutubeUpload = async () => {
    if (!youtubeUrl || !session) return;
    
    setIsProcessing(true);
    setProcessingStep('Analyzing YouTube video...');
    
    try {
      const response = await fetch('/api/generate-from-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      if (!response.ok) throw new Error('Processing failed');
      const data = await response.json();

      if (data.documentId) {
          await generateAllContent(data.documentId);
          // REDIRECT TO DOCUMENT PAGE
          router.push(`/documents/${data.documentId}`);
      } else {
        throw new Error("No document ID returned");
      }
      
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to process YouTube video", variant: "destructive" });
      setIsProcessing(false);
    }
  };

  // --- Loading Overlay Component ---
  if (isProcessing) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
        <div className="w-full max-w-md p-6 text-center space-y-8">
           <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 border-t-4 border-primary rounded-full animate-spin"></div>
              <div className="absolute inset-3 border-t-4 border-secondary rounded-full animate-spin reverse"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <Sparkles className="w-8 h-8 text-primary animate-pulse" />
              </div>
           </div>
           
           <div className="space-y-2">
             <h2 className="text-2xl font-bold animate-pulse">{processingStep}</h2>
             <p className="text-muted-foreground">This uses AI to craft your perfect study set.</p>
           </div>
           
           <div className="flex justify-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Secure</div>
              <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> AI Powered</div>
           </div>
        </div>
      </div>
    );
  }

  // --- Main Render ---
  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-10 text-center">
         <h1 className="text-4xl font-serif font-medium mb-3">Upload Content</h1>
         <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Upload any PDF, text, or video. We'll automatically generate a quiz, notes, and flashcards for you.
         </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8 h-14 p-1 bg-muted/50 rounded-2xl">
          <TabsTrigger value="file" className="rounded-xl h-12 text-base data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileUp className="w-4 h-4 mr-2" /> File
          </TabsTrigger>
          <TabsTrigger value="text" className="rounded-xl h-12 text-base data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="w-4 h-4 mr-2" /> Text
          </TabsTrigger>
          <TabsTrigger value="youtube" className="rounded-xl h-12 text-base data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Youtube className="w-4 h-4 mr-2" /> YouTube
          </TabsTrigger>
          <TabsTrigger value="audio" className="rounded-xl h-12 text-base data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Mic className="w-4 h-4 mr-2" /> Audio
          </TabsTrigger>
        </TabsList>
        
        {/* File Upload Tab */}
        <TabsContent value="file" className="mt-0">
          <Card className="border-2 border-dashed border-border/60 bg-muted/5 shadow-none hover:bg-muted/10 transition-colors">
            <CardContent className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                 <FileUp className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                 <h3 className="text-xl font-medium">Click to upload or drag and drop</h3>
                 <p className="text-muted-foreground text-sm">PDF, DOCX, TXT, or MD (Max 10MB)</p>
              </div>
              <Input 
                id="document" 
                type="file" 
                onChange={handleFileChange} 
                accept=".pdf,.docx,.txt,.md" 
                className="hidden" 
              />
              <label 
                htmlFor="document" 
                className="cursor-pointer inline-flex items-center justify-center rounded-xl text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8"
              >
                Select File
              </label>

              {file && (
                 <div className="flex items-center gap-4 p-4 bg-background border rounded-xl w-full max-w-sm mt-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-2 bg-primary/10 rounded-lg"><FileText className="w-5 h-5 text-primary" /></div>
                    <div className="flex-1 text-left truncate font-medium">{file.name}</div>
                    <Button onClick={handleFileUpload} size="sm">Start Processing</Button>
                 </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Text Tab */}
        <TabsContent value="text" className="mt-0">
          <Card className="shadow-sm border-border/60">
            <CardHeader>
              <CardTitle>Paste Text</CardTitle>
              <CardDescription>Convert raw notes or articles into a study set.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input 
                  id="title" 
                  placeholder="e.g. Biology - Cell Structure" 
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea 
                  id="content" 
                  placeholder="Paste your study material here..." 
                  className="min-h-[300px] resize-y p-4 leading-relaxed"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                />
              </div>
              <Button onClick={handleTextUpload} disabled={!textTitle || !textContent} className="w-full h-12 text-base">
                Generate Study Set
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* YouTube Tab */}
        <TabsContent value="youtube" className="mt-0">
          <Card className="shadow-sm border-border/60">
            <CardHeader>
              <CardTitle>YouTube URL</CardTitle>
              <CardDescription>Paste a video link. We'll extract the transcript and create a quiz.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="youtube-url">Video Link</Label>
                <div className="relative">
                    <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input 
                      id="youtube-url" 
                      placeholder="https://www.youtube.com/watch?v=..." 
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      className="pl-12 h-14 text-lg"
                    />
                </div>
              </div>
              <Button onClick={handleYoutubeUpload} disabled={!youtubeUrl} className="w-full h-12 text-base">
                Process Video
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audio Tab */}
        <TabsContent value="audio" className="mt-0">
           <AudioInput />
        </TabsContent>
        
      </Tabs>
    </div>
  );
}