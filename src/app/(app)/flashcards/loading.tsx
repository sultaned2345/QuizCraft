// src/app/(app)/flashcards/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { DeckCardSkeleton } from "@/components/skeletons/DeckCardSkeleton";
import { Loader2, Layers } from "lucide-react"; // Import icon

export default function FlashcardsLoading() {
  return (
    <>
      {/* --- Branded Loading Header --- */}
      <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground text-center mb-8 p-8 border border-dashed rounded-lg bg-card/50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <h2 className="text-2xl font-semibold text-foreground">Loading Flashcards...</h2>
        <p className="text-sm">Shuffling your decks.</p>
      </div>
      {/* --- END Branded Header --- */}

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