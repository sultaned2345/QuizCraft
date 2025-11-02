// components/skeletons/DocumentCardSkeleton.tsx
// (Create a new folder 'skeletons' in 'components' for organization)
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DocumentCardSkeleton() {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex-row items-start justify-between gap-4 pb-2">
        <div className="space-y-1 overflow-hidden flex-1">
          <Skeleton className="h-5 w-3/4 rounded" /> {/* Title */}
          <Skeleton className="h-4 w-1/2 rounded" /> {/* Type/Size */}
          <Skeleton className="h-4 w-1/3 rounded" /> {/* Date */}
        </div>
        <Skeleton className="h-7 w-7 rounded-md shrink-0" /> {/* Delete Button */}
      </CardHeader>
      <CardContent className="flex-grow">
        <Skeleton className="h-4 w-full rounded mb-2" /> {/* Summary line 1 */}
        <Skeleton className="h-4 w-5/6 rounded" /> {/* Summary line 2 */}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2 pt-2">
        <Skeleton className="h-9 w-full rounded-md" /> {/* View & Chat Button */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Skeleton className="h-9 w-full rounded-md" /> {/* Icon Button 1 */}
          <Skeleton className="h-9 w-full rounded-md" /> {/* Icon Button 2 */}
          <Skeleton className="h-9 w-full rounded-md" /> {/* Icon Button 3 */}
        </div>
      </CardFooter>
    </Card>
  );
}