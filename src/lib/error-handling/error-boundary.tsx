/**
 * React Error Boundary components for graceful error handling
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AppError } from './app-error';
import { ErrorType, ErrorSeverity } from './types';
import { captureAppError, captureError } from './sentry';
import { getLogger } from './logger';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
}

/**
 * Generic Error Boundary component
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private logger = getLogger('error-boundary');
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component' } = this.props;

    // Create AppError from caught error
    const appError = new AppError(
      ErrorType.INTERNAL_ERROR,
      `React Error Boundary caught error: ${error.message}`,
      'REACT_ERROR_BOUNDARY',
      {
        severity: this.getSeverityForLevel(level),
        details: {
          componentStack: errorInfo.componentStack,
          errorBoundaryLevel: level,
          retryCount: this.retryCount
        },
        context: {
          operation: 'render',
          component: 'ErrorBoundary'
        }
      }
    );

    // Capture error in Sentry
    const errorId = captureAppError(appError, {
      errorInfo,
      level,
      retryCount: this.retryCount
    });

    // Log error
    this.logger.error('Error boundary caught error', appError, {
      errorId,
      level,
      componentStack: errorInfo.componentStack
    });

    // Update state with error info
    this.setState({
      error,
      errorInfo,
      errorId
    });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }
  }

  private getSeverityForLevel(level: string): ErrorSeverity {
    switch (level) {
      case 'critical':
        return ErrorSeverity.CRITICAL;
      case 'page':
        return ErrorSeverity.HIGH;
      case 'component':
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.logger.info('Retrying after error boundary catch', {
        retryCount: this.retryCount,
        maxRetries: this.maxRetries
      });
      
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        errorId: undefined
      });
    }
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      const { fallback, level = 'component' } = this.props;
      const { error, errorInfo } = this.state;

      // Use custom fallback if provided
      if (fallback && error && errorInfo) {
        return fallback(error, errorInfo, this.handleRetry);
      }

      // Default error UI based on level
      return this.renderDefaultErrorUI(level);
    }

    return this.props.children;
  }

  private renderDefaultErrorUI(level: string) {
    const canRetry = this.retryCount < this.maxRetries;
    const { error, errorId } = this.state;

    if (level === 'critical') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="mt-4 text-center">
              <h1 className="text-lg font-medium text-gray-900">
                Critical Error
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                A critical error has occurred. Please contact support if this problem persists.
              </p>
              {errorId && (
                <p className="mt-2 text-xs text-gray-500 font-mono">
                  Error ID: {errorId}
                </p>
              )}
              <div className="mt-6 flex flex-col space-y-3">
                <Button onClick={this.handleGoHome} className="w-full">
                  <Home className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (level === 'page') {
      return (
        <div className="flex items-center justify-center min-h-[400px] bg-gray-50 rounded-lg">
          <div className="text-center p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-yellow-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <h2 className="mt-4 text-lg font-medium text-gray-900">
              Page Error
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              This page encountered an error. You can try refreshing or go back to the dashboard.
            </p>
            {errorId && (
              <p className="mt-2 text-xs text-gray-500 font-mono">
                Error ID: {errorId}
              </p>
            )}
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              {canRetry && (
                <Button onClick={this.handleRetry} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again ({this.maxRetries - this.retryCount} left)
                </Button>
              )}
              <Button onClick={this.handleGoHome}>
                <Home className="w-4 h-4 mr-2" />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Component level error
    return (
      <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center">
          <div className="flex items-center justify-center w-8 h-8 mx-auto bg-gray-100 rounded-full">
            <AlertTriangle className="w-4 h-4 text-gray-600" />
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Component failed to load
          </p>
          {canRetry && (
            <Button 
              onClick={this.handleRetry} 
              variant="outline" 
              size="sm"
              className="mt-3"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Page-level error boundary
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary level="page">
      {children}
    </ErrorBoundary>
  );
}

/**
 * Critical error boundary for app-level errors
 */
export function CriticalErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary level="critical">
      {children}
    </ErrorBoundary>
  );
}

/**
 * Component-level error boundary
 */
export function ComponentErrorBoundary({ 
  children, 
  fallback 
}: { 
  children: ReactNode;
  fallback?: ErrorBoundaryProps['fallback'];
}) {
  return (
    <ErrorBoundary level="component" fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}