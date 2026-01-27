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
    
    console.log(`[Client Debug] Requesting '${type}' for DocID:`, targetDocId);

    if (!targetDocId) {
      console.error("[Client Error] No document ID provided for generation");
      setStatus('Error: No Document ID');
      return null;
    }

    try {
      setIsGenerating(true);
      setStatus(`Queuing ${type}...`);
      
      // 1. Start Job
      // The server now automatically triggers the processing logic, so we only need to call 'start'.
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
        console.error("[Client Error] Server responded with:", data);
        throw new Error(data.error || `Failed to start ${type}`);
      }

      console.log(`[Client Debug] Job started successfully. Job ID:`, data.jobId);
      
      // We assume success once queued. 
      // Ideally, the UI should listen to Supabase realtime or poll status, but we'll mark as 'processing' for now.
      setResults(prev => ({ ...prev, [type]: 'processing' }));
      
      setStatus(`${type} queued successfully.`);
      return data;

    } catch (error: any) {
      console.error(`Error generating ${type}:`, error);
      setStatus(`Error: ${error.message}`);
      throw error;
    } finally {
        // If we aren't running a multi-job batch (Turbo Mode), clear loading state here.
        // If running Turbo Mode, the startTurbo function handles the final state.
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
         console.error("Cannot start Turbo: No initialDocId set");
         return;
     }
     
     setIsGenerating(true);
     setProgress(5);
     setStatus('Starting Turbo Mode...');

     const types: TurboJobType[] = ['quiz', 'note', 'flashcard'];
     let completedCount = 0;
     
     try {
       // Run in parallel for speed since server handles queuing
       await Promise.all(types.map(async (t) => {
         try {
           await generate(t);
         } catch (e) {
           console.error(`Failed to generate ${t}`, e);
         } finally {
           completedCount++;
           setProgress(10 + (completedCount / types.length) * 90);
         }
       }));

       if (options?.onSuccess) options.onSuccess();
       setStatus('All tasks queued');
     
     } catch (err) {
       setStatus('Error during generation');
     } finally {
       setIsGenerating(false);
     }
  }, [generate, initialDocId, options]);

  return {
    generate,       // Exposed for AddDocumentDialog
    startTurbo,     // Exposed for Dashboard
    isGenerating,
    progress,
    status,
    results,
    isFullyComplete: !isGenerating && Object.keys(results).length > 0
  };
}