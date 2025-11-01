/**
 * Retry Strategy Configuration
 * Task 6.1: Implement retry strategy
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
}

export interface ErrorClassification {
  retryable: boolean;
  category: 'RATE_LIMIT' | 'NETWORK' | 'AUTHENTICATION' | 'VALIDATION' | 'SYSTEM' | 'UNKNOWN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

/**
 * Retry Strategy Service
 */
export class RetryStrategyService {
  // Default retry configuration
  static readonly DEFAULT_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 2000, // 2 seconds
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    jitter: true,
  };

  // Platform-specific retry configurations
  static readonly PLATFORM_CONFIGS: Record<string, RetryConfig> = {
    shopee: {
      maxAttempts: 5, // Shopee allows more retries
      baseDelay: 1500,
      maxDelay: 60000, // 1 minute
      backoffMultiplier: 1.8,
      jitter: true,
    },
    tiktok: {
      maxAttempts: 3, // TikTok is more strict
      baseDelay: 3000,
      maxDelay: 45000, // 45 seconds
      backoffMultiplier: 2.2,
      jitter: true,
    },
  };

  /**
   * Classify error for retry decision
   */
  static classifyError(error: any): ErrorClassification {
    const errorMessage = error?.message || error?.toString() || '';
    const errorCode = error?.code || error?.status || '';

    // Rate limiting errors
    if (this.isRateLimitError(errorMessage, errorCode)) {
      return {
        retryable: true,
        category: 'RATE_LIMIT',
        severity: 'MEDIUM',
        description: 'API rate limit exceeded, should retry with backoff',
      };
    }

    // Network errors
    if (this.isNetworkError(errorMessage, errorCode)) {
      return {
        retryable: true,
        category: 'NETWORK',
        severity: 'MEDIUM',
        description: 'Network connectivity issue, should retry',
      };
    }

    // Authentication errors
    if (this.isAuthenticationError(errorMessage, errorCode)) {
      return {
        retryable: false, // Don't retry auth errors automatically
        category: 'AUTHENTICATION',
        severity: 'HIGH',
        description: 'Authentication failed, requires manual intervention',
      };
    }

    // Validation errors
    if (this.isValidationError(errorMessage, errorCode)) {
      return {
        retryable: false, // Don't retry validation errors
        category: 'VALIDATION',
        severity: 'HIGH',
        description: 'Data validation failed, requires data correction',
      };
    }

    // System errors
    if (this.isSystemError(errorMessage, errorCode)) {
      return {
        retryable: true,
        category: 'SYSTEM',
        severity: 'HIGH',
        description: 'System error, may be temporary',
      };
    }

    // Unknown errors - be conservative
    return {
      retryable: false,
      category: 'UNKNOWN',
      severity: 'MEDIUM',
      description: 'Unknown error type, manual review required',
    };
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  static calculateRetryDelay(
    attemptNumber: number,
    config: RetryConfig = this.DEFAULT_CONFIG
  ): number {
    // Calculate exponential backoff
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber - 1);

    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelay);

    // Add jitter to prevent thundering herd
    if (config.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return Math.max(delay, 0);
  }

  /**
   * Get retry configuration for platform
   */
  static getRetryConfig(platform: string): RetryConfig {
    return this.PLATFORM_CONFIGS[platform] || this.DEFAULT_CONFIG;
  }

  /**
   * Determine if job should be retried
   */
  static shouldRetry(
    error: any,
    attemptNumber: number,
    platform: string = 'default'
  ): { shouldRetry: boolean; reason: string; nextDelay?: number } {
    const config = this.getRetryConfig(platform);
    const classification = this.classifyError(error);

    // Check if we've exceeded max attempts
    if (attemptNumber >= config.maxAttempts) {
      return {
        shouldRetry: false,
        reason: `Maximum attempts (${config.maxAttempts}) exceeded`,
      };
    }

    // Check if error is retryable
    if (!classification.retryable) {
      return {
        shouldRetry: false,
        reason: `Error is not retryable: ${classification.description}`,
      };
    }

    // Calculate next retry delay
    const nextDelay = this.calculateRetryDelay(attemptNumber + 1, config);

    return {
      shouldRetry: true,
      reason: `Retryable ${classification.category} error, attempt ${attemptNumber + 1}/${config.maxAttempts}`,
      nextDelay,
    };
  }

  /**
   * Check if error is rate limiting related
   */
  private static isRateLimitError(message: string, code: string): boolean {
    const rateLimitIndicators = [
      'rate limit',
      'too many requests',
      'quota exceeded',
      'throttled',
      '429',
      'RATE_LIMITED',
    ];

    return rateLimitIndicators.some(indicator =>
      message.toLowerCase().includes(indicator.toLowerCase()) ||
      code.toString().includes(indicator)
    );
  }

  /**
   * Check if error is network related
   */
  private static isNetworkError(message: string, code: string): boolean {
    const networkIndicators = [
      'network',
      'connection',
      'timeout',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'socket',
      '502',
      '503',
      '504',
      'NETWORK_ERROR',
    ];

    return networkIndicators.some(indicator =>
      message.toLowerCase().includes(indicator.toLowerCase()) ||
      code.toString().includes(indicator)
    );
  }

  /**
   * Check if error is authentication related
   */
  private static isAuthenticationError(message: string, code: string): boolean {
    const authIndicators = [
      'unauthorized',
      'authentication',
      'invalid token',
      'expired token',
      'forbidden',
      '401',
      '403',
      'UNAUTHORIZED',
      'INVALID_CREDENTIALS',
    ];

    return authIndicators.some(indicator =>
      message.toLowerCase().includes(indicator.toLowerCase()) ||
      code.toString().includes(indicator)
    );
  }

  /**
   * Check if error is validation related
   */
  private static isValidationError(message: string, code: string): boolean {
    const validationIndicators = [
      'validation',
      'invalid',
      'bad request',
      'malformed',
      '400',
      'INVALID_PRODUCT',
      'VALIDATION_ERROR',
    ];

    return validationIndicators.some(indicator =>
      message.toLowerCase().includes(indicator.toLowerCase()) ||
      code.toString().includes(indicator)
    );
  }

  /**
   * Check if error is system related
   */
  private static isSystemError(message: string, code: string): boolean {
    const systemIndicators = [
      'internal server error',
      'service unavailable',
      'database',
      'system error',
      '500',
      '502',
      '503',
      'SYSTEM_ERROR',
    ];

    return systemIndicators.some(indicator =>
      message.toLowerCase().includes(indicator.toLowerCase()) ||
      code.toString().includes(indicator)
    );
  }

  /**
   * Get human-readable retry information
   */
  static getRetryInfo(
    error: any,
    attemptNumber: number,
    platform: string = 'default'
  ): {
    classification: ErrorClassification;
    retryDecision: ReturnType<typeof RetryStrategyService.shouldRetry>;
    config: RetryConfig;
  } {
    return {
      classification: this.classifyError(error),
      retryDecision: this.shouldRetry(error, attemptNumber, platform),
      config: this.getRetryConfig(platform),
    };
  }
}

// Export types and default configurations
export { RetryStrategyService as default };
export const DEFAULT_RETRY_CONFIG = RetryStrategyService.DEFAULT_CONFIG;
export const PLATFORM_RETRY_CONFIGS = RetryStrategyService.PLATFORM_CONFIGS;