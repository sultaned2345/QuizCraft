// src/lib/getServerSession.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'; 

export async function getServerSession() {
  const cookieStore = cookies()

  // Ensure environment variables are defined
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('!!! SERVER-SIDE ERROR: Supabase URL or Anon Key missing for getServerSession.');
    return null; 
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
          // We only need 'get' for reading the session. 
          // 'set' and 'remove' are not needed here as we aren't modifying the session.
        },
      }
    )

    // We use getUser() instead of getSession() because it validates the auth token 
    // against the Supabase Auth server, which is more secure for server-side checks.
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
        // It's common to have no user if they aren't logged in, so we just return null.
        // Uncomment the next line if you need to debug auth errors specifically.
        // console.error("Error getting user in getServerSession:", error.message);
        return null; 
    }

    if (!user) {
        return null;
    }
    
    // Return a session-like object containing the user
    return {
        user,
        // Attempt to grab the access token from the cookie if needed, though 'user' is the primary requirement.
        access_token: cookieStore.get(`sb-${supabaseUrl.split('.')[0]}-auth-token`)?.value || null, 
    };

  } catch (e) {
      console.error("!!! SERVER-SIDE ERROR: Exception in getServerSession:", e);
      return null; 
  }
}

/**
 * Optional helper to create a generic Supabase server client.
 * Use this if you need to perform database operations (select, insert, etc.) 
 * on behalf of the logged-in user in other server actions or routes.
 */
export function createSupabaseServerClient() {
    const cookieStore = cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

     if (!supabaseUrl || !supabaseAnonKey) {
        console.error("!!! SERVER-SIDE ERROR: Supabase URL/Key missing for createSupabaseServerClient.");
        throw new Error("Missing Supabase credentials for server client.");
     }

     return createServerClient<Database>(
        supabaseUrl,
        supabaseAnonKey,
        {
           cookies: {
               get(name: string) { return cookieStore.get(name)?.value },
               set(name: string, value: string, options: any) {
                   try {
                       cookieStore.set({ name, value, ...options })
                   } catch (error) {
                       // The `set` method was called from a Server Component.
                       // This can be ignored if you have middleware refreshing user sessions.
                   }
               },
               remove(name: string, options: any) {
                   try {
                       cookieStore.set({ name, value: '', ...options })
                   } catch (error) {
                       // The `remove` method was called from a Server Component.
                       // This can be ignored if you have middleware refreshing user sessions.
                   }
               },
           },
        }
    )
}