import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/reset-password',
];

const ADMIN_ROUTES = [
  '/dashboard/admin',
];

const IGNORED_ROUTES = [
  '/_next',
  '/api',
  '/favicon.ico',
  '/public',
];

const SESSION_COOKIE_NAME = '__session';
const AUTH_TOKEN_COOKIE_NAME = 'auth-token';

function shouldIgnoreRoute(pathname: string): boolean {
  return IGNORED_ROUTES.some(route => pathname.startsWith(route));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => {
    if (route === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(route);
  });
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some(route => pathname.startsWith(route));
}

function hasValidSession(request: NextRequest): boolean {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const authTokenCookie = request.cookies.get(AUTH_TOKEN_COOKIE_NAME);
  return !!(sessionCookie?.value || authTokenCookie?.value);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getTokenClaims(request: NextRequest): { role?: string; uid?: string } | null {
  const authToken = request.cookies.get(AUTH_TOKEN_COOKIE_NAME)?.value;
  if (!authToken) return null;

  const payload = decodeJwtPayload(authToken);
  if (!payload) return null;

  return {
    role: payload.role as string | undefined,
    uid: payload.user_id as string | undefined,
  };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldIgnoreRoute(pathname)) {
    return NextResponse.next();
  }

  if (isPublicRoute(pathname)) {
    if (pathname === '/' && hasValidSession(request)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!hasValidSession(request)) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Middleware] Acesso negado: ${pathname} - Redirecionando para login`);
    }
    
    return NextResponse.redirect(redirectUrl);
  }

  if (isAdminRoute(pathname)) {
    const claims = getTokenClaims(request);
    if (!claims || !['admin', 'master'].includes(claims.role || '')) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Middleware] Acesso admin: ${pathname} - Role no token: ${claims?.role || 'não encontrada'}`);
      }
      
      const response = NextResponse.next();
      response.headers.set('x-admin-route', 'true');
      return response;
    }
  }

  const response = NextResponse.next();
  
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};