// src/lib/auth.ts
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // Modern SSR auth
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Basic client for API routes or non-cookie contexts
const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * 1. SERVER COMPONENT HELPER (New)
 * Gets the user from cookies in Server Components (like DashboardPage)
 */
export async function getUser() {
  const cookieStore = cookies();

  // Create a Supabase client configured to use cookies
  const supabaseServer = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle cookie setting error in Server Components (usually ignored in reading phase)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
             // Handle cookie removal error
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
 * Gets authenticated user from request headers (Bearer token)
 */
export async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return null;
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

/**
 * Helper to validate required authentication in API Routes
 */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new Response(
      JSON.stringify({
        success: false,
        error: 'Authentication required'
      }),
      { status: 401 }
    );
  }
  return user;
}

/**
 * Helper validation function
 */
export function validateRequestBody<T>(body: any, requiredFields: (keyof T)[]): { isValid: boolean; error?: string } {
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