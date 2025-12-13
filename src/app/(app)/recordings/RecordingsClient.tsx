'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Square, Loader2, FileText, Brain, Layers, FileQuestion, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useRouter } from 'next/navigation';

export function RecordingsClient() {
  const { session } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [recordings, setRecordings] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => { fetchRecordings(); }, [session]);

  const fetchRecordings = async () => {
    if (!session) return;
    try {
        const res = await fetch('/api/recordings', { headers: { Authorization: `Bearer ${session.access_token}`}});
        const data = await res.json();
        if (data.success) setRecordings(data.data);
    } catch (e) {
        console.error(e);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleUpload(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { toast({ title: "Mic Error", description: "Could not access microphone.", variant: "destructive" }); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleUpload = async (blob: Blob) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');
    try {
      const res = await fetch('/api/recordings/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({ title: "Recording Processed", description: "Transcript generated successfully." });
      fetchRecordings();
    } catch (error: any) { toast({ title: "Upload Failed", description: error.message, variant: "destructive" }); } 
    finally { setIsProcessing(false); }
  };

  const handleDelete = async (id: string) => {
      if(!confirm("Delete this recording?")) return;
      await fetch(`/api/recordings?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}`}});
      fetchRecordings();
  }

  const generateContent = async (type: 'quiz' | 'note' | 'flashcards', recording: any) => {
      if(!recording.transcript) return;
      setGeneratingId(recording.id);

      try {
          let url = '';
          let body = {};
          
          if (type === 'quiz') {
              url = '/api/generate-quiz?numQuestions=5&difficulty=medium&questionType=MIXED';
              body = { text: recording.transcript };
          } else if (type === 'note') {
              url = '/api/generate-notes';
              body = { text: recording.transcript };
          } else if (type === 'flashcards') {
              url = '/api/generate-flashcards';
              body = { text: recording.transcript, numberOfCards: 5, deckTitle: `Flashcards: ${recording.title}` };
          }

          const res = await fetch(url, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session?.access_token}` 
              },
              body: JSON.stringify(body)
          });
          
          const data = await res.json();
          if(!data.success) throw new Error(data.error);

          toast({ title: "Success!", description: `${type.toUpperCase()} generated successfully.` });
          
          if (type === 'quiz' && data.id) router.push(`/quiz/${data.id}`);
          if (type === 'flashcards' && data.data?.id) router.push(`/flashcards/${data.data.id}`);
          if (type === 'note' && data.data?.count) router.push(`/notes`);

      } catch (e: any) {
          toast({ title: "Generation Failed", description: e.message, variant: "destructive" });
      } finally {
          setGeneratingId(null);
      }
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Voice Notes</h1>
        <div className="flex gap-2">
            {!isRecording ? (
                <Button onClick={startRecording} disabled={isProcessing} className="bg-red-600 hover:bg-red-700">
                    <Mic className="mr-2 h-4 w-4" /> Record
                </Button>
            ) : (
                <Button onClick={stopRecording} variant="destructive" className="animate-pulse">
                    <Square className="mr-2 h-4 w-4" /> Stop
                </Button>
            )}
        </div>
      </div>

      {isProcessing && (
          <div className="p-6 border rounded-lg bg-muted/30 flex flex-col items-center">
              <Loader2 className="h-6 w-6 animate-spin mb-2 text-primary" />
              <p className="text-sm">Transcribing audio...</p>
          </div>
      )}

      <div className="space-y-4">
        {recordings.map((rec) => (
            <Collapsible key={rec.id} open={expandedId === rec.id} onOpenChange={(open) => setExpandedId(open ? rec.id : null)}>
                <Card>
                    <CardHeader className="py-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-500" />
                                {rec.title}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                        {expandedId === rec.id ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                                    </Button>
                                </CollapsibleTrigger>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(rec.id)} className="text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CollapsibleContent>
                        <CardContent className="border-t pt-4 space-y-4">
                            <div className="bg-muted/50 p-3 rounded-md text-sm text-muted-foreground max-h-60 overflow-y-auto">
                                <p className="font-semibold mb-1 text-foreground">Transcript:</p>
                                {rec.transcript}
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Button 
                                    variant="outline" 
                                    className="w-full justify-start" 
                                    disabled={!!generatingId}
                                    onClick={() => generateContent('quiz', rec)}
                                >
                                    {generatingId === rec.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileQuestion className="mr-2 h-4 w-4 text-green-600" />}
                                    Generate Quiz
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="w-full justify-start"
                                    disabled={!!generatingId}
                                    onClick={() => generateContent('flashcards', rec)}
                                >
                                    {generatingId === rec.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Layers className="mr-2 h-4 w-4 text-purple-600" />}
                                    Generate Flashcards
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="w-full justify-start"
                                    disabled={!!generatingId}
                                    onClick={() => generateContent('note', rec)}
                                >
                                    {generatingId === rec.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Brain className="mr-2 h-4 w-4 text-orange-600" />}
                                    Generate Note
                                </Button>
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>
        ))}
        {recordings.length === 0 && !isProcessing && (
            <p className="text-center text-muted-foreground py-12">No recordings found. Start speaking!</p>
        )}
      </div>
    </div>
  );
}