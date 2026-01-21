// src/components/dashboard/SmartStudyQueue.tsx
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrainCircuit, BookOpen, AlertCircle, CheckCircle } from "lucide-react";

export function SmartStudyQueue({ data }: { data: any }) {
  const { dueFlashcards = [], recentLowScores = [] } = data;
  const isEmpty = dueFlashcards.length === 0 && recentLowScores.length === 0;

  if (isEmpty) {
    return (
      <Card className="bg-secondary/10 border-secondary/20">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-background flex items-center justify-center shadow-sm">
             <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="font-serif font-bold text-lg text-green-800">All Caught Up!</p>
            <p className="text-sm text-green-700/80">No immediate tasks. You can relax or start a new subject.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          
          {/* Flashcards Section */}
          {dueFlashcards.length > 0 && (
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <BookOpen className="h-4 w-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Review Decks</h4>
              </div>
              <div className="space-y-2">
                {dueFlashcards.map((item: any) => (
                  <div key={item.id} className="group flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted transition-colors">
                    <span className="font-medium text-sm truncate max-w-[150px]">{item.deck.title}</span>
                    <Button size="sm" variant="ghost" className="h-8 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10" asChild>
                      <Link href={`/flashcards/${item.deck.id}`}>Study</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low Quiz Scores Section */}
          {recentLowScores.length > 0 && (
            <div className="p-5 space-y-3 bg-red-50/50 dark:bg-red-950/10">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Improve Score</h4>
              </div>
              <div className="space-y-2">
                {recentLowScores.map((attempt: any) => (
                  <div key={attempt.id} className="flex items-center justify-between p-3 rounded-xl bg-background border border-red-100 dark:border-red-900/30">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{attempt.quiz.title}</span>
                      <span className="text-[10px] font-bold text-red-500">
                        Last Score: {Math.round((attempt.score / attempt.total) * 100)}%
                      </span>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50" asChild>
                      <Link href={`/quiz/${attempt.quiz.id}`}>Retake</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}