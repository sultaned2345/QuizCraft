// src/hooks/useTurboGenerator.ts
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type GenerationType = 'quiz' | 'notes' | 'flashcards';

interface UseTurboGeneratorOptions {
  onSuccess?: (id: string, type: GenerationType) => void;
  onError?: (error: Error) => void;
}

export function useTurboGenerator(options: UseTurboGeneratorOptions = {}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [status, setStatus] = useState<string>('idle');
  
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useAuth();

  const generate = useCallback(async (
    type: GenerationType, 
    documentId: string, 
    metadata: any = {}
  ) => {
    setIsGenerating(true);
    setProgress(10);
    setStatus('Initializing AI...');

    try {
      if (!documentId) throw new Error("Document ID is required.");

      // DEBUG: Log the payload to catch "undefined" or object issues
      console.log(`[TurboGenerator] Starting ${type} job for doc: "${documentId}"`);

      setProgress(20);
      setStatus('Analyzing content...');
      
      const response = await fetch('/api/generation-jobs/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' 
        },
        body: JSON.stringify({
          documentId: documentId?.trim(), // Ensure clean ID on client side too
          jobType: type,
          metadata
        })
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error("Authentication failed. Please sign in.");
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start generation');
      }

      const { jobId } = await response.json();
      
      setStatus('Generating magic...');
      setProgress(40);

      const pollInterval = setInterval(async () => {
         try {
            const statusRes = await fetch(`/api/generation-jobs/process?id=${jobId}`, {
                headers: { 'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' }
            });
            
            if (!statusRes.ok) return;
            
            const statusData = await statusRes.json();
            
            if (statusData.status === 'completed' || statusData.status === 'success') {
                clearInterval(pollInterval);
                setProgress(100);
                setStatus('Complete!');
                
                if (options.onSuccess) {
                    options.onSuccess(statusData.resultId || statusData.outputId, type);
                } else {
                    const resultId = statusData.resultId || statusData.outputId;
                    if (type === 'quiz') router.push(`/quiz/${resultId}`);
                    if (type === 'notes') router.push(`/notes/${resultId}`);
                    if (type === 'flashcards') router.push(`/flashcards/${resultId}`);
                }
                setIsGenerating(false);
            } else if (statusData.status === 'failed') {
                clearInterval(pollInterval);
                throw new Error(statusData.error || 'Generation failed on server');
            } else {
                setProgress(prev => Math.min(prev + 5, 90));
            }
         } catch (e) {
             // Ignore poll errors
         }
      }, 2000);

      setTimeout(() => {
          if (isGenerating) {
             clearInterval(pollInterval);
             setIsGenerating(false);
             setStatus('Timeout');
             toast({ title: "Generation timed out", variant: "destructive" });
          }
      }, 60000);

    } catch (error: any) {
      console.error('Generation failed', error);
      setIsGenerating(false);
      setStatus('error');
      
      if (options.onError) {
        options.onError(error);
      } else {
        toast({
            title: "Generation failed",
            description: error.message || "An unexpected error occurred.",
            variant: "destructive"
        });
      }
    }
  }, [router, toast, options, isGenerating, session]);

  return {
    generate,
    isGenerating,
    progress,
    status
  };
}