// src/app/(app)/account/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/getServerSession';
import { supabase } from '@/lib/supabaseClient';
// --- 1. CHANGE THIS IMPORT ---
import { AccountClient } from './AccountClient';
// --- END CHANGE ---

// This function fetches the user's plan.
async function getUserPlan(userId: string) {
  // ... (rest of the function is unchanged)
}

// This function fetches the user's AI usage.
async function getAiUsage(userId: string) {
  // ... (rest of the function is unchanged)
}

export default async function AccountPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { data: userPlan, error: planError } = await supabase
    .from('user_plans')
    .select('*')
    .eq('user_id', session.user.id)
    .single();

  const { data: usage, error: usageError } = await supabase
    .from('user_ai_usage')
    .select('*')
    .eq('user_id', session.user.id);
    
  if (planError && planError.code !== 'PGRST116') { // Ignore "no rows" error
    console.error('Error fetching user plan:', planError);
    // Handle error appropriately
  }

  if (usageError) {
    console.error('Error fetching user usage:', usageError);
    // Handle error appropriately
  }

  const currentUsage = {
    documents: usage?.find(u => u.feature === 'DOCUMENT_UPLOAD')?.usage_count || 0,
    quizzes: usage?.find(u => u.feature === 'QUIZ_GENERATION')?.usage_count || 0,
    flashcardDecks: usage?.find(u => u.feature === 'DECK_GENERATION')?.usage_count || 0,
    essayReviews: usage?.find(u => u.feature === 'ESSAY_GRADING')?.usage_count || 0,
  };

  return (
    <AccountClient
      userEmail={session.user.email || ''}
      userPlan={userPlan}
      currentUsage={currentUsage}
    />
  );
}