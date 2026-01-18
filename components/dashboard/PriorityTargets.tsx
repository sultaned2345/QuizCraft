'use client';

import { StudyQueueItem } from '@/lib/dashboard-data';
import { 
  AlertTriangle, 
  ChevronRight, 
  Target, 
  Flame, 
  Zap, 
  CheckCircle2 
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function PriorityTargets({ data }: { data: { dueFlashcards: StudyQueueItem[]; recentLowScores: StudyQueueItem[] } }) {
  const hasItems = data.dueFlashcards.length > 0 || data.recentLowScores.length > 0;

  if (!hasItems) {
    return (
      <div className="h-full min-h-[250px] rounded-3xl border border-dashed border-border/60 bg-card/30 p-8 flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4 ring-1 ring-green-500/20">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-lg font-medium mb-1">All Systems Nominal</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          No urgent directives found. You are completely caught up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
        <h2 className="text-sm font-mono font-bold tracking-wider text-muted-foreground uppercase">
          Active Directives
        </h2>
      </div>

      <div className="grid gap-3">
        {/* 1. Recall Missions (Flashcards) */}
        {data.dueFlashcards.map((item) => (
          <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-card/50 hover:bg-primary/5 transition-all duration-300">
            {/* Hover Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative p-4 flex items-center gap-4">
              <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Zap className="h-6 w-6 text-primary fill-primary/20" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    Recall Protocol
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                     • {item.type === 'flashcard_due' ? item.dueCount : 0} ITEMS
                  </span>
                </div>
                <p className="font-semibold text-foreground truncate">{item.title}</p>
              </div>

              <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full hover:bg-primary hover:text-primary-foreground transition-colors" asChild>
                <Link href={`/flashcards/${item.deckId}/study`}>
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        ))}

        {/* 2. Optimization Missions (Low Scores) */}
        {data.recentLowScores.map((item) => (
          <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-orange-500/20 bg-card/50 hover:bg-orange-500/5 transition-all duration-300">
             <div className="relative p-4 flex items-center gap-4">
              <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded">
                    Optimization Req.
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                     • SCORE: {item.type === 'low_score_quiz' ? item.score : 0}%
                  </span>
                </div>
                <p className="font-semibold text-foreground truncate">{item.title}</p>
              </div>

              <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full hover:bg-orange-500 hover:text-white transition-colors" asChild>
                <Link href={`/quiz/${item.quizId}`}>
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}