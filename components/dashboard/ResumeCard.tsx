// src/components/dashboard/ResumeCard.tsx
import Link from 'next/link';
import { ArrowRight, BookOpen, Clock, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

export function ResumeCard({ data }: { data: any }) {
  if (!data) return null;

  const getLink = () => {
    switch (data.type) {
      case 'quiz': return `/quiz/${data.data.quiz_id}`; // Assuming data structure
      case 'document': return `/documents/${data.id}`;
      case 'deck': return `/flashcards/${data.id}`;
      default: return '/dashboard';
    }
  };

  return (
    <Card className="bg-primary/5 border-primary/20 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Clock className="w-24 h-24 rotate-12" />
      </div>
      <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <PlayCircle className="w-4 h-4" />
            <span>Resume Session</span>
          </div>
          <h3 className="text-xl font-serif font-bold text-foreground">
            {data.title}
          </h3>
          <p className="text-muted-foreground text-sm">
            Last active {formatDistanceToNow(new Date(data.timestamp), { addSuffix: true })}
          </p>
        </div>
        
        <Button asChild className="shrink-0 group">
          <Link href={getLink()}>
            Jump Back In 
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}