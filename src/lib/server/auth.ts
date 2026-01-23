// src/lib/server/auth.ts
// Módulo de autenticação do servidor - verificação de tokens e permissões

import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { 
  AuthenticationError, 
  AuthorizationError, 
  ErrorCodes,
  InternalError 
} from '@/lib/errors';
import { logger } from '@/lib/errors/logger';
import type { DecodedIdToken } from 'firebase-admin/auth';

/**
 * ============================================================================
 * 1. TIPOS
 * ============================================================================
 */

export type UserRole = 'student' | 'admin' | 'master';

export interface AuthenticatedUser {
  uid: string;
  email: string | undefined;
  role: UserRole;
  name?: string;
  emailVerified: boolean;
}

export interface AuthResult {
  success: true;
  user: AuthenticatedUser;
}

/**
 * ============================================================================
 * 2. VERIFICAÇÃO DE TOKEN
 * ============================================================================
 */

/**
 * Verifica e decodifica um token JWT do Firebase
 * @throws AuthenticationError se o token for inválido ou expirado
 */
export async function verifyToken(token: string): Promise<DecodedIdToken> {
  if (!token || token.trim() === '') {
    logger.auth('token_invalid', { reason: 'Token vazio' });
    throw new AuthenticationError(
      'Token não fornecido',
      ErrorCodes.AUTH_NO_TOKEN
    );
  }

  try {
    // verifyIdToken verifica assinatura, expiração e revogação
    const decodedToken = await adminAuth.verifyIdToken(token, true);
    return decodedToken;
  } catch (error: unknown) {
    // Firebase Auth errors têm códigos específicos
    const firebaseError = error as { code?: string; message?: string };
    
    if (firebaseError.code === 'auth/id-token-expired') {
      logger.auth('token_invalid', { reason: 'Token expirado' });
      throw new AuthenticationError(
        'Sessão expirada. Faça login novamente.',
        ErrorCodes.AUTH_TOKEN_EXPIRED
      );
    }

    if (firebaseError.code === 'auth/id-token-revoked') {
      logger.auth('token_invalid', { reason: 'Token revogado' });
      throw new AuthenticationError(
        'Sessão invalidada. Faça login novamente.',
        ErrorCodes.AUTH_SESSION_EXPIRED
      );
    }

    if (firebaseError.code === 'auth/argument-error') {
      logger.auth('token_invalid', { reason: 'Token malformado' });
      throw new AuthenticationError(
        'Token inválido',
        ErrorCodes.AUTH_INVALID_TOKEN
      );
    }

    // Erro genérico de autenticação
    logger.error('Erro ao verificar token', error, { code: firebaseError.code });
    throw new AuthenticationError(
      'Falha na autenticação',
      ErrorCodes.AUTH_INVALID_TOKEN
    );
  }
}

/**
 * ============================================================================
 * 3. BUSCA DE PERFIL E ROLE
 * ============================================================================
 */

/**
 * Busca o perfil completo do usuário no Firestore
 * @throws AuthenticationError se o usuário não existir
 */
export async function getUserProfile(uid: string): Promise<AuthenticatedUser> {
  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      logger.warn('Usuário autenticado mas sem perfil no Firestore', { userId: uid });
      throw new AuthenticationError(
        'Perfil de usuário não encontrado',
        ErrorCodes.AUTH_USER_NOT_FOUND,
        { uid }
      );
    }

    const userData = userDoc.data()!;
    
    return {
      uid,
      email: userData.email,
      role: (userData.role as UserRole) || 'student',
      name: userData.name,
      emailVerified: userData.emailVerified || false,
    };
  } catch (error) {
    // Se já for um AuthenticationError, propaga
    if (error instanceof AuthenticationError) {
      throw error;
    }

    logger.error('Erro ao buscar perfil do usuário', error, { userId: uid });
    throw new InternalError('Erro ao verificar perfil do usuário');
  }
}

/**
 * ============================================================================
 * 4. VERIFICAÇÃO DE PERMISSÕES
 * ============================================================================
 */

/**
 * Verifica se o usuário tem uma das roles permitidas
 * @throws AuthorizationError se não tiver permissão
 */
export function assertRole(user: AuthenticatedUser, allowedRoles: UserRole[]): void {
  if (!allowedRoles.includes(user.role)) {
    logger.warn('Tentativa de acesso não autorizado', {
      userId: user.uid,
      userRole: user.role,
      requiredRoles: allowedRoles,
    });
    
    throw new AuthorizationError(
      'Você não tem permissão para esta ação',
      ErrorCodes.AUTHZ_INSUFFICIENT_ROLE,
      { userId: user.uid, userRole: user.role, requiredRoles: allowedRoles }
    );
  }
}

/**
 * Verifica se o usuário é admin ou master
 * @throws AuthorizationError se não for admin
 */
export function assertAdmin(user: AuthenticatedUser): void {
  assertRole(user, ['admin', 'master']);
}

/**
 * Verifica se o usuário é master
 * @throws AuthorizationError se não for master
 */
export function assertMaster(user: AuthenticatedUser): void {
  assertRole(user, ['master']);
}

/**
 * ============================================================================
 * 5. FUNÇÃO PRINCIPAL DE AUTENTICAÇÃO
 * ============================================================================
 */

/**
 * Autentica e autoriza um usuário em uma única chamada
 * Use esta função em todas as Server Actions
 * 
 * @example
 * const { user } = await authenticateRequest(token);
 * // ou com verificação de role:
 * const { user } = await authenticateRequest(token, ['admin', 'master']);
 */
export async function authenticateRequest(
  token: string,
  requiredRoles?: UserRole[]
): Promise<AuthResult> {
  // 1. Verifica o token
  const decodedToken = await verifyToken(token);

  // 2. Busca o perfil completo
  const user = await getUserProfile(decodedToken.uid);

  // 3. Verifica roles se necessário
  if (requiredRoles && requiredRoles.length > 0) {
    assertRole(user, requiredRoles);
  }

  // 4. Log de sucesso
  logger.debug('Usuário autenticado', { 
    userId: user.uid, 
    role: user.role,
    requiredRoles 
  });

  return { success: true, user };
}

/**
 * ============================================================================
 * 6. HELPERS PARA SERVER ACTIONS
 * ============================================================================
 */

/**
 * Wrapper para Server Actions que requer autenticação
 * Automatiza o try/catch e logging
 * 
 * @example
 * export const myAction = withAuth(async (user, data) => {
 *   // user já está autenticado aqui
 *   return { success: true };
 * });
 */
export function withAuth<TArgs extends unknown[], TResult>(
  handler: (user: AuthenticatedUser, ...args: TArgs) => Promise<TResult>,
  options?: { requiredRoles?: UserRole[] }
) {
  return async (token: string, ...args: TArgs): Promise<TResult> => {
    const { user } = await authenticateRequest(token, options?.requiredRoles);
    return handler(user, ...args);
  };
}

/**
 * Wrapper específico para Server Actions de Admin
 */
export function withAdminAuth<TArgs extends unknown[], TResult>(
  handler: (user: AuthenticatedUser, ...args: TArgs) => Promise<TResult>
) {
  return withAuth(handler, { requiredRoles: ['admin', 'master'] });
}

/**
 * ============================================================================
 * 7. UTILITÁRIOS
 * ============================================================================
 */

/**
 * Extrai o token do header Authorization
 * Útil para API Routes (se usar no futuro)
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Verifica se um usuário pode acessar um recurso de outro usuário
 * Admin e Master podem acessar qualquer recurso
 */
export function canAccessUserResource(
  requestingUser: AuthenticatedUser,
  resourceOwnerId: string
): boolean {
  // Próprio usuário sempre pode acessar
  if (requestingUser.uid === resourceOwnerId) {
    return true;
  }

  // Admin e Master podem acessar qualquer recurso
  if (['admin', 'master'].includes(requestingUser.role)) {
    return true;
  }

  return false;
}
