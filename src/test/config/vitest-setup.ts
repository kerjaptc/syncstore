/**
 * Advanced Vitest setup configuration for comprehensive testing
 */

import { beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { initializeTestEnvironment, cleanupTestEnvironment, getTestConfig } from './test-env';
import { cleanupTestData } from '../utils/test-helpers';

// Global test setup
beforeAll(async () => {
  console.log('🚀 Initializing test environment...');
  
  // Initialize test environment based on context
  const environment = await initializeTestEnvironment();
  const config = getTestConfig();
  
  console.log(`📋 Test Configuration:
    Environment: ${config.environment}
    Database: ${config.database.enabled ? 'enabled' : 'disabled'}
    Redis: ${config.redis.enabled ? 'enabled' : 'disabled'}
    External APIs: ${config.externalApis.enabled ? 'enabled' : 'disabled'}
    Performance Tracking: ${config.performance.enabled ? 'enabled' : 'disabled'}
    Coverage: ${config.coverage.enabled ? 'enabled' : 'disabled'}
  `);
  
  // Set global test timeout based on environment
  if (config.performance.enabled) {
    const timeout = config.performance.thresholds.maxTestDuration;
    console.log(`⏱️ Setting test timeout to ${timeout}ms`);
  }
});

// Setup before each test
beforeEach(async () => {
  const config = getTestConfig();
  
  // Reset test data if needed
  if (config.database.enabled && config.database.resetBetweenTests) {
    // Database cleanup is handled in database-helpers
  }
  
  // Performance tracking setup
  if (config.performance.enabled && typeof performance !== 'undefined') {
    const testName = expect.getState().currentTestName || 'unknown-test';
    performance.mark(`test-start-${testName}`);
  }
});

// Cleanup after each test
afterEach(async () => {
  const config = getTestConfig();
  
  // Performance tracking
  if (config.performance.enabled && typeof performance !== 'undefined') {
    const testName = expect.getState().currentTestName || 'unknown-test';
    try {
      performance.mark(`test-end-${testName}`);
      performance.measure(`test-duration-${testName}`, `test-start-${testName}`, `test-end-${testName}`);
      
      const measure = performance.getEntriesByName(`test-duration-${testName}`)[0];
      if (measure && measure.duration > config.performance.thresholds.maxTestDuration) {
        console.warn(`⚠️ Slow test detected: ${testName} took ${measure.duration.toFixed(2)}ms`);
      }
    } catch (error) {
      // Performance API might not be available
    }
  }
  
  // Memory usage check
  if (config.performance.enabled && typeof process !== 'undefined' && process.memoryUsage) {
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > config.performance.thresholds.maxMemoryUsage) {
      console.warn(`⚠️ High memory usage detected: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }
  }
  
  // Clean up test data
  cleanupTestData();
});

// Global cleanup
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
  await cleanupTestEnvironment();
  console.log('✅ Test environment cleanup complete');
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log the error
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process in tests, just log the error
});

// Export test utilities for use in test files
export * from './test-env';
export * from '../utils/test-helpers';
export * from '../utils/database-helpers';
export * from '../factories';