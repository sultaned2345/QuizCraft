import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

// These environment variables are standard for Supabase projects
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// createBrowserClient automatically handles the storage (cookies)
// logic required for Next.js App Router (Server Components & Actions).
export const supabase = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);