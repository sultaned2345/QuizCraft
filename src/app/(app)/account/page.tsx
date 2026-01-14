// src/app/(app)/account/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/getServerSession'; // Adjust based on your actual auth helper
import { getUserUsage } from '@/lib/usage-limits';
import { AccountClient } from './AccountClient';
import { supabase } from '@/lib/supabaseClient'; // Or your server-side supabase client

export const metadata = {
  title: 'Account Settings | QuizCraft',
  description: 'Manage your profile, preferences, and subscription.',
};

export default async function AccountPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/login');
  }

  // Fetch usage data server-side
  const usageData = await getUserUsage(session.user.id);

  return (
    <AccountClient 
      initialData={usageData} 
      user={{
        id: session.user.id,
        email: session.user.email!,
        // Add other user fields here if available in your metadata
      }} 
    />
  );
}