// src/app/(app)/quizzes/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { QuizCardSkeleton } from "@/components/skeletons/QuizCardSkeleton";
import { Loader2 } from "lucide-react"; // Import Loader

export default function QuizzesLoading() {
  return (
    <>
      {/* --- ADDED LOADING HEADER --- */}
      <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground text-center mb-8 p-8 border border-dashed rounded-lg">
        <Loader2 className="h-10 w-10 animate-spin" />
        <h2 className="text-2xl font-semibold">Loading Quizzes...</h2>
        <p className="text-sm">Just a moment while we get your study materials.</p>
      </div>
      {/* --- END ADDED HEADER --- */}

      {/* Widget Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1">
          <Skeleton className="h-[268px] w-full rounded-xl" />
        </div>
        <div className="md:col-span-2">
          <Skeleton className="h-[268px] w-full rounded-xl" />
        </div>
      </div>

      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-8">
        <Skeleton className="h-9 w-64 rounded" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <QuizCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}