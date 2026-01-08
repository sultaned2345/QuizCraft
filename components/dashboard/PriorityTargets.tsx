// components/dashboard/PriorityTargets.tsx
'use client';

import { StudyQueueItem } from '@/lib/dashboard-data';
import { BrainCircuit, AlertTriangle, ChevronRight, Layers, Crosshair } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function PriorityTargets({ data }: { data: { dueFlashcards: StudyQueueItem[]; recentLowScores: StudyQueueItem[] } }) {
  const hasItems = data.dueFlashcards.length > 0 || data.recentLowScores.length > 0;

  if (!hasItems) {
    return (
      <div className="rounded-2xl border border-white/10 bg-card/40 p-6 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <BrainCircuit className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-xl font-semibold mb-2">All Systems Nominal</h3>
        <p className="text-muted-foreground max-w-xs">
          No urgent directives. You are fully caught up. Initiate new learning protocols via the Library.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-mono font-bold tracking-tight flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-primary" />
          ACTIVE DIRECTIVES
        </h2>
      </div>

      <div className="grid gap-4">
        {/* 1. Recall Missions (Flashcards) */}
        {data.dueFlashcards.map((item) => (
          <div key={item.id} className="group relative overflow-hidden rounded-xl border border-primary/30 bg-primary/5 p-1 transition-all hover:bg-primary/10">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_2s_infinite]" />
            <div className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary ring-1 ring-primary/40">
                <Layers className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-primary font-mono tracking-wide uppercase">Recall Protocol</h4>
                  <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/40">
                    {item.type === 'flashcard_due' ? item.dueCount : 0} PENDING
                  </span>
                </div>
                <p className="truncate text-base font-semibold text-foreground">{item.title}</p>
              </div>
              <Link 
                href={`/flashcards/${item.deckId}/study`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-card hover:bg-primary hover:text-white transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        ))}

        {/* 2. Optimization Missions (Low Scores) */}
        {data.recentLowScores.map((item) => (
          <div key={item.id} className="group relative overflow-hidden rounded-xl border border-orange-500/30 bg-orange-500/5 p-1 transition-all hover:bg-orange-500/10">
             <div className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 text-orange-500 ring-1 ring-orange-500/40">
                <Crosshair className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-orange-500 font-mono tracking-wide uppercase">Optimization Required</h4>
                  <span className="text-xs font-mono text-orange-400">SCORE: {item.type === 'low_score_quiz' ? item.score : 0}%</span>
                </div>
                <p className="truncate text-base font-semibold text-foreground">{item.title}</p>
              </div>
              <Link 
                href={`/quiz/${item.quizId}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-card hover:bg-orange-500 hover:text-white transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}