import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Basic client for stateless checks
const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * 1. SERVER COMPONENT HELPER
 * Usage: const user = await getUser();
 */
export async function getUser() {
  const cookieStore = await cookies(); // Await cookies() for Next.js 15 compatibility

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
 * 2. API ROUTE HELPER
 * Checks both Bearer Token AND Cookies
 */
export async function getAuthenticatedUser(request: NextRequest) {
  // A. Try Bearer Token (Header)
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

  // B. Try Cookies (Supabase SSR)
  try {
    const supabaseServer = createServerClient<Database>(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
               // API routes usually don't set cookies on GET, but we define the interface
            }
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

/**
 * Helper to validate required authentication in API Routes
 * Throws a Response if unauthorized, stopping execution immediately.
 */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  
  if (!user) {
    // We throw a Response so Next.js can handle it automatically
    // IF not caught by a try/catch block.
    // Ideally, your route handler should verify 'error instanceof Response'
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

/**
 * Helper validation function
 */
export function validateRequestBody<T>(body: any, requiredFields: (keyof T)[]): { isValid: boolean; error?: string } {
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

// Alias compatibility
export const getUserSession = getAuthenticatedUser;