// src/hooks/useTurboGenerator.ts
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export function useTurboGenerator() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();
  const { session } = useAuth();

  const generateStudySet = async (file: File | null, youtubeUrl?: string) => {
    if (!session) return;
    setIsProcessing(true);
    setProgress([]);

    try {
      let documentId = '';

      // 1. Ingest (Upload or Link)
      setProgress(prev => [...prev, 'Ingesting content...']);
      
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/documents/upload', {
           method: 'POST',
           headers: { 'Authorization': `Bearer ${session.access_token}` },
           body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        documentId = data.data.id;
      } else if (youtubeUrl) {
        const res = await fetch('/api/generate-from-youtube', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}` 
            },
            body: JSON.stringify({ videoUrl: youtubeUrl })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        documentId = data.data.id;
      }

      // 2. Parallel Generation (Hobby Plan Safe Mode)
      // We fire 3 independent requests. If one takes 55s and another 10s, both succeed.
      const tasks = [
        { type: 'notes', label: 'Summarizing notes...' },
        { type: 'quiz', label: 'Drafting quiz...' },
        { type: 'flashcards', label: 'Creating flashcards...' }
      ];

      setProgress(prev => [...prev, 'Igniting AI Engines...']);

      // Fire all promises but don't await them blocking each other
      const promises = tasks.map(task => 
        fetch(`/api/documents/${documentId}/generate?type=${task.type}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }).then(res => {
          if (res.ok) {
            setProgress(prev => [...prev, `✅ ${task.type.toUpperCase()} Ready`]);
          } else {
            setProgress(prev => [...prev, `❌ ${task.type.toUpperCase()} Failed`]);
          }
        })
      );

      // Wait for all to finish (or fail)
      await Promise.allSettled(promises);
      
      toast({
        title: "Generation Complete",
        description: "Your workspace is ready.",
      });

      // 3. Redirect
      router.push(`/documents/${documentId}`);

    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return { generateStudySet, isProcessing, progress };
}