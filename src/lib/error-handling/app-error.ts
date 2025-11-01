/**
 * Custom application error class with enhanced functionality
 */

import { ErrorType, ErrorSeverity, AppError as IAppError, ErrorContext } from './types';
import { generateCorrelationId } from './utils';

export class AppError extends Error implements IAppError {
  public readonly type: ErrorType;
  public readonly code: string;
  public readonly details?: Record<string, any>;
  public readonly retryable: boolean;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: Date;
  public readonly correlationId: string;
  public readonly userId?: string;
  public readonly organizationId?: string;
  public readonly context?: ErrorContext;
  public readonly cause?: Error;

  constructor(
    type: ErrorType,
    message: string,
    code: string,
    options: {
      details?: Record<string, any>;
      retryable?: boolean;
      severity?: ErrorSeverity;
      correlationId?: string;
      userId?: string;
      organizationId?: string;
      context?: ErrorContext;
      cause?: Error;
    } = {}
  ) {
    super(message);
    
    this.name = 'AppError';
    this.type = type;
    this.code = code;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
    this.severity = options.severity ?? ErrorSeverity.MEDIUM;
    this.timestamp = new Date();
    this.correlationId = options.correlationId ?? generateCorrelationId();
    this.userId = options.userId;
    this.organizationId = options.organizationId;
    this.context = options.context;
    this.cause = options.cause;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Create a validation error
   */
  static validation(
    message: string,
    details?: Record<string, any>,
    options?: Partial<ConstructorParameters<typeof AppError>[3]>
  ): AppError {
    return new AppError(
      ErrorType.VALIDATION_ERROR,
      message,
      'VALIDATION_FAILED',
      {
        details,
        severity: ErrorSeverity.LOW,
        retryable: false,
        ...options
      }
    );
  }

  /**
   * Create an authentication error
   */
  static authentication(
    message: string,
    details?: Record<string, any>,
    options?: Partial<ConstructorParameters<typeof AppError>[3]>
  ): AppError {
    return new AppError(
      ErrorType.AUTHENTICATION_ERROR,
      message,
      'AUTH_FAILED',
      {
        details,
        severity: ErrorSeverity.HIGH,
        retryable: false,
        ...options
      }
    );
  }

  /**
   * Create an authorization error
   */
  static authorization(
    message: string,
    details?: Record<string, any>,
    options?: Partial<ConstructorParameters<typeof AppError>[3]>
  ): AppError {
    return new AppError(
      ErrorType.AUTHORIZATION_ERROR,
      message,
      'UNAUTHORIZED',
      {
        details,
        severity: ErrorSeverity.HIGH,
        retryable: false,
        ...options
      }
    );
  }

  /**
   * Create a platform API error
   */
  static platformApi(
    message: string,
    platform: string,
    statusCode?: number,
    details?: Record<string, any>,
    options?: Partial<ConstructorParameters<typeof AppError>[3]>
  ): AppError {
    return new AppError(
      ErrorType.PLATFORM_API_ERROR,
      message,
      'PLATFORM_API_ERROR',
      {
        details: {
          platform,
          statusCode,
          ...details
        },
        severity: ErrorSeverity.MEDIUM,
        retryable: statusCode ? statusCode >= 500 : true,
        ...options
      }
    );
  }

  /**
   * Create a rate limit error
   */
  static rateLimit(
    message: string,
    retryAfter?: number,
    details?: Record<string, any>,
    options?: Partial<ConstructorParameters<typeof AppError>[3]>
  ): AppError {
    return new AppError(
      ErrorType.RATE_LIMIT_ERROR,
      message,
      'RATE_LIMIT_EXCEEDED',
      {
        details: {
          retryAfter,
          ...details
        },
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        ...options
      }
    );
  }

  /**
   * Create a network error
   */
  static network(
    message: string,
    details?: Record<string, any>,
    options?: Partial<ConstructorParameters<typeof AppError>[3]>
  ): AppError {
    return new AppError(
      ErrorType.NETWORK_ERROR,
      message,
      'NETWORK_ERROR',
      {
        details,
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        ...options
      }
    );
  }

  /**
   * Create a database error
   */
  static database(
    message: string,
    details?: Record<string, any>,
    options?: Partial<ConstructorParameters<typeof AppError>[3]>
  ): AppError {
    return new AppError(
      ErrorType.DATABASE_ERROR,
      message,
      'DATABASE_ERROR',
      {
        details,
        severity: ErrorSeverity.HIGH,
        retryable: false,
        ...options
      }
    );
  }

  /**
   * Create a sync error
   */
  static sync(
    message: string,
    operation: string,
    details?: Record<string, any>,
    options?: Partial<ConstructorParameters<typeof AppError>[3]>
  ): AppError {
    return new AppError(
      ErrorType.SYNC_ERROR,
      message,
      'SYNC_FAILED',
      {
        details: {
          operation,
          ...details
        },
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        ...options
      }
    );
  }

  /**
   * Create an internal error
   */
  static internal(
    message: string,
    details?: Record<string, any>,
    options?: Partial<ConstructorParameters<typeof AppError>[3]>
  ): AppError {
    return new AppError(
      ErrorType.INTERNAL_ERROR,
      message,
      'INTERNAL_ERROR',
      {
        details,
        severity: ErrorSeverity.CRITICAL,
        retryable: false,
        ...options
      }
    );
  }

  /**
   * Convert to JSON for logging/serialization
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      code: this.code,
      details: this.details,
      retryable: this.retryable,
      severity: this.severity,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.correlationId,
      userId: this.userId,
      organizationId: this.organizationId,
      context: this.context,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : undefined
    };
  }

  /**
   * Check if error should trigger an alert
   */
  shouldAlert(): boolean {
    return this.severity === ErrorSeverity.HIGH || this.severity === ErrorSeverity.CRITICAL;
  }

  /**
   * Get retry delay based on attempt count
   */
  getRetryDelay(attemptCount: number, baseDelay = 1000, maxDelay = 30000): number {
    if (!this.retryable) return 0;
    
    const delay = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }
}