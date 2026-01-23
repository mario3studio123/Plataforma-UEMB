// src/lib/errors/index.ts
// Sistema centralizado de tratamento de erros da plataforma UEMB

/**
 * ============================================================================
 * 1. CÓDIGOS DE ERRO PADRONIZADOS
 * ============================================================================
 * Usamos códigos para facilitar rastreamento e internacionalização futura
 */
export const ErrorCodes = {
  // Autenticação (1000-1999)
  AUTH_INVALID_TOKEN: 'AUTH_1001',
  AUTH_TOKEN_EXPIRED: 'AUTH_1002',
  AUTH_NO_TOKEN: 'AUTH_1003',
  AUTH_INVALID_CREDENTIALS: 'AUTH_1004',
  AUTH_USER_NOT_FOUND: 'AUTH_1005',
  AUTH_SESSION_EXPIRED: 'AUTH_1006',
  
  // Autorização (2000-2999)
  AUTHZ_INSUFFICIENT_ROLE: 'AUTHZ_2001',
  AUTHZ_RESOURCE_FORBIDDEN: 'AUTHZ_2002',
  AUTHZ_ADMIN_REQUIRED: 'AUTHZ_2003',
  
  // Validação (3000-3999)
  VALIDATION_INVALID_INPUT: 'VALIDATION_3001',
  VALIDATION_MISSING_FIELD: 'VALIDATION_3002',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_3003',
  
  // Recursos/Dados (4000-4999)
  RESOURCE_NOT_FOUND: 'RESOURCE_4001',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_4002',
  RESOURCE_CONFLICT: 'RESOURCE_4003',
  
  // Rate Limiting (5000-5999)
  RATE_LIMIT_EXCEEDED: 'RATE_5001',
  RATE_LIMIT_QUIZ_ATTEMPT: 'RATE_5002',
  
  // Servidor/Sistema (6000-6999)
  SERVER_INTERNAL_ERROR: 'SERVER_6001',
  SERVER_DATABASE_ERROR: 'SERVER_6002',
  SERVER_STORAGE_ERROR: 'SERVER_6003',
  SERVER_EXTERNAL_SERVICE: 'SERVER_6004',
  
  // Rede/Conexão (7000-7999)
  NETWORK_OFFLINE: 'NETWORK_7001',
  NETWORK_TIMEOUT: 'NETWORK_7002',
  NETWORK_REQUEST_FAILED: 'NETWORK_7003',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * ============================================================================
 * 2. CLASSE BASE DE ERRO CUSTOMIZADA
 * ============================================================================
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational; // Erros esperados vs bugs
    this.context = context;
    this.timestamp = new Date();

    // Mantém o stack trace correto no V8
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serializa o erro para envio ao cliente (esconde detalhes sensíveis)
   */
  toClientResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        // Não expõe context ou stack em produção
      }
    };
  }

  /**
   * Serializa o erro para logging (inclui todos os detalhes)
   */
  toLogFormat() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * ============================================================================
 * 3. CLASSES DE ERRO ESPECÍFICAS (Semânticas)
 * ============================================================================
 */

/** Erro de autenticação - token inválido, expirado, etc */
export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Falha na autenticação',
    code: ErrorCode = ErrorCodes.AUTH_INVALID_TOKEN,
    context?: Record<string, unknown>
  ) {
    super(message, code, 401, true, context);
    this.name = 'AuthenticationError';
  }
}

/** Erro de autorização - sem permissão para acessar recurso */
export class AuthorizationError extends AppError {
  constructor(
    message: string = 'Acesso não autorizado',
    code: ErrorCode = ErrorCodes.AUTHZ_INSUFFICIENT_ROLE,
    context?: Record<string, unknown>
  ) {
    super(message, code, 403, true, context);
    this.name = 'AuthorizationError';
  }
}

/** Erro de validação - dados inválidos */
export class ValidationError extends AppError {
  public readonly fields?: Record<string, string>;

  constructor(
    message: string = 'Dados inválidos',
    fields?: Record<string, string>,
    context?: Record<string, unknown>
  ) {
    super(message, ErrorCodes.VALIDATION_INVALID_INPUT, 400, true, context);
    this.name = 'ValidationError';
    this.fields = fields;
  }

  toClientResponse() {
    return {
      ...super.toClientResponse(),
      error: {
        ...super.toClientResponse().error,
        fields: this.fields,
      }
    };
  }
}

/** Erro de recurso não encontrado */
export class NotFoundError extends AppError {
  constructor(
    resource: string = 'Recurso',
    context?: Record<string, unknown>
  ) {
    super(`${resource} não encontrado(a)`, ErrorCodes.RESOURCE_NOT_FOUND, 404, true, context);
    this.name = 'NotFoundError';
  }
}

/** Erro de rate limiting */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Muitas requisições. Tente novamente mais tarde.',
    retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, ErrorCodes.RATE_LIMIT_EXCEEDED, 429, true, context);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/** Erro de conflito - recurso já existe */
export class ConflictError extends AppError {
  constructor(
    message: string = 'Recurso já existe',
    context?: Record<string, unknown>
  ) {
    super(message, ErrorCodes.RESOURCE_CONFLICT, 409, true, context);
    this.name = 'ConflictError';
  }
}

/** Erro interno do servidor - bugs, falhas de DB, etc */
export class InternalError extends AppError {
  constructor(
    message: string = 'Erro interno do servidor',
    context?: Record<string, unknown>
  ) {
    // isOperational = false indica que é um bug, não um erro esperado
    super(message, ErrorCodes.SERVER_INTERNAL_ERROR, 500, false, context);
    this.name = 'InternalError';
  }
}

/**
 * ============================================================================
 * 4. UTILITÁRIOS DE ERRO
 * ============================================================================
 */

/**
 * Verifica se um erro é uma instância de AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Verifica se o erro é operacional (esperado) ou um bug
 */
export function isOperationalError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}

/**
 * Converte qualquer erro para AppError de forma segura
 */
export function normalizeError(error: unknown): AppError {
  // Já é um AppError, retorna como está
  if (isAppError(error)) {
    return error;
  }

  // É um Error nativo
  if (error instanceof Error) {
    return new InternalError(error.message, {
      originalName: error.name,
      originalStack: error.stack,
    });
  }

  // É uma string
  if (typeof error === 'string') {
    return new InternalError(error);
  }

  // Qualquer outra coisa
  return new InternalError('Erro desconhecido', {
    originalError: String(error),
  });
}

/**
 * ============================================================================
 * 5. MENSAGENS AMIGÁVEIS PARA O USUÁRIO
 * ============================================================================
 */
const userFriendlyMessages: Record<ErrorCode, string> = {
  // Auth
  [ErrorCodes.AUTH_INVALID_TOKEN]: 'Sua sessão é inválida. Faça login novamente.',
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 'Sua sessão expirou. Faça login novamente.',
  [ErrorCodes.AUTH_NO_TOKEN]: 'Você precisa estar logado para continuar.',
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 'E-mail ou senha incorretos.',
  [ErrorCodes.AUTH_USER_NOT_FOUND]: 'Usuário não encontrado.',
  [ErrorCodes.AUTH_SESSION_EXPIRED]: 'Sua sessão expirou. Faça login novamente.',
  
  // Authz
  [ErrorCodes.AUTHZ_INSUFFICIENT_ROLE]: 'Você não tem permissão para esta ação.',
  [ErrorCodes.AUTHZ_RESOURCE_FORBIDDEN]: 'Acesso negado a este recurso.',
  [ErrorCodes.AUTHZ_ADMIN_REQUIRED]: 'Esta ação requer privilégios de administrador.',
  
  // Validation
  [ErrorCodes.VALIDATION_INVALID_INPUT]: 'Os dados enviados são inválidos.',
  [ErrorCodes.VALIDATION_MISSING_FIELD]: 'Campos obrigatórios não preenchidos.',
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: 'Formato de dados inválido.',
  
  // Resource
  [ErrorCodes.RESOURCE_NOT_FOUND]: 'O recurso solicitado não foi encontrado.',
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: 'Este recurso já existe.',
  [ErrorCodes.RESOURCE_CONFLICT]: 'Conflito ao processar a solicitação.',
  
  // Rate Limit
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Muitas tentativas. Aguarde alguns minutos.',
  [ErrorCodes.RATE_LIMIT_QUIZ_ATTEMPT]: 'Aguarde antes de tentar o quiz novamente.',
  
  // Server
  [ErrorCodes.SERVER_INTERNAL_ERROR]: 'Ocorreu um erro interno. Tente novamente.',
  [ErrorCodes.SERVER_DATABASE_ERROR]: 'Erro ao acessar os dados. Tente novamente.',
  [ErrorCodes.SERVER_STORAGE_ERROR]: 'Erro ao processar arquivo. Tente novamente.',
  [ErrorCodes.SERVER_EXTERNAL_SERVICE]: 'Serviço temporariamente indisponível.',
  
  // Network
  [ErrorCodes.NETWORK_OFFLINE]: 'Você parece estar offline. Verifique sua conexão.',
  [ErrorCodes.NETWORK_TIMEOUT]: 'A requisição demorou demais. Tente novamente.',
  [ErrorCodes.NETWORK_REQUEST_FAILED]: 'Falha na conexão. Tente novamente.',
};

/**
 * Obtém mensagem amigável para exibir ao usuário
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (isAppError(error)) {
    return userFriendlyMessages[error.code] || error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'Ocorreu um erro inesperado. Tente novamente.';
}

/**
 * ============================================================================
 * 6. TIPO PADRÃO DE RESPOSTA DAS SERVER ACTIONS
 * ============================================================================
 */
export type ActionResult<T = void> = 
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string; fields?: Record<string, string> } };

/**
 * Helper para criar resposta de sucesso
 */
export function successResult<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

/**
 * Helper para criar resposta de erro a partir de um AppError
 */
export function errorResult(error: AppError): ActionResult<never> {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error instanceof ValidationError && error.fields ? { fields: error.fields } : {}),
    }
  };
}

/**
 * Helper para criar resposta de erro a partir de qualquer erro
 */
export function handleActionError(error: unknown): ActionResult<never> {
  const normalizedError = normalizeError(error);
  return errorResult(normalizedError);
}
