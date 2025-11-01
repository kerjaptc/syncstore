/**
 * Retry mechanism with exponential backoff and jitter
 */

import { RetryConfig } from './types';
import { AppError } from './app-error';
import { isRetryableError } from './utils';
import { getLogger } from './logger';

export interface RetryOptions extends Partial<RetryConfig> {
  onRetry?: (error: unknown, attempt: number) => void;
  shouldRetry?: (error: unknown) => boolean;
}

export class RetryManager {
  private logger = getLogger('retry-manager');

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const config: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      ...options
    };

    let lastError: unknown;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 1) {
          this.logger.info(`Operation succeeded after ${attempt} attempts`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if we should retry this error
        const shouldRetry = options.shouldRetry 
          ? options.shouldRetry(error)
          : this.shouldRetryError(error);

        if (!shouldRetry || attempt === config.maxAttempts) {
          this.logger.error(`Operation failed after ${attempt} attempts`, error instanceof Error ? error : undefined, {
            attempt,
            maxAttempts: config.maxAttempts,
            finalAttempt: true
          });
          throw error;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, config);
        
        this.logger.warn(`Operation failed, retrying in ${delay}ms (attempt ${attempt}/${config.maxAttempts})`, error instanceof Error ? error : undefined);

        // Call retry callback if provided
        if (options.onRetry) {
          options.onRetry(error, attempt);
        }

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError;
  }

  /**
   * Determine if an error should be retried
   */
  private shouldRetryError(error: unknown): boolean {
    // Don't retry AppErrors that are explicitly marked as non-retryable
    if (error instanceof AppError) {
      return error.retryable;
    }

    // For tests and generic errors, default to retryable
    // In production, you might want to be more selective
    return true;
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    // Calculate exponential backoff
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay limit
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
    
    // Add jitter if enabled
    if (config.jitter) {
      // Add random jitter up to 25% of the delay
      const jitterAmount = cappedDelay * 0.25;
      const jitter = Math.random() * jitterAmount;
      return Math.floor(cappedDelay + jitter);
    }
    
    return cappedDelay;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global retry manager instance
let globalRetryManager: RetryManager | null = null;

/**
 * Get global retry manager instance
 */
export function getRetryManager(): RetryManager {
  if (!globalRetryManager) {
    globalRetryManager = new RetryManager();
  }
  return globalRetryManager;
}

/**
 * Convenience function to retry an operation
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  return getRetryManager().execute(fn, options);
}

/**
 * Decorator for adding retry logic to methods
 */
export function retryable(options?: RetryOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return retry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Create a retryable version of a function
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: RetryOptions
): T {
  return (async (...args: any[]) => {
    return retry(() => fn(...args), options);
  }) as T;
}