// src/app/(app)/projects/[projectId]/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { ContentItemSkeleton } from "@/components/skeletons/ContentItemSkeleton";

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