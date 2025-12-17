import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrainCircuit, RotateCcw } from "lucide-react";
import Link from "next/link";

export function SmartStudyQueue({ data }: { data: any }) {
  if (data.dueFlashcards.length === 0 && data.recentLowScores.length === 0) {
    return (
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardContent className="pt-6">
          <p className="text-green-800 font-medium">🎉 You are all caught up! Great job.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-indigo-500" />
          Recommended Focus
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Flashcards Section */}
        {data.dueFlashcards.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-muted-foreground uppercase tracking-wider">Due for Review</h4>
            {data.dueFlashcards.map((card: any) => (
              <div key={card.id} className="flex items-center justify-between bg-secondary/20 p-3 rounded-lg">
                <span className="font-medium truncate max-w-[200px]">{card.deck.title}</span>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/flashcards/${card.deck.id}`}>Review</Link>
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Low Quiz Scores Section */}
        {data.recentLowScores.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-muted-foreground uppercase tracking-wider">Needs Improvement</h4>
            {data.recentLowScores.map((attempt: any) => (
              <div key={attempt.id} className="flex items-center justify-between bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-100 dark:border-red-900">
                <div className="flex flex-col">
                  <span className="font-medium">{attempt.quiz.title}</span>
                  <span className="text-xs text-red-600">Score: {attempt.score}%</span>
                </div>
                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-100" asChild>
                  <Link href={`/quiz/${attempt.quiz.id}`}>Retake</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}