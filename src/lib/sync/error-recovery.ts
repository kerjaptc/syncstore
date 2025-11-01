/**
 * Error Recovery System
 * Handles sync error recovery with dead letter queues and retry strategies
 */

export interface SyncError {
  id: string;
  jobId: string;
  jobType: string;
  organizationId: string;
  storeId?: string;
  errorType: ErrorType;
  errorCode?: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: ErrorResolution;
}

export enum ErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  RATE_LIMIT = 'rate_limit',
  VALIDATION = 'validation',
  PLATFORM_ERROR = 'platform_error',
  DATA_CONFLICT = 'data_conflict',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

export enum ErrorResolution {
  RETRY = 'retry',
  SKIP = 'skip',
  MANUAL_FIX = 'manual_fix',
  ESCALATE = 'escalate'
}

export interface RetryStrategy {
  type: 'fixed' | 'exponential' | 'linear';
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  backoffMultiplier?: number;
}

export interface DeadLetterQueueItem {
  id: string;
  originalJobId: string;
  error: SyncError;
  attempts: number;
  lastAttemptAt: Date;
  createdAt: Date;
  processedAt?: Date;
  status: 'pending' | 'processing' | 'resolved' | 'abandoned';
}

export class ErrorRecoverySystem {
  private errors: Map<string, SyncError> = new Map();
  private deadLetterQueue: Map<string, DeadLetterQueueItem> = new Map();
  private retryStrategies: Map<ErrorType, RetryStrategy> = new Map();
  private errorHandlers: Map<ErrorType, (error: SyncError) => Promise<ErrorResolution>> = new Map();

  constructor() {
    this.initializeDefaultStrategies();
    this.initializeDefaultHandlers();
  }

  /**
   * Initialize default retry strategies for different error types
   */
  private initializeDefaultStrategies(): void {
    this.retryStrategies.set(ErrorType.NETWORK, {
      type: 'exponential',
      baseDelay: 1000,
      maxDelay: 60000,
      jitter: true,
      backoffMultiplier: 2,
    });

    this.retryStrategies.set(ErrorType.RATE_LIMIT, {
      type: 'exponential',
      baseDelay: 5000,
      maxDelay: 300000,
      jitter: true,
      backoffMultiplier: 2,
    });

    this.retryStrategies.set(ErrorType.TIMEOUT, {
      type: 'linear',
      baseDelay: 2000,
      maxDelay: 30000,
      jitter: false,
    });

    this.retryStrategies.set(ErrorType.PLATFORM_ERROR, {
      type: 'exponential',
      baseDelay: 2000,
      maxDelay: 120000,
      jitter: true,
      backoffMultiplier: 1.5,
    });
  }

  /**
   * Initialize default error handlers
   */
  private initializeDefaultHandlers(): void {
    this.errorHandlers.set(ErrorType.AUTHENTICATION, async (error) => {
      // Authentication errors usually require manual intervention
      return ErrorResolution.MANUAL_FIX;
    });

    this.errorHandlers.set(ErrorType.AUTHORIZATION, async (error) => {
      // Authorization errors might be temporary or require manual fix
      return error.retryCount < 2 ? ErrorResolution.RETRY : ErrorResolution.MANUAL_FIX;
    });

    this.errorHandlers.set(ErrorType.VALIDATION, async (error) => {
      // Validation errors usually don't resolve with retries
      return ErrorResolution.MANUAL_FIX;
    });

    this.errorHandlers.set(ErrorType.DATA_CONFLICT, async (error) => {
      // Data conflicts might resolve with retries or need manual resolution
      return error.retryCount < 3 ? ErrorResolution.RETRY : ErrorResolution.MANUAL_FIX;
    });
  }

  /**
   * Record a sync error
   */
  async recordError(
    jobId: string,
    jobType: string,
    organizationId: string,
    error: Error,
    context?: Record<string, any>,
    storeId?: string
  ): Promise<SyncError> {
    const errorType = this.classifyError(error);
    const maxRetries = this.getMaxRetries(errorType);

    const syncError: SyncError = {
      id: this.generateErrorId(),
      jobId,
      jobType,
      organizationId,
      storeId,
      errorType,
      errorCode: (error as any).code,
      message: error.message,
      stack: error.stack,
      context,
      retryCount: 0,
      maxRetries,
      createdAt: new Date(),
    };

    this.errors.set(syncError.id, syncError);

    // Determine next action
    const resolution = await this.determineResolution(syncError);
    syncError.resolution = resolution;

    if (resolution === ErrorResolution.RETRY) {
      syncError.nextRetryAt = this.calculateNextRetry(syncError);
    } else if (resolution === ErrorResolution.ESCALATE) {
      await this.moveToDeadLetterQueue(syncError);
    }

    return syncError;
  }

  /**
   * Classify error type based on error properties
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const code = (error as any).code;

    if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || message.includes('network')) {
      return ErrorType.NETWORK;
    }

    if (message.includes('unauthorized') || message.includes('authentication')) {
      return ErrorType.AUTHENTICATION;
    }

    if (message.includes('forbidden') || message.includes('permission')) {
      return ErrorType.AUTHORIZATION;
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return ErrorType.RATE_LIMIT;
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION;
    }

    if (message.includes('timeout') || code === 'ETIMEDOUT') {
      return ErrorType.TIMEOUT;
    }

    if (message.includes('conflict') || message.includes('duplicate')) {
      return ErrorType.DATA_CONFLICT;
    }

    if (message.includes('platform') || message.includes('api error')) {
      return ErrorType.PLATFORM_ERROR;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Get maximum retries for error type
   */
  private getMaxRetries(errorType: ErrorType): number {
    switch (errorType) {
      case ErrorType.NETWORK:
      case ErrorType.TIMEOUT:
      case ErrorType.RATE_LIMIT:
        return 5;
      case ErrorType.PLATFORM_ERROR:
      case ErrorType.DATA_CONFLICT:
        return 3;
      case ErrorType.AUTHENTICATION:
      case ErrorType.AUTHORIZATION:
        return 2;
      case ErrorType.VALIDATION:
        return 1;
      default:
        return 3;
    }
  }

  /**
   * Determine resolution strategy for error
   */
  private async determineResolution(error: SyncError): Promise<ErrorResolution> {
    const handler = this.errorHandlers.get(error.errorType);
    
    if (handler) {
      return await handler(error);
    }

    // Default resolution logic
    if (error.retryCount >= error.maxRetries) {
      return ErrorResolution.ESCALATE;
    }

    return ErrorResolution.RETRY;
  }

  /**
   * Calculate next retry time
   */
  private calculateNextRetry(error: SyncError): Date {
    const strategy = this.retryStrategies.get(error.errorType) || {
      type: 'exponential',
      baseDelay: 1000,
      maxDelay: 60000,
      jitter: true,
      backoffMultiplier: 2,
    };

    let delay: number;

    switch (strategy.type) {
      case 'fixed':
        delay = strategy.baseDelay;
        break;
      case 'linear':
        delay = strategy.baseDelay * (error.retryCount + 1);
        break;
      case 'exponential':
      default:
        const multiplier = strategy.backoffMultiplier || 2;
        delay = strategy.baseDelay * Math.pow(multiplier, error.retryCount);
        break;
    }

    // Apply maximum delay limit
    delay = Math.min(delay, strategy.maxDelay);

    // Apply jitter if enabled
    if (strategy.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return new Date(Date.now() + delay);
  }

  /**
   * Move error to dead letter queue
   */
  private async moveToDeadLetterQueue(error: SyncError): Promise<void> {
    const dlqItem: DeadLetterQueueItem = {
      id: this.generateDLQId(),
      originalJobId: error.jobId,
      error,
      attempts: 0,
      lastAttemptAt: new Date(),
      createdAt: new Date(),
      status: 'pending',
    };

    this.deadLetterQueue.set(dlqItem.id, dlqItem);
    console.warn(`Error moved to dead letter queue: ${error.id}`);
  }

  /**
   * Retry a failed error
   */
  async retryError(errorId: string): Promise<boolean> {
    const error = this.errors.get(errorId);
    if (!error) return false;

    if (error.retryCount >= error.maxRetries) {
      await this.moveToDeadLetterQueue(error);
      return false;
    }

    error.retryCount++;
    error.nextRetryAt = this.calculateNextRetry(error);

    // Determine if we should continue retrying
    const resolution = await this.determineResolution(error);
    error.resolution = resolution;

    if (resolution === ErrorResolution.ESCALATE) {
      await this.moveToDeadLetterQueue(error);
      return false;
    }

    return true;
  }

  /**
   * Resolve an error
   */
  resolveError(errorId: string, resolution: ErrorResolution): boolean {
    const error = this.errors.get(errorId);
    if (!error) return false;

    error.resolvedAt = new Date();
    error.resolution = resolution;

    return true;
  }

  /**
   * Get errors ready for retry
   */
  getErrorsReadyForRetry(): SyncError[] {
    const now = new Date();
    return Array.from(this.errors.values()).filter(
      error => 
        !error.resolvedAt &&
        error.nextRetryAt &&
        error.nextRetryAt <= now &&
        error.retryCount < error.maxRetries
    );
  }

  /**
   * Get dead letter queue items
   */
  getDeadLetterQueueItems(status?: DeadLetterQueueItem['status']): DeadLetterQueueItem[] {
    const items = Array.from(this.deadLetterQueue.values());
    
    if (status) {
      return items.filter(item => item.status === status);
    }

    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Process dead letter queue item
   */
  async processDLQItem(itemId: string): Promise<boolean> {
    const item = this.deadLetterQueue.get(itemId);
    if (!item || item.status !== 'pending') return false;

    item.status = 'processing';
    item.attempts++;
    item.lastAttemptAt = new Date();

    try {
      // Attempt to reprocess the original job
      // This would typically involve recreating the sync job
      console.log(`Processing DLQ item: ${itemId} for job: ${item.originalJobId}`);
      
      // Mark as resolved if successful
      item.status = 'resolved';
      item.processedAt = new Date();
      
      return true;
    } catch (error) {
      // If processing fails multiple times, abandon the item
      if (item.attempts >= 3) {
        item.status = 'abandoned';
        console.error(`Abandoning DLQ item ${itemId} after ${item.attempts} attempts`);
      } else {
        item.status = 'pending';
      }
      
      return false;
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(organizationId?: string): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsByResolution: Record<ErrorResolution, number>;
    retrySuccessRate: number;
    dlqSize: number;
    averageRetryCount: number;
  } {
    let errors = Array.from(this.errors.values());
    
    if (organizationId) {
      errors = errors.filter(e => e.organizationId === organizationId);
    }

    const errorsByType: Record<ErrorType, number> = {} as any;
    const errorsByResolution: Record<ErrorResolution, number> = {} as any;
    let totalRetries = 0;
    let resolvedErrors = 0;

    for (const error of errors) {
      // Count by type
      errorsByType[error.errorType] = (errorsByType[error.errorType] || 0) + 1;
      
      // Count by resolution
      if (error.resolution) {
        errorsByResolution[error.resolution] = (errorsByResolution[error.resolution] || 0) + 1;
      }
      
      totalRetries += error.retryCount;
      
      if (error.resolvedAt) {
        resolvedErrors++;
      }
    }

    const retrySuccessRate = errors.length > 0 ? (resolvedErrors / errors.length) * 100 : 0;
    const averageRetryCount = errors.length > 0 ? totalRetries / errors.length : 0;

    return {
      totalErrors: errors.length,
      errorsByType,
      errorsByResolution,
      retrySuccessRate,
      dlqSize: this.deadLetterQueue.size,
      averageRetryCount,
    };
  }

  /**
   * Clean up old resolved errors
   */
  cleanup(olderThanDays: number = 7): { deletedErrors: number; deletedDLQItems: number } {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let deletedErrors = 0;
    let deletedDLQItems = 0;

    // Clean resolved errors
    for (const [id, error] of this.errors) {
      if (error.resolvedAt && error.resolvedAt < cutoff) {
        this.errors.delete(id);
        deletedErrors++;
      }
    }

    // Clean resolved DLQ items
    for (const [id, item] of this.deadLetterQueue) {
      if (item.processedAt && item.processedAt < cutoff && item.status === 'resolved') {
        this.deadLetterQueue.delete(id);
        deletedDLQItems++;
      }
    }

    return { deletedErrors, deletedDLQItems };
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique DLQ ID
   */
  private generateDLQId(): string {
    return `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set custom retry strategy for error type
   */
  setRetryStrategy(errorType: ErrorType, strategy: RetryStrategy): void {
    this.retryStrategies.set(errorType, strategy);
  }

  /**
   * Set custom error handler
   */
  setErrorHandler(
    errorType: ErrorType, 
    handler: (error: SyncError) => Promise<ErrorResolution>
  ): void {
    this.errorHandlers.set(errorType, handler);
  }
}

// Global error recovery system instance
export const errorRecoverySystem = new ErrorRecoverySystem();