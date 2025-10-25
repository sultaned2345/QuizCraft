// src/lib/supabase.ts
import { createClient, PostgrestError } from '@supabase/supabase-js';
import { Database, Note, Quiz, Question, User } from '@/types/database';
import { prisma } from '@/lib/prisma';

// --- Supabase Client Initialization (Keep global client) ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!supabaseUrl || !supabaseAnonKey) { /* ... error handling ... */ }
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// --- Error Handling Helper (Keep as is) ---
function handleSupabaseError(error: PostgrestError | null, context: string): void {
    if (error) {
        // Log more details from PostgrestError
        console.error(`Supabase error during ${context}:`, {
        message: error.message,
        details: error.details,
        code: error.code,
        hint: error.hint,
        });
        // Rethrow a formatted error
        throw new Error(`Failed during ${context}: ${error.message} (Code: ${error.code})`);
    }
}


export const supabaseHelpers = {
  // ... (getUserWithPlan, getQuizzesForDashboard, getQuiz, deleteQuiz, getNotes, etc. remain the same) ...

  // --- AI Usage Operations ---

  // ... (getAIGenerationCount, getAIGenerationUsageForMonth remain the same) ...

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

        handleSupabaseError(fetchError, `fetching current AI usage for user ${userId} month ${firstDayOfMonth}`);

        const currentCount = currentUsage?.usage_count ?? 0;
        const newCount = currentCount + count;

        // Perform the upsert operation
        const { error: upsertError } = await userSupabase
            .from('ai_usage')
            .upsert(
                {
                    user_id: userId, // Must provide user_id explicitly
                    usage_month: firstDayOfMonth,
                    usage_count: newCount,
                    updated_at: new Date().toISOString(), // Manually set updated_at
                },
                {
                    onConflict: 'user_id, usage_month', // Specify conflict columns
                    // ignoreDuplicates: false // Default is false, ensures update happens
                }
            );

        // Explicitly check for upsert error and pass to handler
        handleSupabaseError(upsertError, `upserting AI usage for user ${userId} month ${firstDayOfMonth}`);

        console.log(`Successfully updated AI usage for ${userId} in ${firstDayOfMonth} to ${newCount}.`);

    } catch (error) {
        // Errors from handleSupabaseError or client creation will be caught here
        console.error(`Error during AI usage increment logic for user ${userId}:`, error);
        // Re-throw the original error after logging, or throw a new formatted one
        throw error; // Re-throws the error caught by handleSupabaseError or others
    }
    // --- End UPSERT logic ---

    // No need to call RPC anymore
    // const { error } = await userSupabase.rpc('increment_ai_usage', { ... });
    // handleSupabaseError(error, `incrementing AI usage...`);
  },
};