// src/app/(app)/projects/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCardSkeleton } from "@/components/skeletons/ProjectCardSkeleton";
import { Loader2, FolderKanban } from "lucide-react"; // Import icon

export default function ProjectsLoading() {
  return (
    <>
      {/* --- Branded Loading Header --- */}
      <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground text-center mb-8 p-8 border border-dashed rounded-lg bg-card/50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <h2 className="text-2xl font-semibold text-foreground">Loading Projects...</h2>
        <p className="text-sm">Organizing your workspaces.</p>
      </div>
      {/* --- END Branded Header --- */}

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