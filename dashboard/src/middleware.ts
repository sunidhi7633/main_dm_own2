import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('harshwal_token')?.value;
  const path = request.nextUrl.pathname;

  const isAuthRoute = path === '/login' || path.startsWith('/api/auth');
  const isStaticFile = path.includes('.') || path.startsWith('/_next');

  // Unauthenticated — redirect to login
  if (!token && !isAuthRoute && !isStaticFile) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Already logged in — skip login page
  if (token && path === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Role-based guards (only when authenticated)
  if (token && !isAuthRoute && !isStaticFile) {
    const role = request.cookies.get('user_role')?.value || 'admin';

    if (role === 'designer') {
      // designer can only access /designer-queue and /library
      const allowed =
        path.startsWith('/designer-queue') || path.startsWith('/library');
      if (!allowed) {
        return NextResponse.redirect(new URL('/designer-queue', request.url));
      }
    } else {
      // admin / dm_leader cannot visit the designer queue
      if (path.startsWith('/designer-queue')) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/og|_next/static|_next/image|favicon.ico).*)'],
};
