// src/hooks/useTurboGenerator.ts
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext'; // Added Import

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
  const { session } = useAuth(); // Get Session

  const generate = useCallback(async (
    type: GenerationType, 
    content: string, 
    metadata: any = {}
  ) => {
    setIsGenerating(true);
    setProgress(10);
    setStatus('Initializing AI...');

    try {
      const jobId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 15);
      
      setProgress(20);
      setStatus('Analyzing content...');
      
      // FIX: Add Auth Header here too
      const response = await fetch('/api/generation-jobs/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' 
        },
        body: JSON.stringify({
          jobId,
          type,
          content,
          metadata
        })
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error("Authentication failed. Please sign in.");
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start generation');
      }

      const { data } = await response.json();
      const jobDbId = data.jobId;

      setStatus('Generating magic...');
      setProgress(40);

      const pollInterval = setInterval(async () => {
         try {
            // FIX: Add Auth Header to status check
            const statusRes = await fetch(`/api/generation-jobs/check?id=${jobDbId}`, {
                headers: { 'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' }
            });
            if (!statusRes.ok) return;
            
            const statusData = await statusRes.json();
            
            if (statusData.status === 'completed') {
                clearInterval(pollInterval);
                setProgress(100);
                setStatus('Complete!');
                
                if (options.onSuccess) {
                    options.onSuccess(statusData.resultId, type);
                } else {
                    if (type === 'quiz') router.push(`/quiz/${statusData.resultId}`);
                    if (type === 'notes') router.push(`/notes/${statusData.resultId}`);
                    if (type === 'flashcards') router.push(`/flashcards/${statusData.resultId}`);
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

      // Timeout safety (60s)
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
  }, [router, toast, options, isGenerating, session]); // Add session dependency

  return {
    generate,
    isGenerating,
    progress,
    status
  };
}