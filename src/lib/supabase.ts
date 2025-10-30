// src/lib/supabase.ts
import { createClient, PostgrestError } from '@supabase/supabase-js';
import { Database, Note, Quiz, Question, User } from '@/types/database';
import { prisma } from '@/lib/prisma'; // Import Prisma
// --- IMPORT THE SHARED CLIENT ---
import { supabase } from '@/lib/supabaseClient'; 

// --- REMOVE THE OLD CLIENT CREATION ---
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!; // <-- REMOVED
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // <-- REMOVED
// if (!supabaseUrl || !supabaseAnonKey) { // <-- REMOVED
//   throw new Error("Supabase URL or Anon Key is missing in environment variables.");
// }
// export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey); // <-- REMOVED

// --- Error Handling Helper (Keep) ---
function handleSupabaseError(error: PostgrestError | null, context: string): void {
  if (error) {
    console.error(`Supabase error during ${context}:`, {
      message: error.message,
      details: error.details,
      code: error.code,
      hint: error.hint,
    });
    throw new Error(`Failed during ${context}: ${error.message} (Code: ${error.code})`);
  }
}

/**
 * A collection of helper functions.
 * All functions here will now use the shared, imported 'supabase' client.
 */
export const supabaseHelpers = {
  // --- User Operations ---
  async getUserWithPlan(userId: string): Promise<(User & { subscription_plan: 'free' | 'pro' }) | null> {
    const { data, error } = await supabase // <-- Uses shared client
      .from('profiles')
      .select('id, email, created_at, subscription_plan')
      .eq('id', userId)
      .maybeSingle();

    handleSupabaseError(error, `fetching user plan for user ${userId}`);

    if (!data) {
        console.warn(`No profile found for user ${userId}, assuming 'free' plan.`);
         try {
             const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
             if (authError || !authUser?.user) throw authError || new Error('User not found');
             return {
                 id: userId,
                 email: authUser.user.email || 'unknown',
                 created_at: authUser.user.created_at || new Date().toISOString(),
                 subscription_plan: 'free' as const
             };
         } catch (adminError) {
              console.error(`Failed to get auth user details for ${userId} after profile lookup failed:`, adminError);
              return null;
         }
    }
    const plan = (data as any).subscription_plan === 'pro' ? 'pro' : 'free';
    return { ...data, subscription_plan: plan } as (User & { subscription_plan: 'free' | 'pro' });
  },

  // --- Quiz Operations ---
  async getQuizzes(userId: string): Promise<(Quiz & { questions: Question[] })[]> {
    const { data, error } = await supabase // <-- Uses shared client
      .from('quizzes')
      .select('*, questions(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    handleSupabaseError(error, `fetching quizzes for user ${userId}`);
    return data || [];
  },

  // UPDATED getQuiz function with debugging
  async getQuiz(quizId: string): Promise<(Quiz & { questions: Question[] }) | null> {
    console.log(`[supabaseHelpers.getQuiz] Attempting to fetch quiz with ID: ${quizId}`);

    // Log session state from the shared client instance just before the query
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if(sessionError){
        console.error('[supabaseHelpers.getQuiz] Error getting session before query:', sessionError);
    }
    console.log('[supabaseHelpers.getQuiz] Session state before query:', {
        hasSession: !!sessionData.session,
        userId: sessionData.session?.user?.id
    });

    if (!quizId || typeof quizId !== 'string' || quizId.length < 10) {
        console.warn(`[supabaseHelpers.getQuiz] Invalid quizId provided: ${quizId}`);
        return null;
    }

    const { data, error } = await supabase // <-- Uses shared client
      .from('quizzes')
      .select('*, questions(*)')
      .eq('id', quizId)
      .maybeSingle(); 

    console.log(`[supabaseHelpers.getQuiz] Supabase response for ID ${quizId}:`, { data: data ? `Quiz found (Title: ${data.title})` : null , error: error });

    if (error && error.code !== 'PGRST116') {
         console.error(`[supabaseHelpers.getQuiz] Supabase error (excluding 'not found'):`, error);
         handleSupabaseError(error, `fetching quiz ${quizId}`);
    }

    if (data) {
        console.log(`[supabaseHelpers.getQuiz] Found quiz data for ID ${quizId}.`);
    } else {
        console.log(`[supabaseHelpers.getQuiz] No quiz data found for ID ${quizId} (or RLS prevented access).`);
    }

    return data;
  },

  async deleteQuiz(quizId: string): Promise<void> {
    const { error } = await supabase // <-- Uses shared client
      .from('quizzes')
      .delete()
      .eq('id', quizId);

    handleSupabaseError(error, `deleting quiz ${quizId}`);
  },

  // --- Notes Operations ---
  async getNotes(userId: string): Promise<Note[]> {
    const { data, error } = await supabase // <-- Uses shared client
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    handleSupabaseError(error, `fetching notes for user ${userId}`);
    return data || [];
  },

  // --- AI Usage Operations ---
  async getAIGenerationCount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase // <-- Uses shared client
        .from('ai_usage')
        .select('usage_count')
        .eq('user_id', userId);

      if (error && error.code !== 'PGRST116') {
         handleSupabaseError(error, `fetching total AI generation count for user ${userId}`);
      }
      const totalCount = data?.reduce((sum, record) => sum + (record.usage_count ?? 0), 0) ?? 0;
      return totalCount;

    } catch (error) {
      console.error('Error getting total AI generation count:', error);
      return 0;
    }
  },

  async getAIGenerationUsageForMonth(userId: string, month: Date): Promise<number> {
    const firstDayOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
        .toISOString().split('T')[0];

    try {
        const { data, error } = await supabase // <-- Uses shared client
            .from('ai_usage')
            .select('usage_count')
            .eq('user_id', userId)
            .eq('usage_month', firstDayOfMonth)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            handleSupabaseError(error, `fetching AI generation usage for user ${userId} month ${firstDayOfMonth}`);
        }
        return data?.usage_count ?? 0;

    } catch (error) {
        console.error(`Error getting AI generation usage for month ${firstDayOfMonth}:`, error);
        return 0;
    }
  },

  async incrementAIGenerationUsage(userId: string, month: Date, accessToken: string | undefined | null, count: number = 1): Promise<void> {
    if (!accessToken) {
        console.error("incrementAIGenerationUsage called without an accessToken.");
        throw new Error("Authentication token is required to update usage statistics.");
    }
    if (count <= 0) {
      console.warn("Attempted to increment AI usage by non-positive value:", count);
      return;
    }

    const firstDayOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
        .toISOString().split('T')[0];

    // --- Re-fetching the original supabaseUrl and supabaseAnonKey for this specific function ---
    const supabaseUrl_for_increment = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey_for_increment = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const userSupabase = createClient<Database>(supabaseUrl_for_increment, supabaseAnonKey_for_increment, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });

    try {
        const { data: currentUsage, error: fetchError } = await userSupabase
            .from('ai_usage')
            .select('usage_count')
            .eq('user_id', userId)
            .eq('usage_month', firstDayOfMonth)
            .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
             handleSupabaseError(fetchError, `fetching current AI usage for user ${userId} month ${firstDayOfMonth}`);
        }

        const currentCount = currentUsage?.usage_count ?? 0;
        const newCount = currentCount + count;

        const { error: upsertError } = await userSupabase
            .from('ai_usage')
            .upsert(
                {
                    user_id: userId,
                    usage_month: firstDayOfMonth,
                    usage_count: newCount,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: 'user_id, usage_month',
                }
            );

        handleSupabaseError(upsertError, `upserting AI usage for user ${userId} month ${firstDayOfMonth}`);
        console.log(`Successfully updated AI usage for ${userId} in ${firstDayOfMonth} to ${newCount}.`);

    } catch (error) {
        console.error(`Error during AI usage increment logic for user ${userId}:`, error);
        throw error;
    }
  },
};