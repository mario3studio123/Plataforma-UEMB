// src/lib/server/rateLimit.ts
// Sistema de Rate Limiting para Server Actions
//
// Implementação em memória para simplicidade.
// Em produção com múltiplas instâncias, considere usar Redis ou Upstash.

import { RateLimitError } from '@/lib/errors';
import { logger } from '@/lib/errors/logger';

/**
 * ============================================================================
 * 1. TIPOS E CONFIGURAÇÃO
 * ============================================================================
 */

interface RateLimitConfig {
  /** Número máximo de requisições permitidas na janela de tempo */
  maxRequests: number;
  
  /** Janela de tempo em segundos */
  windowSeconds: number;
  
  /** Identificador único para este limitador (para logs) */
  name: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp em ms
}

/**
 * Configurações pré-definidas para diferentes tipos de ações
 */
export const RATE_LIMIT_CONFIGS = {
  // Ações de autenticação - mais restritivo
  AUTH: {
    maxRequests: 5,
    windowSeconds: 60, // 5 tentativas por minuto
    name: 'auth',
  },
  
  // Quiz - evita spam de tentativas
  QUIZ: {
    maxRequests: 3,
    windowSeconds: 60, // 3 tentativas por minuto
    name: 'quiz',
  },
  
  // Progresso de vídeo - mais permissivo
  PROGRESS: {
    maxRequests: 30,
    windowSeconds: 60, // 30 saves por minuto
    name: 'progress',
  },
  
  // Ações de admin - moderado
  ADMIN: {
    maxRequests: 20,
    windowSeconds: 60, // 20 ações por minuto
    name: 'admin',
  },
  
  // Ações gerais - padrão
  DEFAULT: {
    maxRequests: 60,
    windowSeconds: 60, // 60 por minuto
    name: 'default',
  },
} as const;

/**
 * ============================================================================
 * 2. ARMAZENAMENTO EM MEMÓRIA
 * ============================================================================
 * 
 * Nota: Em produção com múltiplas instâncias do servidor,
 * isso deve ser substituído por Redis, Upstash, ou similar.
 */

// Mapa: chave = `${config.name}:${identifier}`, valor = RateLimitEntry
const rateLimitStore = new Map<string, RateLimitEntry>();

// Limpeza periódica de entradas expiradas (evita memory leak)
const CLEANUP_INTERVAL = 60 * 1000; // 1 minuto

let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanupTimer(): void {
  if (cleanupTimer) return;
  
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Rate limit cleanup: ${cleaned} entradas removidas`);
    }
  }, CLEANUP_INTERVAL);
}

// Inicia o timer quando o módulo é carregado
if (typeof global !== 'undefined') {
  startCleanupTimer();
}

/**
 * ============================================================================
 * 3. FUNÇÕES PRINCIPAIS
 * ============================================================================
 */

/**
 * Gera a chave única para o rate limiter
 */
function getRateLimitKey(config: RateLimitConfig, identifier: string): string {
  return `${config.name}:${identifier}`;
}

/**
 * Verifica e incrementa o contador de rate limit
 * 
 * @param config Configuração do rate limiter
 * @param identifier Identificador único (userId, IP, etc)
 * @returns Informações sobre o estado atual do rate limit
 * @throws RateLimitError se o limite for excedido
 */
export function checkRateLimit(
  config: RateLimitConfig,
  identifier: string
): { remaining: number; resetAt: Date } {
  const key = getRateLimitKey(config, identifier);
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // Se não existe ou expirou, cria nova entrada
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + (config.windowSeconds * 1000),
    };
    rateLimitStore.set(key, entry);
    
    return {
      remaining: config.maxRequests - 1,
      resetAt: new Date(entry.resetAt),
    };
  }
  
  // Incrementa o contador
  entry.count++;
  
  // Verifica se excedeu o limite
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    
    logger.rateLimit(config.name, identifier, {
      count: entry.count,
      maxRequests: config.maxRequests,
      retryAfter,
    });
    
    throw new RateLimitError(
      `Limite de requisições excedido. Tente novamente em ${retryAfter} segundos.`,
      retryAfter,
      { action: config.name, identifier }
    );
  }
  
  return {
    remaining: config.maxRequests - entry.count,
    resetAt: new Date(entry.resetAt),
  };
}

/**
 * Reseta o rate limit para um identificador específico
 * Útil após login bem-sucedido, por exemplo
 */
export function resetRateLimit(config: RateLimitConfig, identifier: string): void {
  const key = getRateLimitKey(config, identifier);
  rateLimitStore.delete(key);
}

/**
 * Obtém o estado atual do rate limit sem incrementar
 */
export function getRateLimitStatus(
  config: RateLimitConfig,
  identifier: string
): { count: number; remaining: number; resetAt: Date | null } {
  const key = getRateLimitKey(config, identifier);
  const entry = rateLimitStore.get(key);
  const now = Date.now();
  
  if (!entry || entry.resetAt < now) {
    return {
      count: 0,
      remaining: config.maxRequests,
      resetAt: null,
    };
  }
  
  return {
    count: entry.count,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: new Date(entry.resetAt),
  };
}

/**
 * ============================================================================
 * 4. WRAPPER PARA SERVER ACTIONS
 * ============================================================================
 */

/**
 * HOF que adiciona rate limiting a uma Server Action
 * 
 * @example
 * export const myAction = withRateLimit(
 *   RATE_LIMIT_CONFIGS.DEFAULT,
 *   async (token: string, data: MyData) => {
 *     // ... lógica da action
 *   },
 *   // Função para extrair o identificador (userId ou IP)
 *   (token) => extractUserIdFromToken(token)
 * );
 */
export function withRateLimit<TArgs extends unknown[], TResult>(
  config: RateLimitConfig,
  action: (...args: TArgs) => Promise<TResult>,
  getIdentifier: (...args: TArgs) => string | Promise<string>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const identifier = await getIdentifier(...args);
    
    // Verifica rate limit (lança exceção se excedido)
    checkRateLimit(config, identifier);
    
    // Executa a action original
    return action(...args);
  };
}

/**
 * Versão simplificada que usa o primeiro argumento (token) como base para identificação
 * Assume que o primeiro argumento é o token JWT
 */
export function withTokenRateLimit<TArgs extends [string, ...unknown[]], TResult>(
  config: RateLimitConfig,
  action: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return withRateLimit(
    config,
    action,
    (token: string) => {
      // Usa hash simples do token como identificador
      // (não expõe o token completo nos logs)
      return `token:${hashString(token.slice(-20))}`;
    }
  );
}

/**
 * ============================================================================
 * 5. UTILITÁRIOS
 * ============================================================================
 */

/**
 * Hash simples para criar identificadores
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Converte para 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extrai IP do request (útil para API Routes)
 */
export function getClientIP(headers: Headers): string {
  // Verifica headers comuns de proxies
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback
  return 'unknown';
}

/**
 * ============================================================================
 * 6. TIPOS EXPORTADOS
 * ============================================================================
 */

export type { RateLimitConfig };
