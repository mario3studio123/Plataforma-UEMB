// src/lib/server/index.ts
// Barrel export para módulos do servidor

// Autenticação
export {
  verifyToken,
  getUserProfile,
  assertRole,
  assertAdmin,
  assertMaster,
  authenticateRequest,
  withAuth,
  withAdminAuth,
  extractBearerToken,
  canAccessUserResource,
  type UserRole,
  type AuthenticatedUser,
  type AuthResult,
} from './auth';

// Rate Limiting
export {
  checkRateLimit,
  resetRateLimit,
  getRateLimitStatus,
  withRateLimit,
  withTokenRateLimit,
  getClientIP,
  RATE_LIMIT_CONFIGS,
  type RateLimitConfig,
} from './rateLimit';

// Serviço de sincronização de curso
export { rebuildCourseSyllabus } from './courseSyncService';
