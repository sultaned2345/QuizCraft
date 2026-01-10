'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BrainCircuit, Play, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';

export function ProjectQuizList({ quizzes, documentId, projectId }: { quizzes: any[], documentId?: string, projectId: string }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!documentId) return; // Need a source doc
    setIsGenerating(true);

    try {
      // 1. Create Job
      await fetch('/api/generation-jobs/start', { // Simple wrapper to create job row
        method: 'POST',
        body: JSON.stringify({ documentId, jobType: 'quiz' })
      });
      
      // 2. Trigger Process (Optimistic)
      fetch('/api/generation-jobs/process', { method: 'POST' });

      // In real app, you'd use a toast here
      alert("Quiz generation started! It will appear here shortly.");
      
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-primary" /> 
          Practice Quizzes
        </h3>
        {documentId && (
            <Button onClick={handleGenerate} disabled={isGenerating} size="sm" className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate New
            </Button>
        )}
      </div>

      {quizzes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/10">
          <p className="text-muted-foreground mb-4">No quizzes yet.</p>
          <Button variant="outline" onClick={handleGenerate} disabled={!documentId}>
            Generate from Document
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {quizzes.map(q => (
            <div key={q.id} className="border p-4 rounded-xl bg-card hover:shadow-md transition-all flex justify-between items-center group">
              <div>
                <CardTitle className="text-base group-hover:text-primary transition-colors">{q.title}</CardTitle>
                <CardDescription className="text-xs mt-1">
                  {q.questions?.length || 5} Questions • AI Generated
                </CardDescription>
              </div>
              <Button asChild size="sm">
                <Link href={`/quiz/${q.id}`}>
                  <Play className="w-4 h-4 mr-2" /> Start
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}