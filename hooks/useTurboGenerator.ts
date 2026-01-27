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
    // 1. Strict Validation
    if (!type) {
        console.error("[TurboGenerator] ❌ Job Type is missing/undefined in generate() call.");
        throw new Error("Job Type is required.");
    }
    
    // Safety Check: Prevent passing Event objects (e.g. onClick={generate})
    if (typeof type !== 'string') {
        console.error("[TurboGenerator] ❌ Invalid Job Type. You likely used 'onClick={generate}' instead of 'onClick={() => generate(...)}'. Value received:", type);
        throw new Error("Invalid function call. Use an arrow function in your onClick handler.");
    }
    
    const targetDocId = docIdOverride || initialDocId;
    
    if (!targetDocId) {
      console.error("[TurboGenerator] ❌ No document ID provided for generation");
      return null;
    }

    try {
      setIsGenerating(true);
      setStatus(`Generating ${type}...`);
      
      // 2. Start Job
      // Fix: Spread metadata FIRST so it cannot overwrite jobType or documentId
      const startRes = await fetch('/api/generation-jobs/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' 
        },
        body: JSON.stringify({ 
            ...metadata, 
            documentId: targetDocId, 
            jobType: type, // Explicitly set last to prevent overwrite
        })
      });

      if (!startRes.ok) {
          const err = await startRes.json();
          throw new Error(err.error || `Failed to start ${type}`);
      }
      
      const data = await startRes.json();
      console.log(`[TurboGenerator] ✅ Job Started: ${data.jobId} (${type})`);

      // 3. Update Status 
      setResults(prev => ({ ...prev, [type]: 'processing' }));
      
      return { jobId: data.jobId };

    } catch (error: any) {
      console.error(`[TurboGenerator] 💥 Error generating ${type}:`, error);
      setStatus(`Error: ${error.message}`);
      throw error;
    } finally {
        if (status !== 'Starting Turbo Mode...') {
            setIsGenerating(false);
        }
    }
  }, [initialDocId, session, status]);

  /**
   * Legacy wrapper for "Turbo" button (runs all default types)
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