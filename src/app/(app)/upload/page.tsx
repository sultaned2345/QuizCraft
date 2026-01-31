// src/app/(app)/upload/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUp, Youtube, FileText, Loader2, Mic, ScanEye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AudioInput } from '@/components/AudioInput';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function UploadPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('file');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Uploading & Starting AI...');
  
  const [file, setFile] = useState<File | null>(null);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // OCR specific state
  const [isOcrRequired, setIsOcrRequired] = useState(false);

  // 1. Handle File Upload
  const handleFileUpload = async () => {
    if (!file || !session) return;
    setIsProcessing(true);
    setProcessingMessage('Uploading & Analyzing...');
    setIsOcrRequired(false); // Reset OCR state
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      });

      const data = await response.json();
      
      // Handle Scanned PDF Detection (422)
      if (response.status === 422 && data.code === 'SCANNED_PDF_DETECTED') {
        setIsProcessing(false);
        setIsOcrRequired(true);
        toast({ 
          title: "Scanned Document Detected", 
          description: data.error, 
          variant: "destructive" // Changed to destructive to match typical error styling or use "default"
        });
        return;
      }

      if (!response.ok) throw new Error(data.error || 'Upload failed');
      
      toast({ title: "Upload Complete", description: "Generating study materials..." });
      router.push(`/documents/${data.documentId}`);
      
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  // 1.5 Handle OCR Upload (Fallback)
  const handleOcrUpload = async () => {
    if (!file || !session) return;
    setIsProcessing(true);
    setProcessingMessage('Running OCR (This may take a moment)...');
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/ocr', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'OCR Processing failed');

      toast({ title: "OCR Complete", description: "Text extracted successfully!" });
      router.push(`/documents/${data.documentId}`);

    } catch (error: any) {
      console.error(error);
      toast({ title: "OCR Error", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  // 2. Handle Text Upload
  const handleTextUpload = async () => {
    if (!textTitle || !textContent || !session) return;
    setIsProcessing(true);
    setProcessingMessage('Processing text...');
    
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

  // 3. Handle YouTube
  const handleYoutubeUpload = async () => {
    if (!youtubeUrl || !session) return;
    setIsProcessing(true);
    setProcessingMessage('Analyzing video...');
    
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

  const handleAudioComplete = async (documentId: string) => {
    router.push(`/documents/${documentId}`);
  };

  if (isProcessing) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
        <div className="flex flex-col items-center gap-4">
           <Loader2 className="w-12 h-12 text-primary animate-spin" />
           <h2 className="text-xl font-medium">{processingMessage}</h2>
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
              
              {!isOcrRequired ? (
                <>
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                     <FileUp className="w-10 h-10 text-primary" />
                  </div>
                  <Input 
                    id="document" 
                    type="file" 
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      setIsOcrRequired(false); // Reset OCR if file changes
                    }} 
                    accept=".pdf,.docx,.txt,.md,.pptx" 
                    className="hidden" 
                  />
                  <label htmlFor="document" className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 rounded-xl flex items-center">
                    Select File
                  </label>
                  {file && (
                     <div className="flex items-center gap-4 p-4 bg-background border rounded-xl w-full max-w-sm mt-4">
                        <span className="truncate flex-1">{file.name}</span>
                        <Button onClick={handleFileUpload} size="sm">Upload</Button>
                     </div>
                  )}
                </>
              ) : (
                /* OCR Fallback UI */
                <div className="w-full max-w-md space-y-4">
                  <Alert variant="destructive" className="border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400">
                    <ScanEye className="h-4 w-4" />
                    <AlertTitle>No text found!</AlertTitle>
                    <AlertDescription>
                      This looks like a scanned document or image. We can use Optical Character Recognition (OCR) to read it.
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" onClick={() => { setIsOcrRequired(false); setFile(null); }}>
                      Cancel
                    </Button>
                    <Button onClick={handleOcrUpload} className="bg-orange-600 hover:bg-orange-700 text-white">
                      <ScanEye className="w-4 h-4 mr-2" />
                      Process with OCR
                    </Button>
                  </div>
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

        <TabsContent value="youtube" className="mt-0">
          <Card>
            <CardHeader><CardTitle>YouTube URL</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="https://youtube.com/..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
              <Button onClick={handleYoutubeUpload} disabled={!youtubeUrl} className="w-full">Process Video</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audio" className="mt-0">
           <AudioInput onTranscriptionComplete={handleAudioComplete} />
        </TabsContent>
      </Tabs>
    </div>
  );
}