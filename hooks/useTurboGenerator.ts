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

// --- Overload Signatures ---
// These allow TypeScript to understand the different ways you can call this hook
export function useTurboGenerator(documentId: string): any;
export function useTurboGenerator(documentId: string, options: UseTurboGeneratorOptions): any;
export function useTurboGenerator(options: UseTurboGeneratorOptions): any;

// --- Implementation ---
export function useTurboGenerator(
  arg1?: string | UseTurboGeneratorOptions,
  arg2?: UseTurboGeneratorOptions
) {
  
  // 1. Resolve arguments based on what was passed
  const initialDocId = typeof arg1 === 'string' ? arg1 : undefined;
  const options = typeof arg1 === 'object' ? arg1 : arg2;

  // 2. State
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
    argInput: TurboJobType | { type: TurboJobType, docId?: string, metadata?: any }, 
    legacyDocId?: string, 
    legacyMeta?: any
  ) => {
    
    // Normalize Arguments (Supports both object style and legacy arguments)
    let type: TurboJobType;
    let docIdOverride = legacyDocId;
    let metadata = legacyMeta;

    if (typeof argInput === 'object' && argInput !== null) {
        // @ts-ignore
        type = argInput.type;
        // @ts-ignore
        docIdOverride = argInput.docId;
        // @ts-ignore
        metadata = argInput.metadata;
    } else {
        type = argInput as TurboJobType;
    }

    // Validation
    if (!type) {
        console.error("Job Type is required");
        return;
    }
    
    const targetDocId = docIdOverride || initialDocId;
    
    if (!targetDocId) {
      console.error("[TurboGenerator] ❌ No document ID provided");
      return null;
    }

    try {
      setIsGenerating(true);
      setStatus(`Generating ${type}...`);
      
      const payload = {
        ...metadata,
        documentId: targetDocId,
        jobType: type, 
      };

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
      setResults(prev => ({ ...prev, [type]: 'processing' }));
      
      // Trigger success callback if provided
      if (options?.onSuccess) {
         // Small delay to allow DB to propagate changes before refetching
         setTimeout(() => options.onSuccess?.(), 1000);
      }
      
      return { jobId: data.jobId };

    } catch (error: any) {
      console.error(`[TurboGenerator] Error:`, error);
      setStatus(`Error: ${error.message}`);
    } finally {
      // Only set to false if we aren't in the middle of a multi-step "Turbo" run
      if (status !== 'Starting Turbo Mode...') {
          setIsGenerating(false);
      }
    }
  }, [initialDocId, session, options, status]);

  /**
   * Wrapper for "Turbo" button (Runs multiple jobs: Quiz, Note, Flashcard)
   */
  const startTurbo = useCallback(async () => {
     if (!initialDocId) return;
     
     setIsGenerating(true);
     setProgress(5);
     setStatus('Starting Turbo Mode...');

     const types: TurboJobType[] = ['quiz', 'note', 'flashcard'];
     let completedCount = 0;
     
     try {
       // Run generations in parallel
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