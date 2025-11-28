// src/components/AiDisclaimer.tsx
import { AlertTriangle } from 'lucide-react';

export function AiDisclaimer() {
  return (
    <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-800 my-2">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>
        <strong>AI-Generated Content:</strong> Questions may contain inaccuracies. 
        Always verify answers against your original study materials.
      </span>
    </div>
  );
}