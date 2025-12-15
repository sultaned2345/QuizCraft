// src/app/(app)/account/page.tsx

import { getServerSession } from '@/lib/getServerSession';
import { getUserUsage } from '@/lib/usage-limits';
import { redirect } from 'next/navigation';
import { AccountClient } from './AccountClient';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

export default async function AccountPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect('/login');
  }

  // Fetch all usage data on the server
  const usageData = await getUserUsage(session.user.id);

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <AccountClient 
        initialData={usageData} 
        user={{
          id: session.user.id,
          email: session.user.email || '',
        }} 
      />
    </Suspense>
  );
}