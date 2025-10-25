// src/lib/getServerSession.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'; // Adjust if your types are elsewhere

export async function getServerSession() {
  const cookieStore = cookies()

  // Ensure environment variables are defined
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Anon Key is missing in environment variables for server client.');
    // Depending on your error handling strategy, you might throw an error
    // or return null/undefined. Returning null here for demonstration.
    return null;
  }

  const supabase = createServerClient<Database>( // Add your Database type if you have one
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        // Optionally add set and remove if needed for server-side auth actions
        // set(name: string, value: string, options: CookieOptions) {
        //   cookieStore.set({ name, value, ...options })
        // },
        // remove(name: string, options: CookieOptions) {
        //   cookieStore.delete({ name, ...options })
        // },
      },
    }
  )

  // Get session data
  const { data: { session } } = await supabase.auth.getSession();

  // You might want to also fetch user profile data here if needed globally
  // const { data: user } = await supabase.auth.getUser();

  return session; // Return the session object (contains user data if logged in)
}

// Optional: Helper to get the server client directly if needed elsewhere
export function createSupabaseServerClient() {
    const cookieStore = cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

     return createServerClient<Database>(
        supabaseUrl,
        supabaseAnonKey,
        {
        cookies: {
            get(name: string) { return cookieStore.get(name)?.value },
        },
        }
    )
}