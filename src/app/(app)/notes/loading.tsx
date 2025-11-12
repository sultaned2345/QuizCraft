// src/app/(app)/notes/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { NoteCardSkeleton } from "@/components/skeletons/NoteCardSkeleton";
import { Loader2 } from "lucide-react"; // Import Loader

export default function NotesLoading() {
  return (
    <>
      {/* --- ADDED LOADING HEADER --- */}
      <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground text-center mb-8 p-8 border border-dashed rounded-lg">
        <Loader2 className="h-10 w-10 animate-spin" />
        <h2 className="text-2xl font-semibold">Loading Notes...</h2>
        <p className="text-sm">Gathering your thoughts.</p>
      </div>
      {/* --- END ADDED HEADER --- */}

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