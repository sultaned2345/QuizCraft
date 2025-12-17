// src/app/(app)/documents/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentCardSkeleton } from "@/components/skeletons/DocumentCardSkeleton";

export default function DocumentsLoading() {
  return (
    <div className="space-y-8 pb-10">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" /> {/* Title */}
          <Skeleton className="h-4 w-32" /> {/* Usage Text */}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
           <Skeleton className="h-10 w-full sm:w-64" /> {/* Search */}
           <div className="flex gap-2 w-full sm:w-auto">
               <Skeleton className="h-10 w-full sm:w-64" /> {/* Input */}
               <Skeleton className="h-10 w-12" /> {/* Button */}
           </div>
        </div>
      </div>

      {/* Grid Skeleton - Matches 2 col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <DocumentCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}