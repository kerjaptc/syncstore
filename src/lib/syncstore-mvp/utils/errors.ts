/**
 * SyncStore MVP Error Handling Utilities
 * 
 * This file contains error classes, error handling utilities, and recovery mechanisms
 * for the SyncStore MVP application.
 */

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base error class for all SyncStore errors
 */
export class SyncStoreError extends Error {
  public readonly timestamp: Date;
  public readonly errorId: string;

  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SyncStoreError';
    this.timestamp = new Date();
    this.errorId = generateErrorId();
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SyncStoreError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      errorId: this.errorId,
      stack: this.stack,
    };
  }
}

/**
 * Shopee API specific errors
 */
export class ShopeeApiError extends SyncStoreError {
  constructor(
    message: string,
    public readonly apiCode: string,
    public readonly httpStatus?: number,
    public readonly retryAfter?: number,
    context?: Record<string, any>
  ) {
    super(message, 'SHOPEE_API_ERROR', context);
    this.name = 'ShopeeApiError';
  }

  get isRateLimited(): boolean {
    return this.httpStatus === 429 || this.apiCode === 'RATE_LIMIT_EXCEEDED';
  }

  get isTokenExpired(): boolean {
    return this.httpStatus === 401 || this.apiCode === 'TOKEN_EXPIRED';
  }

  get isRetryable(): boolean {
    return this.isRateLimited || this.httpStatus === 500 || this.httpStatus === 502 || this.httpStatus === 503;
  }
}

/**
 * Data validation errors
 */
export class ValidationError extends SyncStoreError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value?: any,
    context?: Record<string, any>
  ) {
    super(message, 'VALIDATION_ERROR', { ...context, field, value });
    this.name = 'ValidationError';
  }
}

/**
 * Store connection errors
 */
export class ConnectionError extends SyncStoreError {
  constructor(
    message: string,
    public readonly storeId: string,
    public readonly platform: string,
    context?: Record<string, any>
  ) {
    super(message, 'CONNECTION_ERROR', { ...context, storeId, platform });
    this.name = 'ConnectionError';
  }
}

/**
 * Product synchronization errors
 */
export class SyncError extends SyncStoreError {
  constructor(
    message: string,
    public readonly storeId: string,
    public readonly syncType: 'full' | 'incremental',
    public readonly productsProcessed: number = 0,
    context?: Record<string, any>
  ) {
    super(message, 'SYNC_ERROR', { ...context, storeId, syncType, productsProcessed });
    this.name = 'SyncError';
  }
}

/**
 * Database operation errors
 */
export class DatabaseError extends SyncStoreError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly table?: string,
    context?: Record<string, any>
  ) {
    super(message, 'DATABASE_ERROR', { ...context, operation, table });
    this.name = 'DatabaseError';
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends SyncStoreError {
  constructor(
    message: string,
    public readonly configKey: string,
    context?: Record<string, any>
  ) {
    super(message, 'CONFIGURATION_ERROR', { ...context, configKey });
    this.name = 'ConfigurationError';
  }
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Generates a unique error ID for tracking
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Checks if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof ShopeeApiError) {
    return error.isRetryable;
  }
  
  if (error instanceof DatabaseError) {
    // Retry on connection errors, timeouts, but not on constraint violations
    return error.operation === 'connect' || error.message.includes('timeout');
  }
  
  // Network errors are generally retryable
  if (error.message.includes('ECONNRESET') || 
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND')) {
    return true;
  }
  
  return false;
}

/**
 * Extracts retry delay from error (for rate limiting)
 */
export function getRetryDelay(error: Error): number {
  if (error instanceof ShopeeApiError && error.retryAfter) {
    return error.retryAfter * 1000; // Convert to milliseconds
  }
  
  // Default exponential backoff base delay
  return 1000;
}

/**
 * Categorizes errors for monitoring and alerting
 */
export function categorizeError(error: Error): {
  category: 'user' | 'system' | 'external' | 'configuration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  alertRequired: boolean;
} {
  if (error instanceof ValidationError) {
    return { category: 'user', severity: 'low', alertRequired: false };
  }
  
  if (error instanceof ConfigurationError) {
    return { category: 'configuration', severity: 'high', alertRequired: true };
  }
  
  if (error instanceof ShopeeApiError) {
    if (error.isRateLimited) {
      return { category: 'external', severity: 'medium', alertRequired: false };
    }
    if (error.isTokenExpired) {
      return { category: 'external', severity: 'medium', alertRequired: true };
    }
    return { category: 'external', severity: 'high', alertRequired: true };
  }
  
  if (error instanceof DatabaseError) {
    return { category: 'system', severity: 'critical', alertRequired: true };
  }
  
  if (error instanceof SyncError) {
    return { category: 'system', severity: 'medium', alertRequired: true };
  }
  
  // Unknown errors are treated as critical system errors
  return { category: 'system', severity: 'critical', alertRequired: true };
}

/**
 * Sanitizes error data for logging (removes sensitive information)
 */
export function sanitizeErrorForLogging(error: Error): Record<string, any> {
  const sanitized: Record<string, any> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
  
  if (error instanceof SyncStoreError) {
    sanitized.code = error.code;
    sanitized.timestamp = error.timestamp;
    sanitized.errorId = error.errorId;
    
    // Sanitize context to remove sensitive data
    if (error.context) {
      sanitized.context = sanitizeContext(error.context);
    }
  }
  
  return sanitized;
}

/**
 * Removes sensitive information from error context
 */
function sanitizeContext(context: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['accessToken', 'refreshToken', 'password', 'secret', 'key', 'token'];
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(context)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContext(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// ============================================================================
// Error Recovery Utilities
// ============================================================================

/**
 * Implements exponential backoff retry logic
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if it's not a retryable error
      if (!isRetryableError(lastError)) {
        throw lastError;
      }
      
      // Don't wait after the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );
      
      // Use custom delay for rate limiting
      const customDelay = getRetryDelay(lastError);
      const finalDelay = Math.max(delay, customDelay);
      
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }
  
  throw lastError!;
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000, // 1 minute
    private readonly successThreshold: number = 2
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new SyncStoreError('Circuit breaker is open', 'CIRCUIT_BREAKER_OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }
  
  get isOpen(): boolean {
    return this.state === 'open';
  }
  
  get status(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// ============================================================================
// Error Reporting Utilities
// ============================================================================

/**
 * Formats error for user display
 */
export function formatErrorForUser(error: Error): string {
  if (error instanceof ValidationError) {
    return `Invalid ${error.field}: ${error.message}`;
  }
  
  if (error instanceof ShopeeApiError) {
    if (error.isRateLimited) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (error.isTokenExpired) {
      return 'Your store connection has expired. Please reconnect your store.';
    }
    return 'There was an issue connecting to Shopee. Please try again later.';
  }
  
  if (error instanceof ConnectionError) {
    return `Unable to connect to your ${error.platform} store. Please check your connection settings.`;
  }
  
  if (error instanceof SyncError) {
    return 'Product synchronization failed. Please try again or contact support if the issue persists.';
  }
  
  // Generic error message for unknown errors
  return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
}

/**
 * Creates error context for debugging
 */
export function createErrorContext(
  operation: string,
  params?: Record<string, any>,
  metadata?: Record<string, any>
): Record<string, any> {
  return {
    operation,
    params: params ? sanitizeContext(params) : undefined,
    metadata,
    timestamp: new Date().toISOString(),
    userAgent: typeof window !== 'undefined' ? window.navigator?.userAgent : undefined,
  };
}