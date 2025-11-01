/**
 * Error handling utilities
 */

import { randomBytes } from 'crypto';
import { AppError } from './app-error';
import { ErrorType, ErrorSeverity } from './types';

/**
 * Generate a unique correlation ID for tracking requests
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${randomBytes(8).toString('hex')}`;
}

/**
 * Sanitize sensitive data from objects for logging
 */
export function sanitizeForLogging(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging);
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Sensitive field patterns
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('key') ||
        lowerKey.includes('credential') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('ssn') ||
        lowerKey.includes('social') ||
        lowerKey.includes('credit') ||
        lowerKey.includes('card') ||
        lowerKey.includes('cvv') ||
        lowerKey.includes('pin')
      ) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeForLogging(value);
      }
    }
    
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize sensitive patterns in strings
 */
function sanitizeString(str: string): string {
  // Email addresses
  str = str.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  
  // Phone numbers (basic patterns)
  str = str.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
  
  // Credit card numbers (basic pattern)
  str = str.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]');
  
  // API keys and tokens (common patterns)
  str = str.replace(/\b[A-Za-z0-9]{32,}\b/g, '[TOKEN]');
  
  return str;
}

/**
 * Extract error information from unknown error types
 */
export function extractErrorInfo(error: unknown): {
  message: string;
  stack?: string;
  name?: string;
  code?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: (error as any).code
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as any;
    return {
      message: obj.message || obj.error || 'Unknown error',
      stack: obj.stack,
      name: obj.name,
      code: obj.code
    };
  }

  return { message: 'Unknown error occurred' };
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(
  error: unknown,
  defaultType: ErrorType = ErrorType.INTERNAL_ERROR,
  context?: any
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const errorInfo = extractErrorInfo(error);
  
  // Try to determine error type from error properties
  let errorType = defaultType;
  let severity = ErrorSeverity.MEDIUM;
  let retryable = false;
  let code = 'UNKNOWN_ERROR';

  if (error instanceof Error) {
    const errorName = error.name.toLowerCase();
    const errorMessage = error.message.toLowerCase();

    if (errorName.includes('validation') || errorMessage.includes('validation')) {
      errorType = ErrorType.VALIDATION_ERROR;
      severity = ErrorSeverity.LOW;
      code = 'VALIDATION_ERROR';
    } else if (errorName.includes('auth') || errorMessage.includes('unauthorized')) {
      errorType = ErrorType.AUTHENTICATION_ERROR;
      severity = ErrorSeverity.HIGH;
      code = 'AUTH_ERROR';
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      errorType = ErrorType.NETWORK_ERROR;
      severity = ErrorSeverity.MEDIUM;
      retryable = true;
      code = 'NETWORK_ERROR';
    } else if (errorMessage.includes('database') || errorMessage.includes('sql')) {
      errorType = ErrorType.DATABASE_ERROR;
      severity = ErrorSeverity.HIGH;
      code = 'DATABASE_ERROR';
    }
  }

  return new AppError(
    errorType,
    errorInfo.message,
    code,
    {
      details: {
        originalError: {
          name: errorInfo.name,
          stack: errorInfo.stack,
          code: errorInfo.code
        }
      },
      severity,
      retryable,
      context,
      cause: error instanceof Error ? error : undefined
    }
  );
}

/**
 * Check if an error is retryable based on common patterns
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.retryable;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors are usually retryable
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      name.includes('network')
    ) {
      return true;
    }

    // Rate limit errors are retryable
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return true;
    }

    // Server errors (5xx) are usually retryable
    const statusMatch = message.match(/status\s*:?\s*(\d+)/i);
    if (statusMatch) {
      const status = parseInt(statusMatch[1]);
      return status >= 500;
    }
  }

  return false;
}

/**
 * Get error severity based on error type and context
 */
export function getErrorSeverity(error: unknown, context?: any): ErrorSeverity {
  if (error instanceof AppError) {
    return error.severity;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Critical errors
    if (
      message.includes('database') ||
      message.includes('payment') ||
      message.includes('security') ||
      name.includes('security')
    ) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (
      message.includes('auth') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      name.includes('auth')
    ) {
      return ErrorSeverity.HIGH;
    }

    // Low severity errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      name.includes('validation')
    ) {
      return ErrorSeverity.LOW;
    }
  }

  return ErrorSeverity.MEDIUM;
}

/**
 * Format error for user display (sanitized)
 */
export function formatErrorForUser(error: unknown): string {
  if (error instanceof AppError) {
    // Return user-friendly message based on error type
    switch (error.type) {
      case ErrorType.VALIDATION_ERROR:
        return error.message;
      case ErrorType.AUTHENTICATION_ERROR:
        return 'Authentication failed. Please log in again.';
      case ErrorType.AUTHORIZATION_ERROR:
        return 'You do not have permission to perform this action.';
      case ErrorType.RATE_LIMIT_ERROR:
        return 'Too many requests. Please try again later.';
      case ErrorType.NETWORK_ERROR:
        return 'Network error. Please check your connection and try again.';
      case ErrorType.PLATFORM_API_ERROR:
        return 'External service error. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  if (error instanceof Error) {
    // For non-AppError instances, provide generic messages
    if (error.message.toLowerCase().includes('validation')) {
      return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
  }

  return 'An unexpected error occurred. Please try again.';
}