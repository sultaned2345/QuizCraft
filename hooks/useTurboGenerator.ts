// src/hooks/useTurboGenerator.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type TurboJobType = 'quiz' | 'note' | 'flashcard' | 'podcast' | 'embedding';
export type JobStatus = 'idle' | 'generating' | 'completed' | 'error';

interface TurboState {
  quiz: JobStatus;
  note: JobStatus;
  flashcard: JobStatus;
  podcast: JobStatus;
  embedding: JobStatus;
}

interface TurboResults {
  quiz?: string;      // ID
  note?: string;      // ID
  flashcard?: string; // ID
  podcast?: string;   // ID
  embedding?: boolean; 
}

export function useTurboGenerator(documentId: string) {
  const [statuses, setStatuses] = useState<TurboState>({
    quiz: 'idle',
    note: 'idle',
    flashcard: 'idle',
    podcast: 'idle',
    embedding: 'idle'
  });
  
  const [results, setResults] = useState<TurboResults>({});
  const [isFullyComplete, setIsFullyComplete] = useState(false);
  
  const { session } = useAuth();

  // Helper to run a single job
  const runJob = useCallback(async (type: TurboJobType) => {
    try {
      setStatuses(prev => ({ ...prev, [type]: 'generating' }));

      // 1. Start Job
      const startRes = await fetch('/api/generation-jobs/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' 
        },
        body: JSON.stringify({ documentId, jobType: type })
      });

      if (!startRes.ok) {
        console.error(`Failed to start ${type}`);
        setStatuses(prev => ({ ...prev, [type]: 'error' }));
        return;
      }

      const { jobId } = await startRes.json();

      // 2. Process Job (Synchronous wait for server)
      const processRes = await fetch('/api/generation-jobs/process', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '' 
        },
        body: JSON.stringify({ jobId })
      });

      if (!processRes.ok) throw new Error(`Process failed for ${type}`);
      
      const data = await processRes.json();
      
      setResults(prev => ({ ...prev, [type]: data.outputId || true }));
      setStatuses(prev => ({ ...prev, [type]: 'completed' }));

    } catch (error) {
      console.error(`Error in ${type} job:`, error);
      setStatuses(prev => ({ ...prev, [type]: 'error' }));
    }
  }, [documentId, session]);

  // Main trigger function
  const startTurbo = useCallback(() => {
    runJob('quiz');
    runJob('note');
    runJob('flashcard');
    runJob('podcast');
    runJob('embedding'); 
  }, [runJob]);

  // Check completion
  useEffect(() => {
    const all = Object.values(statuses);
    const isWorking = all.includes('generating') || all.every(s => s === 'idle'); // Wait if idle or working
    
    // We are done if we are NOT working, and at least some jobs have finished/errored
    if (!isWorking && (all.includes('completed') || all.includes('error'))) {
      setIsFullyComplete(true);
    }
  }, [statuses]);

  return {
    startTurbo,
    statuses,
    results,
    isFullyComplete
  };
}