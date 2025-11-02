// src/app/(app)/notes/loading.tsx
// UPDATED FILE (Motion removed)

import { Skeleton } from "@/components/ui/skeleton";
import { NoteCardSkeleton } from "@/components/skeletons/NoteCardSkeleton";

export default function NotesLoading() {
  return (
    <>
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <Skeleton className="h-9 w-40 rounded mb-2" /> {/* Title */}
          <Skeleton className="h-4 w-60 rounded" /> {/* Usage */}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-40 rounded-md" /> {/* AI Button */}
          <Skeleton className="h-10 w-32 rounded-md" /> {/* New Button */}
        </div>
      </div>

      {/* Search Skeleton */}
      <div className="mb-6">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>

      {/* Grid Skeleton (No motion) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <NoteCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}