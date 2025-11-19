// src/lib/fetcher.ts
import { ApiResponse } from '@/types/database';

/**
 * A generic fetcher function for useSWR.
 * It wraps the native fetch to handle:
 * 1. Bearer token injection (if second arg is a string)
 * 2. Standard RequestInit options (if second arg is an object)
 * 3. API Response parsing and error throwing
 */
export const fetcher = async <T = any>(
  url: string,
  arg?: string | RequestInit
): Promise<ApiResponse<T>> => {
  let options: RequestInit = {};

  if (typeof arg === 'string') {
    // CASE 1: Argument is a token string (from SWR calls)
    options = {
      headers: {
        Authorization: `Bearer ${arg}`,
        'Content-Type': 'application/json',
      },
    };
  } else if (arg) {
    // CASE 2: Argument is a standard RequestInit object
    options = arg;
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    try {
      // Try to parse the error message from the API
      const errorJson = await res.json();
      (error as any).info = errorJson;
      (error as any).message = errorJson.error || error.message;
    } catch (e) {
      // Fallback if error is not JSON
      (error as any).info = { error: 'Failed to parse error JSON.' };
    }
    (error as any).status = res.status;
    throw error;
  }

  const result: ApiResponse<T> = await res.json();

  if (result.success === false) {
    // This is an error from our API wrapper (e.g., success: false)
    const error = new Error(
      result.error || 'API returned success=false but no error message.',
    );
    (error as any).info = result;
    (error as any).status = res.status;
    throw error;
  }

  // Return the full result so components can access .data, .success, etc.
  return result; 
};