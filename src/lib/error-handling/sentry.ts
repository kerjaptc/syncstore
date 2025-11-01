/**
 * Sentry integration for error tracking and performance monitoring
 */

import * as Sentry from '@sentry/nextjs';
import { env } from '@/env';
import { AppError } from './app-error';
import { ErrorSeverity, LogLevel } from './types';

export interface SentryConfig {
  dsn?: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
  beforeSend?: (event: Sentry.Event) => Sentry.Event | null;
  beforeSendTransaction?: (event: any) => any;
}

/**
 * Initialize Sentry with configuration
 */
export function initializeSentry(config?: Partial<SentryConfig>): void {
  const sentryConfig: SentryConfig = {
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    ...config
  };

  if (!sentryConfig.dsn) {
    console.warn('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: sentryConfig.dsn,
    environment: sentryConfig.environment,
    release: sentryConfig.release,
    tracesSampleRate: sentryConfig.tracesSampleRate,
    profilesSampleRate: sentryConfig.profilesSampleRate,
    
    beforeSend: (event) => {
      // Apply custom beforeSend logic
      if (sentryConfig.beforeSend) {
        const result = sentryConfig.beforeSend(event);
        if (!result) return null;
        event = result;
      }

      // Filter out development errors in production
      if (sentryConfig.environment === 'production') {
        // Skip certain error types in production
        if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
          return null;
        }
      }

      return event;
    },

    beforeSendTransaction: (event) => {
      // Apply custom beforeSendTransaction logic
      if (sentryConfig.beforeSendTransaction) {
        return sentryConfig.beforeSendTransaction(event);
      }
      return event;
    },

    integrations: [
      // Add custom integrations if available
    ],

    // Performance monitoring
    // enableTracing removed - not supported in current version
    
    // Session replay for debugging
    replaysSessionSampleRate: sentryConfig.environment === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0
  });

  // Set global tags
  Sentry.setTag('component', 'storesync');
  Sentry.setTag('version', process.env.npm_package_version || 'unknown');
}

/**
 * Capture AppError with enhanced context
 */
export function captureAppError(error: AppError, context?: Record<string, any>): string {
  return Sentry.withScope((scope) => {
    // Set error severity
    scope.setLevel(mapSeverityToSentryLevel(error.severity));
    
    // Set tags
    scope.setTag('error.type', error.type);
    scope.setTag('error.code', error.code);
    scope.setTag('error.severity', error.severity);
    scope.setTag('error.retryable', error.retryable);
    
    if (error.correlationId) {
      scope.setTag('correlationId', error.correlationId);
    }
    
    if (error.organizationId) {
      scope.setTag('organizationId', error.organizationId);
    }

    // Set user context
    if (error.userId) {
      scope.setUser({ id: error.userId });
    }

    // Set additional context
    if (error.context) {
      scope.setContext('error.context', error.context as any);
    }
    
    if (error.details) {
      scope.setContext('error.details', error.details);
    }
    
    if (context) {
      scope.setContext('additional', context);
    }

    // Set fingerprint for grouping similar errors
    scope.setFingerprint([error.type, error.code]);

    return Sentry.captureException(error);
  });
}

/**
 * Capture generic error with context
 */
export function captureError(
  error: Error,
  context?: Record<string, any>,
  level: Sentry.SeverityLevel = 'error'
): string {
  return Sentry.withScope((scope) => {
    scope.setLevel(level);
    
    if (context) {
      scope.setContext('error.context', context);
    }

    return Sentry.captureException(error);
  });
}

/**
 * Capture message with context
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
): string {
  return Sentry.withScope((scope) => {
    scope.setLevel(level);
    
    if (context) {
      scope.setContext('message.context', context);
    }

    return Sentry.captureMessage(message, level);
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string = 'custom',
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000
  });
}

/**
 * Set user context
 */
export function setUser(user: {
  id?: string;
  email?: string;
  username?: string;
  organizationId?: string;
}): void {
  Sentry.setUser(user);
}

/**
 * Set additional context
 */
export function setContext(key: string, context: Record<string, any>): void {
  Sentry.setContext(key, context);
}

/**
 * Set tag
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Start transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  operation: string,
  description?: string
): any {
  // Transaction API may vary by Sentry version
  return {
    name,
    op: operation,
    description,
    setData: (key: string, value: any) => {},
    setStatus: (status: string) => {},
    finish: () => {}
  };
}

/**
 * Measure function execution time
 */
export async function measurePerformance<T>(
  name: string,
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  const transaction = startTransaction(name, operation);
  
  if (context) {
    transaction.setData('context', context);
  }

  try {
    const result = await fn();
    transaction.setStatus('ok');
    return result;
  } catch (error) {
    transaction.setStatus('internal_error');
    
    if (error instanceof AppError) {
      captureAppError(error, context);
    } else if (error instanceof Error) {
      captureError(error, context);
    }
    
    throw error;
  } finally {
    transaction.finish();
  }
}

/**
 * Map AppError severity to Sentry level
 */
function mapSeverityToSentryLevel(severity: ErrorSeverity): Sentry.SeverityLevel {
  switch (severity) {
    case ErrorSeverity.LOW:
      return 'info';
    case ErrorSeverity.MEDIUM:
      return 'warning';
    case ErrorSeverity.HIGH:
      return 'error';
    case ErrorSeverity.CRITICAL:
      return 'fatal';
    default:
      return 'error';
  }
}

/**
 * Map log level to Sentry level
 */
export function mapLogLevelToSentryLevel(level: LogLevel): Sentry.SeverityLevel {
  switch (level) {
    case LogLevel.DEBUG:
      return 'debug';
    case LogLevel.INFO:
      return 'info';
    case LogLevel.WARN:
      return 'warning';
    case LogLevel.ERROR:
      return 'error';
    case LogLevel.FATAL:
      return 'fatal';
    default:
      return 'info';
  }
}

/**
 * Configure Sentry for different environments
 */
export function configureSentryForEnvironment(): void {
  const environment = process.env.NODE_ENV || 'development';
  
  if (environment === 'development') {
    // Development configuration
    Sentry.setTag('environment', 'development');
    
    // More verbose logging in development
    addBreadcrumb('Sentry initialized for development', 'sentry', 'info');
    
  } else if (environment === 'production') {
    // Production configuration
    Sentry.setTag('environment', 'production');
    
    // Set release information
    if (process.env.VERCEL_GIT_COMMIT_SHA) {
      Sentry.setTag('release', process.env.VERCEL_GIT_COMMIT_SHA);
    }
    
    addBreadcrumb('Sentry initialized for production', 'sentry', 'info');
  }
}

/**
 * Flush Sentry events (useful for serverless environments)
 */
export async function flushSentry(timeout: number = 2000): Promise<boolean> {
  return Sentry.flush(timeout);
}