'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mic, Square, UploadCloud, FileAudio, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AudioInputProps {
  onTranscriptionComplete: (documentId: string) => void; // Returns ID of the new document
  isPro?: boolean; // Can be used to lock feature later
}

export function AudioInput({ onTranscriptionComplete, isPro = true }: AudioInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  // --- Recording Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Safari requires specific mimeTypes, Chrome prefers others
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `lecture_recording_${new Date().toISOString()}.webm`, { type: mimeType });
        await handleUpload(file);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      // Start Timer
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(prev => prev + 1), 1000);

    } catch (err) {
      console.error(err);
      toast({ title: "Microphone Error", description: "Please allow microphone access.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // --- Upload Logic ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const handleUpload = async (file: File) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      toast({ title: "Uploading & Transcribing...", description: "This may take a minute for long lectures." });
      
      const res = await fetch('/api/upload/audio', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload failed");

      toast({ title: "Success!", description: "Lecture processed into a document." });
      onTranscriptionComplete(data.documentId); // Parent component handles redirect

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full border-dashed border-2 bg-muted/20">
      <CardContent className="pt-6">
        <Tabs defaultValue="record" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="record">Record Lecture</TabsTrigger>
            <TabsTrigger value="upload">Upload Audio File</TabsTrigger>
          </TabsList>

          {/* Record Tab */}
          <TabsContent value="record" className="flex flex-col items-center justify-center py-8 space-y-4">
             {isProcessing ? (
                <div className="text-center space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">Transcribing audio with AI...</p>
                </div>
             ) : isRecording ? (
              <>
                <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
                  <Mic className="w-10 h-10 text-red-500" />
                </div>
                <div className="text-2xl font-mono font-bold text-foreground">{formatTime(duration)}</div>
                <Button onClick={stopRecording} variant="destructive" size="lg" className="rounded-full px-8">
                  <Square className="w-4 h-4 mr-2 fill-current" /> Stop & Process
                </Button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Mic className="w-8 h-8 text-primary" />
                </div>
                <Button onClick={startRecording} size="lg" className="rounded-full px-8">
                  Start Recording
                </Button>
                <p className="text-xs text-muted-foreground mt-2">Works best for nearby speakers</p>
              </>
            )}
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload" className="flex flex-col items-center justify-center py-8 space-y-4">
             {isProcessing ? (
                <div className="text-center space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">Transcribing audio with AI...</p>
                </div>
             ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <UploadCloud className="w-8 h-8 text-primary" />
                  </div>
                  <label htmlFor="audio-upload" className="cursor-pointer">
                    <Button variant="outline" size="lg" className="pointer-events-none">
                      Select Audio File
                    </Button>
                    <input 
                      id="audio-upload" 
                      type="file" 
                      accept="audio/*" 
                      className="hidden" 
                      onChange={handleFileUpload}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground max-w-xs text-center">
                    Supports MP3, WAV, M4A. Max 25MB (approx 30 mins).
                  </p>
                </>
             )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}