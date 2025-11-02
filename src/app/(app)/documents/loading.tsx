// src/app/(app)/documents/loading.tsx
// UPDATED FILE (Motion removed)

import { Skeleton } from "@/components/ui/skeleton";
import { DocumentCardSkeleton } from "@/components/skeletons/DocumentCardSkeleton";

export default function DocumentsLoading() {
  return (
    <>
      {/* Header & Upload Skeleton (unchanged) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <Skeleton className="h-9 w-48 rounded mb-2" /> {/* Title */}
          <Skeleton className="h-4 w-56 rounded" /> {/* Usage */}
        </div>
        <div className="w-full sm:max-w-md p-6 border rounded-xl shadow-sm bg-card">
           <Skeleton className="h-5 w-3/5 rounded mb-4" /> {/* Upload Title */}
           <Skeleton className="h-10 w-full rounded-md mb-2" /> {/* Input */}
           <Skeleton className="h-4 w-4/5 rounded mb-3" /> {/* Selected File */}
           <Skeleton className="h-9 w-24 rounded-md" /> {/* Upload Button */}
        </div>
      </div>

      {/* Grid Skeleton (No motion) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <DocumentCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}