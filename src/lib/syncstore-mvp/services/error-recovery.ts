/**
 * SyncStore MVP Error Recovery System
 * 
 * This service provides intelligent error recovery mechanisms with
 * automatic retry logic, fallback strategies, and recovery workflows.
 */

import {
  SyncStoreError,
  ShopeeApiError,
  ValidationError,
  ConnectionError,
  SyncError,
  DatabaseError,
  createErrorContext,
  retryWithBackoff,
  CircuitBreaker,
} from '../index';
import { getErrorLoggingService } from './error-logging';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  type: 'retry' | 'fallback' | 'circuit-breaker' | 'manual' | 'escalation';
  priority: number;
  conditions: RecoveryCondition[];
  action: RecoveryAction;
  config: RecoveryConfig;
}

export interface RecoveryCondition {
  type: 'error-type' | 'error-message' | 'context' | 'retry-count' | 'time-window';
  operator: 'equals' | 'contains' | 'matches' | 'greater-than' | 'less-than';
  value: any;
}

export interface RecoveryAction {
  type: 'function' | 'service-call' | 'redirect' | 'notification' | 'escalation';
  handler: (context: RecoveryContext) => Promise<RecoveryResult>;
  timeout?: number;
  retries?: number;
}

export interface RecoveryConfig {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

export interface RecoveryContext {
  error: Error;
  errorId: string;
  attempt: number;
  maxAttempts: number;
  previousAttempts: RecoveryAttempt[];
  metadata: Record<string, any>;
  startTime: Date;
  timeoutAt?: Date;
}

export interface RecoveryAttempt {
  id: string;
  strategyId: string;
  startTime: Date;
  endTime?: Date;
  success: boolean;
  error?: Error;
  result?: any;
  metadata: Record<string, any>;
}

export interface RecoveryResult {
  success: boolean;
  recovered: boolean;
  result?: any;
  error?: Error;
  nextStrategy?: string;
  metadata?: Record<string, any>;
}

export interface RecoverySession {
  id: string;
  errorId: string;
  error: Error;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  attempts: RecoveryAttempt[];
  finalResult?: RecoveryResult;
  metadata: Record<string, any>;
}

// ============================================================================
// Built-in Recovery Strategies
// ============================================================================

class BuiltInStrategies {
  /**
   * Simple retry strategy with exponential backoff
   */
  static createRetryStrategy(config?: Partial<RecoveryConfig>): RecoveryStrategy {
    return {
      id: 'retry-exponential',
      name: 'Exponential Backoff Retry',
      description: 'Retries the operation with exponential backoff',
      type: 'retry',
      priority: 1,
      conditions: [
        {
          type: 'retry-count',
          operator: 'less-than',
          value: config?.maxAttempts || 3,
        },
      ],
      action: {
        type: 'function',
        handler: async (context: RecoveryContext) => {
          const delay = Math.min(
            (config?.baseDelay || 1000) * Math.pow(2, context.attempt),
            config?.maxDelay || 30000
          );

          await new Promise(resolve => setTimeout(resolve, delay));

          // The actual retry logic would be implemented by the caller
          return {
            success: true,
            recovered: false, // Will be determined by the actual operation
            metadata: { delay, attempt: context.attempt },
          };
        },
      },
      config: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelay: 1000,
        maxDelay: 30000,
        jitter: true,
        ...config,
      },
    };
  }

  /**
   * API token refresh strategy
   */
  static createTokenRefreshStrategy(): RecoveryStrategy {
    return {
      id: 'token-refresh',
      name: 'API Token Refresh',
      description: 'Refreshes expired API tokens',
      type: 'fallback',
      priority: 2,
      conditions: [
        {
          type: 'error-type',
          operator: 'equals',
          value: 'ShopeeApiError',
        },
        {
          type: 'context',
          operator: 'equals',
          value: { isTokenExpired: true },
        },
      ],
      action: {
        type: 'service-call',
        handler: async (context: RecoveryContext) => {
          try {
            // This would call the actual token refresh service
            console.log('🔄 Attempting to refresh API tokens...');
            
            // Simulate token refresh
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            return {
              success: true,
              recovered: true,
              metadata: { tokenRefreshed: true },
            };
          } catch (error) {
            return {
              success: false,
              recovered: false,
              error: error as Error,
            };
          }
        },
        timeout: 10000,
      },
      config: {
        maxAttempts: 1,
        backoffStrategy: 'fixed',
        baseDelay: 0,
        maxDelay: 0,
        jitter: false,
      },
    };
  }

  /**
   * Database connection recovery strategy
   */
  static createDatabaseRecoveryStrategy(): RecoveryStrategy {
    return {
      id: 'database-recovery',
      name: 'Database Connection Recovery',
      description: 'Attempts to recover database connections',
      type: 'fallback',
      priority: 3,
      conditions: [
        {
          type: 'error-type',
          operator: 'equals',
          value: 'DatabaseError',
        },
      ],
      action: {
        type: 'service-call',
        handler: async (context: RecoveryContext) => {
          try {
            console.log('🔄 Attempting to recover database connection...');
            
            // This would call the actual database recovery service
            // await databaseService.reconnect();
            
            return {
              success: true,
              recovered: true,
              metadata: { connectionRecovered: true },
            };
          } catch (error) {
            return {
              success: false,
              recovered: false,
              error: error as Error,
            };
          }
        },
        timeout: 15000,
      },
      config: {
        maxAttempts: 2,
        backoffStrategy: 'linear',
        baseDelay: 5000,
        maxDelay: 10000,
        jitter: false,
      },
    };
  }

  /**
   * Sync fallback strategy
   */
  static createSyncFallbackStrategy(): RecoveryStrategy {
    return {
      id: 'sync-fallback',
      name: 'Sync Fallback Mode',
      description: 'Falls back to manual sync mode',
      type: 'fallback',
      priority: 4,
      conditions: [
        {
          type: 'error-type',
          operator: 'equals',
          value: 'SyncError',
        },
        {
          type: 'retry-count',
          operator: 'greater-than',
          value: 2,
        },
      ],
      action: {
        type: 'service-call',
        handler: async (context: RecoveryContext) => {
          try {
            console.log('🔄 Switching to manual sync mode...');
            
            // This would disable automatic sync and enable manual mode
            // await syncService.enableManualMode(storeId);
            
            return {
              success: true,
              recovered: true,
              metadata: { manualModeEnabled: true },
            };
          } catch (error) {
            return {
              success: false,
              recovered: false,
              error: error as Error,
            };
          }
        },
      },
      config: {
        maxAttempts: 1,
        backoffStrategy: 'fixed',
        baseDelay: 0,
        maxDelay: 0,
        jitter: false,
      },
    };
  }

  /**
   * Circuit breaker strategy
   */
  static createCircuitBreakerStrategy(): RecoveryStrategy {
    return {
      id: 'circuit-breaker',
      name: 'Circuit Breaker',
      description: 'Temporarily stops operations to prevent cascade failures',
      type: 'circuit-breaker',
      priority: 5,
      conditions: [
        {
          type: 'retry-count',
          operator: 'greater-than',
          value: 5,
        },
      ],
      action: {
        type: 'function',
        handler: async (context: RecoveryContext) => {
          console.log('⚡ Circuit breaker activated - stopping operations temporarily');
          
          // This would activate the circuit breaker
          return {
            success: true,
            recovered: false,
            metadata: { circuitBreakerActivated: true },
          };
        },
      },
      config: {
        maxAttempts: 1,
        backoffStrategy: 'fixed',
        baseDelay: 0,
        maxDelay: 0,
        jitter: false,
        circuitBreakerThreshold: 5,
        circuitBreakerTimeout: 300000, // 5 minutes
      },
    };
  }
}

// ============================================================================
// Error Recovery Service
// ============================================================================

export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private strategies = new Map<string, RecoveryStrategy>();
  private activeSessions = new Map<string, RecoverySession>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private loggingService = getErrorLoggingService();

  private constructor() {
    this.initializeBuiltInStrategies();
  }

  static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  // ============================================================================
  // Strategy Management
  // ============================================================================

  /**
   * Registers a recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.id, strategy);
    console.log(`📋 Registered recovery strategy: ${strategy.name}`);
  }

  /**
   * Unregisters a recovery strategy
   */
  unregisterStrategy(strategyId: string): boolean {
    const removed = this.strategies.delete(strategyId);
    if (removed) {
      console.log(`🗑️  Unregistered recovery strategy: ${strategyId}`);
    }
    return removed;
  }

  /**
   * Gets all registered strategies
   */
  getStrategies(): RecoveryStrategy[] {
    return Array.from(this.strategies.values())
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Gets applicable strategies for an error
   */
  getApplicableStrategies(error: Error, context: Record<string, any> = {}): RecoveryStrategy[] {
    return this.getStrategies().filter(strategy => 
      this.evaluateConditions(strategy.conditions, error, context)
    );
  }

  // ============================================================================
  // Recovery Execution
  // ============================================================================

  /**
   * Attempts to recover from an error
   */
  async recover(
    error: Error,
    context: Record<string, any> = {},
    options?: {
      maxAttempts?: number;
      timeout?: number;
      strategies?: string[];
    }
  ): Promise<RecoveryResult> {
    const errorId = await this.loggingService.logError(error, context);
    const sessionId = this.generateSessionId();

    const session: RecoverySession = {
      id: sessionId,
      errorId,
      error,
      startTime: new Date(),
      status: 'active',
      attempts: [],
      metadata: { ...context, options },
    };

    this.activeSessions.set(sessionId, session);

    try {
      console.log(`🔄 Starting recovery session ${sessionId} for error: ${error.message}`);

      // Get applicable strategies
      let strategies = this.getApplicableStrategies(error, context);
      
      // Filter by requested strategies if specified
      if (options?.strategies) {
        strategies = strategies.filter(s => options.strategies!.includes(s.id));
      }

      if (strategies.length === 0) {
        console.log('❌ No applicable recovery strategies found');
        session.status = 'failed';
        session.endTime = new Date();
        return {
          success: false,
          recovered: false,
          error: new Error('No applicable recovery strategies found'),
        };
      }

      console.log(`📋 Found ${strategies.length} applicable strategies:`, 
        strategies.map(s => s.name).join(', '));

      // Execute strategies in priority order
      for (const strategy of strategies) {
        if (session.attempts.length >= (options?.maxAttempts || 10)) {
          console.log('⚠️  Maximum recovery attempts reached');
          break;
        }

        // Check timeout
        if (options?.timeout && Date.now() - session.startTime.getTime() > options.timeout) {
          console.log('⏰ Recovery timeout reached');
          session.status = 'timeout';
          break;
        }

        // Check circuit breaker
        if (this.isCircuitBreakerOpen(strategy.id)) {
          console.log(`⚡ Circuit breaker open for strategy: ${strategy.name}`);
          continue;
        }

        const result = await this.executeStrategy(strategy, session);
        
        if (result.success && result.recovered) {
          console.log(`✅ Recovery successful with strategy: ${strategy.name}`);
          session.status = 'completed';
          session.endTime = new Date();
          session.finalResult = result;
          return result;
        }

        if (result.nextStrategy) {
          const nextStrategy = this.strategies.get(result.nextStrategy);
          if (nextStrategy) {
            strategies.push(nextStrategy);
          }
        }
      }

      // If we get here, all strategies failed
      console.log('❌ All recovery strategies failed');
      session.status = 'failed';
      session.endTime = new Date();

      return {
        success: false,
        recovered: false,
        error: new Error('All recovery strategies failed'),
        metadata: { attempts: session.attempts.length },
      };

    } catch (recoveryError) {
      console.error('💥 Recovery process failed:', recoveryError);
      session.status = 'failed';
      session.endTime = new Date();

      return {
        success: false,
        recovered: false,
        error: recoveryError as Error,
      };
    } finally {
      // Clean up session after some time
      setTimeout(() => {
        this.activeSessions.delete(sessionId);
      }, 300000); // 5 minutes
    }
  }

  /**
   * Cancels an active recovery session
   */
  cancelRecovery(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return false;
    }

    session.status = 'cancelled';
    session.endTime = new Date();
    console.log(`🛑 Cancelled recovery session: ${sessionId}`);
    
    return true;
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Gets active recovery sessions
   */
  getActiveSessions(): RecoverySession[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.status === 'active');
  }

  /**
   * Gets recovery session by ID
   */
  getSession(sessionId: string): RecoverySession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Gets recovery statistics
   */
  getRecoveryStatistics(): {
    totalSessions: number;
    activeSessions: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    averageRecoveryTime: number;
    strategySuccessRates: Record<string, { attempts: number; successes: number; rate: number }>;
  } {
    const sessions = Array.from(this.activeSessions.values());
    const completedSessions = sessions.filter(s => s.status === 'completed' || s.status === 'failed');
    const successfulSessions = sessions.filter(s => s.status === 'completed');

    let totalRecoveryTime = 0;
    const strategyStats: Record<string, { attempts: number; successes: number }> = {};

    for (const session of completedSessions) {
      if (session.endTime) {
        totalRecoveryTime += session.endTime.getTime() - session.startTime.getTime();
      }

      for (const attempt of session.attempts) {
        if (!strategyStats[attempt.strategyId]) {
          strategyStats[attempt.strategyId] = { attempts: 0, successes: 0 };
        }
        strategyStats[attempt.strategyId].attempts++;
        if (attempt.success) {
          strategyStats[attempt.strategyId].successes++;
        }
      }
    }

    const strategySuccessRates: Record<string, { attempts: number; successes: number; rate: number }> = {};
    for (const [strategyId, stats] of Object.entries(strategyStats)) {
      strategySuccessRates[strategyId] = {
        ...stats,
        rate: stats.attempts > 0 ? stats.successes / stats.attempts : 0,
      };
    }

    return {
      totalSessions: sessions.length,
      activeSessions: this.getActiveSessions().length,
      successfulRecoveries: successfulSessions.length,
      failedRecoveries: sessions.filter(s => s.status === 'failed').length,
      averageRecoveryTime: completedSessions.length > 0 ? totalRecoveryTime / completedSessions.length : 0,
      strategySuccessRates,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private initializeBuiltInStrategies(): void {
    this.registerStrategy(BuiltInStrategies.createRetryStrategy());
    this.registerStrategy(BuiltInStrategies.createTokenRefreshStrategy());
    this.registerStrategy(BuiltInStrategies.createDatabaseRecoveryStrategy());
    this.registerStrategy(BuiltInStrategies.createSyncFallbackStrategy());
    this.registerStrategy(BuiltInStrategies.createCircuitBreakerStrategy());
  }

  private generateSessionId(): string {
    return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private evaluateConditions(
    conditions: RecoveryCondition[],
    error: Error,
    context: Record<string, any>
  ): boolean {
    return conditions.every(condition => this.evaluateCondition(condition, error, context));
  }

  private evaluateCondition(
    condition: RecoveryCondition,
    error: Error,
    context: Record<string, any>
  ): boolean {
    let actualValue: any;

    switch (condition.type) {
      case 'error-type':
        actualValue = error.constructor.name;
        break;
      case 'error-message':
        actualValue = error.message;
        break;
      case 'context':
        actualValue = context[Object.keys(condition.value)[0]];
        break;
      case 'retry-count':
        actualValue = context.retryCount || 0;
        break;
      case 'time-window':
        actualValue = Date.now() - (context.startTime || Date.now());
        break;
      default:
        return false;
    }

    switch (condition.operator) {
      case 'equals':
        return actualValue === condition.value;
      case 'contains':
        return String(actualValue).includes(String(condition.value));
      case 'matches':
        return new RegExp(condition.value).test(String(actualValue));
      case 'greater-than':
        return Number(actualValue) > Number(condition.value);
      case 'less-than':
        return Number(actualValue) < Number(condition.value);
      default:
        return false;
    }
  }

  private async executeStrategy(
    strategy: RecoveryStrategy,
    session: RecoverySession
  ): Promise<RecoveryResult> {
    const attemptId = this.generateAttemptId();
    const attempt: RecoveryAttempt = {
      id: attemptId,
      strategyId: strategy.id,
      startTime: new Date(),
      success: false,
      metadata: {},
    };

    session.attempts.push(attempt);

    try {
      console.log(`🔄 Executing recovery strategy: ${strategy.name}`);

      const recoveryContext: RecoveryContext = {
        error: session.error,
        errorId: session.errorId,
        attempt: session.attempts.length,
        maxAttempts: strategy.config.maxAttempts,
        previousAttempts: session.attempts.slice(0, -1),
        metadata: session.metadata,
        startTime: session.startTime,
        timeoutAt: strategy.action.timeout 
          ? new Date(Date.now() + strategy.action.timeout)
          : undefined,
      };

      // Execute with timeout if specified
      let result: RecoveryResult;
      if (strategy.action.timeout) {
        result = await Promise.race([
          strategy.action.handler(recoveryContext),
          new Promise<RecoveryResult>((_, reject) => 
            setTimeout(() => reject(new Error('Strategy timeout')), strategy.action.timeout)
          ),
        ]);
      } else {
        result = await strategy.action.handler(recoveryContext);
      }

      attempt.success = result.success;
      attempt.endTime = new Date();
      attempt.result = result.result;
      attempt.metadata = result.metadata || {};

      // Update circuit breaker
      this.updateCircuitBreaker(strategy.id, result.success);

      return result;

    } catch (error) {
      attempt.success = false;
      attempt.endTime = new Date();
      attempt.error = error as Error;

      console.error(`❌ Recovery strategy failed: ${strategy.name}`, error);

      // Update circuit breaker
      this.updateCircuitBreaker(strategy.id, false);

      return {
        success: false,
        recovered: false,
        error: error as Error,
      };
    }
  }

  private isCircuitBreakerOpen(strategyId: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(strategyId);
    return circuitBreaker ? circuitBreaker.isOpen() : false;
  }

  private updateCircuitBreaker(strategyId: string, success: boolean): void {
    let circuitBreaker = this.circuitBreakers.get(strategyId);
    
    if (!circuitBreaker) {
      const strategy = this.strategies.get(strategyId);
      if (strategy?.config.circuitBreakerThreshold) {
        circuitBreaker = new CircuitBreaker(
          strategy.config.circuitBreakerThreshold,
          strategy.config.circuitBreakerTimeout || 300000
        );
        this.circuitBreakers.set(strategyId, circuitBreaker);
      }
    }

    if (circuitBreaker) {
      if (success) {
        circuitBreaker.recordSuccess();
      } else {
        circuitBreaker.recordFailure();
      }
    }
  }
}

// ============================================================================
// Factory Functions and Utilities
// ============================================================================

/**
 * Gets the global error recovery service instance
 */
export function getErrorRecoveryService(): ErrorRecoveryService {
  return ErrorRecoveryService.getInstance();
}

/**
 * Convenience function to attempt error recovery
 */
export async function recoverFromError(
  error: Error,
  context?: Record<string, any>,
  options?: {
    maxAttempts?: number;
    timeout?: number;
    strategies?: string[];
  }
): Promise<RecoveryResult> {
  const service = getErrorRecoveryService();
  return service.recover(error, context, options);
}

/**
 * Creates a custom recovery strategy
 */
export function createRecoveryStrategy(
  id: string,
  name: string,
  description: string,
  type: RecoveryStrategy['type'],
  priority: number,
  conditions: RecoveryCondition[],
  handler: (context: RecoveryContext) => Promise<RecoveryResult>,
  config?: Partial<RecoveryConfig>
): RecoveryStrategy {
  return {
    id,
    name,
    description,
    type,
    priority,
    conditions,
    action: {
      type: 'function',
      handler,
    },
    config: {
      maxAttempts: 3,
      backoffStrategy: 'exponential',
      baseDelay: 1000,
      maxDelay: 30000,
      jitter: true,
      ...config,
    },
  };
}

/**
 * Initializes error recovery with built-in strategies
 */
export function initializeErrorRecovery(): ErrorRecoveryService {
  const service = getErrorRecoveryService();
  
  console.log('✅ Error recovery service initialized');
  console.log(`📋 Registered strategies: ${service.getStrategies().length}`);
  
  return service;
}

export default ErrorRecoveryService;