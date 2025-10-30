// src/lib/supabase.ts
import { createClient, PostgrestError } from '@supabase/supabase-js';
import { Database, Note, Quiz, Question, User } from '@/types/database';
import { prisma } from '@/lib/prisma'; // Import Prisma

// --- Supabase Client Initialization (Keep global client) ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing in environment variables.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// --- Error Handling Helper ---
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
 */
export const supabaseHelpers = {
  // --- User Operations ---
  async getUserWithPlan(userId: string): Promise<(User & { subscription_plan: 'free' | 'pro' }) | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, created_at, subscription_plan')
      .eq('id', userId)
      .maybeSingle();

    handleSupabaseError(error, `fetching user plan for user ${userId}`);

    if (!data) {
        console.warn(`No profile found for user ${userId}, assuming 'free' plan.`);
         try {
             // This might require an admin client if RLS is strict
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

  // --- Quiz Operations (Legacy - Dashboard uses Server Components) ---
  // This function is still used by the /dashboard page (client component) for delete
  async getQuizzes(userId: string): Promise<(Quiz & { questions: Question[] })[]> {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*, questions(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    handleSupabaseError(error, `fetching quizzes for user ${userId}`);
    return data || [];
  },

  // UPDATED getQuiz function with debugging
  async getQuiz(quizId: string): Promise<(Quiz & { questions: Question[] }) | null> {
    console.log(`[supabaseHelpers.getQuiz] Attempting to fetch quiz with ID: ${quizId}`); // Log the ID being used

    // Log session state from the global client instance just before the query
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if(sessionError){
        console.error('[supabaseHelpers.getQuiz] Error getting session before query:', sessionError);
    }
    console.log('[supabaseHelpers.getQuiz] Session state before query:', {
        hasSession: !!sessionData.session,
        userId: sessionData.session?.user?.id // Log the user ID from the session perspective
    });

    // Ensure quizId is potentially valid before querying
    if (!quizId || typeof quizId !== 'string' || quizId.length < 10) { // Basic sanity check
        console.warn(`[supabaseHelpers.getQuiz] Invalid quizId provided: ${quizId}`);
        return null;
    }

    const { data, error } = await supabase
      .from('quizzes')
      .select('*, questions(*)')
      .eq('id', quizId)
      .maybeSingle(); // Use maybeSingle()

    // Log the raw Supabase response (cleaner output)
    console.log(`[supabaseHelpers.getQuiz] Supabase response for ID ${quizId}:`, { data: data ? `Quiz found (Title: ${data.title})` : null , error: error });

    // Handle potential errors (but not the '0 rows' case for maybeSingle)
    if (error && error.code !== 'PGRST116') {
         console.error(`[supabaseHelpers.getQuiz] Supabase error (excluding 'not found'):`, error);
         // Optionally, re-throw or handle specific errors differently
         handleSupabaseError(error, `fetching quiz ${quizId}`); // This will throw
    }

    // Log whether data was found before returning
    if (data) {
        console.log(`[supabaseHelpers.getQuiz] Found quiz data for ID ${quizId}.`);
    } else {
        console.log(`[supabaseHelpers.getQuiz] No quiz data found for ID ${quizId} (or RLS prevented access).`);
    }

    return data; // Returns the quiz object or null
  },

  // This is used by the /dashboard page
  async deleteQuiz(quizId: string): Promise<void> {
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId);

    handleSupabaseError(error, `deleting quiz ${quizId}`);
  },

  // --- Notes Operations (Legacy - AI Tutor uses this) ---
  async getNotes(userId: string): Promise<Note[]> {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    handleSupabaseError(error, `fetching notes for user ${userId}`);
    return data || [];
  },

  // --- AI Usage Operations (Using Supabase Client) ---

  /**
   * Gets the total count of AI generations recorded for a user (across all time).
   */
  async getAIGenerationCount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
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
      return 0; // Return 0 on failure
    }
  },

  /**
   * Retrieves the AI generation usage count for a user within a specific calendar month.
   */
  async getAIGenerationUsageForMonth(userId: string, month: Date): Promise<number> {
    const firstDayOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
        .toISOString().split('T')[0]; // Format 'YYYY-MM-DD'

    try {
        const { data, error } = await supabase
            .from('ai_usage')
            .select('usage_count')
            .eq('user_id', userId)
            .eq('usage_month', firstDayOfMonth)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            handleSupabaseError(error, `fetching AI generation usage for user ${userId} month ${firstDayOfMonth}`);
        }
        return data?.usage_count ?? 0; // Return count or 0 if no record

    } catch (error) {
        console.error(`Error getting AI generation usage for month ${firstDayOfMonth}:`, error);
        return 0; // Return 0 on failure
    }
  },


  /**
   * Increments the AI generation usage count for a user for a specific month.
   * Performs an UPSERT operation directly using the Supabase JS client.
   * Requires the user's accessToken to ensure RLS policies are met.
   * @param userId The UUID of the user.
   * @param month A Date object representing any day within the target month.
   * @param accessToken The user's Supabase JWT access token.
   * @param count The positive integer value to increment the usage by (defaults to 1).
   * @throws {Error} If the upsert operation fails or accessToken is missing.
   */
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
        .toISOString().split('T')[0]; // Format 'YYYY-MM-DD'

    // Create a temporary client authenticated as the specific user
    const userSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });

    // --- Perform UPSERT directly ---
    try {
        // Fetch the current count for the specific user and month first
        const { data: currentUsage, error: fetchError } = await userSupabase
            .from('ai_usage')
            .select('usage_count')
            .eq('user_id', userId)
            .eq('usage_month', firstDayOfMonth)
            .maybeSingle(); // Use maybeSingle to handle no existing row

        // Pass error to handler (will throw if it's not a 'no rows' error)
        if (fetchError && fetchError.code !== 'PGRST116') {
             handleSupabaseError(fetchError, `fetching current AI usage for user ${userId} month ${firstDayOfMonth}`);
        }

        const currentCount = currentUsage?.usage_count ?? 0;
        const newCount = currentCount + count;

        // Perform the upsert operation
        const { error: upsertError } = await userSupabase
            .from('ai_usage')
            .upsert(
                {
                    user_id: userId, // Must provide user_id explicitly for RLS
                    usage_month: firstDayOfMonth,
                    usage_count: newCount,
                    updated_at: new Date().toISOString(), // Manually set updated_at
                },
                {
                    onConflict: 'user_id, usage_month', // Specify conflict columns
                }
            );

        // Explicitly check for upsert error and pass to handler
        handleSupabaseError(upsertError, `upserting AI usage for user ${userId} month ${firstDayOfMonth}`);

        console.log(`Successfully updated AI usage for ${userId} in ${firstDayOfMonth} to ${newCount}.`);

    } catch (error) {
        // Errors from handleSupabaseError or client creation will be caught here
        console.error(`Error during AI usage increment logic for user ${userId}:`, error);
        // Re-throw the original error
        throw error;
    }
  },
};