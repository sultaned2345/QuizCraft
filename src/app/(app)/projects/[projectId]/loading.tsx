// src/app/(app)/projects/[projectId]/loading.tsx
// NEW FILE

'use client';

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

function ContentItemSkeleton() {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-4 space-y-0 pb-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-5 w-3/4" />
      </CardHeader>
      <CardContent>
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

export default function ProjectDetailLoading() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-10 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>
      </div>
      <div className="mb-8">
        <Skeleton className="h-9 w-1/2 rounded" />
        <Skeleton className="h-4 w-3/4 rounded mt-3" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <ContentItemSkeleton key={i} />
        ))}
      </div>
    </>
  );
}