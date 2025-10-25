import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Removed Supabase client import as we are not using it here anymore

export async function middleware(request: NextRequest) {
  // You can still use middleware for other things like:
  // - Setting request headers
  // - Redirects based on path
  // - Handling geolocation or A/B testing logic

  // For now, we'll just let the request pass through.
  // Authentication will be handled by Server Components (getServerSession)
  // and API Routes (requireAuth).

  // console.log(`Middleware running for: ${request.nextUrl.pathname}`); // Optional: Add logging if needed

  return NextResponse.next();
}

// Update the matcher if you only want middleware to run on specific paths,
// or remove it entirely if you want it to run on all requests (not recommended).
// Keeping it limited to API routes might still be useful for future rate limiting, etc.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
    // '/api/:path*', // Or keep matching only API routes if preferred
  ],
};