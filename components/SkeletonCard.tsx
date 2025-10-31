// src/components/SkeletonCard.tsx
'use client';
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton"; // Assuming you have a Skeleton component (install if needed)

// If you don't have Skeleton, install shadcn-ui Skeleton:
// npx shadcn-ui@latest add skeleton

export function SkeletonCard() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <Skeleton className="h-5 w-3/4 rounded" /> {/* Title placeholder */}
      </CardHeader>
      <CardContent className="flex-grow">
        <Skeleton className="h-4 w-full rounded mb-2" /> {/* Description line 1 */}
        <Skeleton className="h-4 w-5/6 rounded" /> {/* Description line 2 */}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Skeleton className="h-8 w-20 rounded-md" /> {/* Button placeholder */}
        <Skeleton className="h-8 w-8 rounded-md" /> {/* Icon Button placeholder */}
      </CardFooter>
    </Card>
  );
}