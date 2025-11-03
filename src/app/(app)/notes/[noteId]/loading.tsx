// src/app/(app)/notes/[noteId]/loading.tsx
// NEW FILE
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

export default function NoteEditorLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 overflow-hidden">
        {/* Main Editor */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
          <div className="grid gap-2">
            <Skeleton className="h-6 w-24" /> {/* Title Label */}
            <Skeleton className="h-12 w-full" /> {/* Title Input */}
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-6 w-24" /> {/* Tags Label */}
            <Skeleton className="h-10 w-full" /> {/* Tags Input */}
          </div>
          <div className="grid gap-2 flex-1">
            <Skeleton className="h-6 w-24" /> {/* Content Label */}
            <Skeleton className="w-full min-h-[300px]" /> {/* Editor */}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 overflow-y-auto space-y-6 border-l -ml-4 pl-8">
          <div className="flex items-center justify-center pt-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}