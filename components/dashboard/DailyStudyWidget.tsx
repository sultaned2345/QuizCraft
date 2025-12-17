"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrainCircuit, CheckCircle } from "lucide-react";

export function DailyStudyWidget() {
  const [plan, setPlan] = useState<any>(null);

  useEffect(() => {
    fetch("/api/study/daily").then(res => res.json()).then(setPlan);
  }, []);

  if (!plan) return <div className="h-32 bg-muted/20 animate-pulse rounded-lg" />;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-primary" />
          Daily Focus
        </CardTitle>
        <CardDescription>Automated study plan based on your retention.</CardDescription>
      </CardHeader>
      <CardContent>
        {plan.hasWork ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>🎯 {plan.dueCount} Flashcards due</p>
              <p>📉 Review weak topics: {plan.weakTopics.join(", ")}</p>
            </div>
            <Button className="w-full font-bold" size="lg">
              Start Session ({plan.estimatedMinutes} min)
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
            <p className="font-medium">You're all caught up!</p>
            <p className="text-xs text-muted-foreground">Great job keeping up with your spaced repetition.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}