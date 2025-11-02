// components/skeletons/DeckCardSkeleton.tsx
// NEW FILE
'use client';

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DeckCardSkeleton() {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <Skeleton className="h-5 w-3/4 rounded" /> {/* Title */}
      </CardHeader>
      <CardContent className="flex-grow">
        <Skeleton className="h-4 w-1/2 rounded" /> {/* Description line */}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Skeleton className="h-9 w-24 rounded-md" /> {/* Study Button */}
        <Skeleton className="h-9 w-9 rounded-md" /> {/* Edit Button */}
        <Skeleton className="h-9 w-9 rounded-md" /> {/* Delete Button */}
      </CardFooter>
    </Card>
  );
}