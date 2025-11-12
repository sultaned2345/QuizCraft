// src/app/(app)/flashcards/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { DeckCardSkeleton } from "@/components/skeletons/DeckCardSkeleton";

export default function FlashcardsLoading() {
  return (
    <>
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <Skeleton className="h-9 w-52 rounded mb-2" /> {/* Title */}
          <Skeleton className="h-4 w-48 rounded" /> {/* Usage */}
        </div>
        <Skeleton className="h-10 w-32 rounded-md" /> {/* New Button */}
      </div>

      {/* Grid Skeleton (No motion) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <DeckCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}