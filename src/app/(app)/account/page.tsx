// src/app/(app)/account/page.tsx
// NEW FILE

import { getServerSession } from '@/lib/getServerSession';
import { getUserUsage } from '@/lib/usage-limits';
import { redirect } from 'next/navigation';
import { AccountClient } from './AccountClient';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// This is the new React Server Component (RSC) for the account page.
// Its only job is to fetch data and pass it to the client component.

export default async function AccountPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect('/login');
  }

  // Fetch all usage data on the server using our existing helper
  const usageData = await getUserUsage(session.user.id);

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <AccountClient initialData={usageData} />
    </Suspense>
  );
}