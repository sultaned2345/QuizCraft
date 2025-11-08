// src/app/(app)/projects/loading.tsx
// NEW FILE

'use client'; // <-- ADD THIS DIRECTIVE

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

function ProjectCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-3/4 rounded" /> {/* Title */}
        <Skeleton className="h-4 w-1/2 rounded" /> {/* Item count */}
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full rounded" /> {/* Description line 1 */}
        <Skeleton className="h-4 w-5/6 rounded mt-2" /> {/* Description line 2 */}
      </CardContent>
      <CardFooter>
         <Skeleton className="h-9 w-24 rounded-md" /> {/* View Button */}
      </CardFooter>
    </Card>
  );
}

export default function ProjectsLoading() {
  return (
    <>
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-8">
        <Skeleton className="h-9 w-48 rounded" /> {/* Title */}
        <Skeleton className="h-10 w-32 rounded-md" /> {/* New Button */}
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}