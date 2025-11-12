// components/skeletons/ProjectCardSkeleton.tsx
'use client';

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProjectCardSkeleton() {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <Skeleton className="h-5 w-3/4 rounded" /> {/* Title */}
        <Skeleton className="h-4 w-1/2 rounded" /> {/* Item count */}
      </CardHeader>
      <CardContent className="flex-grow">
        <Skeleton className="h-4 w-full rounded" /> {/* Description line 1 */}
        <Skeleton className="h-4 w-5/6 rounded mt-2" /> {/* Description line 2 */}
      </CardContent>
      <CardFooter className="flex justify-between">
         <Skeleton className="h-9 w-24 rounded-md" /> {/* View Button */}
         <Skeleton className="h-9 w-9 rounded-md" /> {/* Delete Button */}
      </CardFooter>
    </Card>
  );
}