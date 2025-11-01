/**
 * Global error handling setup and configuration
 */

import { AppError } from './app-error';
import { ErrorType, ErrorSeverity } from './types';
import { getLogger } from './logger';
import { getNotificationService } from './notification';
import { captureAppError, captureError, initializeSentry, configureSentryForEnvironment } from './sentry';
import { toAppError } from './utils';

const logger = getLogger('global-error-handler');

/**
 * Setup global error handling for the application
 */
export function setupGlobalErrorHandling(): void {
  // Initialize Sentry
  initializeSentry();
  configureSentryForEnvironment();

  // Setup unhandled promise rejection handler
  if (typeof window !== 'undefined') {
    // Browser environment
    setupBrowserErrorHandling();
  } else {
    // Node.js environment
    setupNodeErrorHandling();
  }

  logger.info('Global error handling initialized');
}

/**
 * Setup error handling for browser environment
 */
function setupBrowserErrorHandling(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = toAppError(event.reason, ErrorType.INTERNAL_ERROR, {
      operation: 'unhandled_promise_rejection',
      component: 'global'
    });

    logger.error('Unhandled promise rejection', error);
    captureAppError(error);

    // Notify if critical
    if (error.shouldAlert()) {
      getNotificationService().notifyError(error, {
        source: 'unhandled_promise_rejection',
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    }

    // Prevent default browser behavior
    event.preventDefault();
  });

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    const error = toAppError(event.error || event.message, ErrorType.INTERNAL_ERROR, {
      operation: 'uncaught_error',
      component: 'global',
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    });

    logger.error('Uncaught error', error);
    captureAppError(error);

    // Notify if critical
    if (error.shouldAlert()) {
      getNotificationService().notifyError(error, {
        source: 'uncaught_error',
        userAgent: navigator.userAgent,
        url: window.location.href,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    }
  });

  // Handle resource loading errors
  window.addEventListener('error', (event) => {
    if (event.target && event.target !== window) {
      const target = event.target as HTMLElement;
      
      const error = new AppError(
        ErrorType.NETWORK_ERROR,
        `Failed to load resource: ${target.tagName}`,
        'RESOURCE_LOAD_ERROR',
        {
          severity: ErrorSeverity.LOW,
          retryable: true,
          details: {
            tagName: target.tagName,
            src: (target as any).src || (target as any).href,
            type: (target as any).type
          },
          context: {
            operation: 'resource_load',
            component: 'global'
          }
        }
      );

      logger.warn('Resource load error', error);
      captureAppError(error);
    }
  }, true);

  // Handle network status changes
  window.addEventListener('online', () => {
    logger.info('Network connection restored');
  });

  window.addEventListener('offline', () => {
    logger.warn('Network connection lost');
  });
}

/**
 * Setup error handling for Node.js environment
 */
function setupNodeErrorHandling(): void {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    const error = toAppError(reason, ErrorType.INTERNAL_ERROR, {
      operation: 'unhandled_promise_rejection',
      component: 'global',
      metadata: {
        promise: promise.toString()
      }
    });

    logger.error('Unhandled promise rejection', error);
    captureAppError(error);

    // Notify if critical
    if (error.shouldAlert()) {
      getNotificationService().notifyError(error, {
        source: 'unhandled_promise_rejection',
        process: process.pid,
        nodeVersion: process.version
      });
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    const appError = toAppError(error, ErrorType.INTERNAL_ERROR, {
      operation: 'uncaught_exception',
      component: 'global'
    });

    logger.fatal('Uncaught exception', appError);
    captureAppError(appError);

    // Always notify for uncaught exceptions
    getNotificationService().notifyError(appError, {
      source: 'uncaught_exception',
      process: process.pid,
      nodeVersion: process.version
    });

    // Exit process after logging
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle SIGTERM gracefully
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    
    // Perform cleanup
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  });

  // Handle SIGINT gracefully
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    
    // Perform cleanup
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  });
}

/**
 * Create a global error handler for API routes
 */
export function createApiErrorHandler() {
  return (error: unknown, req?: any, res?: any) => {
    const appError = error instanceof AppError ? error : toAppError(error, ErrorType.INTERNAL_ERROR, {
      operation: 'api_request',
      component: 'api',
      metadata: {
        method: req?.method,
        url: req?.url,
        userAgent: req?.headers?.['user-agent']
      }
    });

    logger.error('API error', appError, {
      method: req?.method,
      url: req?.url,
      statusCode: res?.statusCode
    });

    captureAppError(appError, {
      request: {
        method: req?.method,
        url: req?.url,
        headers: req?.headers,
        query: req?.query,
        body: req?.body
      },
      response: {
        statusCode: res?.statusCode
      }
    });

    // Notify if critical
    if (appError.shouldAlert()) {
      getNotificationService().notifyError(appError, {
        source: 'api_error',
        method: req?.method,
        url: req?.url
      });
    }

    return appError;
  };
}

/**
 * Middleware for handling errors in async functions
 */
export function asyncErrorHandler<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return ((...args: any[]) => {
    return Promise.resolve(fn(...args)).catch((error) => {
      const appError = error instanceof AppError ? error : toAppError(error);
      
      logger.error('Async function error', appError);
      captureAppError(appError);
      
      throw appError;
    });
  }) as T;
}

/**
 * Decorator for handling errors in class methods
 */
export function handleErrors(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    try {
      return await originalMethod.apply(this, args);
    } catch (error) {
      const appError = error instanceof AppError ? error : toAppError(error, ErrorType.INTERNAL_ERROR, {
        operation: propertyKey,
        component: target.constructor.name
      });

      logger.error(`Method ${propertyKey} error`, appError);
      captureAppError(appError);

      throw appError;
    }
  };

  return descriptor;
}

/**
 * Create error context for tracking related operations
 */
export function createErrorContext(operation: string, component: string, metadata?: Record<string, any>) {
  return {
    operation,
    component,
    metadata,
    timestamp: new Date(),
    correlationId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };
}