// src/lib/supabaseAdmin.ts (Create this file)
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database'; // Adjust path if needed

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  // In a real app, you might throw an error during build if these are missing
  console.warn('Supabase URL or Service Role Key missing for admin client.');
}

// Ensure this client is ONLY used in server-side code (API routes, Server Components)
export const supabaseAdmin = createClient<Database>(
    supabaseUrl || '',
    serviceRoleKey || '',
    {
        auth: {
            // Important: Prevent client from persisting sessions or auto-refreshing tokens
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        }
    }
);