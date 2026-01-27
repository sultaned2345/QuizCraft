// src/hooks/useTurboGenerator.ts
'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type TurboJobType = 'quiz' | 'note' | 'flashcard' | 'podcast' | 'embedding';

interface TurboResults {
  quiz?: string;
  note?: string;
  flashcard?: string;
  podcast?: string;
}

interface UseTurboGeneratorOptions {
  onSuccess?: () => void;
}

// Overload signatures to support both usage patterns
export function useTurboGenerator(documentId: string): any;
export function useTurboGenerator(options: UseTurboGeneratorOptions): any;
export function useTurboGenerator(initialDocIdOrOptions?: string | UseTurboGeneratorOptions) {
  
  // Resolve arguments
  const initialDocId = typeof initialDocIdOrOptions === 'string' ? initialDocIdOrOptions : undefined;
  const options = typeof initialDocIdOrOptions === 'object' ? initialDocIdOrOptions : undefined;

  // State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('Idle');
  const [results, setResults] = useState<TurboResults>({});
  
  const { session } = useAuth();

  /**
   * Core generation function.
   * Can be called with a specific type and optional document ID override.
   */
  const generate = useCallback(async (type: TurboJobType, docIdOverride?: string, metadata?: any) => {
    const targetDocId = docIdOverride || initialDocId;
    
    console.log(`[TurboGenerator Client] 🟢 Requesting '${type}' for DocID:`, targetDocId);

    if (!targetDocId) {
      console.error("[TurboGenerator Client] 🔴 No document ID provided.");
      setStatus('Error: No Document ID');
      return null;
    }

    try {
      setIsGenerating(true);
      setStatus(`Queuing ${type}...`);
      
      // 1. Start Job 
      // Note: The server route (api/generation-jobs/start) must be configured 
      // to automatically trigger the processing logic.
      const startRes = await fetch('/api/generation-jobs/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' 
        },
        body: JSON.stringify({ documentId: targetDocId, jobType: type, ...metadata })
      });

      const data = await startRes.json();

      if (!startRes.ok) {
        console.error("[TurboGenerator Client] 🔴 Server Error Response:", data);
        throw new Error(data.error || `Failed to start ${type}`);
      }

      console.log(`[TurboGenerator Client] ✅ Job Started Successfully. Job ID:`, data.jobId);
      
      // We mark the result as 'processing' immediately.
      // Ideally, your UI would poll the job status or listen for a Supabase realtime event.
      setResults(prev => ({ ...prev, [type]: 'processing' }));
      
      setStatus(`${type} queued successfully.`);
      return data;

    } catch (error: any) {
      console.error(`[TurboGenerator Client] 💥 Exception while generating ${type}:`, error);
      setStatus(`Error: ${error.message}`);
      // Don't rethrow if you want the UI to handle it gracefully, 
      // but rethrowing allows the caller to handle it too.
      throw error;
    } finally {
        // Only clear loading state if NOT running the full "Turbo Mode" batch.
        // If we are in Turbo Mode, the startTurbo function controls the 'isGenerating' state.
        if (status !== 'Starting Turbo Mode...') {
            setIsGenerating(false);
        }
    }
  }, [initialDocId, session, status]);

  /**
   * Legacy wrapper for "Turbo" button (runs all default types)
   */
  const startTurbo = useCallback(async () => {
     if (!initialDocId) {
         console.error("[TurboGenerator Client] 🔴 Cannot start Turbo: No initialDocId set");
         return;
     }
     
     setIsGenerating(true);
     setProgress(5);
     setStatus('Starting Turbo Mode...');

     // Define the batch of jobs to run
     const types: TurboJobType[] = ['quiz', 'note', 'flashcard'];
     let completedCount = 0;
     
     try {
       // Run requests in parallel. Since the server handles queuing, this is efficient.
       await Promise.all(types.map(async (t) => {
         try {
           await generate(t);
         } catch (e) {
           console.error(`[TurboGenerator Client] ⚠️ Failed one turbo task: ${t}`, e);
         } finally {
           completedCount++;
           // Update progress bar
           setProgress(10 + (completedCount / types.length) * 90);
         }
       }));

       if (options?.onSuccess) options.onSuccess();
       setStatus('All tasks queued');
     
     } catch (err) {
       console.error("[TurboGenerator Client] 💥 Error during Turbo generation", err);
       setStatus('Error during generation');
     } finally {
       setIsGenerating(false);
     }
  }, [generate, initialDocId, options]);

  return {
    generate,       // Exposed for individual action buttons (e.g. "Generate Quiz")
    startTurbo,     // Exposed for the main "Turbo" button
    isGenerating,
    progress,
    status,
    results,
    isFullyComplete: !isGenerating && Object.keys(results).length > 0
  };
}