// components/skeletons/ContentItemSkeleton.tsx
'use client';

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ContentItemSkeleton() {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex-row items-start gap-4 space-y-0">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/4 mt-1" />
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6 mt-2" />
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </CardFooter>
    </Card>
  );
}