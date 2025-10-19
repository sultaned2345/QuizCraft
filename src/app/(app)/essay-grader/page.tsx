import { FileSignature } from 'lucide-react';

export default function EssayGraderPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-center">
      <FileSignature className="mx-auto h-16 w-16 text-slate-400 dark:text-slate-500" />
      <h1 className="mt-6 text-2xl font-bold">Essay Grader</h1>
      <p className="mt-2 text-muted-foreground">This feature is coming soon!</p>
    </div>
  );
}