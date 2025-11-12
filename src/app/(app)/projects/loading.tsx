// src/app/(app)/projects/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCardSkeleton } from "@/components/skeletons/ProjectCardSkeleton";

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