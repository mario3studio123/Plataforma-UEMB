// src/components/ErrorBoundary/index.tsx
// Error Boundary para capturar erros em componentes React

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './styles.module.css';
import { logger } from '@/lib/errors/logger';

/**
 * ============================================================================
 * 1. TIPOS
 * ============================================================================
 */

interface ErrorBoundaryProps {
  children: ReactNode;
  
  /** Componente customizado para exibir quando há erro */
  fallback?: ReactNode;
  
  /** Callback quando um erro é capturado */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  
  /** Nível do boundary (afeta o layout do fallback) */
  level?: 'page' | 'section' | 'component';
  
  /** Se deve mostrar detalhes técnicos (dev only) */
  showDetails?: boolean;
  
  /** Mensagem customizada para o usuário */
  message?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showTechnicalDetails: boolean;
}

/**
 * ============================================================================
 * 2. ERROR BOUNDARY CLASS COMPONENT
 * ============================================================================
 * Nota: Error Boundaries DEVEM ser class components (limitação do React)
 */

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showTechnicalDetails: false,
    };
  }

  /**
   * Atualiza o state quando um erro é lançado
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  /**
   * Captura informações adicionais do erro
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log do erro
    logger.error('ErrorBoundary capturou erro', error, {
      componentStack: errorInfo.componentStack,
      level: this.props.level || 'component',
    });

    // Callback customizado
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: Aqui você pode enviar para Sentry, LogRocket, etc.
  }

  /**
   * Reseta o estado de erro
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showTechnicalDetails: false,
    });
  };

  /**
   * Recarrega a página
   */
  handleReload = (): void => {
    window.location.reload();
  };

  /**
   * Volta para a home
   */
  handleGoHome = (): void => {
    window.location.href = '/dashboard';
  };

  /**
   * Toggle detalhes técnicos
   */
  toggleDetails = (): void => {
    this.setState(prev => ({ showTechnicalDetails: !prev.showTechnicalDetails }));
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, showTechnicalDetails } = this.state;
    const { children, fallback, level = 'component', showDetails, message } = this.props;

    // Se não há erro, renderiza os children normalmente
    if (!hasError) {
      return children;
    }

    // Se tem fallback customizado, usa ele
    if (fallback) {
      return fallback;
    }

    // Renderiza o fallback padrão baseado no nível
    const isDev = process.env.NODE_ENV === 'development';
    const shouldShowDetails = showDetails ?? isDev;

    return (
      <div className={`${styles.container} ${styles[level]}`}>
        <div className={styles.content}>
          {/* Ícone */}
          <div className={styles.iconWrapper}>
            <AlertTriangle size={level === 'page' ? 64 : level === 'section' ? 48 : 32} />
          </div>

          {/* Mensagem */}
          <h2 className={styles.title}>
            {level === 'page' ? 'Ops! Algo deu errado' : 'Erro inesperado'}
          </h2>
          
          <p className={styles.message}>
            {message || 'Encontramos um problema ao carregar este conteúdo.'}
          </p>

          {/* Ações */}
          <div className={styles.actions}>
            <button onClick={this.handleReset} className={styles.btnPrimary}>
              <RefreshCw size={18} />
              Tentar Novamente
            </button>

            {level === 'page' && (
              <button onClick={this.handleGoHome} className={styles.btnSecondary}>
                <Home size={18} />
                Voltar ao Início
              </button>
            )}

            <button onClick={this.handleReload} className={styles.btnGhost}>
              Recarregar Página
            </button>
          </div>

          {/* Detalhes Técnicos (Dev Only) */}
          {shouldShowDetails && error && (
            <div className={styles.technicalSection}>
              <button onClick={this.toggleDetails} className={styles.detailsToggle}>
                {showTechnicalDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Detalhes Técnicos
              </button>

              {showTechnicalDetails && (
                <div className={styles.detailsContent}>
                  <div className={styles.errorName}>
                    <strong>Erro:</strong> {error.name}
                  </div>
                  <div className={styles.errorMessage}>
                    <strong>Mensagem:</strong> {error.message}
                  </div>
                  {errorInfo?.componentStack && (
                    <pre className={styles.stackTrace}>
                      <strong>Component Stack:</strong>
                      {errorInfo.componentStack}
                    </pre>
                  )}
                  {error.stack && (
                    <pre className={styles.stackTrace}>
                      <strong>Stack Trace:</strong>
                      {error.stack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}

/**
 * ============================================================================
 * 3. COMPONENTES WRAPPER CONVENIENTES
 * ============================================================================
 */

/**
 * Error Boundary para páginas inteiras
 */
export function PageErrorBoundary({ children, ...props }: Omit<ErrorBoundaryProps, 'level'>) {
  return (
    <ErrorBoundary level="page" {...props}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error Boundary para seções da página
 */
export function SectionErrorBoundary({ children, ...props }: Omit<ErrorBoundaryProps, 'level'>) {
  return (
    <ErrorBoundary level="section" {...props}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error Boundary para componentes individuais
 */
export function ComponentErrorBoundary({ children, ...props }: Omit<ErrorBoundaryProps, 'level'>) {
  return (
    <ErrorBoundary level="component" {...props}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * ============================================================================
 * 4. HOC PARA ENVOLVER COMPONENTES
 * ============================================================================
 */

/**
 * Higher-Order Component para adicionar Error Boundary a qualquer componente
 * 
 * @example
 * const SafeVideoPlayer = withErrorBoundary(VideoPlayer, {
 *   message: 'Erro ao carregar o player de vídeo'
 * });
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

export default ErrorBoundary;
