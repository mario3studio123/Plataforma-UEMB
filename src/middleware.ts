import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session'); // Você precisará setar esse cookie no login
  const { pathname } = request.nextUrl;

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/'],
};