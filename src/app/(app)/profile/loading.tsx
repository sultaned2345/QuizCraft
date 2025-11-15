// src/app/(app)/profile/loading.tsx
import { Loader2, User } from "lucide-react";

export default function ProfileLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground text-center my-8 p-8 border border-dashed rounded-lg bg-card/50">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <h2 className="text-2xl font-semibold text-foreground">Loading Profile...</h2>
      <p className="text-sm">Gathering your stats.</p>
    </div>
  );
}