import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";

type Job = {
  id: string;
  job_type: string;
  status: string;
};

export function useTurboGenerator() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const startProcessing = async (initialJobs: Job[], onComplete: () => void) => {
    setJobs(initialJobs);
    setIsProcessing(true);

    const processJob = async (job: Job) => {
      try {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'processing' } : j));
        
        const res = await fetch('/api/generation-jobs/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id })
        });

        if (!res.ok) throw new Error('Job failed');
        
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'completed' } : j));
      } catch (error) {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed' } : j));
        console.error(error);
      }
    };

    // Run jobs in parallel (or limit concurrency if needed)
    await Promise.all(initialJobs.map(job => processJob(job)));
    
    setIsProcessing(false);
    toast({
      title: "Turbo Generation Complete",
      description: "Your Quiz, Notes, and Flashcards are ready!",
    });
    onComplete();
  };

  return { jobs, isProcessing, startProcessing };
}