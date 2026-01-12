// hooks/useTurboGenerator.ts
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
// Removed 'supabase' (unused) and 'nanoid' (source of the "z is not a function" error)

// Define the generation types
export type GenerationType = 'quiz' | 'notes' | 'flashcards';

interface UseTurboGeneratorOptions {
  onSuccess?: (id: string, type: GenerationType) => void;
  onError?: (error: Error) => void;
}

export function useTurboGenerator(options: UseTurboGeneratorOptions = {}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [status, setStatus] = useState<string>('idle');
  const router = useRouter();
  const { toast } = useToast();

  const generate = useCallback(async (
    type: GenerationType, 
    content: string, 
    metadata: any = {}
  ) => {
    setIsGenerating(true);
    setProgress(10);
    setStatus('Initializing AI...');

    try {
      // 1. Create a Job ID for tracking
      // FIX: Use native crypto.randomUUID() instead of nanoid to prevent minification errors
      const jobId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // 2. Start the server-side generation process
      setProgress(20);
      setStatus('Analyzing content...');
      
      const response = await fetch('/api/generation-jobs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          type,
          content,
          metadata
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start generation');
      }

      const { data } = await response.json();
      const jobDbId = data.jobId; // The ID in the database

      // 3. Poll for status (Simulated real-time)
      setStatus('Generating magic...');
      setProgress(40);

      const pollInterval = setInterval(async () => {
         try {
            const statusRes = await fetch(`/api/generation-jobs/check?id=${jobDbId}`);
            if (!statusRes.ok) return;
            
            const statusData = await statusRes.json();
            
            if (statusData.status === 'completed') {
                clearInterval(pollInterval);
                setProgress(100);
                setStatus('Complete!');
                
                // Handle success
                if (options.onSuccess) {
                    options.onSuccess(statusData.resultId, type);
                } else {
                    // Default behavior: redirect
                    if (type === 'quiz') router.push(`/quiz/${statusData.resultId}`);
                    if (type === 'notes') router.push(`/notes/${statusData.resultId}`);
                    if (type === 'flashcards') router.push(`/flashcards/${statusData.resultId}`);
                }
                setIsGenerating(false);
            } else if (statusData.status === 'failed') {
                clearInterval(pollInterval);
                throw new Error(statusData.error || 'Generation failed on server');
            } else {
                // Still processing: Simulate progress increment
                setProgress(prev => Math.min(prev + 5, 90));
            }
         } catch (e) {
             // Ignore poll errors, just wait for next tick or timeout
         }
      }, 2000);

      // Timeout safety (60 seconds)
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
  }, [router, toast, options, isGenerating]);

  return {
    generate,
    isGenerating,
    progress,
    status
  };
}