/**
 * Error handling middleware for API routes and tRPC
 */

import { NextRequest, NextResponse } from 'next/server';
import { TRPCError } from '@trpc/server';
import { AppError } from './app-error';
import { ErrorType, ErrorSeverity } from './types';
import { getLogger } from './logger';
import { captureAppError } from './sentry';
import { getNotificationService } from './notification';
import { formatErrorForUser, toAppError } from './utils';

const logger = getLogger('error-middleware');

/**
 * API route error handler middleware
 */
export function withErrorHandler(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(req);
    } catch (error) {
      return handleApiError(error, req);
    }
  };
}

/**
 * Handle API errors and return appropriate response
 */
export function handleApiError(error: unknown, req?: NextRequest): NextResponse {
  const appError = error instanceof AppError ? error : toAppError(error, ErrorType.INTERNAL_ERROR, {
    operation: 'api_request',
    component: 'api',
    metadata: {
      method: req?.method,
      url: req?.url,
      userAgent: req?.headers.get('user-agent')
    }
  });

  // Log error
  logger.error('API error occurred', appError, {
    method: req?.method,
    url: req?.url,
    correlationId: appError.correlationId
  });

  // Capture in Sentry
  captureAppError(appError, {
    request: {
      method: req?.method,
      url: req?.url,
      headers: Object.fromEntries(req?.headers.entries() || []),
    }
  });

  // Send notification for critical errors
  if (appError.shouldAlert()) {
    getNotificationService().notifyError(appError, {
      source: 'api_error',
      method: req?.method,
      url: req?.url
    });
  }

  // Determine HTTP status code
  const statusCode = getHttpStatusCode(appError);

  // Return error response
  return NextResponse.json(
    {
      success: false,
      error: {
        code: appError.code,
        message: formatErrorForUser(appError),
        type: appError.type,
        correlationId: appError.correlationId,
        timestamp: appError.timestamp.toISOString(),
        ...(process.env.NODE_ENV === 'development' && {
          details: appError.details,
          stack: appError.stack
        })
      }
    },
    { 
      status: statusCode,
      headers: {
        'X-Correlation-ID': appError.correlationId
      }
    }
  );
}

/**
 * tRPC error handler
 */
export function handleTRPCError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  const appError = error instanceof AppError ? error : toAppError(error);

  // Log error
  logger.error('tRPC error occurred', appError);

  // Capture in Sentry
  captureAppError(appError);

  // Send notification for critical errors
  if (appError.shouldAlert()) {
    getNotificationService().notifyError(appError, {
      source: 'trpc_error'
    });
  }

  // Convert to tRPC error
  return new TRPCError({
    code: getTRPCErrorCode(appError),
    message: formatErrorForUser(appError),
    cause: appError
  });
}

/**
 * Map AppError to HTTP status code
 */
function getHttpStatusCode(error: AppError): number {
  switch (error.type) {
    case ErrorType.VALIDATION_ERROR:
      return 400;
    case ErrorType.AUTHENTICATION_ERROR:
      return 401;
    case ErrorType.AUTHORIZATION_ERROR:
      return 403;
    case ErrorType.RATE_LIMIT_ERROR:
      return 429;
    case ErrorType.PLATFORM_API_ERROR:
    case ErrorType.EXTERNAL_SERVICE_ERROR:
      return 502;
    case ErrorType.NETWORK_ERROR:
      return 503;
    case ErrorType.INTERNAL_ERROR:
    case ErrorType.DATABASE_ERROR:
    case ErrorType.SYNC_ERROR:
    case ErrorType.BUSINESS_LOGIC_ERROR:
    default:
      return 500;
  }
}

/**
 * Map AppError to tRPC error code
 */
function getTRPCErrorCode(error: AppError): TRPCError['code'] {
  switch (error.type) {
    case ErrorType.VALIDATION_ERROR:
      return 'BAD_REQUEST';
    case ErrorType.AUTHENTICATION_ERROR:
      return 'UNAUTHORIZED';
    case ErrorType.AUTHORIZATION_ERROR:
      return 'FORBIDDEN';
    case ErrorType.RATE_LIMIT_ERROR:
      return 'TOO_MANY_REQUESTS';
    case ErrorType.PLATFORM_API_ERROR:
    case ErrorType.EXTERNAL_SERVICE_ERROR:
    case ErrorType.NETWORK_ERROR:
      return 'BAD_GATEWAY';
    case ErrorType.INTERNAL_ERROR:
    case ErrorType.DATABASE_ERROR:
    case ErrorType.SYNC_ERROR:
    case ErrorType.BUSINESS_LOGIC_ERROR:
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
}

/**
 * Async wrapper for error handling
 */
export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw error instanceof AppError ? error : toAppError(error);
    }
  };
}

/**
 * Error boundary for server components
 */
export function withServerErrorBoundary<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  fallback?: (error: AppError) => R
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = error instanceof AppError ? error : toAppError(error);
      
      logger.error('Server component error', appError);
      captureAppError(appError);

      if (fallback) {
        return fallback(appError);
      }

      throw appError;
    }
  };
}