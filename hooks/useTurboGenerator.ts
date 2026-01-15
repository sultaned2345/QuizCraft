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
      // 1. Validate Inputs
      if (!documentId) throw new Error("Document ID is required.");

      const cleanedId = documentId.trim();
      
      // UUID Regex (V4 and others)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Check if it's NOT a UUID (and likely text content)
      if (!uuidRegex.test(cleanedId)) {
        console.error("❌ [TurboGenerator Error] Invalid Document ID format.");
        
        throw new Error(
            cleanedId.length > 50 
            ? "Implementation Error: You are passing file CONTENT instead of the document ID." 
            : `Invalid Document ID: ${cleanedId}`
        );
      }

      console.log(`[TurboGenerator] Starting ${type} job for ID: ${cleanedId}`);

      setProgress(20);
      setStatus('Analyzing content...');
      
      // 2. Start Job (Create Record)
      const startResponse = await fetch('/api/generation-jobs/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' 
        },
        body: JSON.stringify({
          documentId: cleanedId, 
          jobType: type,
          metadata
        })
      });

      if (!startResponse.ok) {
        if (startResponse.status === 401) throw new Error("Authentication failed. Please sign in.");
        const errorData = await startResponse.json();
        throw new Error(errorData.error || 'Failed to start generation');
      }

      const { jobId } = await startResponse.json();
      
      setStatus('Generating magic...');
      setProgress(40);

      // 3. Process Job (Synchronous Execution)
      // Since the server route processes the job synchronously, we await the POST request.
      // We use a timer just to simulate visual progress while waiting.
      const progressTimer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 5;
        });
      }, 1000);

      const processResponse = await fetch('/api/generation-jobs/process', {
        method: 'POST', 
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' 
        },
        body: JSON.stringify({ jobId }) 
      });

      clearInterval(progressTimer);

      if (!processResponse.ok) {
         const errorData = await processResponse.json();
         throw new Error(errorData.error || 'Generation process failed');
      }

      const result = await processResponse.json();

      // CRITICAL CHECK: Ensure we actually have an output ID
      if (!result.outputId) {
          throw new Error("Generation completed, but no content was returned. Please check your document content.");
      }

      // 4. Completion
      setProgress(100);
      setStatus('Complete!');
      
      if (options.onSuccess) {
          options.onSuccess(result.outputId, type);
      } else {
          const resultId = result.outputId;
          if (type === 'quiz') router.push(`/quiz/${resultId}`);
          if (type === 'notes') router.push(`/notes/${resultId}`);
          if (type === 'flashcards') router.push(`/flashcards/${resultId}`);
      }

    } catch (error: any) {
      console.error('Generation failed', error);
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
    } finally {
      setIsGenerating(false);
    }
  }, [router, toast, options, session]);

  return {
    generate,
    isGenerating,
    progress,
    status
  };
}