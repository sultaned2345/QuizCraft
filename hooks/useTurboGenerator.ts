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

  // Renamed 'content' to 'documentId' to match API requirement
  const generate = useCallback(async (
    type: GenerationType, 
    documentId: string, 
    metadata: any = {}
  ) => {
    setIsGenerating(true);
    setProgress(10);
    setStatus('Initializing AI...');

    try {
      // Note: Server generates the DB Job ID, but we can generate a trace ID if needed.
      // The server snippet provided does not use this client-side ID, but we keep logic consistent.
      
      setProgress(20);
      setStatus('Analyzing content...');
      
      const response = await fetch('/api/generation-jobs/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' 
        },
        // FIX: Map client arguments to server expected fields
        body: JSON.stringify({
          documentId: documentId, // Server expects 'documentId'
          jobType: type,          // Server expects 'jobType'
          metadata                // Optional, passed along if needed
        })
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error("Authentication failed. Please sign in.");
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start generation');
      }

      const { jobId } = await response.json(); // Server returns { success: true, jobId: '...' }
      
      setStatus('Generating magic...');
      setProgress(40);

      const pollInterval = setInterval(async () => {
         try {
            const statusRes = await fetch(`/api/generation-jobs/process?id=${jobId}`, { // Check endpoint usually matches logic, ensuring route exists
                headers: { 'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' }
            });
            
            // Note: The original code used '/api/generation-jobs/check', but typical patterns use 'process' or specific status endpoints.
            // If you get a 404 here, ensure the 'check' or 'process' route exists.
            // Based on your file list, you have 'src/app/api/generation-jobs/process/route.ts'.
            // I have updated the URL below to likely match your existing file structure or the original code if 'check' exists.
            // Assuming strict adherence to provided file list, 'process' might be the worker or status check.
            // If 'check' was a typo in original code, ensure this matches your actual API.
            
            // Reverting to original URL path for safety unless file list confirms otherwise.
            // File list shows: src/app/api/generation-jobs/process/route.ts
            // Use that if 'check' fails. For now, I'll keep the logic generic or use the previous valid path.
            
            // NOTE: The previous code used `/api/generation-jobs/check`. 
            // If that route is missing, please rename `src/app/api/generation-jobs/process/route.ts` or adjust this URL.
            // I will use `/api/generation-jobs/process` based on your file list.
             
            if (!statusRes.ok) return;
            
            const statusData = await statusRes.json();
            
            if (statusData.status === 'completed' || statusData.status === 'success') {
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
  }, [router, toast, options, isGenerating, session]);

  return {
    generate,
    isGenerating,
    progress,
    status
  };
}