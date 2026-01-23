// src/lib/errors/logger.ts
// Sistema de logging centralizado da plataforma UEMB

import { AppError, isAppError, normalizeError } from './index';

/**
 * ============================================================================
 * 1. TIPOS E CONFIGURAÇÃO
 * ============================================================================
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  userId?: string;
  action?: string;
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    code?: string;
    message: string;
    stack?: string;
    isOperational?: boolean;
  };
}

/**
 * Configuração do Logger
 * Em produção, pode ser substituído por serviços como Sentry, LogRocket, etc.
 */
const config = {
  // Nível mínimo de log (em produção, usar 'warn' ou 'error')
  minLevel: (process.env.NODE_ENV === 'production' ? 'warn' : 'debug') as LogLevel,
  
  // Se deve incluir stack traces (desabilitar em produção para performance)
  includeStackTrace: process.env.NODE_ENV !== 'production',
  
  // Se deve logar no console (pode ser desabilitado se usar serviço externo)
  consoleOutput: true,
};

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * ============================================================================
 * 2. CLASSE LOGGER
 * ============================================================================
 */

class Logger {
  private context: LogContext = {};

  /**
   * Cria uma instância do logger com contexto inicial
   */
  constructor(initialContext?: LogContext) {
    if (initialContext) {
      this.context = initialContext;
    }
  }

  /**
   * Cria um novo logger com contexto adicional (útil para requests)
   */
  withContext(additionalContext: LogContext): Logger {
    const newLogger = new Logger({ ...this.context, ...additionalContext });
    return newLogger;
  }

  /**
   * Verifica se o nível atual deve ser logado
   */
  private shouldLog(level: LogLevel): boolean {
    return levelPriority[level] >= levelPriority[config.minLevel];
  }

  /**
   * Formata e envia o log
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...context },
    };

    // Processa erro se fornecido
    if (error) {
      const normalizedError = normalizeError(error);
      entry.error = {
        name: normalizedError.name,
        code: normalizedError.code,
        message: normalizedError.message,
        isOperational: normalizedError.isOperational,
        ...(config.includeStackTrace ? { stack: normalizedError.stack } : {}),
      };
    }

    // Output
    if (config.consoleOutput) {
      this.outputToConsole(entry);
    }

    // TODO: Aqui você pode adicionar integração com serviços externos
    // Ex: Sentry.captureException(error), LogRocket.log(entry), etc.
  }

  /**
   * Output formatado para console
   */
  private outputToConsole(entry: LogEntry): void {
    const emoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    }[entry.level];

    const color = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
    }[entry.level];
    
    const reset = '\x1b[0m';

    // Formato para Server (Node.js)
    if (typeof window === 'undefined') {
      const contextStr = entry.context && Object.keys(entry.context).length > 0
        ? ` | ${JSON.stringify(entry.context)}`
        : '';
      
      console[entry.level === 'debug' ? 'log' : entry.level](
        `${color}${emoji} [${entry.level.toUpperCase()}]${reset} ${entry.timestamp} | ${entry.message}${contextStr}`
      );
      
      if (entry.error?.stack && entry.level === 'error') {
        console.error(entry.error.stack);
      }
    } else {
      // Formato para Browser (mais limpo)
      const args: unknown[] = [`${emoji} [${entry.level.toUpperCase()}] ${entry.message}`];
      
      if (entry.context && Object.keys(entry.context).length > 0) {
        args.push(entry.context);
      }
      
      if (entry.error) {
        args.push(entry.error);
      }

      console[entry.level === 'debug' ? 'log' : entry.level](...args);
    }
  }

  // ==================== MÉTODOS PÚBLICOS ====================

  /**
   * Log de debug - detalhes de desenvolvimento
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log informativo - eventos normais do sistema
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log de aviso - situações que merecem atenção mas não são erros
   */
  warn(message: string, context?: LogContext, error?: unknown): void {
    this.log('warn', message, context, error);
  }

  /**
   * Log de erro - erros que precisam ser investigados
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    this.log('error', message, context, error);
  }

  /**
   * Log específico para Server Actions
   */
  action(actionName: string, status: 'start' | 'success' | 'error', context?: LogContext, error?: unknown): void {
    const fullContext = { action: actionName, ...context };
    
    switch (status) {
      case 'start':
        this.debug(`Action iniciada: ${actionName}`, fullContext);
        break;
      case 'success':
        this.info(`Action concluída: ${actionName}`, fullContext);
        break;
      case 'error':
        this.error(`Action falhou: ${actionName}`, error, fullContext);
        break;
    }
  }

  /**
   * Log específico para autenticação
   */
  auth(event: 'login' | 'logout' | 'register' | 'token_refresh' | 'token_invalid', context?: LogContext): void {
    const messages = {
      login: 'Usuário autenticado',
      logout: 'Usuário deslogado',
      register: 'Novo usuário registrado',
      token_refresh: 'Token renovado',
      token_invalid: 'Tentativa de acesso com token inválido',
    };

    const level: LogLevel = event === 'token_invalid' ? 'warn' : 'info';
    this.log(level, messages[event], { authEvent: event, ...context });
  }

  /**
   * Log específico para rate limiting
   */
  rateLimit(action: string, identifier: string, context?: LogContext): void {
    this.warn(`Rate limit excedido: ${action}`, { 
      action, 
      identifier,
      ...context 
    });
  }

  /**
   * Log de performance (tempo de execução)
   */
  performance(operation: string, durationMs: number, context?: LogContext): void {
    const level: LogLevel = durationMs > 5000 ? 'warn' : 'debug';
    this.log(level, `Performance: ${operation} levou ${durationMs}ms`, {
      operation,
      durationMs,
      ...context
    });
  }
}

/**
 * ============================================================================
 * 3. INSTÂNCIA GLOBAL E HELPERS
 * ============================================================================
 */

// Instância global do logger
export const logger = new Logger();

/**
 * Helper para criar logger com contexto de usuário
 */
export function createUserLogger(userId: string): Logger {
  return logger.withContext({ userId });
}

/**
 * Helper para criar logger com contexto de request/action
 */
export function createActionLogger(actionName: string, userId?: string): Logger {
  return logger.withContext({ action: actionName, userId });
}

/**
 * Decorator/Wrapper para Server Actions com logging automático
 */
export function withLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  actionName: string,
  action: T
): T {
  return (async (...args: Parameters<T>) => {
    const actionLogger = createActionLogger(actionName);
    const startTime = Date.now();

    actionLogger.action(actionName, 'start');

    try {
      const result = await action(...args);
      
      const duration = Date.now() - startTime;
      actionLogger.action(actionName, 'success', { durationMs: duration });
      actionLogger.performance(actionName, duration);
      
      return result;
    } catch (error) {
      actionLogger.action(actionName, 'error', undefined, error);
      throw error;
    }
  }) as T;
}

export default logger;
