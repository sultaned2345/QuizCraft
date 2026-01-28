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
   * Usage: generate('quiz') OR generate({ type: 'quiz', docId: '...' })
   */
  const generate = useCallback(async (
    arg1: TurboJobType | { type: TurboJobType, docId?: string, metadata?: any }, 
    legacyDocId?: string, 
    legacyMeta?: any
  ) => {
    
    // 1. Normalize Arguments
    let type: TurboJobType;
    let docIdOverride = legacyDocId;
    let metadata = legacyMeta;

    if (typeof arg1 === 'object' && arg1 !== null) {
        // Handle object usage: generate({ type: 'quiz' })
        // @ts-ignore
        type = arg1.type;
        // @ts-ignore
        docIdOverride = arg1.docId;
        // @ts-ignore
        metadata = arg1.metadata;
    } else {
        // Handle string usage: generate('quiz')
        type = arg1 as TurboJobType;
    }

    // 2. Strict Validation (Client-Side Guardrail)
    if (!type) {
        console.error("[TurboGenerator] ❌ Job Type is missing/undefined in generate() call.");
        throw new Error("Job Type is required. Usage: generate('quiz')");
    }
    
    if (typeof type !== 'string') {
        console.error("[TurboGenerator] ❌ Invalid Job Type. Received:", type);
        console.error("This usually happens if you do: onClick={generate} instead of onClick={() => generate('quiz')}");
        return; // Exit silently to prevent crash if event object is passed
    }
    
    const targetDocId = docIdOverride || initialDocId;
    
    if (!targetDocId) {
      console.error("[TurboGenerator] ❌ No document ID provided for generation");
      return null;
    }

    try {
      setIsGenerating(true);
      setStatus(`Generating ${type}...`);
      
      // 3. Prepare Payload
      // We spread metadata first so it cannot accidentally overwrite strict fields
      const payload = {
        ...metadata,
        documentId: targetDocId,
        jobType: type, 
      };

      console.log(`[TurboGenerator] 🚀 Sending Request:`, payload);

      // 4. Start Job
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
      throw error;
    } finally {
        if (status !== 'Starting Turbo Mode...') {
            setIsGenerating(false);
        }
    }
  }, [initialDocId, session, status]);

  /**
   * Wrapper for "Turbo" button (Sequentially runs multiple jobs)
   */
  const startTurbo = useCallback(async () => {
     if (!initialDocId) return;
     
     setIsGenerating(true);
     setProgress(5);
     setStatus('Starting Turbo Mode...');

     const types: TurboJobType[] = ['quiz', 'note', 'flashcard'];
     let completedCount = 0;
     
     try {
       // Run in parallel for speed, or sequential if DB locks are a concern
       // Here we use Promise.all for parallel execution
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