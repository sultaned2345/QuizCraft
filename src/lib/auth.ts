// src/lib/auth.ts
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Helper function to get authenticated user from request headers
 * Expects Authorization header with Bearer token
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
 * Helper function to validate required authentication
 * Returns user if authenticated, throws error response if not
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
 * Helper function to validate request body against a schema
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

// --- FIX: Export alias for compatibility ---
export const getUserSession = getAuthenticatedUser;