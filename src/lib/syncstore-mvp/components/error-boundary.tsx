/**
 * SyncStore MVP Error Boundary
 * 
 * This component provides comprehensive error handling with recovery options,
 * error reporting, and user-friendly error displays.
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  RefreshCw, 
  Bug, 
  Home, 
  ChevronDown, 
  ChevronUp,
  Copy,
  ExternalLink
} from 'lucide-react';
import { toast as showToast } from 'sonner';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
  enableRecovery?: boolean;
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  showDetails: boolean;
  retryCount: number;
}

interface ErrorReport {
  errorId: string;
  message: string;
  stack?: string;
  componentStack?: string;
  context?: string;
  timestamp: Date;
  userAgent: string;
  url: string;
  retryCount: number;
}

// ============================================================================
// Error Reporting Service
// ============================================================================

class ErrorReportingService {
  private static instance: ErrorReportingService;
  private errorReports: ErrorReport[] = [];

  static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService();
    }
    return ErrorReportingService.instance;
  }

  generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  reportError(
    error: Error,
    errorInfo: ErrorInfo,
    context?: string,
    retryCount: number = 0
  ): string {
    const errorId = this.generateErrorId();
    
    const report: ErrorReport = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context,
      timestamp: new Date(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
      retryCount,
    };

    this.errorReports.push(report);
    
    // In a real application, you would send this to your error tracking service
    console.error('Error Report:', report);
    
    // Optionally send to external service
    this.sendToExternalService(report);
    
    return errorId;
  }

  private async sendToExternalService(report: ErrorReport): Promise<void> {
    try {
      // Example: Send to Sentry, LogRocket, or custom endpoint
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(report),
      // });
    } catch (error) {
      console.warn('Failed to send error report to external service:', error);
    }
  }

  getErrorReports(): ErrorReport[] {
    return [...this.errorReports];
  }

  clearErrorReports(): void {
    this.errorReports = [];
  }
}

// ============================================================================
// Error Display Components
// ============================================================================

interface ErrorDisplayProps {
  error: Error;
  errorInfo: ErrorInfo;
  errorId: string;
  context?: string;
  showDetails: boolean;
  retryCount: number;
  onToggleDetails: () => void;
  onRetry: () => void;
  onGoHome: () => void;
  onCopyError: () => void;
}

function ErrorDisplay({
  error,
  errorInfo,
  errorId,
  context,
  showDetails,
  retryCount,
  onToggleDetails,
  onRetry,
  onGoHome,
  onCopyError,
}: ErrorDisplayProps) {
  const getErrorSeverity = (error: Error): 'low' | 'medium' | 'high' | 'critical' => {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'medium';
    }
    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'high';
    }
    if (message.includes('database') || message.includes('server')) {
      return 'critical';
    }
    return 'low';
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Medium</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Low</Badge>;
    }
  };

  const severity = getErrorSeverity(error);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-red-600">Something went wrong</CardTitle>
                <CardDescription>
                  An unexpected error occurred in the application
                </CardDescription>
              </div>
            </div>
            {getSeverityBadge(severity)}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Error Summary */}
          <Alert>
            <Bug className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error.message}
              {context && (
                <>
                  <br />
                  <strong>Context:</strong> {context}
                </>
              )}
            </AlertDescription>
          </Alert>

          {/* Error Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-muted-foreground">Error ID</p>
              <code className="text-xs bg-muted px-2 py-1 rounded">{errorId}</code>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Retry Count</p>
              <p>{retryCount}</p>
            </div>
          </div>

          {/* Error Details Toggle */}
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleDetails}
              className="w-full justify-between"
            >
              <span>Technical Details</span>
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            
            {showDetails && (
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Stack Trace</h4>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                </div>
                
                {errorInfo.componentStack && (
                  <div>
                    <h4 className="font-medium mb-2">Component Stack</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recovery Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button onClick={onRetry} className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            
            <Button variant="outline" onClick={onGoHome} className="flex-1">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
            
            <Button variant="outline" onClick={onCopyError}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Error
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              If this error persists, please contact support with the error ID above.
            </p>
            <Button variant="link" size="sm" className="p-0 h-auto">
              <ExternalLink className="w-3 h-3 mr-1" />
              Report Issue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Error Boundary Component
// ============================================================================

export class SyncStoreMvpErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorReportingService: ErrorReportingService;
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      showDetails: false,
      retryCount: 0,
    };

    this.errorReportingService = ErrorReportingService.getInstance();
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.errorReportingService.reportError(
      error,
      errorInfo,
      this.props.context,
      this.state.retryCount
    );

    this.setState({
      errorInfo,
      errorId,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Show toast notification
    showToast.error(`Application Error: ${error.message}`);
  }

  handleRetry = () => {
    if (this.state.retryCount >= this.maxRetries) {
      showToast.error('Maximum Retries Exceeded. Please refresh the page or contact support.');
      return;
    }

    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      showDetails: false,
      retryCount: prevState.retryCount + 1,
    }));

    showToast.info('Retrying... Attempting to recover from the error.');
  };

  handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  handleToggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails,
    }));
  };

  handleCopyError = () => {
    if (!this.state.error || !this.state.errorInfo) return;

    const errorText = `
Error ID: ${this.state.errorId}
Message: ${this.state.error.message}
Context: ${this.props.context || 'Unknown'}
Retry Count: ${this.state.retryCount}
Timestamp: ${new Date().toISOString()}

Stack Trace:
${this.state.error.stack}

Component Stack:
${this.state.errorInfo.componentStack}
    `.trim();

    navigator.clipboard.writeText(errorText).then(() => {
      showToast.success('Error Details Copied. Error information has been copied to clipboard.');
    }).catch(() => {
      showToast.error('Copy Failed. Unable to copy error details to clipboard.');
    });
  };

  render() {
    if (this.state.hasError) {
      // Show custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Show error display if error details are available
      if (this.state.error && this.state.errorInfo && this.state.errorId) {
        return (
          <ErrorDisplay
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            errorId={this.state.errorId}
            context={this.props.context}
            showDetails={this.state.showDetails}
            retryCount={this.state.retryCount}
            onToggleDetails={this.handleToggleDetails}
            onRetry={this.handleRetry}
            onGoHome={this.handleGoHome}
            onCopyError={this.handleCopyError}
          />
        );
      }

      // Fallback error display
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
              <p className="text-muted-foreground mb-4">
                An unexpected error occurred. Please try refreshing the page.
              </p>
              <Button onClick={this.handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Hook for Error Reporting
// ============================================================================

export function useErrorReporting() {
  const errorReportingService = ErrorReportingService.getInstance();

  const reportError = (error: Error, context?: string) => {
    return errorReportingService.reportError(
      error,
      { componentStack: '' },
      context
    );
  };

  const getErrorReports = () => {
    return errorReportingService.getErrorReports();
  };

  const clearErrorReports = () => {
    errorReportingService.clearErrorReports();
  };

  return {
    reportError,
    getErrorReports,
    clearErrorReports,
  };
}

// ============================================================================
// Higher-Order Component for Error Boundaries
// ============================================================================

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <SyncStoreMvpErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </SyncStoreMvpErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// ============================================================================
// Error Recovery Hook
// ============================================================================

export function useErrorRecovery() {
  const [error, setError] = React.useState<Error | null>(null);
  const [isRecovering, setIsRecovering] = React.useState(false);

  const handleError = React.useCallback((error: Error) => {
    setError(error);
    console.error('Handled error:', error);
  }, []);

  const recover = React.useCallback(async (recoveryFn?: () => Promise<void>) => {
    if (!error) return;

    setIsRecovering(true);
    
    try {
      if (recoveryFn) {
        await recoveryFn();
      }
      setError(null);
      showToast.success('Recovery Successful. The error has been resolved.');
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      showToast.error('Recovery Failed. Unable to recover from the error automatically.');
    } finally {
      setIsRecovering(false);
    }
  }, [error]);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    isRecovering,
    handleError,
    recover,
    clearError,
  };
}

export default SyncStoreMvpErrorBoundary;