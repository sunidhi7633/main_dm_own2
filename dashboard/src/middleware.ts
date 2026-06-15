import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Check if the user has an auth token cookie
  const token = request.cookies.get('harshwal_token')?.value;

  // Protect all routes except /login and /api/auth
  const isAuthRoute = request.nextUrl.pathname === '/login' || request.nextUrl.pathname.startsWith('/api/auth');
  
  // Exclude static files and Next.js internals
  const isStaticFile = request.nextUrl.pathname.includes('.') || request.nextUrl.pathname.startsWith('/_next');

  if (!token && !isAuthRoute && !isStaticFile) {
    // Redirect to login if unauthenticated
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && request.nextUrl.pathname === '/login') {
    // Redirect to dashboard if already logged in
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/og (open graph image generator)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/og|_next/static|_next/image|favicon.ico).*)',
  ],
};
