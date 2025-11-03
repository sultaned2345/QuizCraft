// components/BacklinksWidget.tsx
// NEW FILE
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ApiResponse } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link2, StickyNote } from 'lucide-react';

interface Backlink {
  id: string;
  title: string;
}

interface BacklinksWidgetProps {
  noteId: string | null;
}

export function BacklinksWidget({ noteId }: BacklinksWidgetProps) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();

  useEffect(() => {
    if (noteId && session) {
      setIsLoading(true);
      setBacklinks([]);
      fetch(`/api/notes/${noteId}/backlinks`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
        .then((res) => res.json())
        .then((result: ApiResponse<Backlink[]>) => {
          if (result.success && result.data) {
            setBacklinks(result.data);
          }
        })
        .catch((err) =>
          console.error('Failed to fetch backlinks:', err),
        )
        .finally(() => setIsLoading(false));
    }
  }, [noteId, session]);

  return (
    <div className="space-y-3 pt-4 lg:pt-0">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Link2 className="w-4 h-4" />
        Backlinks
      </h4>
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}
      {!isLoading && backlinks.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No other notes link here yet.
        </p>
      )}
      {!isLoading && backlinks.length > 0 && (
        <div className="space-y-2">
          {backlinks.map((item) => (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full justify-start h-auto py-2"
              key={item.id}
            >
              <Link href={`/notes/${item.id}`} title={item.title}>
                <StickyNote className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate text-xs font-semibold">
                  {item.title}
                </span>
              </Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}