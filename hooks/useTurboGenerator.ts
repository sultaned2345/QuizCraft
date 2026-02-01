// src/hooks/useTurboGenerator.ts
'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// [CHANGE] Added 'flashcards' to type definition to support the plural variant
export type TurboJobType = 'quiz' | 'note' | 'flashcard' | 'flashcards' | 'podcast' | 'embedding';

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
        
        // [FIX] Added 'flashcards' case to handle plural input gracefully
        case 'flashcard':
        case 'flashcards':
          endpoint = '/api/generate-flashcards';
          if (!body.numberOfCards) body.numberOfCards = 15;
          break;
          
        case 'podcast':
          endpoint = '/api/podcasts/generate'; 
          break;
        
        case 'embedding':
             // Assuming there's an endpoint or logic for embeddings, otherwise handle accordingly
             // If embedding generation is handled differently, add logic here.
             // For now, logging warning if no endpoint mapping exists for embedding but it's in types.
             console.warn("Embedding generation triggered via Turbo but no direct endpoint mapped in switch.");
             break;

        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      // If we fell through 'embedding' without an endpoint, skip fetch or handle it. 
      // Assuming 'embedding' might not need a fetch here or uses a different pattern.
      if (!endpoint && type === 'embedding') {
          return { success: false, message: "Embedding generation not fully implemented in client hook." };
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
      // Normalize 'flashcards' to 'flashcard' for results state consistency if desired
      const resultKey = type === 'flashcards' ? 'flashcard' : type;
      setResults(prev => ({ ...prev, [resultKey]: 'completed' }));
      
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

     // Ensure we use the singular types internally for the loop
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