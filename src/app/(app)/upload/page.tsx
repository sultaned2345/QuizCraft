"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  UploadCloud, 
  FileText, 
  Link as LinkIcon, 
  Youtube, 
  Type, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

export default function UploadPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Form States
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- File Upload Logic ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 300);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) throw new Error("Upload failed");
      
      const data = await response.json();
      setUploadProgress(100);
      
      toast({
        title: "Success",
        description: "Document uploaded successfully. Generating quiz...",
      });

      // Redirect to the new document or quiz page
      router.push(`/documents/${data.id}`);
      
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload file. Please try again.",
      });
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  // --- URL Logic ---
  const handleUrlSubmit = async () => {
    if (!urlInput) return;
    setIsUploading(true);
    
    try {
      // Differentiate between YouTube and standard web pages if needed
      const endpoint = urlInput.includes("youtube.com") || urlInput.includes("youtu.be")
        ? "/api/youtube/turbo" // Assuming you have this or similar
        : "/api/documents/url";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
      });

      if (!response.ok) throw new Error("Failed to process URL");
      
      const data = await response.json();
      toast({ title: "Content imported", description: "Redirecting to quiz..." });
      router.push(`/documents/${data.id}`); // Or wherever your flow goes

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not import content from this URL.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // --- Text Logic ---
  const handleTextSubmit = async () => {
    if (!textInput) return;
    setIsUploading(true);

    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: textInput, 
          title: "Pasted Text Note", 
          type: "text" 
        }),
      });

      if (!response.ok) throw new Error("Failed to process text");
      
      const data = await response.json();
      router.push(`/documents/${data.id}`);

    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not process text." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container max-w-5xl mx-auto py-10 px-4 space-y-8">
      
      {/* Header Section */}
      <div className="text-center space-y-4 mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Create New Quiz
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Turn any content into an interactive quiz. Upload a PDF, paste a link, or type your notes directly.
        </p>
      </div>

      {/* Main Upload Area */}
      <Card className="border-border/50 shadow-xl bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <Tabs defaultValue="file" className="w-full space-y-6">
            
            <TabsList className="grid w-full grid-cols-3 h-14 p-1 bg-muted/50 rounded-lg">
              <TabsTrigger value="file" className="h-full space-x-2 text-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                <UploadCloud className="w-5 h-5" />
                <span>Upload File</span>
              </TabsTrigger>
              <TabsTrigger value="url" className="h-full space-x-2 text-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                <LinkIcon className="w-5 h-5" />
                <span>Web / YouTube</span>
              </TabsTrigger>
              <TabsTrigger value="text" className="h-full space-x-2 text-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                <Type className="w-5 h-5" />
                <span>Paste Text</span>
              </TabsTrigger>
            </TabsList>

            {/* --- File Upload Tab --- */}
            <TabsContent value="file" className="mt-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ease-in-out
                  ${isDragging 
                    ? "border-primary bg-primary/10 scale-[1.01]" 
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"}
                `}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pdf,.docx,.txt,.md"
                  onChange={handleFileSelect}
                />
                
                <div className="flex flex-col items-center gap-4">
                  <div className={`p-4 rounded-full ${isDragging ? "bg-primary/20" : "bg-muted"}`}>
                    <UploadCloud className={`w-10 h-10 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold">
                      {isDragging ? "Drop file here" : "Click to upload or drag & drop"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      PDF, DOCX, TXT, or MD (max 10MB)
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* --- URL Tab --- */}
            <TabsContent value="url" className="mt-6 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-muted/30 border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setUrlInput("")}>
                    <CardHeader className="space-y-1">
                      <div className="flex items-center space-x-2 text-primary">
                        <Youtube className="w-6 h-6" />
                        <CardTitle className="text-base">YouTube Video</CardTitle>
                      </div>
                      <CardDescription>Generate from any public video URL</CardDescription>
                    </CardHeader>
                  </Card>
                  
                  <Card className="bg-muted/30 border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader className="space-y-1">
                      <div className="flex items-center space-x-2 text-blue-500">
                        <FileText className="w-6 h-6" />
                        <CardTitle className="text-base">Article / Blog</CardTitle>
                      </div>
                      <CardDescription>Paste any webpage link to study</CardDescription>
                    </CardHeader>
                  </Card>
                </div>

                <div className="flex gap-2">
                  <Input 
                    placeholder="https://..." 
                    value={urlInput} 
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="h-12 text-lg"
                  />
                  <Button size="lg" className="h-12 px-8" onClick={handleUrlSubmit} disabled={!urlInput || isUploading}>
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Import"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* --- Text Tab --- */}
            <TabsContent value="text" className="mt-6 space-y-4">
              <Textarea 
                placeholder="Paste your study notes, essay, or raw text here..." 
                className="min-h-[300px] p-4 text-base resize-none focus-visible:ring-primary"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <div className="flex justify-end">
                <Button size="lg" onClick={handleTextSubmit} disabled={!textInput || isUploading}>
                  {isUploading ? "Processing..." : "Generate Quiz"}
                </Button>
              </div>
            </TabsContent>

          </Tabs>

          {/* Loading / Progress State */}
          {isUploading && (
            <div className="mt-6 space-y-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Processing content...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

        </CardContent>
      </Card>

      {/* Info / Disclaimer */}
      <div className="flex justify-center">
        <Alert className="max-w-2xl bg-muted/50 border-none">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Note on AI Generation</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            QuizCraft uses AI to analyze your content. Large files may take up to 30-60 seconds to process. 
            Ensure your document text is readable (scanned PDFs without OCR may not work).
          </AlertDescription>
        </Alert>
      </div>

    </div>
  );
}