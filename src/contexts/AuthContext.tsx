// src/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, SupabaseClient } from '@supabase/supabase-js';
// Import the shared browser client
import { supabase } from '@/lib/supabaseClient';
import { Database } from '@/types/database'; // Make sure this path is correct

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any; data?: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any; data?: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  // Optional: You could also expose the client here if needed
  // supabase: SupabaseClient<Database>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- We no longer create a client here, we import it ---
// const supabase = createBrowserClient<Database>(...) // <-- REMOVED

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session *using the shared client*
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes *using the shared client*
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []); // No dependency on 'supabase' as it's defined outside

  // All auth methods below now use the imported, shared 'supabase' client

  const signUp = async (email: string, password: string) => {
    try {
      console.log('Starting sign up process for:', email);
      if (!email || !password) {
        /* ...validation... */ return { error: { message: 'Email and password are required' } };
      }
      if (password.length < 6) {
        /* ...validation... */ return { error: { message: 'Password must be at least 6 characters' } };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        // --- THIS IS THE CHANGE ---
        // The `options` object can be removed or left empty,
        // as emailRedirectTo is no longer used.
        // options: {
        //   emailRedirectTo: `${window.location.origin}/documents`,
        // },
        // --- END OF CHANGE ---
      });

      console.log('Sign up result:', {
        user: data.user?.id,
        session: !!data.session,
        error: error?.message,
      });
      return { data, error };
    } catch (err: any) {
      console.error('Sign up error:', err);
      return { error: { message: err.message || 'An unexpected error occurred during sign up' } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Starting sign in process for:', email);
      if (!email || !password) {
        /* ...validation... */ return { error: { message: 'Email and password are required' } };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      console.log('Sign in result:', {
        user: data.user?.id,
        session: !!data.session,
        error: error?.message,
      });
      return { data, error };
    } catch (err: any) {
      console.error('Sign in error:', err);
      return { error: { message: err.message || 'An unexpected error occurred during sign in' } };
    }
  };

  const signOut = async () => {
    try {
      console.log('Starting sign out process');
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Sign out error:', error);
        return { error };
      }

      console.log('Sign out successful');
      return { error: null };
    } catch (err: any) {
      console.error('Sign out error:', err);
      return { error: { message: err.message || 'An unexpected error occurred during sign out' } };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('Starting password reset for:', email);
      if (!email) {
        /* ...validation... */ return { error: { message: 'Email is required' } };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      console.log('Password reset result:', { error: error?.message });
      return { error };
    } catch (err: any) {
      console.error('Password reset error:', err);
      return { error: { message: err.message || 'An unexpected error occurred during password reset' } };
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    // supabase, // You can expose the client here if you want
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}