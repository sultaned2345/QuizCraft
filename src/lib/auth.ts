// src/lib/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation'; // <--- ADD THIS IMPORT
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * 1. SERVER COMPONENT HELPER
 * Usage: const user = await getUser();
 */
export async function getUser() {
  const cookieStore = await cookies();

  const supabaseServer = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Write ignored in Server Components
          }
        },
      },
    }
  );

  const { data: { user } } = await supabaseServer.auth.getUser();
  return user;
}

/**
 * 3. SERVER COMPONENT AUTH GUARD (NEW)
 * Use this in Page/Layout components. 
 * Redirects to /login if unauthorized.
 */
export async function requireUser() {
  const user = await getUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

/**
 * 2. API ROUTE HELPER
 * ... (Rest of file remains unchanged)
 */
export async function getAuthenticatedUser(request: NextRequest) {
  // ... existing code ...
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) return user;
    } catch {
      // Token failed, fall through to cookies
    }
  }

  try {
    const supabaseServer = createServerClient<Database>(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {}
          }
        }
      );
    const { data: { user }, error } = await supabaseServer.auth.getUser();
    if (!error && user) return user;
  } catch (e) {
    // Cookie check failed
  }

  return null;
}

export async function requireAuth(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  
  if (!user) {
    throw new NextResponse(
      JSON.stringify({
        success: false,
        error: 'Authentication required'
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  return user;
}

export function validateRequestBody<T>(body: any, requiredFields: (keyof T)[]): { isValid: boolean; error?: string } {
  // ... existing code ...
  if (!body || typeof body !== 'object') {
      return { isValid: false, error: 'Invalid JSON body' };
  }
  
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null) {
      return {
        isValid: false,
        error: `Missing required field: ${String(field)}`
      };
    }
    
    if (typeof body[field] === 'string' && body[field].trim().length === 0) {
      return {
        isValid: false,
        error: `${String(field)} cannot be empty`
      };
    }
  }
  
  return { isValid: true };
}

export const getUserSession = getAuthenticatedUser;