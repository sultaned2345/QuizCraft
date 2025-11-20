// components/dashboard/PersonalizedStudyPlan.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ApiResponse } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Layers, FileQuestion, ArrowRight, StickyNote, FileText, Sparkles, Target } from 'lucide-react';

interface StudySuggestion {
  type: 'flashcard' | 'quiz' | 'note' | 'document';
  id: string;
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

  // Helper for icons
  const getIcon = (type: StudySuggestion['type']) => {
    switch (type) {
      case 'flashcard': return <Layers className="w-5 h-5" />;
      case 'quiz': return <FileQuestion className="w-5 h-5" />;
      case 'note': return <StickyNote className="w-5 h-5" />;
      case 'document': return <FileText className="w-5 h-5" />;
      default: return <Sparkles className="w-5 h-5" />;
    }
  };

  // Helper for styling
  const getStyles = (type: StudySuggestion['type']) => {
     switch(type) {
        case 'quiz': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-900';
        case 'flashcard': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-900';
        case 'note': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900';
        default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-900';
     }
  };

  const getHref = (item: StudySuggestion) => {
    switch (item.type) {
      case 'flashcard': return `/flashcards/${item.id}`;
      case 'quiz': return `/quiz/${item.id}`;
      case 'note': return `/notes/${item.id}`;
      case 'document': return `/documents/${item.id}`;
      default: return '/';
    }
  };

  return (
    <Card className="h-full flex flex-col shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" /> 
              Your Study Path
            </CardTitle>
            <CardDescription>AI-recommended actions for today.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
            <Sparkles className="w-8 h-8 mb-2 opacity-20" />
            <p className="font-medium">You're all caught up!</p>
            <p className="text-xs mt-1">Upload a document to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {suggestions.map((item, idx) => (
              <Link 
                key={idx} 
                href={getHref(item)}
                className="group block"
              >
                <div className="flex items-start gap-4 p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/30 transition-all relative overflow-hidden">
                   {/* Color indicator strip */}
                   <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getStyles(item.type).split(' ')[0].replace('/30', '')}`} />
                   
                   <div className={`p-2.5 rounded-lg shrink-0 ${getStyles(item.type)}`}>
                      {getIcon(item.type)}
                   </div>
                   <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                        {item.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.reason}
                      </p>
                   </div>
                   <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center -translate-x-2 group-hover:translate-x-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}