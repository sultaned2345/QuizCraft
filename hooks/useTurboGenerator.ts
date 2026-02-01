// src/hooks/useTurboGenerator.ts
'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
export function useTurboGenerator(documentId: string): any;
export function useTurboGenerator(documentId: string, options: UseTurboGeneratorOptions): any;
export function useTurboGenerator(options: UseTurboGeneratorOptions): any;

// --- Implementation ---
export function useTurboGenerator(
  arg1?: string | UseTurboGeneratorOptions,
  arg2?: UseTurboGeneratorOptions
) {
  
  // 1. Resolve arguments
  const initialDocId = typeof arg1 === 'string' ? arg1 : undefined;
  const options = typeof arg1 === 'object' ? arg1 : arg2;

  // 2. State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('Idle');
  const [results, setResults] = useState<TurboResults>({});
  
  const { toast } = useToast();
  const { session } = useAuth();

  // --- Helper: Fetch Text Content First ---
  const fetchDocumentText = useCallback(async (id: string) => {
    if (!id || id === 'undefined' || id === 'null') {
        throw new Error("Invalid Document ID");
    }
    
    // Fetch metadata
    const res = await fetch(`/api/documents/${id}`);
    
    if (!res.ok) {
        throw new Error(`Failed to fetch document metadata: ${res.statusText}`);
    }
    
    const json = await res.json();
    const text = json.data?.extracted_text || json.extracted_text;
    
    // [FIX] Do NOT throw error if text is missing. 
    // Return empty string instead so the backend can detect it and run self-healing.
    if (!text || text.length < 50) {
        console.warn(`[Turbo] Document ${id} text is missing/short. Delegating to backend for repair.`);
        return ""; 
    }
    return text;
  }, []);

  /**
   * Core generation function.
   */
  const generate = useCallback(async (
    argInput: TurboJobType | { type: TurboJobType, docId?: string, metadata?: any }, 
    legacyDocId?: string
  ) => {
    
    // Normalize Arguments
    let type: TurboJobType;
    let docIdOverride = legacyDocId;
    let metadata = {};

    if (typeof argInput === 'object' && argInput !== null) {
        type = (argInput as any).type;
        docIdOverride = (argInput as any).docId;
        metadata = (argInput as any).metadata || {};
    } else {
        type = argInput as TurboJobType;
    }

    // Resolve Target ID
    const targetDocId = docIdOverride || initialDocId;

    if (!targetDocId) {
      toast({ title: "Error", description: "No document ID provided", variant: "destructive" });
      return null;
    }

    try {
      setIsGenerating(true);
      setStatus(`Preparing to generate ${type}...`);

      // 1. PRE-FETCH TEXT 
      // This will now return "" if empty, instead of throwing.
      const textContent = await fetchDocumentText(targetDocId);
      
      setStatus(`Generating ${type} with AI...`);

      // 2. Prepare Payload
      let endpoint = '';
      let body: any = { 
          text: textContent, 
          documentId: targetDocId,
          ...metadata 
      };

      // 3. Configure Endpoint & Specific Params
      switch (type) {
        case 'note':
          endpoint = '/api/generate-notes';
          break;
        case 'quiz':
          endpoint = '/api/generate-quiz?mode=content&numQuestions=10&difficulty=medium';
          break;
        case 'flashcard':
          endpoint = '/api/generate-flashcards';
          if (!body.numberOfCards) body.numberOfCards = 15;
          break;
        case 'podcast':
          endpoint = '/api/podcasts/generate'; 
          break;
        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      // 4. Send Request
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' 
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
          throw new Error(data.error || `Failed to generate ${type}`);
      }
      
      // 5. Success State
      setResults(prev => ({ ...prev, [type]: 'completed' }));
      toast({ title: "Success", description: `${type} generated successfully!` });
      
      if (options?.onSuccess) {
         setTimeout(() => options.onSuccess?.(), 1000);
      }
      
      return { success: true, data };

    } catch (error: any) {
      console.error(`[TurboGenerator] Error generating ${type}:`, error);
      setStatus(`Error: ${error.message}`);
      toast({ 
        title: "Generation Failed", 
        description: error.message, 
        variant: "destructive" 
      });
      return { success: false, error: error.message };
    } finally {
      if (status !== 'Starting Turbo Mode...') {
          setIsGenerating(false);
      }
    }
  }, [initialDocId, session, options, fetchDocumentText, toast, status]);

  /**
   * Wrapper for "Turbo" button
   */
  const startTurbo = useCallback(async () => {
     if (!initialDocId) return;
     
     setIsGenerating(true);
     setProgress(5);
     setStatus('Starting Turbo Mode...');

     const types: TurboJobType[] = ['note', 'flashcard', 'quiz'];
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

       setStatus('All tasks completed');
       if (options?.onSuccess) options.onSuccess();
     
     } catch (err) {
       setStatus('Error during turbo generation');
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