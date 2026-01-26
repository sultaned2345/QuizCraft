// src/components/dashboard/SmartStudyQueue.tsx
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrainCircuit, BookOpen, AlertCircle, CheckCircle, ArrowRight, Zap } from "lucide-react";

export function SmartStudyQueue({ data }: { data: any }) {
  const { dueFlashcards = [], recentLowScores = [] } = data;
  const isEmpty = dueFlashcards.length === 0 && recentLowScores.length === 0;

  if (isEmpty) {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/10 border-green-200/50 dark:border-green-900/30">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shadow-sm animate-in zoom-in duration-500">
             <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-serif font-bold text-lg text-green-800 dark:text-green-300">All Caught Up!</p>
            <p className="text-sm text-green-700/80 dark:text-green-400/80">
              No urgent tasks. Perfect time to explore a new topic.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border overflow-hidden">
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          
          {/* 1. Flashcards Section */}
          {dueFlashcards.length > 0 && (
            <div className="p-5 space-y-3 bg-card">
              <div className="flex items-center gap-2 text-primary">
                <BookOpen className="h-4 w-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Review Due</h4>
              </div>
              <div className="space-y-2">
                {dueFlashcards.map((item: any) => (
                  <div key={item.id} className="group flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors border border-transparent hover:border-border/50">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm truncate max-w-[150px]">{item.deck.title}</span>
                      <span className="text-[10px] text-muted-foreground">{item.dueCount} cards due</span>
                    </div>
                    <Button size="sm" variant="secondary" className="h-8 text-xs font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-all" asChild>
                      <Link href={`/flashcards/${item.deck.id}`}>Review</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Low Quiz Scores (AI Remediation) */}
          {recentLowScores.length > 0 && (
            <div className="p-5 space-y-3 bg-red-50/40 dark:bg-red-950/10">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Weak Areas detected</h4>
              </div>
              <div className="space-y-3">
                {recentLowScores.map((attempt: any) => {
                  const scorePct = Math.round((attempt.score / attempt.total) * 100);
                  return (
                    <div key={attempt.id} className="flex flex-col gap-2 p-3 rounded-xl bg-background/80 border border-red-100 dark:border-red-900/30 shadow-sm">
                      <div className="flex items-center justify-between">
                         <span className="font-medium text-sm text-foreground/90">{attempt.quiz.title}</span>
                         <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-md">
                           {scorePct}%
                         </span>
                      </div>
                      
                      <div className="flex gap-2 mt-1">
                        {/* Option A: Retake Exact Quiz */}
                        <Button size="sm" variant="ghost" className="h-7 flex-1 text-[10px] text-muted-foreground hover:text-foreground border border-border" asChild>
                           <Link href={`/quiz/${attempt.quiz.id}`}>Retake</Link>
                        </Button>
                        
                        {/* Option B: AI Generate Remedial Quiz */}
                        <Button size="sm" variant="default" className="h-7 flex-[2] text-[10px] bg-red-600 hover:bg-red-700 text-white border-none shadow-none" asChild>
                           <Link href={`/create?mode=ai&source=weakness&topic=${encodeURIComponent(attempt.quiz.title)}&contextId=${attempt.quiz.id}`}>
                             <Zap className="w-3 h-3 mr-1.5 fill-current" />
                             Fix Weakness
                           </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}