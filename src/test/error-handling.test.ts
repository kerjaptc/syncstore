/**
 * Error handling system tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AppError } from '@/lib/error-handling/app-error';
import { ErrorType, ErrorSeverity } from '@/lib/error-handling/types';
import { Logger } from '@/lib/error-handling/logger';
import { CircuitBreaker } from '@/lib/error-handling/circuit-breaker';
import { RetryManager } from '@/lib/error-handling/retry';

describe('Error Handling System', () => {
  describe('AppError', () => {
    it('should create a validation error', () => {
      const error = AppError.validation('Invalid input', { field: 'email' });
      
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.retryable).toBe(false);
      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should create a platform API error', () => {
      const error = AppError.platformApi('API failed', 'shopee', 500);
      
      expect(error.type).toBe(ErrorType.PLATFORM_API_ERROR);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.retryable).toBe(true);
      expect(error.details?.platform).toBe('shopee');
      expect(error.details?.statusCode).toBe(500);
    });

    it('should determine if error should alert', () => {
      const lowError = AppError.validation('Invalid input');
      const highError = AppError.authentication('Auth failed');
      
      expect(lowError.shouldAlert()).toBe(false);
      expect(highError.shouldAlert()).toBe(true);
    });

    it('should calculate retry delay', () => {
      const retryableError = AppError.network('Connection failed');
      const nonRetryableError = AppError.validation('Invalid input');
      
      expect(retryableError.getRetryDelay(1)).toBeGreaterThan(0);
      expect(nonRetryableError.getRetryDelay(1)).toBe(0);
    });
  });

  describe('Logger', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({
        component: 'test',
        enableConsole: false,
        enableFile: false,
        enableRemote: false
      });
    });

    it('should create child logger', () => {
      const childLogger = logger.child({ component: 'child-test' });
      expect(childLogger).toBeInstanceOf(Logger);
    });

    it('should log messages without throwing', () => {
      expect(() => {
        logger.info('Test message');
        logger.warn('Test warning');
        logger.error('Test error', new Error('Test'));
      }).not.toThrow();
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker('test-circuit', {
        failureThreshold: 2,
        recoveryTimeout: 1000
      });
    });

    it('should start in closed state', () => {
      const state = circuitBreaker.getState();
      expect(state.state).toBe('closed');
      expect(state.failureCount).toBe(0);
    });

    it('should execute successful operations', async () => {
      const result = await circuitBreaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should handle failures and open circuit', async () => {
      // First failure
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Test failure');
        });
      } catch (error) {
        // Expected
      }

      // Second failure should open circuit
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Test failure');
        });
      } catch (error) {
        // Expected
      }

      const state = circuitBreaker.getState();
      expect(state.state).toBe('open');
    });
  });

  describe('RetryManager', () => {
    let retryManager: RetryManager;

    beforeEach(() => {
      retryManager = new RetryManager();
    });

    it('should execute successful operations without retry', async () => {
      let attempts = 0;
      const result = await retryManager.execute(async () => {
        attempts++;
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should retry failed operations', async () => {
      let attempts = 0;
      const result = await retryManager.execute(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        },
        { maxAttempts: 3, baseDelay: 10 }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should fail after max attempts', async () => {
      let attempts = 0;
      
      await expect(
        retryManager.execute(
          async () => {
            attempts++;
            throw new Error('Persistent failure');
          },
          { maxAttempts: 2, baseDelay: 10 }
        )
      ).rejects.toThrow('Persistent failure');

      expect(attempts).toBe(2);
    });
  });
});