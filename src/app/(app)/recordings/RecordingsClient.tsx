'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    Mic, Square, Loader2, FileText, Play, Pause, 
    Sparkles, Trash2, ChevronDown, ChevronUp, Clock 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useRouter } from 'next/navigation';

// Mocking the "Turbo" steps visual
const LoadingSteps = ({ step }: { step: string }) => (
    <div className="flex flex-col items-center justify-center py-8 space-y-4 animate-in fade-in zoom-in duration-300">
        <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin relative z-10" />
        </div>
        <div className="space-y-1 text-center">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {step}
            </h3>
            <p className="text-sm text-muted-foreground">This uses advanced AI to analyze your speech.</p>
        </div>
    </div>
);

export function RecordingsClient() {
  const { session } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [recordings, setRecordings] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [loadingState, setLoadingState] = useState<'idle' | 'uploading' | 'analyzing' | 'finalizing'>('idle');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Audio Playback State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => { fetchRecordings(); }, [session]);

  const fetchRecordings = async () => {
    if (!session) return;
    try {
        const res = await fetch('/api/recordings', { headers: { Authorization: `Bearer ${session.access_token}`}});
        const data = await res.json();
        if (data.success) setRecordings(data.data);
    } catch (e) { console.error(e); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleUpload(audioBlob, duration);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { toast({ title: "Mic Error", description: "Access denied.", variant: "destructive" }); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleUpload = async (blob: Blob, duration: number) => {
    setLoadingState('uploading');
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');
    formData.append('duration', duration.toString());

    try {
      // Simulate "Turbo" steps if upload is fast
      setTimeout(() => setLoadingState('analyzing'), 1500);

      const res = await fetch('/api/recordings/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });

      setLoadingState('finalizing');
      const data = await res.json();
      
      if (!data.success) throw new Error(data.error);
      
      toast({ title: "Recording Processed", description: "Your audio has been analyzed." });
      await fetchRecordings();
      setExpandedId(data.data.id); // Auto-open new recording
    } catch (error: any) { 
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" }); 
    } finally { 
      setLoadingState('idle'); 
    }
  };

  const handlePlay = (rec: any) => {
    if (playingId === rec.id) {
        audioRef.current?.pause();
        setPlayingId(null);
        return;
    }

    if (!rec.storage_path) {
        toast({ title: "Audio unavailable", description: "Original audio not found.", variant: "secondary" });
        return;
    }

    // Construct Supabase public URL (Adjust based on your project ID/Config)
    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recordings/${rec.storage_path}`;
    
    if (audioRef.current) {
        audioRef.current.src = publicUrl;
        audioRef.current.play();
        setPlayingId(rec.id);
        
        audioRef.current.onended = () => setPlayingId(null);
    }
  };

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Hidden Global Audio Player */}
      <audio ref={audioRef} className="hidden" />

      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Library</h1>
            <p className="text-muted-foreground">Record lectures and convert them into knowledge.</p>
        </div>
        
        <div className="flex gap-2">
            {!isRecording && loadingState === 'idle' ? (
                <Button onClick={startRecording} size="lg" className="rounded-full bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-xl transition-all">
                    <Mic className="mr-2 h-5 w-5" /> Record New
                </Button>
            ) : loadingState === 'idle' ? (
                <Button onClick={stopRecording} size="lg" variant="destructive" className="rounded-full animate-pulse shadow-red-500/50 shadow-lg">
                    <Square className="mr-2 h-5 w-5 fill-current" /> Stop Recording
                </Button>
            ) : null}
        </div>
      </div>

      {loadingState !== 'idle' && (
          <Card className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/10">
              <CardContent>
                <LoadingSteps step={
                    loadingState === 'uploading' ? 'Uploading Audio securely...' :
                    loadingState === 'analyzing' ? 'Transcribing & Summarizing...' : 
                    'Finalizing Knowledge Base...'
                } />
              </CardContent>
          </Card>
      )}

      <div className="grid gap-4">
        {recordings.map((rec) => (
            <Collapsible key={rec.id} open={expandedId === rec.id} onOpenChange={(open) => setExpandedId(open ? rec.id : null)}>
                <Card className={`transition-all duration-200 ${expandedId === rec.id ? 'border-blue-500/40 ring-1 ring-blue-500/20' : 'hover:border-primary/30'}`}>
                    <CardHeader className="py-4 cursor-pointer" onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <FileText className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-medium">{rec.title}</CardTitle>
                                    <CardDescription className="flex items-center gap-2 text-xs">
                                        <span>{new Date(rec.created_at).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {rec.duration ? `${rec.duration}s` : 'Audio'}</span>
                                    </CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" className={`rounded-full ${playingId === rec.id ? 'text-red-500 bg-red-100 dark:bg-red-950' : ''}`} 
                                    onClick={(e) => { e.stopPropagation(); handlePlay(rec); }}>
                                    {playingId === rec.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                </Button>
                                {expandedId === rec.id ? <ChevronUp className="h-4 w-4 text-muted-foreground"/> : <ChevronDown className="h-4 w-4 text-muted-foreground"/>}
                            </div>
                        </div>
                    </CardHeader>
                    <CollapsibleContent>
                        <CardContent className="border-t bg-muted/20 pt-4 space-y-4">
                            {rec.summary && (
                                <div className="bg-background/50 p-4 rounded-lg border">
                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                        <Sparkles className="h-3 w-3 text-yellow-500" /> AI Summary
                                    </h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{rec.summary}</p>
                                </div>
                            )}

                            <div>
                                <h4 className="text-sm font-semibold mb-2">Transcript</h4>
                                <div className="bg-background/80 p-3 rounded-md text-sm text-muted-foreground max-h-60 overflow-y-auto border shadow-inner">
                                    {rec.transcript}
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                {/* Future: Add "Convert to Podcast" button here linked to PodcastPlayer */}
                                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => {/* delete handler */}}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </Button>
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>
        ))}
      </div>
    </div>
  );
}