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
  
  // State
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Inputs
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. File Upload Logic ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Max 10MB allowed." });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const interval = setInterval(() => setUploadProgress((p) => Math.min(p + 10, 90)), 400);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }
      
      const json = await response.json();
      setUploadProgress(100);

      // FIX: Handle the nested response structure from your API
      // Structure: { success: true, data: { document: { id: "..." } } }
      const docId = json.data?.document?.id || json.id; 

      if (!docId) throw new Error("Invalid server response: Missing document ID");

      toast({ title: "Success", description: "File uploaded. Redirecting..." });
      router.push(`/documents/${docId}`);
      
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: error.message });
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  // --- 2. URL / YouTube Logic ---
  const handleUrlSubmit = async () => {
    if (!urlInput) return;
    setIsUploading(true);
    setUploadProgress(20);
    
    try {
      const isYoutube = urlInput.includes("youtube.com") || urlInput.includes("youtu.be");
      const endpoint = isYoutube ? "/api/youtube/turbo" : "/api/documents/create-from-url";
      
      // Youtube Turbo expects { videoUrl: "..." }
      // Generic URL might expect { url: "..." }
      const body = isYoutube ? { videoUrl: urlInput } : { url: urlInput };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to process URL");
      }
      
      const json = await response.json();
      
      // Check for different ID locations depending on which route answered
      const docId = json.data?.id || json.data?.document?.id || json.id;

      toast({ title: "Content imported", description: "Redirecting..." });
      router.push(isYoutube ? `/study/${docId}` : `/documents/${docId}`); // YouTube goes to study mode usually

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  // --- 3. Text Logic ---
  const handleTextSubmit = async () => {
    if (!textInput) return;
    setIsUploading(true);

    try {
      const response = await fetch("/api/documents/create-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: textInput, 
          title: "Quick Note", 
        }),
      });

      if (!response.ok) throw new Error("Failed to process text");
      
      const json = await response.json();
      const docId = json.data?.document?.id || json.id;
      
      router.push(`/documents/${docId}`);

    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not process text." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container max-w-5xl mx-auto py-10 px-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="text-center space-y-4 mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Create New Quiz
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Turn any content into an interactive quiz. Upload a PDF, paste a link, or type your notes directly.
        </p>
      </div>

      <Card className="border-border/50 shadow-xl bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <Tabs defaultValue="file" className="w-full space-y-6">
            
            <TabsList className="grid w-full grid-cols-3 h-14 p-1 bg-muted/50 rounded-lg">
              <TabsTrigger value="file" className="gap-2 h-full"><UploadCloud className="w-4 h-4" /> Upload File</TabsTrigger>
              <TabsTrigger value="url" className="gap-2 h-full"><LinkIcon className="w-4 h-4" /> Web / YouTube</TabsTrigger>
              <TabsTrigger value="text" className="gap-2 h-full"><Type className="w-4 h-4" /> Paste Text</TabsTrigger>
            </TabsList>

            {/* File Tab */}
            <TabsContent value="file" className="mt-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300
                  ${isDragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-muted-foreground/25 hover:border-primary/50"}
                `}
              >
                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileSelect} />
                <div className="flex flex-col items-center gap-4">
                  <div className={`p-4 rounded-full ${isDragging ? "bg-primary/20" : "bg-muted"}`}>
                    <UploadCloud className={`w-10 h-10 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{isDragging ? "Drop it here!" : "Click to upload"}</h3>
                    <p className="text-sm text-muted-foreground mt-1">PDF, DOCX, TXT (Max 10MB)</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* URL Tab */}
            <TabsContent value="url" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-4 border rounded-lg bg-muted/20 flex gap-3 items-center">
                    <Youtube className="text-red-600 w-8 h-8" />
                    <div><div className="font-semibold">YouTube</div><div className="text-xs text-muted-foreground">Generates transcript & quiz</div></div>
                 </div>
                 <div className="p-4 border rounded-lg bg-muted/20 flex gap-3 items-center">
                    <LinkIcon className="text-blue-500 w-8 h-8" />
                    <div><div className="font-semibold">Web Article</div><div className="text-xs text-muted-foreground">Parses text content</div></div>
                 </div>
              </div>
              <div className="flex gap-2">
                <Input 
                  placeholder="Paste YouTube or Web URL..." 
                  value={urlInput} 
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="h-12 text-lg"
                />
                <Button size="lg" className="h-12 px-8" onClick={handleUrlSubmit} disabled={!urlInput || isUploading}>
                  {isUploading ? <Loader2 className="animate-spin" /> : "Import"}
                </Button>
              </div>
            </TabsContent>

            {/* Text Tab */}
            <TabsContent value="text" className="mt-6 space-y-4">
              <Textarea 
                placeholder="Type or paste your notes here..." 
                className="min-h-[300px] p-4 text-base"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <div className="flex justify-end">
                <Button size="lg" onClick={handleTextSubmit} disabled={!textInput || isUploading}>
                  {isUploading ? "Generating..." : "Create Quiz"}
                </Button>
              </div>
            </TabsContent>

          </Tabs>

          {/* Progress Bar */}
          {isUploading && (
             <div className="mt-6 space-y-2">
               <div className="flex justify-between text-xs text-muted-foreground">
                 <span>Processing...</span><span>{uploadProgress}%</span>
               </div>
               <Progress value={uploadProgress} className="h-2" />
             </div>
          )}
        </CardContent>
      </Card>
      
      {/* Footer Note */}
      <Alert className="bg-muted/50 border-none">
        <AlertCircle className="w-4 h-4" />
        <AlertTitle>Note</AlertTitle>
        <AlertDescription>Large files or long videos may take up to 60 seconds to process.</AlertDescription>
      </Alert>
    </div>
  );
}