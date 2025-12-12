'use client';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function AudioRecorder({ onTranscriptionComplete }: { onTranscriptionComplete: (text: string) => void }) {
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
      toast({ title: "Microphone Access Denied", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop all tracks to release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleUpload = async (audioBlob: Blob) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');

    try {
      // 1. Transcribe
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (!data.text) throw new Error("Transcription failed");

      // 2. Pass text to parent to generate notes
      onTranscriptionComplete(data.text); 
      
    } catch (error) {
      toast({ title: "Error processing audio", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex gap-4 items-center">
      {!isRecording ? (
        <Button onClick={startRecording} disabled={isProcessing} variant="outline" className="gap-2">
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          {isProcessing ? "Transcribing..." : "Record Lecture"}
        </Button>
      ) : (
        <Button onClick={stopRecording} variant="destructive" className="gap-2 animate-pulse">
          <Square className="w-4 h-4" /> Stop Recording
        </Button>
      )}
    </div>
  );
}