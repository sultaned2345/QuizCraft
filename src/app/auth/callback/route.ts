// src/app/auth/callback/route.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    // Allow redirecting to a specific page after auth, default to dashboard
    const next = requestUrl.searchParams.get('next') ?? '/dashboard';

    if (code) {
      const cookieStore = cookies();

      // Create a Supabase client using @supabase/ssr for the server context
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: CookieOptions) {
              cookieStore.set({ name, value, ...options });
            },
            remove(name: string, options: CookieOptions) {
              cookieStore.delete({ name, ...options });
            },
          },
        }
      );
      
      // Exchange the code for a session
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(`${requestUrl.origin}${next}`);
    
  } catch (error) {
    console.error('Auth Callback Error:', error);
    // On error, redirect to login with error param
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_callback_error`);
  }
}