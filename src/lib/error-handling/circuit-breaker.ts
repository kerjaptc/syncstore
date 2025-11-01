/**
 * Circuit breaker implementation for error recovery
 */

import { CircuitBreakerState } from './types';
import { AppError } from './app-error';
import { getLogger } from './logger';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: string[];
}

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;
  private logger = getLogger('circuit-breaker');

  constructor(
    private name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 10000, // 10 seconds
      expectedErrors: [],
      ...config
    };

    this.state = {
      state: 'closed',
      failureCount: 0,
      successCount: 0
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state.state = 'half-open';
        this.state.successCount = 0;
        this.logger.info(`Circuit breaker ${this.name} transitioning to half-open`);
      } else {
        throw AppError.internal(
          `Circuit breaker ${this.name} is open`,
          {
            circuitBreakerState: this.state,
            nextAttemptTime: this.state.nextAttemptTime
          }
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state.state === 'half-open') {
      this.state.successCount = (this.state.successCount || 0) + 1;
      
      // If we've had enough successes, close the circuit
      if (this.state.successCount >= 3) {
        this.state.state = 'closed';
        this.state.failureCount = 0;
        this.state.lastFailureTime = undefined;
        this.state.nextAttemptTime = undefined;
        this.logger.info(`Circuit breaker ${this.name} closed after successful recovery`);
      }
    } else if (this.state.state === 'closed') {
      // Reset failure count on success
      this.state.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: unknown): void {
    // Check if this is an expected error that shouldn't trigger the circuit breaker
    if (this.isExpectedError(error)) {
      return;
    }

    this.state.failureCount++;
    this.state.lastFailureTime = new Date();

    if (this.state.state === 'half-open') {
      // If we fail in half-open state, go back to open
      this.openCircuit();
    } else if (this.state.state === 'closed' && this.state.failureCount >= this.config.failureThreshold) {
      // If we've exceeded the failure threshold, open the circuit
      this.openCircuit();
    }

    this.logger.warn(`Circuit breaker ${this.name} recorded failure (${this.state.failureCount}/${this.config.failureThreshold})`);
  }

  /**
   * Open the circuit breaker
   */
  private openCircuit(): void {
    this.state.state = 'open';
    this.state.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    
    this.logger.error(`Circuit breaker ${this.name} opened`);
  }

  /**
   * Check if we should attempt to reset the circuit breaker
   */
  private shouldAttemptReset(): boolean {
    return this.state.nextAttemptTime ? Date.now() >= this.state.nextAttemptTime.getTime() : false;
  }

  /**
   * Check if an error is expected and shouldn't trigger the circuit breaker
   */
  private isExpectedError(error: unknown): boolean {
    if (!this.config.expectedErrors || this.config.expectedErrors.length === 0) {
      return false;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : '';

    return this.config.expectedErrors.some(expectedError => 
      errorMessage.includes(expectedError) || errorName.includes(expectedError)
    );
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = {
      state: 'closed',
      failureCount: 0,
      successCount: 0
    };
    
    this.logger.info(`Circuit breaker ${this.name} manually reset`);
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics(): {
    name: string;
    state: string;
    failureCount: number;
    successCount: number;
    lastFailureTime?: Date;
    nextAttemptTime?: Date;
    config: CircuitBreakerConfig;
  } {
    return {
      name: this.name,
      state: this.state.state,
      failureCount: this.state.failureCount,
      successCount: this.state.successCount || 0,
      lastFailureTime: this.state.lastFailureTime,
      nextAttemptTime: this.state.nextAttemptTime,
      config: this.config
    };
  }
}

// Global circuit breaker registry
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a specific operation
 */
export function getCircuitBreaker(
  name: string, 
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, config));
  }
  
  return circuitBreakers.get(name)!;
}

/**
 * Get all circuit breaker metrics
 */
export function getAllCircuitBreakerMetrics(): Array<ReturnType<CircuitBreaker['getMetrics']>> {
  return Array.from(circuitBreakers.values()).map(cb => cb.getMetrics());
}