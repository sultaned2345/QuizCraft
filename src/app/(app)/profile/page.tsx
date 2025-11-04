// src/app/(app)/profile/page.tsx
// NEW FILE (Replaces the old /app/profile/page.tsx)

import { getServerSession } from '@/lib/getServerSession';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { ProfileClient } from './ProfileClient'; // Import the new client component
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// This is the new Server Component.
// It fetches *only* the data needed for this specific page.
async function getProfileData(userId: string) {
  const [quizCount, noteCount, docCount] = await Promise.all([
    prisma.quiz.count({ where: { userId: userId } }),
    prisma.notes.count({ where: { user_id: userId } }),
    prisma.documents.count({ where: { user_id: userId } }),
  ]);
  return { quizCount, noteCount, docCount };
}

export default async function ProfilePage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect('/login');
  }

  const { quizCount, noteCount, docCount } = await getProfileData(
    session.user.id
  );

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      {/* Pass user and data as props to the Client Component */}
      <ProfileClient
        user={session.user} // Pass the user object
        quizCount={quizCount}
        noteCount={noteCount}
        docCount={docCount}
      />
    </Suspense>
  );
}