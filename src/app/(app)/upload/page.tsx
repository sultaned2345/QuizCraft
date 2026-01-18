// src/app/(app)/upload/page.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, Loader2, Sparkles, FolderPlus } from 'lucide-react';
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

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({ title: "File too large", description: "Limit is 10MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Upload the File
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');
      
      const documentId = uploadData.id || uploadData.documentId;
      const fileName = file.name.split('.').slice(0, -1).join('.');

      // 2. Create a "Project" for this file (Turbo Mode)
      // We assume you have an endpoint for creating projects. 
      // If not, you might need to rely on the backend doing this or create a simple API route.
      const projectRes = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: fileName || "New Study Project",
          description: "Auto-generated from Turbo Upload",
          initialDocumentId: documentId // Optional: Tell backend to link this doc
        })
      });

      let projectId;
      if (projectRes.ok) {
        const projectData = await projectRes.json();
        projectId = projectData.id;
      } else {
        // Fallback: If project creation fails (or API doesn't exist yet), 
        // we might just redirect to the document study page.
        // But for "One Big File" feel, we really want a Project.
        console.warn("Could not create project object, defaulting to document view");
      }

      toast({ title: "Turbo Initialized", description: "Building your workspace..." });

      // 3. Redirect
      if (projectId) {
        // Pass 'turbo=true' and 'docId' so the project page knows to start generation
        router.push(`/projects/${projectId}?turbo=true&docId=${documentId}`);
      } else {
        // Fallback to the study hub we built before
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
    <div className="container max-w-5xl mx-auto py-12 min-h-[85vh] flex flex-col items-center justify-center">
      <div className="text-center space-y-6 mb-12">
        <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-1000">
          TURBO WORKSPACE
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Upload a file to generate a complete <strong>Project</strong>. <br/>
          Includes: Quiz, Podcast, Notes, Chat, and Flashcards in one view.
        </p>
      </div>

      <Card
        {...getRootProps()}
        className={cn(
          "relative w-full max-w-3xl h-[400px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all duration-500 overflow-hidden group bg-background/50 backdrop-blur-sm",
          isDragActive ? "border-indigo-500 bg-indigo-500/5 scale-[1.01] shadow-2xl shadow-indigo-500/20" : "border-muted-foreground/20 hover:border-indigo-500/50 hover:bg-muted/30",
          isUploading ? "pointer-events-none" : ""
        )}
      >
        <input {...getInputProps()} />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center space-y-8 p-8 text-center transition-all duration-300">
          {isUploading ? (
            <div className="flex flex-col items-center gap-4">
               <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border-t-4 border-indigo-500 rounded-full animate-spin" />
                  <div className="absolute inset-2 border-b-4 border-purple-500 rounded-full animate-spin direction-reverse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FolderPlus className="w-8 h-8 text-indigo-500 animate-pulse" />
                  </div>
               </div>
               <div className="space-y-1">
                 <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
                   Creating Project...
                 </h3>
                 <p className="text-muted-foreground">Synthesizing AI assets</p>
               </div>
            </div>
          ) : (
            <>
              <div className={cn("p-8 rounded-full bg-muted/50 transition-transform duration-300", isDragActive ? "scale-110 bg-indigo-500/10" : "group-hover:scale-105")}>
                <UploadCloud className={cn("w-16 h-16 transition-colors", isDragActive ? "text-indigo-500" : "text-muted-foreground group-hover:text-indigo-500")} />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-bold tracking-tight">Drop Source File</h3>
                <p className="text-base text-muted-foreground">
                  PDF or TXT (Max 10MB)
                </p>
              </div>
              <Button size="lg" className="mt-4 rounded-full px-8 font-bold shadow-lg shadow-indigo-500/20">
                Select File
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}