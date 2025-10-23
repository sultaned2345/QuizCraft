import { createClient, PostgrestError } from '@supabase/supabase-js';
import { Database, Note, Quiz, Question, User } from '@/types/database'; // Assuming User type is defined here

// --- Supabase Client Initialization ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing in environment variables.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// --- Error Handling Helper ---
/**
 * Handles potential Supabase errors, logging them and throwing a consistent error format.
 * @param error The error object from Supabase.
 * @param context A string describing the operation that failed (e.g., "fetching quizzes").
 * @throws {Error} Throws a formatted error if the Supabase operation failed.
 */
function handleSupabaseError(error: PostgrestError | null, context: string): void {
  if (error) {
    console.error(`Supabase error during ${context}:`, {
      message: error.message,
      details: error.details,
      code: error.code,
      hint: error.hint,
    });
    // Rethrow the original error or a formatted one
    throw new Error(`Failed during ${context}: ${error.message}`);
  }
}

/**
 * A collection of helper functions for interacting with the Supabase database.
 * This object encapsulates all database queries, making them reusable and easier to manage.
 */
export const supabaseHelpers = {
  // --- User Operations ---

  /**
   * Fetches a single user profile by their ID.
   * Includes the subscription plan.
   * @param userId The UUID of the user to retrieve.
   * @returns A user profile object including the subscription plan, or null if not found.
   * @throws {Error} If there's a database error.
   */
  async getUserWithPlan(userId: string): Promise<(User & { subscription_plan: 'free' | 'pro' }) | null> {
    // Note: The 'users' table needs a 'subscription_plan' column.
    // Adjust the select query if your actual user profile table is different (e.g., 'profiles')
    // and ensure it has the 'subscription_plan' column.
    const { data, error } = await supabase
      .from('profiles') // Assuming 'profiles' table holds user details including plan
      .select('id, email, created_at, subscription_plan') // Select specific fields including plan
      .eq('id', userId)
      .maybeSingle(); // Use maybeSingle to return null instead of error if not found

    handleSupabaseError(error, `fetching user plan for user ${userId}`);

     // If no user profile found in 'profiles', create a default free plan representation
     // This handles cases where auth.users exists but the profile hasn't been created yet,
     // or if the profile table is named differently and the query returns null.
    if (!data) {
        console.warn(`No profile found for user ${userId}, assuming 'free' plan.`);
        // Fetch basic user info from auth to return something meaningful
         const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
         if (authError || !authUser?.user) {
             console.error(`Failed to get auth user details for ${userId} after profile lookup failed.`);
             // Return a minimal default object if auth lookup also fails
             return {
                 id: userId,
                 email: 'unknown', // Cannot retrieve email without profile/auth data
                 created_at: new Date().toISOString(), // Placeholder
                 subscription_plan: 'free' as const // Ensure type safety
             };
         }
         return {
             id: userId,
             email: authUser.user.email || 'unknown',
             created_at: authUser.user.created_at || new Date().toISOString(),
             subscription_plan: 'free' as const
         };
    }

    // Ensure the subscription_plan field exists and has a valid value, defaulting to 'free'
    const plan = (data as any).subscription_plan === 'pro' ? 'pro' : 'free';

    return { ...data, subscription_plan: plan } as (User & { subscription_plan: 'free' | 'pro' });
  },


  // --- Quiz Operations ---

  /**
   * Fetches quizzes for a specific user, including their questions.
   * Sorts by creation date descending.
   * @param userId The UUID of the user whose quizzes to fetch.
   * @returns An array of quiz objects with their related questions.
   * @throws {Error} If there's a database error.
   */
  async getQuizzes(userId: string): Promise<(Quiz & { questions: Question[] })[]> {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*, questions(*)') // Select all quiz fields and all related questions
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    handleSupabaseError(error, `fetching quizzes for user ${userId}`);
    return data || []; // Return data or an empty array if null
  },

  /**
   * Fetches a single quiz by its ID, including all its questions.
   * @param quizId The UUID of the quiz to retrieve.
   * @returns A single quiz object with its questions.
   * @throws {Error} If the quiz is not found or there's a database error.
   */
  async getQuiz(quizId: string): Promise<Quiz & { questions: Question[] }> {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*, questions(*)')
      .eq('id', quizId)
      .single(); // Throws error if not exactly one row is found

    handleSupabaseError(error, `fetching quiz ${quizId}`);
    if (!data) throw new Error(`Quiz with ID ${quizId} not found.`); // Should be caught by .single() but added for clarity
    return data;
  },

  /**
   * Gets the total count of quizzes for a user.
   * @param userId The UUID of the user.
   * @returns The number of quizzes the user has created.
   * @throws {Error} If there's a database error.
   */
  async getQuizzesCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('quizzes')
      .select('*', { count: 'exact', head: true }) // Efficiently get only the count
      .eq('user_id', userId);

    handleSupabaseError(error, `counting quizzes for user ${userId}`);
    return count ?? 0; // Return count or 0 if null
  },

  /**
   * Deletes a quiz by its ID. Assumes RLS prevents unauthorized deletion.
   * @param quizId The UUID of the quiz to delete.
   * @throws {Error} If there's a database error.
   */
  async deleteQuiz(quizId: string): Promise<void> {
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId);

    handleSupabaseError(error, `deleting quiz ${quizId}`);
  },

  /**
   * Fetches all questions for a specific quiz.
   * @param quizId The UUID of the quiz.
   * @returns An array of question objects for the specified quiz.
   * @throws {Error} If there's a database error.
   */
  async getQuestions(quizId: string): Promise<Question[]> {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId);

    handleSupabaseError(error, `fetching questions for quiz ${quizId}`);
    return data || [];
  },

  // --- Notes Operations ---

  /**
   * Fetches all notes for a specific user.
   * Sorts by creation date descending.
   * @param userId The UUID of the user.
   * @returns An array of note objects.
   * @throws {Error} If there's a database error.
   */
  async getNotes(userId: string): Promise<Note[]> {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    handleSupabaseError(error, `fetching notes for user ${userId}`);
    return data || [];
  },

  /**
   * Fetches a single note by its ID.
   * Assumes RLS ensures the user owns the note.
   * @param noteId The UUID of the note.
   * @returns A single note object.
   * @throws {Error} If the note is not found or there's a database error.
   */
  async getNote(noteId: string): Promise<Note> {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single(); // Error if 0 or >1 rows found

    handleSupabaseError(error, `fetching note ${noteId}`);
     if (!data) throw new Error(`Note with ID ${noteId} not found.`);
    return data;
  },

  /**
   * Gets the total count of notes for a user.
   * @param userId The UUID of the user.
   * @returns The number of notes the user has created.
   * @throws {Error} If there's a database error.
   */
  async getNotesCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    handleSupabaseError(error, `counting notes for user ${userId}`);
    return count ?? 0;
  },

  /**
   * Creates a single new note and returns the created record.
   * Uses .select().single() for reliability with RLS.
   * @param userId The UUID of the user creating the note.
   * @param title The title of the note.
   * @param content The content of the note.
   * @returns The newly created note object.
   * @throws {Error} If there's a database error or the insert fails.
   */
  async createNote(userId: string, title: string, content: string): Promise<Note> {
    const { data, error } = await supabase
      .from('notes')
      .insert({ user_id: userId, title: title.trim(), content: content.trim() })
      .select() // Ask Supabase to return the inserted row(s)
      .single(); // Expect only one row

    // Use the centralized error handler
    handleSupabaseError(error, `creating note for user ${userId}`);

    // This check is slightly redundant because .single() throws if no data,
    // but it adds explicitness.
    if (!data) {
        console.error("Note insert appeared successful (no error thrown), but no data was returned from Supabase.");
        throw new Error("Failed to retrieve the note immediately after saving. Please refresh.");
    }

    return data;
  },

  /**
   * Creates multiple notes in a single batch operation.
   * @param userId The UUID of the user creating the notes.
   * @param notes An array of note objects ({ title: string; content: string }) to insert.
   * @returns An array of the newly created note objects.
   * @throws {Error} If there's a database error during the batch insert.
   */
  async createManyNotes(userId: string, notes: Array<{ title: string; content: string }>): Promise<Note[]> {
    if (!notes || notes.length === 0) {
      return []; // Return empty array if no notes are provided
    }
    const notesToInsert = notes.map(note => ({
        ...note,
        title: note.title.trim(), // Trim title and content
        content: note.content.trim(),
        user_id: userId
    }));

    const { data, error } = await supabase
      .from('notes')
      .insert(notesToInsert)
      .select(); // Return all inserted rows

    handleSupabaseError(error, `creating multiple notes for user ${userId}`);
    return data || []; // Return inserted data or empty array
  },

  /**
   * Updates an existing note. Assumes RLS prevents unauthorized updates.
   * @param noteId The UUID of the note to update.
   * @param updates An object containing the fields to update (e.g., { title?: string; content?: string }).
   * @returns The updated note object.
   * @throws {Error} If the update fails or the note isn't found.
   */
  async updateNote(noteId: string, updates: Partial<Pick<Note, 'title' | 'content'>>): Promise<Note> {
      // Trim title and content if they are being updated
      const trimmedUpdates = { ...updates };
      if (trimmedUpdates.title !== undefined) {
          trimmedUpdates.title = trimmedUpdates.title.trim();
      }
       if (trimmedUpdates.content !== undefined) {
          trimmedUpdates.content = trimmedUpdates.content.trim();
      }

      const { data, error } = await supabase
          .from('notes')
          .update(trimmedUpdates)
          .eq('id', noteId)
          .select() // Return the updated row
          .single(); // Expect exactly one row to be updated and returned

      handleSupabaseError(error, `updating note ${noteId}`);
      if (!data) throw new Error(`Failed to update or retrieve note ${noteId} after update.`);
      return data;
  },

  /**
   * Deletes a note by its ID. Assumes RLS prevents unauthorized deletion.
   * @param noteId The UUID of the note to delete.
   * @throws {Error} If there's a database error.
   */
  async deleteNote(noteId: string): Promise<void> {
      const { error } = await supabase
          .from('notes')
          .delete()
          .eq('id', noteId);

      handleSupabaseError(error, `deleting note ${noteId}`);
  },

  // --- AI Usage Operations ---

  /**
   * Gets the total count of AI generations recorded for a user (across all time).
   * Note: This sums counts from potentially multiple monthly records.
   * @param userId The UUID of the user.
   * @returns The total number of AI generations used. Returns 0 if error or no records.
   */
  async getAIGenerationCount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('ai_usage')
        .select('usage_count')
        .eq('user_id', userId);

      // Don't throw if no rows found ('PGRST116'), just means count is 0.
      if (error && error.code !== 'PGRST116') {
         handleSupabaseError(error, `fetching total AI generation count for user ${userId}`);
      }

      // Sum up usage counts from all monthly records found
      const totalCount = data?.reduce((sum, record) => sum + (record.usage_count ?? 0), 0) ?? 0;
      return totalCount;

    } catch (error) {
      // Catch errors specifically from handleSupabaseError or other unexpected issues
      console.error('Error getting total AI generation count:', error);
      return 0; // Return 0 on failure
    }
  },

  /**
   * Retrieves the AI generation usage count for a user within a specific calendar month.
   * @param userId The UUID of the user.
   * @param month A Date object representing any day within the target month.
   * @returns The number of AI generations used in that specific month. Returns 0 if error or no record.
   */
  async getAIGenerationUsageForMonth(userId: string, month: Date): Promise<number> {
    // Ensure we use the very start of the month for consistent querying
    const firstDayOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
        .toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'

    try {
        const { data, error } = await supabase
            .from('ai_usage')
            .select('usage_count')
            .eq('user_id', userId)
            .eq('usage_month', firstDayOfMonth)
            .maybeSingle(); // Use maybeSingle as a record might not exist for the month

        // Don't throw if no rows found ('PGRST116')
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
   * Calls a PostgreSQL function `increment_ai_usage` which handles upsert logic.
   * @param userId The UUID of the user.
   * @param month A Date object representing any day within the target month.
   * @param count The positive integer value to increment the usage by (defaults to 1).
   * @throws {Error} If the RPC call fails.
   */
  async incrementAIGenerationUsage(userId: string, month: Date, count: number = 1): Promise<void> {
    if (count <= 0) {
      console.warn("Attempted to increment AI usage by non-positive value:", count);
      return; // Do nothing if count is not positive
    }

    const firstDayOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
        .toISOString().split('T')[0]; // Format 'YYYY-MM-DD'

    const { error } = await supabase.rpc('increment_ai_usage', {
        p_user_id: userId,
        p_usage_month: firstDayOfMonth,
        p_increment_by: count
    });

    // Pass the error (if any) to the centralized handler
    handleSupabaseError(error, `incrementing AI usage for user ${userId} month ${firstDayOfMonth} by ${count}`);
  },
};