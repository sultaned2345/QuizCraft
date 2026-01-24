// src/app/(app)/upload/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  UploadCloud, 
  Youtube, 
  FileText, 
  Type, 
  ArrowRight, 
  Loader2, 
  Sparkles,
  BookOpen,
  Brain,
  MessageSquare
} from 'lucide-react';
// FIX: Use named import (curly braces)
import { QuickUploadWidget } from '@/components/dashboard/QuickUploadWidget'; 

export default function NewContentPage() {
  const router = useRouter();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // --- HANDLER: YouTube ---
  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    
    setLoading(true);
    // Redirect to the Turbo page with the URL encoded
    // This triggers the auto-start logic in /youtube/page.tsx
    router.push(`/youtube?url=${encodeURIComponent(youtubeUrl)}`);
  };

  return (
    <div className="container max-w-4xl py-10 space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Add New Content</h1>
        <p className="text-muted-foreground text-lg">
          Import study materials to automatically generate quizzes, flashcards, and notes.
        </p>
      </div>

      <Tabs defaultValue="youtube" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-16 p-1 bg-muted/50 rounded-xl">
           <TabsTrigger value="youtube" className="rounded-lg h-14 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-red-600 transition-all">
            <Youtube className="w-5 h-5 mr-2" />
            <div className="flex flex-col items-start text-left">
                <span className="font-semibold text-sm">YouTube Turbo</span>
                <span className="text-xs text-muted-foreground font-normal">Video to Quiz</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="file" className="rounded-lg h-14 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
            <UploadCloud className="w-5 h-5 mr-2" /> 
            <div className="flex flex-col items-start text-left">
                <span className="font-semibold text-sm">Upload File</span>
                <span className="text-xs text-muted-foreground font-normal">PDF, DOCX, TXT</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="text" className="rounded-lg h-14 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
            <Type className="w-5 h-5 mr-2" />
            <div className="flex flex-col items-start text-left">
                <span className="font-semibold text-sm">Paste Text</span>
                <span className="text-xs text-muted-foreground font-normal">Notes & Articles</span>
            </div>
          </TabsTrigger>
        </TabsList>

        {/* 1. YOUTUBE TURBO TAB */}
        <TabsContent value="youtube" className="mt-6 space-y-4">
          <Card className="shadow-lg border-indigo-500/20 overflow-hidden relative border-t-4 border-t-red-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                Turbo Study Mode
              </CardTitle>
              <CardDescription className="text-base">
                Paste a YouTube URL below. We'll watch it for you and generate a 
                <strong> transcript, study notes, quiz, and chat bot</strong> instantly.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleYoutubeSubmit} className="flex flex-col gap-6 py-2">
                <div className="space-y-3">
                  <Label htmlFor="youtube-url" className="text-base">YouTube Video Link</Label>
                  <div className="relative">
                    <Input 
                      id="youtube-url" 
                      placeholder="https://www.youtube.com/watch?v=..." 
                      className="h-14 text-lg pl-12 shadow-sm"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                    />
                    <Youtube className="absolute left-4 top-4 h-6 w-6 text-muted-foreground" />
                  </div>
                </div>

                <div className="flex justify-end">
                   <Button 
                     size="lg" 
                     className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto h-12 px-8 text-base shadow-md hover:shadow-xl transition-all"
                     disabled={loading || !youtubeUrl}
                   >
                     {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Sparkles className="mr-2 h-5 w-5 fill-yellow-400 text-yellow-100" />}
                     Start Turbo Mode
                   </Button>
                </div>
              </form>
            </CardContent>

            {/* Feature List Footer */}
            <div className="bg-muted/30 p-6 border-t grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground bg-background/50 p-3 rounded-lg border">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full"><FileText className="w-4 h-4 text-blue-600 dark:text-blue-400"/></div>
                    <span>Full Transcript</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground bg-background/50 p-3 rounded-lg border">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full"><Brain className="w-4 h-4 text-green-600 dark:text-green-400"/></div>
                    <span>AI Quiz Generation</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground bg-background/50 p-3 rounded-lg border">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full"><MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400"/></div>
                    <span>Interactive Chat</span>
                </div>
            </div>
          </Card>
        </TabsContent>

        {/* 2. FILE UPLOAD TAB */}
        <TabsContent value="file" className="mt-6">
          <Card className="border-dashed border-2 shadow-sm bg-muted/5">
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
              <CardDescription>
                Upload your course materials. We support PDF, DOCX, and TXT files up to 10MB.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuickUploadWidget />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. PASTE TEXT TAB */}
        <TabsContent value="text" className="mt-6">
           <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>Paste Raw Text</CardTitle>
                <CardDescription>
                    Have notes on your clipboard? Create a new Note to analyze them.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center border-2 border-dashed rounded-xl bg-muted/5 hover:bg-muted/10 transition-colors">
                    <div className="p-4 bg-primary/10 rounded-full">
                        <BookOpen className="w-8 h-8 text-primary" />
                    </div>
                    <div className="max-w-sm space-y-2">
                        <h3 className="font-semibold text-lg">Create a New Note</h3>
                        <p className="text-muted-foreground text-sm">
                            Go to the notes editor to paste your content, format it, and generate quizzes directly from there.
                        </p>
                    </div>
                    <Button onClick={() => router.push('/notes/new')} size="lg" className="mt-4">
                        Open Notes Editor <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </CardContent>
           </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}