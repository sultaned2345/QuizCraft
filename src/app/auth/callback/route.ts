// src/app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');

    if (code) {
      const cookieStore = cookies();
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
      
      // Exchange the code for a session
      await supabase.auth.exchangeCodeForSession(code);
    }

    // URL to redirect to after sign in process completes
    // FIX: Redirect explicitly to the dashboard (Workspace)
    return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
    
  } catch (error) {
    console.error('Auth Callback Error:', error);
    // On error, redirect to login with error param
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_callback_error`);
  }
}