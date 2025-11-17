// src/lib/fetcher.ts
import { ApiResponse } from '@/types/database';

/**
 * A generic fetcher function for useSWR.
 * It expects our standard ApiResponse format and returns the `data` field.
 * @throws {Error} If the fetch fails or API returns success: false.
 */
export const fetcher = async <T = any>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> => {
  const res = await fetch(input, init);

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

  if (result.success === false || result.data === undefined) {
    // This is an error from our API wrapper (e.g., success: false)
    const error = new Error(
      result.error || 'API returned success=false but no error message.',
    );
    (error as any).info = result;
    (error as any).status = res.status;
    throw error;
  }

  return result.data; // Success: return only the 'data' property
};