// src/app/(app)/profile/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/getServerSession';
import { supabase } from '@/lib/supabaseClient';
// --- 1. CHANGE THIS IMPORT ---
import { ProfileClient } from './ProfileClient';
// --- END CHANGE ---

async function getCounts(userId: string) {
  const { count: quizCount, error: quizError } = await supabase
    .from('quizzes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: noteCount, error: noteError } = await supabase
    .from('notes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
    
  const { count: docCount, error: docError } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (quizError || noteError || docError) {
    console.error('Error fetching counts:', { quizError, noteError, docError });
  }

  return {
    quizCount: quizCount || 0,
    noteCount: noteCount || 0,
    docCount: docCount || 0,
  };
}

export default async function ProfilePage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { quizCount, noteCount, docCount }_ = await getCounts(session.user.id);

  return (
    <ProfileClient
      user={session.user}
      quizCount={quizCount}
      noteCount={noteCount}
      docCount={docCount}
    />
  );
}