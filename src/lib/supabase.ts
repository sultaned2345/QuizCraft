// src/lib/supabase.ts
import { createClient, PostgrestError } from '@supabase/supabase-js';
import { Database, Note, Quiz, Question, User } from '@/types/database';
// --- IMPORT THE SHARED CLIENT ---
import { supabase } from '@/lib/supabaseClient';

// --- Error Handling Helper ---
function handleSupabaseError(
  error: PostgrestError | null,
  context: string
): void {
  if (error) {
    console.error(`Supabase error during ${context}:`, {
      message: error.message,
      details: error.details,
      code: error.code,
      hint: error.hint,
    });
    throw new Error(
      `Failed during ${context}: ${error.message} (Code: ${error.code})`
    );
  }
}

/**
 * A collection of helper functions.
 * All functions here will now use the shared, imported 'supabase' client.
 */
export const supabaseHelpers = {
  // --- User Operations ---
  async getUserWithPlan(
    userId: string
  ): Promise<(User & { subscription_plan: 'free' | 'pro' }) | null> {
    const { data, error } = await supabase // <-- Uses shared client
      .from('profiles')
      .select('id, email, created_at, subscription_plan')
      .eq('id', userId)
      .maybeSingle();

    handleSupabaseError(error, `fetching user plan for user ${userId}`);

    if (!data) {
      console.warn(
        `No profile found for user ${userId}, assuming 'free' plan.`
      );
      return null;
    }
    const plan = (data as any).subscription_plan === 'pro' ? 'pro' : 'free';
    
    // Cast data to 'any' to avoid spread type errors
    return { ...(data as any), subscription_plan: plan } as User & {
      subscription_plan: 'free' | 'pro';
    };
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
  async getQuiz(
    quizId: string
  ): Promise<(Quiz & { questions: Question[] }) | null> {
    console.log(
      `[supabaseHelpers.getQuiz] Attempting to fetch quiz with ID: ${quizId}`
    );

    // Log session state from the shared client instance just before the query
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    if (sessionError) {
      console.error(
        '[supabaseHelpers.getQuiz] Error getting session before query:',
        sessionError
      );
    }
    console.log('[supabaseHelpers.getQuiz] Session state before query:', {
      hasSession: !!sessionData.session,
      userId: sessionData.session?.user?.id,
    });

    if (!quizId || typeof quizId !== 'string' || quizId.length < 10) {
      console.warn(
        `[supabaseHelpers.getQuiz] Invalid quizId provided: ${quizId}`
      );
      return null;
    }

    const { data, error } = await supabase // <-- Uses shared client
      .from('quizzes')
      .select('*, questions(*)')
      .eq('id', quizId)
      .maybeSingle();

    console.log(
      `[supabaseHelpers.getQuiz] Supabase response for ID ${quizId}:`,
      {
        // FIX: Cast data to 'any' because TS might infer it as 'never' if types are mismatched
        data: data ? `Quiz found (Title: ${(data as any).title})` : null,
        error: error,
      }
    );

    if (error && error.code !== 'PGRST116') {
      console.error(
        `[supabaseHelpers.getQuiz] Supabase error (excluding 'not found'):`,
        error
      );
      handleSupabaseError(error, `fetching quiz ${quizId}`);
    }

    if (data) {
      console.log(
        `[supabaseHelpers.getQuiz] Found quiz data for ID ${quizId}.`
      );
    } else {
      console.log(
        `[supabaseHelpers.getQuiz] No quiz data found for ID ${quizId} (or RLS prevented access).`
      );
    }

    // Cast return to match the Promise signature if needed, though 'never' is usually assignable
    return data as (Quiz & { questions: Question[] }) | null;
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
};