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

// Overload signatures
export function useTurboGenerator(documentId: string): any;
export function useTurboGenerator(options: UseTurboGeneratorOptions): any;
export function useTurboGenerator(initialDocIdOrOptions?: string | UseTurboGeneratorOptions) {
  
  // Resolve arguments
  const initialDocId = typeof initialDocIdOrOptions === 'string' ? initialDocIdOrOptions : undefined;
  const options = typeof initialDocIdOrOptions === 'object' ? initialDocIdOrOptions : undefined;

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('Idle');
  const [results, setResults] = useState<TurboResults>({});
  
  const { session } = useAuth();

  /**
   * Core generation function.
   */
  const generate = useCallback(async (type: TurboJobType, docIdOverride?: string, metadata?: any) => {
    // 1. Critical Validation
    // Check if 'type' is an object (React Event) or undefined/null/empty
    if (!type || typeof type !== 'string') {
        const errorMsg = `[TurboGenerator] ❌ Invalid Job Type: '${typeof type}'. You likely used 'onClick={generate}' instead of 'onClick={() => generate("quiz")}'`;
        console.error(errorMsg);
        // Do not throw here if it's an event, just return to prevent crash, but log error.
        // If it's undefined, we must stop.
        return;
    }
    
    const targetDocId = docIdOverride || initialDocId;
    
    if (!targetDocId) {
      console.error("[TurboGenerator] ❌ No document ID provided for generation");
      return null;
    }

    try {
      setIsGenerating(true);
      setStatus(`Generating ${type}...`);
      
      // 2. Prepare Payload (Sanitize undefined)
      const payload = {
        ...metadata,
        documentId: targetDocId,
        jobType: type, 
      };

      console.log(`[TurboGenerator] 🚀 Sending Request:`, payload);

      // 3. Start Job
      const startRes = await fetch('/api/generation-jobs/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' 
        },
        body: JSON.stringify(payload)
      });

      if (!startRes.ok) {
          const err = await startRes.json();
          throw new Error(err.error || `Failed to start ${type}`);
      }
      
      const data = await startRes.json();
      console.log(`[TurboGenerator] ✅ Job Started: ${data.jobId} (${type})`);

      setResults(prev => ({ ...prev, [type]: 'processing' }));
      return { jobId: data.jobId };

    } catch (error: any) {
      console.error(`[TurboGenerator] 💥 Error generating ${type}:`, error);
      setStatus(`Error: ${error.message}`);
      // Don't re-throw if you want the UI to handle it gracefully via 'status'
    } finally {
        if (status !== 'Starting Turbo Mode...') {
            setIsGenerating(false);
        }
    }
  }, [initialDocId, session, status]);

  /**
   * Wrapper for "Turbo" button
   */
  const startTurbo = useCallback(async () => {
     if (!initialDocId) return;
     
     setIsGenerating(true);
     setProgress(5);
     setStatus('Starting Turbo Mode...');

     const types: TurboJobType[] = ['quiz', 'note', 'flashcard'];
     let completedCount = 0;
     
     try {
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
       setStatus('All tasks completed');
     
     } catch (err) {
       setStatus('Error during generation');
     } finally {
       setIsGenerating(false);
     }
  }, [generate, initialDocId, options]);

  return {
    generate,       
    startTurbo,     
    isGenerating,
    progress,
    status,
    results,
    isFullyComplete: !isGenerating && Object.keys(results).length > 0
  };
}