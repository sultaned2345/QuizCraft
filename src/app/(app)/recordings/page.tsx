import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { RecordingsClient } from './RecordingsClient';

export default function RecordingsPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <RecordingsClient />
    </Suspense>
  );
}