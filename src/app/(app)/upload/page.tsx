// src/app/(app)/upload/page.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, Loader2, BookOpen, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function UploadPage() {
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Frontend limit (10MB)
    if (file.size > 10 * 1024 * 1024) { 
      toast({ title: "File too large", description: "Limit is 10MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Upload the File using the Documents API (unified path)
      const uploadRes = await fetch('/api/documents/upload', { 
        method: 'POST', 
        body: formData 
      });

      // Safety check for HTML error pages before parsing JSON
      const contentType = uploadRes.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await uploadRes.text();
        console.error("Server returned non-JSON response:", text);
        throw new Error("Server error: Received HTML instead of JSON. Check backend logs.");
      }

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');
      
      // Accessing ID from the standard response structure in documents/upload/route.ts
      const documentId = uploadData.data.document.id;
      const fileName = file.name.split('.').slice(0, -1).join('.');

      // 2. Create a "Project"
      const projectRes = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: fileName || "New Study Project",
          description: "Auto-generated from Upload",
          initialDocumentId: documentId
        })
      });

      let projectId;
      if (projectRes.ok) {
        const projectData = await projectRes.json();
        projectId = projectData.id;
      } else {
        console.warn("Could not create project object, defaulting to document view");
      }

      toast({ title: "Success", description: "Preparing your study space..." });

      // 3. Redirect to project with turbo parameters to trigger the processing UI
      if (projectId) {
        router.push(`/projects/${projectId}?turbo=true&docId=${documentId}`);
      } else {
        router.push(`/study/${documentId}`);
      }

    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsUploading(false);
    }
  }, [router, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    maxFiles: 1,
    disabled: isUploading
  });

  return (
    <div className="container max-w-4xl mx-auto py-16 min-h-[85vh] flex flex-col items-center justify-center animate-in fade-in duration-700">
      
      <div className="text-center space-y-4 mb-10">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-foreground">
          Upload Material
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto font-serif leading-relaxed">
          Drop your PDF or notes here. We'll organize them into a project with quizzes, summaries, and flashcards.
        </p>
      </div>

      <Card
        {...getRootProps()}
        className={cn(
          "relative w-full max-w-2xl h-[350px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 overflow-hidden bg-card/50 backdrop-blur-sm",
          isDragActive 
            ? "border-secondary bg-secondary/5 scale-[1.01] shadow-xl" 
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          isUploading ? "pointer-events-none" : ""
        )}
      >
        <input {...getInputProps()} />
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center space-y-6 p-8 text-center">
          {isUploading ? (
            <div className="flex flex-col items-center gap-6">
               <div className="relative w-20 h-20 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-xl font-serif font-semibold text-foreground">
                   Analyzing content...
                 </h3>
                 <p className="text-muted-foreground font-sans text-sm">
                   Creating your personalized study guide.
                 </p>
               </div>
            </div>
          ) : (
            <>
              <div className={cn(
                "p-6 rounded-full transition-all duration-300", 
                isDragActive ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}>
                <UploadCloud className="w-10 h-10" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-serif font-semibold text-foreground">
                  {isDragActive ? "Drop file now" : "Click or drag file"}
                </h3>
                <p className="text-sm text-muted-foreground font-sans max-w-xs mx-auto">
                  Supports PDF or TXT (Max 10MB)
                </p>
              </div>

              <Button 
                variant={isDragActive ? "secondary" : "default"}
                className={cn(
                  "mt-4 min-w-[150px] font-sans transition-all",
                  isDragActive ? "bg-secondary hover:bg-secondary/90 text-secondary-foreground" : ""
                )}
              >
                Select Document
              </Button>
            </>
          )}
        </div>
      </Card>
      
      <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground/60">
        <Sparkles className="w-4 h-4" />
        <span>AI-Powered Analysis</span>
      </div>
    </div>
  );
}