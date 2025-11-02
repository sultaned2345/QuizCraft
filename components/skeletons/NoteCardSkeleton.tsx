// components/skeletons/NoteCardSkeleton.tsx
// NEW FILE
'use client';

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function NoteCardSkeleton() {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <Skeleton className="h-5 w-3/4 rounded" /> {/* Title */}
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-5 w-16 rounded-full" /> {/* Tag 1 */}
          <Skeleton className="h-5 w-20 rounded-full" /> {/* Tag 2 */}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Skeleton className="h-9 w-20 rounded-md" /> {/* Edit Button */}
        <Skeleton className="h-9 w-24 rounded-md" /> {/* Delete Button */}
      </CardFooter>
    </Card>
  );
}