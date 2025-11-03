// components/dashboard/PersonalizedStudyPlan.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ApiResponse } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Layers, FileQuestion, ArrowRight } from 'lucide-react';

interface StudySuggestion {
  type: 'flashcard' | 'quiz';
  id: string; // Deck ID or Quiz ID
  title: string;
  reason: string;
}

export function PersonalizedStudyPlan() {
  const [suggestions, setSuggestions] = useState<StudySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { session } = useAuth();

  useEffect(() => {
    if (session) {
      fetch('/api/dashboard/study-plan', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(res => res.json())
        .then((data: ApiResponse<StudySuggestion[]>) => {
          if (data.success && data.data) {
            setSuggestions(data.data);
          }
        })
        .catch(err => console.error("Failed to fetch study plan", err))
        .finally(() => setIsLoading(false));
    }
  }, [session]);

  const getIcon = (type: 'flashcard' | 'quiz') => {
    return type === 'flashcard' 
      ? <Layers className="w-5 h-5 text-primary" /> 
      : <FileQuestion className="w-5 h-5 text-blue-500" />;
  };

  const getHref = (item: StudySuggestion) => {
    return item.type === 'flashcard' 
      ? `/flashcards/${item.id}` 
      : `/quiz/${item.id}`;
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle>Your Study Plan</CardTitle>
        <CardDescription>AI-powered suggestions based on your activity.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="font-medium">You're all set!</p>
            <p className="text-sm">Take quizzes or review flashcards to get new suggestions.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((item) => (
              <Button
                key={item.id}
                asChild
                variant="outline"
                className="w-full h-auto justify-between items-start p-3"
              >
                <Link href={getHref(item)}>
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{getIcon(item.type)}</div>
                    <div className="text-left">
                      <p className="font-semibold text-sm line-clamp-1">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.reason}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}