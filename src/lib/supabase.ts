import { createClient } from '@supabase/supabase-js';
import { Database, Note } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * A collection of helper functions for interacting with the Supabase database.
 * This object encapsulates all database queries, making them reusable and easier to manage.
 */
export const supabaseHelpers = {
  // --- User Operations ---

  /**
   * Fetches a single user profile by their ID.
   * @param userId The UUID of the user to retrieve.
   * @returns A user profile object.
   */
  async getUser(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Fetches a user's subscription plan.
   * @param userId The UUID of the user.
   * @returns An object containing the user's subscription_plan.
   */
  async getUserWithPlan(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('subscription_plan')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // --- Quiz Operations ---

  /**
   * Fetches all quizzes for a specific user or all public quizzes.
   * @param userId Optional. If provided, fetches quizzes for this user. Otherwise, fetches all public quizzes.
   * @returns An array of quiz objects, including their related questions.
   */
  async getQuizzes(userId?: string) {
    let query = supabase.from('quizzes').select('*, questions(*)');
    
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('is_public', true);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  /**
   * Fetches a single quiz by its ID, including all its questions.
   * @param quizId The UUID of the quiz to retrieve.
   * @returns A single quiz object with its questions.
   */
  async getQuiz(quizId: string) {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*, questions(*)')
      .eq('id', quizId)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Deletes a quiz by its ID.
   * @param quizId The UUID of the quiz to delete.
   */
  async deleteQuiz(quizId: string) {
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId);
    
    if (error) throw error;
  },

  /**
   * Fetches all questions for a specific quiz.
   * @param quizId The UUID of the quiz.
   * @returns An array of question objects.
   */
  async getQuestions(quizId: string) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId);
    
    if (error) throw error;
    return data;
  },

  // --- Notes Operations ---

  /**
   * Fetches all notes for a specific user.
   * @param userId The UUID of the user.
   * @returns An array of note objects.
   */
  async getNotes(userId: string): Promise<Note[]> {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  /**
   * Fetches a single note by its ID.
   * @param noteId The UUID of the note.
   * @returns A single note object.
   */
  async getNote(noteId: string): Promise<Note> {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Gets the total count of notes for a user.
   * @param userId The UUID of the user.
   * @returns The number of notes.
   */
  async getNotesCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (error) throw error;
    return count || 0;
  },

  /**
   * Creates a single new note.
   * @param userId The UUID of the user creating the note.
   * @param title The title of the note.
   * @param content The content of the note.
   * @returns The newly created note object.
   */
  async createNote(userId: string, title: string, content: string): Promise<Note> {
    // Step 1: Insert the note without selecting immediately
    const { error: insertError } = await supabase
      .from('notes')
      .insert({ user_id: userId, title, content });

    if (insertError) {
        console.error("Error during note insertion:", insertError);
        // Rethrow the specific Supabase error
        throw insertError;
    }

    // Step 2: Query separately for the note that was just inserted.
    // We fetch the most recent note by this user matching the title/content.
    // This assumes title/content are unique enough for recent inserts.
    const { data: selectData, error: selectError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .eq('title', title) // Match the title we just inserted
        .eq('content', content) // Match the content we just inserted
        .order('created_at', { ascending: false }) // Get the absolute most recent one
        .limit(1) // We only want one
        .maybeSingle(); // Use maybeSingle() instead of single() to return null instead of error if 0 rows

    if (selectError) {
        console.error("Error selecting note immediately after insertion:", selectError);
        throw new Error(`Note inserted, but failed to retrieve it immediately. Error: ${selectError.message}`);
    }

    if (!selectData) {
         // This *really* shouldn't happen if the insert worked and RLS is correct,
         // but it indicates a persistent visibility problem.
         console.error("Note inserted, but query returned null immediately after.");
         throw new Error("Note was saved, but could not be immediately retrieved. Please refresh the notes list.");
    }

    // If we successfully selected the data, return it
    return selectData;
  },

  /**
   * Creates multiple notes in a single batch operation.
   * @param userId The UUID of the user creating the notes.
   * @param notes An array of note objects to insert.
   * @returns An array of the newly created note objects.
   */
  async createManyNotes(userId: string, notes: Array<{ title: string; content: string }>): Promise<Note[]> {
    const notesToInsert = notes.map(note => ({ ...note, user_id: userId }));
    const { data, error } = await supabase
      .from('notes')
      .insert(notesToInsert)
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Updates an existing note.
   * @param noteId The UUID of the note to update.
   * @param updates An object containing the fields to update (title or content).
   * @returns The updated note object.
   */
  async updateNote(noteId: string, updates: { title?: string, content?: string }): Promise<Note> {
      const { data, error } = await supabase
          .from('notes')
          .update({ ...updates }) // FIX: Removed the manual 'updated_at' update.
          .eq('id', noteId)
          .select()
          .single();
      if (error) throw error;
      return data;
  },

  /**
   * Deletes a note by its ID.
   * @param noteId The UUID of the note to delete.
   */
  async deleteNote(noteId: string): Promise<void> {
      const { error } = await supabase
          .from('notes')
          .delete()
          .eq('id', noteId);
      if (error) throw error;
  },

  // --- AI Usage Operations ---

  /**
   * Retrieves the AI generation usage count for a user in a given month.
   * @param userId The UUID of the user.
   * @param month The month to check usage for (as a Date object).
   * @returns The number of AI generations used in that month.
   */
  async getAIGenerationUsage(userId: string, month: Date): Promise<number> {
    const firstDayOfMonth = new Date(month.getFullYear(), month.getMonth(), 1).toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('ai_usage')
        .select('usage_count')
        .eq('user_id', userId)
        .eq('usage_month', firstDayOfMonth)
        .single();
    
    // 'PGRST116' means no rows were found, which is not an error in this case, just means usage is 0.
    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    return data ? data.usage_count : 0;
  },

  /**
   * Increments the AI generation usage count for a user.
   * This calls a PostgreSQL function that handles inserting or updating the monthly record.
   * @param userId The UUID of the user.
   * @param month The month to increment usage for.
   * @param count The number to increment the usage by.
   */
  async incrementAIGenerationUsage(userId: string, month: Date, count: number): Promise<void> {
    const firstDayOfMonth = new Date(month.getFullYear(), month.getMonth(), 1).toISOString().split('T')[0];
    const { error } = await supabase.rpc('increment_ai_usage', {
        p_user_id: userId,
        p_usage_month: firstDayOfMonth,
        p_increment_by: count
    });
    if (error) throw error;
  },
};