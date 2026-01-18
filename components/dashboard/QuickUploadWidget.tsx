'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileText, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export function QuickUploadWidget() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Upload to your existing API
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      
      const data = await res.json();
      
      toast({ title: "Success", description: "Analyzing document..." });
      
      // REDIRECT: Go straight to the new "Study Workspace"
      router.push(`/documents/${data.id}?view=chat`); 
      
    } catch (error) {
      toast({ title: "Error", description: "Could not upload file", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card 
      className={`border-dashed border-2 transition-all cursor-pointer group relative overflow-hidden
        ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'}
      `}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
      }}
      onClick={() => document.getElementById('quick-upload')?.click()}
    >
      <input 
        id="quick-upload" 
        type="file" 
        className="hidden" 
        accept=".pdf,.docx,.txt"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      />
      
      <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-4">
        <div className={`
          h-16 w-16 rounded-2xl flex items-center justify-center transition-all duration-500
          ${isUploading ? 'bg-primary/20 scale-110' : 'bg-secondary/30 group-hover:bg-primary/10 group-hover:scale-105'}
        `}>
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          ) : (
            <Sparkles className="h-8 w-8 text-secondary-foreground group-hover:text-primary transition-colors" />
          )}
        </div>
        
        <div className="space-y-1">
          <h3 className="font-serif text-xl font-medium">
            {isUploading ? "Initializing Workspace..." : "Drop to Study"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
            Upload a PDF, audio, or note to instantly start chatting and quizzing.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}