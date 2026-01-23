// src/middleware.ts
// Middleware de proteção de rotas da plataforma UEMB
// 
// IMPORTANTE: Este middleware roda no Edge Runtime, então não podemos
// usar o Firebase Admin SDK diretamente. A verificação completa do token
// acontece nas Server Actions. Aqui fazemos verificações básicas.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * ============================================================================
 * 1. CONFIGURAÇÃO DE ROTAS
 * ============================================================================
 */

// Rotas que não requerem autenticação
const PUBLIC_ROUTES = [
  '/',           // Landing page / Login
  '/login',      // Se tiver página separada
  '/register',   // Se tiver página separada
  '/reset-password',
];

// Rotas que requerem role de admin
const ADMIN_ROUTES = [
  '/dashboard/admin',
];

// Assets e rotas que devem ser ignoradas pelo middleware
const IGNORED_ROUTES = [
  '/_next',
  '/api',
  '/favicon.ico',
  '/public',
];

// Nome do cookie de sessão (deve ser consistente com o AuthContext)
const SESSION_COOKIE_NAME = '__session';
const AUTH_TOKEN_COOKIE_NAME = 'auth-token';

/**
 * ============================================================================
 * 2. HELPERS
 * ============================================================================
 */

/**
 * Verifica se a rota deve ser ignorada pelo middleware
 */
function shouldIgnoreRoute(pathname: string): boolean {
  return IGNORED_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Verifica se a rota é pública
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => {
    if (route === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(route);
  });
}

/**
 * Verifica se a rota requer admin
 */
function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Verifica se o usuário tem um token de sessão válido (verificação básica)
 * A verificação completa do token acontece nas Server Actions
 */
function hasValidSession(request: NextRequest): boolean {
  // Verifica múltiplos cookies possíveis (compatibilidade)
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const authTokenCookie = request.cookies.get(AUTH_TOKEN_COOKIE_NAME);
  
  // Se qualquer um dos cookies existir e não estiver vazio
  return !!(sessionCookie?.value || authTokenCookie?.value);
}

/**
 * Decodifica o payload do JWT sem verificar a assinatura
 * ATENÇÃO: Isso NÃO valida o token, apenas extrai informações
 * A validação real acontece nas Server Actions com Firebase Admin
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    // Decodifica base64url
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Extrai claims customizadas do token (se existirem)
 * Usado para verificação rápida de role no middleware
 */
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

/**
 * ============================================================================
 * 3. MIDDLEWARE PRINCIPAL
 * ============================================================================
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Ignora rotas de assets e API
  if (shouldIgnoreRoute(pathname)) {
    return NextResponse.next();
  }

  // 2. Rotas públicas - permite acesso
  if (isPublicRoute(pathname)) {
    // Se já está logado e tenta acessar login, redireciona para dashboard
    if (pathname === '/' && hasValidSession(request)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // 3. Rotas protegidas - verifica sessão
  if (!hasValidSession(request)) {
    // Salva a URL original para redirect após login
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    
    // Log para debug (apenas em desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Middleware] Acesso negado: ${pathname} - Redirecionando para login`);
    }
    
    return NextResponse.redirect(redirectUrl);
  }

  // 4. Rotas de admin - verificação adicional de role
  if (isAdminRoute(pathname)) {
    const claims = getTokenClaims(request);
    
    // Se não conseguir extrair claims ou role não é admin/master
    // Nota: Esta é uma verificação rápida, a verificação real acontece na Server Action
    if (!claims || !['admin', 'master'].includes(claims.role || '')) {
      // Em vez de bloquear completamente, deixamos a Server Action fazer a verificação final
      // Isso é necessário porque o token pode não ter custom claims configurados
      // e a role está apenas no Firestore
      
      // Log para monitoramento
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Middleware] Acesso admin: ${pathname} - Role no token: ${claims?.role || 'não encontrada'}`);
      }
      
      // Adiciona header para indicar que é uma rota admin (usado para logging)
      const response = NextResponse.next();
      response.headers.set('x-admin-route', 'true');
      return response;
    }
  }

  // 5. Adiciona headers de segurança
  const response = NextResponse.next();
  
  // Headers de segurança básicos
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}

/**
 * ============================================================================
 * 4. CONFIGURAÇÃO DO MATCHER
 * ============================================================================
 */

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};