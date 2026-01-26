'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  UploadCloud, 
  Youtube, 
  Sparkles,
  Loader2,
  PlayCircle,
  FileText
} from 'lucide-react';
import { QuickUploadWidget } from '@/components/dashboard/QuickUploadWidget'; 

export default function NewContentPage() {
  const router = useRouter();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Helper to extract ID client-side for instant preview
  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  // Auto-detect video ID when URL changes
  useEffect(() => {
    const id = extractVideoId(youtubeUrl);
    setVideoId(id);
  }, [youtubeUrl]);

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    
    setLoading(true);
    // Redirect to the Turbo page which handles the actual processing
    router.push(`/youtube?url=${encodeURIComponent(youtubeUrl)}`);
  };

  return (
    <div className="container max-w-7xl py-8 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Add New Content</h1>
        <p className="text-muted-foreground text-lg">
          Import study materials. Use YouTube Turbo for instant quizzes or upload files.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT COLUMN: YouTube Turbo (Spans 2 columns on large screens) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg border-indigo-500/20 overflow-hidden relative border-t-4 border-t-red-600 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="w-6 h-6 text-indigo-500" />
                YouTube Turbo Mode
              </CardTitle>
              <CardDescription className="text-base">
                Paste a YouTube URL. We'll watch it, extract the transcript, and generate 
                <strong> study notes, a quiz, and a chatbot</strong> instantly.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <form onSubmit={handleYoutubeSubmit} className="flex flex-col gap-4">
                <div className="space-y-3">
                  <Label htmlFor="youtube-url" className="text-base font-semibold">
                    Paste Video Link
                  </Label>
                  <div className="relative">
                    <Input 
                      id="youtube-url" 
                      placeholder="https://www.youtube.com/watch?v=..." 
                      className="h-14 text-lg pl-12 shadow-sm border-2 focus-visible:ring-offset-2"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                    />
                    <Youtube className="absolute left-4 top-4 h-6 w-6 text-red-600" />
                  </div>
                </div>

                {/* VIDEO PREVIEW SECTION */}
                <div className={`transition-all duration-500 ease-in-out overflow-hidden rounded-xl bg-black/5 ${videoId ? 'opacity-100 max-h-[600px] border shadow-xl' : 'opacity-0 max-h-0'}`}>
                  {videoId && (
                    <div className="aspect-video w-full">
                       <iframe 
                        width="100%" 
                        height="100%" 
                        src={`https://www.youtube.com/embed/${videoId}`} 
                        title="YouTube video player" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                        className="w-full h-full"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-2">
                   <Button 
                     size="lg" 
                     className="w-full bg-red-600 hover:bg-red-700 text-white h-14 text-lg font-semibold shadow-md hover:shadow-xl transition-all"
                     disabled={loading || !youtubeUrl}
                     type="submit"
                   >
                     {loading ? (
                       <><Loader2 className="mr-2 h-6 w-6 animate-spin"/> Processing...</>
                     ) : (
                       <><PlayCircle className="mr-2 h-6 w-6" /> Start Turbo Generation</>
                     )}
                   </Button>
                </div>
              </form>

              {/* Feature Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t mt-4">
                  <div className="bg-muted/40 p-3 rounded-lg border text-center text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4" /> Instant Transcript
                  </div>
                  <div className="bg-muted/40 p-3 rounded-lg border text-center text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" /> AI Summary
                  </div>
                  <div className="bg-muted/40 p-3 rounded-lg border text-center text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
                    <Youtube className="w-4 h-4" /> Auto-Quiz
                  </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: File Upload */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-dashed border-2 shadow-sm bg-muted/5 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5" /> 
                Upload Files
              </CardTitle>
              <CardDescription>
                Drag & drop course materials. <br/>
                <span className="text-xs">Supports PDF, DOCX, TXT.</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Re-using your existing widget */}
              <QuickUploadWidget />
            </CardContent>
          </Card>

          {/* Optional: Text Note Shortcut */}
          <Card className="shadow-sm bg-background border hover:border-indigo-500/50 transition-colors cursor-pointer" onClick={() => router.push('/notes/new')}>
             <CardContent className="pt-6 pb-6 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                    <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex flex-col">
                    <span className="font-semibold text-sm">Paste Text Note</span>
                    <span className="text-xs text-muted-foreground">Manually create quizzes</span>
                </div>
             </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}