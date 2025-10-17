import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Helper functions for common operations
export const supabaseHelpers = {
  // User operations
  async getUser(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getUserWithPlan(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('subscription_plan')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Quiz operations
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

  async getQuiz(quizId: string) {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*, questions(*)')
      .eq('id', quizId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteQuiz(quizId: string) {
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId);
    
    if (error) throw error;
  },

  // This function is still useful for specific cases, so we keep it.
  async getQuestions(quizId: string) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId);
    
    if (error) throw error;
    return data;
  },

  // Notes operations
  async getNotes(userId: string) {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getNote(noteId: string) {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async getNotesCount(userId: string) {
    const { count, error } = await supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (error) throw error;
    return count || 0;
  }
};