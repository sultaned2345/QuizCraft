'use client';

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, Loader2, Link as LinkIcon, Youtube, Zap } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function QuickUploadWidget() {
  const router = useRouter();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optional: Add more types if needed, matching the API
    const validTypes = [
      'application/pdf', 
      'text/plain', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    if (!validTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a PDF, DOCX, PPTX, or TXT file.",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Upload the file to Supabase via our API
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // 2. Success! We have the file URL and metadata.
      // Now we can redirect to a "processing" page or the document view.
      // Assuming we want to start a "Project" or "Study Session" with this file:
      
      toast({
        title: "Upload Successful!",
        description: "Your file is ready. Setting up your workspace...",
      });

      // Navigate to a page that will use this file. 
      // You might pass the file URL as a query param or create a 'Project' first.
      // For now, let's assume we go to a generic 'new project' page with the file URL.
      // Alternatively, if your API created a 'Document' record, use its ID.
      
      // If the API only returned a file path/url (as per my previous fix):
      if (data.file && data.file.url) {
         // Encode the URL to safely pass it
         const encodedUrl = encodeURIComponent(data.file.url);
         // Example: Go to a page that generates content from this URL
         router.push(`/projects/create?docUrl=${encodedUrl}&fileName=${encodeURIComponent(data.file.name)}`);
      } else {
         // Fallback if your API structure is different
         router.push('/dashboard');
      }

    } catch (error: any) {
      console.error(error);
      setIsUploading(false);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Please try again later.",
      });
    }
  };

  return (
    <Card className="group relative h-full overflow-hidden border-2 border-primary/20 shadow-xl bg-background/95 backdrop-blur-sm transition-all duration-500 hover:border-primary/40 hover:shadow-2xl">
      
      {/* 1. Turbo Gradient Top Bar */}
      <div className="absolute top-0 left-0 w-full h-1 overflow-hidden bg-muted">
        <div className={cn(
          "absolute top-0 left-0 h-full w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-transform duration-700 ease-out origin-left",
          isUploading ? "scale-x-100 animate-pulse" : isHovering ? "scale-x-100 opacity-100" : "scale-x-0 opacity-50"
        )} />
        {isUploading && (
           <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
        )}
      </div>

      <CardContent className="p-6 flex flex-col items-center justify-between h-full gap-4 relative z-10">
        
        {/* Header Section */}
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold tracking-tight flex items-center justify-center gap-2">
            <span className="bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
              Quick Upload
            </span>
            <Zap className={cn("w-4 h-4 text-primary", isHovering || isUploading ? "fill-primary" : "")} />
          </h3>
          <p className="text-xs text-muted-foreground font-medium">
            Drag & drop to start studying
          </p>
        </div>

        {/* Central Animation / Upload Zone */}
        <div 
          className="relative w-full flex-1 min-h-[140px] flex items-center justify-center"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <input
            type="file"
            // Accept all supported types
            accept=".pdf,.docx,.pptx,.txt"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
          />

          {/* Rotating Rings Animation (Turbo Style) */}
          <div className="relative w-24 h-24 flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
            {/* Outer Ring */}
            <div className={cn(
              "absolute inset-0 border-4 rounded-full transition-colors duration-500",
              isUploading ? "border-muted" : "border-muted/30 group-hover:border-primary/20"
            )} />
            
            {/* Spinning Ring */}
            <div 
              className={cn(
                "absolute inset-0 border-4 border-t-primary border-r-primary border-b-transparent border-l-transparent rounded-full",
                isUploading ? "animate-spin" : "opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              )}
              style={{ animationDuration: '3s' }}
            />
            
            {/* Reverse Spinning Ring */}
            <div 
              className={cn(
                "absolute inset-2 border-4 border-t-transparent border-r-purple-500 border-b-purple-500 border-l-transparent rounded-full",
                isUploading ? "animate-spin" : "opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              )}
              style={{ animationDirection: 'reverse', animationDuration: '2s' }}
            />
            
            {/* Center Icon */}
            <div className={cn(
              "relative z-10 bg-background rounded-full p-4 shadow-sm transition-all duration-300",
              isHovering && !isUploading ? "scale-110 shadow-primary/20 shadow-lg" : ""
            )}>
               {isUploading ? (
                 <Loader2 className="w-8 h-8 text-primary animate-spin" />
               ) : (
                 <UploadCloud className={cn(
                   "w-8 h-8 transition-colors duration-300",
                   isHovering ? "text-primary" : "text-muted-foreground"
                 )} />
               )}
            </div>
          </div>
          
          {/* Status Text overlay */}
          <div className={cn(
            "absolute bottom-2 text-xs font-bold uppercase tracking-wider transition-all duration-300",
            isUploading ? "text-primary animate-pulse" : "text-muted-foreground opacity-0 group-hover:opacity-100"
          )}>
            {isUploading ? "Uploading..." : "Drop File"}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs h-9 border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 transition-all" 
            onClick={() => router.push('/upload?tab=url')}
          >
            <LinkIcon className="w-3.5 h-3.5 mr-2 text-blue-500" /> 
            Link
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs h-9 border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 transition-all" 
            onClick={() => router.push('/youtube')}
          >
            <Youtube className="w-3.5 h-3.5 mr-2 text-red-500" /> 
            YouTube
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}