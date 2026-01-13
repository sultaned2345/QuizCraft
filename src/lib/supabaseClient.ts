// src/lib/supabaseClient.ts
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// createBrowserClient automatically configures cookie storage for Next.js
export const supabase = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);