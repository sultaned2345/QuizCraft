// src/lib/getServerSession.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'; 

export async function getServerSession() {
  const cookieStore = cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Debug: Check environment variables
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Auth Debug] Missing Supabase Env Vars:', { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!supabaseAnonKey 
    });
    return null; 
  }

  try {
    // Debug: Check if auth cookie exists
    // The cookie name usually starts with 'sb-' and ends with '-auth-token'
    const allCookies = cookieStore.getAll();
    const authCookie = allCookies.find(c => c.name.includes('-auth-token'));
    
    if (!authCookie) {
        // Helpful for debugging: list what cookies ARE present (redacted for safety)
        const cookieNames = allCookies.map(c => c.name).join(', ');
        console.warn(`[Auth Debug] No Supabase auth token found. Cookies present: [${cookieNames}]`);
    } else {
        console.log('[Auth Debug] Auth token found:', authCookie.name);
    }

    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
        console.error("[Auth Debug] supabase.auth.getUser() error:", error.message);
        return null; 
    }

    if (!user) {
        console.warn("[Auth Debug] No user returned from Supabase (Token might be invalid/expired).");
        return null;
    }
    
    // console.log('[Auth Debug] User successfully authenticated:', user.id);
    return {
        user,
        access_token: authCookie?.value || null, 
    };

  } catch (e) {
      console.error("[Auth Debug] Exception in getServerSession:", e);
      return null; 
  }
}