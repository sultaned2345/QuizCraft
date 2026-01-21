// src/components/dashboard/QuickUploadWidget.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, Loader2, Sparkles, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      
      toast({ title: "Analysis Complete", description: "Redirecting to workspace..." });
      router.push(`/documents/${data.id}?view=chat`); 
      
    } catch (error) {
      toast({ title: "Upload Failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card 
      className={cn(
        "border-2 border-dashed transition-all duration-300 cursor-pointer group relative overflow-hidden bg-card/50",
        isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
      }}
      onClick={() => document.getElementById('quick-upload-input')?.click()}
    >
      <input 
        id="quick-upload-input" 
        type="file" 
        className="hidden" 
        accept=".pdf,.docx,.txt"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      />
      
      <CardContent className="flex flex-row items-center gap-6 p-6">
        {/* Icon Box */}
        <div className={cn(
          "h-20 w-20 shrink-0 rounded-2xl flex items-center justify-center transition-all duration-500",
          isUploading ? "bg-primary/10" : "bg-secondary/20 group-hover:bg-primary/10"
        )}>
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          ) : (
            <UploadCloud className="h-8 w-8 text-secondary-foreground group-hover:text-primary transition-colors" />
          )}
        </div>
        
        {/* Text Content */}
        <div className="space-y-1 text-left">
          <h3 className="font-serif text-xl font-bold text-foreground">
            {isUploading ? "Processing Document..." : "New Study Session"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md font-sans">
            Drop a PDF or notes file here to instantly generate quizzes, summaries, and flashcards.
          </p>
        </div>

        {/* Action Indicator */}
        <div className="ml-auto hidden md:block">
           <div className="h-10 w-10 rounded-full border border-border flex items-center justify-center group-hover:bg-primary group-hover:border-primary group-hover:text-primary-foreground transition-all">
              <Sparkles className="w-5 h-5" />
           </div>
        </div>
      </CardContent>
    </Card>
  );
}