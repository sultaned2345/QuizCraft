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

    // --- THIS IS THE FIX ---
    // Change from getSession() to getUser()
    // This validates the cookie/token against the Supabase server.
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
        console.error("!!! SERVER-SIDE ERROR: Error getting user in getServerSession:", error.message);
        return null; // Return null on error
    }

    // If user is null, there is no valid session
    if (!user) {
        return null;
    }
    
    // We don't have the full "session" object, but we have the
    // essential "user" object, which is what we use everywhere else.
    // We will return a "session-like" object to match expectations.
    return {
        user,
        // You can add other properties here if needed, but user is the key
        access_token: cookieStore.get(`sb-${supabaseUrl.split('.')[0]}-auth-token`)?.value || null, 
    };
    // --- END OF FIX ---

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