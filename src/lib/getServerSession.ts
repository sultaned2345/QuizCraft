// src/lib/getServerSession.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'; // Adjust path if your types are elsewhere

export async function getServerSession() {
  const cookieStore = cookies()

  // Ensure environment variables are defined
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('!!! SERVER-SIDE ERROR: Supabase URL or Anon Key missing for getServerSession.');
    return null; // Return null if keys are missing
  }

  try {
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          // No need for set/remove here just to get session
        },
      }
    )

    // Get session data
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error("!!! SERVER-SIDE ERROR: Error getting session in getServerSession:", error.message);
        return null; // Return null on error
    }

    // console.log("getServerSession - Session User ID:", session?.user?.id); // Optional: Add logging
    return session; // Return the session object (contains user data if logged in)

  } catch (e) {
      console.error("!!! SERVER-SIDE ERROR: Exception in getServerSession:", e);
      return null; // Return null on exception
  }
}

// Optional helper (keep if you use it elsewhere)
export function createSupabaseServerClient() {
    const cookieStore = cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

     // Add checks for env vars here too if needed
     if (!supabaseUrl || !supabaseAnonKey) {
        console.error("!!! SERVER-SIDE ERROR: Supabase URL/Key missing for createSupabaseServerClient.");
        // Handle appropriately - maybe throw or return a dummy client?
        throw new Error("Missing Supabase credentials for server client.");
     }

     return createServerClient<Database>(
        supabaseUrl,
        supabaseAnonKey,
        {
           cookies: {
               get(name: string) { return cookieStore.get(name)?.value },
               // set(...) and remove(...) might be needed if using this client for auth actions
           },
        }
    )
}