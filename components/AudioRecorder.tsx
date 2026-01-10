'use client';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AudioRecorderProps {
  projectId: string;
  onUploadComplete?: (newRecording: any) => void;
}

export function AudioRecorder({ projectId, onUploadComplete }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleUpload(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic Error:", err);
      toast({ title: "Microphone Access Denied", description: "Please allow microphone access to record.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop all tracks to release microphone hardware
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleUpload = async (audioBlob: Blob) => {
    setIsProcessing(true);
    const formData = new FormData();
    // File name with timestamp
    const fileName = `recording-${new Date().toISOString().slice(0,19).replace(/:/g, "-")}.webm`;
    formData.append('file', audioBlob, fileName);
    formData.append('projectId', projectId); // Link directly to project

    try {
      // Use the Universal Source Upload API
      const res = await fetch('/api/upload/source', { 
        method: 'POST', 
        body: formData 
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Upload failed");

      toast({ title: "Lecture Saved", description: "Audio uploaded and transcription started." });

      if (onUploadComplete) {
        onUploadComplete(data.data); // Return the new recording object
      }
      
    } catch (error: any) {
      toast({ title: "Error processing audio", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 border rounded-xl bg-muted/20">
      <div className="flex gap-4 items-center">
        {!isRecording ? (
          <Button 
            onClick={startRecording} 
            disabled={isProcessing} 
            size="lg"
            className="gap-2 rounded-full w-48 transition-all hover:scale-105"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
            {isProcessing ? "Processing..." : "Start Recording"}
          </Button>
        ) : (
          <Button 
            onClick={stopRecording} 
            variant="destructive" 
            size="lg"
            className="gap-2 rounded-full w-48 animate-pulse"
          >
            <Square className="w-5 h-5 fill-current" /> Stop
          </Button>
        )}
      </div>
      
      {isRecording && (
        <p className="text-sm text-red-500 animate-pulse font-medium">
          Recording in progress...
        </p>
      )}
      
      {isProcessing && (
        <p className="text-sm text-muted-foreground text-center">
          Uploading and transcribing... <br/>
          <span className="text-xs opacity-70">This may take a moment.</span>
        </p>
      )}
    </div>
  );
}