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
    // 1. Validate 'type' Argument Immediately
    // This catches the exact bug where type was coming in as undefined
    if (!type) {
      const msg = "[TurboGenerator] ❌ Missing 'type' argument in generate() call.";
      console.error(msg);
      setStatus("Error: Internal Type Missing");
      throw new Error(msg);
    }

    const targetDocId = docIdOverride || initialDocId;
    console.log(`[TurboGenerator] 🟢 Requesting '${type}' for DocID:`, targetDocId);

    // 2. Validate Document ID
    if (!targetDocId) {
      console.error("[TurboGenerator] ❌ No document ID provided.");
      setStatus('Error: No Document ID');
      return null;
    }

    try {
      setIsGenerating(true);
      setStatus(`Queuing ${type}...`);
      
      // 3. Start Job 
      const startRes = await fetch('/api/generation-jobs/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' 
        },
        // Explicitly construct body to ensure no keys are missed
        body: JSON.stringify({ 
            documentId: targetDocId, 
            jobType: type, 
            ...metadata 
        })
      });

      const data = await startRes.json();

      if (!startRes.ok) {
        console.error("[TurboGenerator] 🔴 Server Error Response:", data);
        throw new Error(data.error || `Failed to start ${type}`);
      }

      console.log(`[TurboGenerator] ✅ Job Started. Job ID:`, data.jobId);
      
      // Update local state to show 'processing' immediately
      setResults(prev => ({ ...prev, [type]: 'processing' }));
      setStatus(`${type} queued successfully.`);
      return data;

    } catch (error: any) {
      console.error(`[TurboGenerator] 💥 Exception generating ${type}:`, error);
      setStatus(`Error: ${error.message}`);
      throw error;
    } finally {
        // Only clear global loading state if NOT running the full "Turbo Mode" batch
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
         console.error("[TurboGenerator] 🔴 Cannot start Turbo: No initialDocId set");
         return;
     }
     
     setIsGenerating(true);
     setProgress(5);
     setStatus('Starting Turbo Mode...');

     const types: TurboJobType[] = ['quiz', 'note', 'flashcard'];
     let completedCount = 0;
     
     try {
       // Run in parallel
       await Promise.all(types.map(async (t) => {
         try {
           await generate(t);
         } catch (e) {
           console.error(`[TurboGenerator] ⚠️ Failed task: ${t}`, e);
         } finally {
           completedCount++;
           setProgress(10 + (completedCount / types.length) * 90);
         }
       }));

       if (options?.onSuccess) options.onSuccess();
       setStatus('All tasks queued');
     
     } catch (err) {
       console.error("[TurboGenerator] 💥 Error during Turbo generation", err);
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