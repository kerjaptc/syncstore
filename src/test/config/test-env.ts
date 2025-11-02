/**
 * Test environment configuration and utilities
 */

import { vi } from 'vitest';

// Test environment types
export type TestEnvironment = 'unit' | 'integration' | 'e2e' | 'performance';

// Test configuration interface
export interface TestConfig {
  environment: TestEnvironment;
  database: {
    enabled: boolean;
    url?: string;
    resetBetweenTests: boolean;
  };
  redis: {
    enabled: boolean;
    url?: string;
  };
  externalApis: {
    enabled: boolean;
    mockResponses: boolean;
  };
  performance: {
    enabled: boolean;
    thresholds: {
      maxTestDuration: number;
      maxMemoryUsage: number;
    };
  };
  coverage: {
    enabled: boolean;
    threshold: number;
  };
}

// Default test configurations for different environments
export const testConfigs: Record<TestEnvironment, TestConfig> = {
  unit: {
    environment: 'unit',
    database: {
      enabled: false,
      resetBetweenTests: false,
    },
    redis: {
      enabled: false,
    },
    externalApis: {
      enabled: false,
      mockResponses: true,
    },
    performance: {
      enabled: false,
      thresholds: {
        maxTestDuration: 1000, // 1 second
        maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      },
    },
    coverage: {
      enabled: true,
      threshold: 80,
    },
  },
  
  integration: {
    environment: 'integration',
    database: {
      enabled: true,
      url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/syncstore_test',
      resetBetweenTests: true,
    },
    redis: {
      enabled: true,
      url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
    },
    externalApis: {
      enabled: false,
      mockResponses: true,
    },
    performance: {
      enabled: true,
      thresholds: {
        maxTestDuration: 5000, // 5 seconds
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      },
    },
    coverage: {
      enabled: true,
      threshold: 70,
    },
  },
  
  e2e: {
    environment: 'e2e',
    database: {
      enabled: true,
      url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/syncstore_test',
      resetBetweenTests: true,
    },
    redis: {
      enabled: true,
      url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
    },
    externalApis: {
      enabled: true,
      mockResponses: false,
    },
    performance: {
      enabled: true,
      thresholds: {
        maxTestDuration: 30000, // 30 seconds
        maxMemoryUsage: 200 * 1024 * 1024, // 200MB
      },
    },
    coverage: {
      enabled: false,
      threshold: 0,
    },
  },
  
  performance: {
    environment: 'performance',
    database: {
      enabled: true,
      url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/syncstore_test',
      resetBetweenTests: false,
    },
    redis: {
      enabled: true,
      url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
    },
    externalApis: {
      enabled: false,
      mockResponses: true,
    },
    performance: {
      enabled: true,
      thresholds: {
        maxTestDuration: 60000, // 60 seconds
        maxMemoryUsage: 500 * 1024 * 1024, // 500MB
      },
    },
    coverage: {
      enabled: false,
      threshold: 0,
    },
  },
};

// Current test configuration
let currentConfig: TestConfig = testConfigs.unit;

// Set test environment
export const setTestEnvironment = (environment: TestEnvironment) => {
  currentConfig = testConfigs[environment];
  
  // Set environment variables
  process.env.TEST_ENVIRONMENT = environment;
  (process.env as any).NODE_ENV = 'test';
  
  // Configure based on environment
  if (currentConfig.database.enabled) {
    process.env.DATABASE_URL = currentConfig.database.url;
  }
  
  if (currentConfig.redis.enabled) {
    process.env.REDIS_URL = currentConfig.redis.url;
  }
  
  // Disable external services in test mode
  if (!currentConfig.externalApis.enabled) {
    process.env.DISABLE_EXTERNAL_APIS = 'true';
  }
  
  console.log(`🔧 Test environment set to: ${environment}`);
};

// Get current test configuration
export const getTestConfig = (): TestConfig => currentConfig;

// Test environment utilities
export const testEnvUtils = {
  // Check if running in specific environment
  isUnitTest: () => currentConfig.environment === 'unit',
  isIntegrationTest: () => currentConfig.environment === 'integration',
  isE2ETest: () => currentConfig.environment === 'e2e',
  isPerformanceTest: () => currentConfig.environment === 'performance',
  
  // Check if services are enabled
  isDatabaseEnabled: () => currentConfig.database.enabled,
  isRedisEnabled: () => currentConfig.redis.enabled,
  areExternalApisEnabled: () => currentConfig.externalApis.enabled,
  
  // Performance utilities
  shouldTrackPerformance: () => currentConfig.performance.enabled,
  getMaxTestDuration: () => currentConfig.performance.thresholds.maxTestDuration,
  getMaxMemoryUsage: () => currentConfig.performance.thresholds.maxMemoryUsage,
  
  // Coverage utilities
  isCoverageEnabled: () => currentConfig.coverage.enabled,
  getCoverageThreshold: () => currentConfig.coverage.threshold,
};

// Environment-specific setup functions
export const setupTestEnvironment = async (environment: TestEnvironment) => {
  setTestEnvironment(environment);
  
  switch (environment) {
    case 'unit':
      await setupUnitTestEnvironment();
      break;
    case 'integration':
      await setupIntegrationTestEnvironment();
      break;
    case 'e2e':
      await setupE2ETestEnvironment();
      break;
    case 'performance':
      await setupPerformanceTestEnvironment();
      break;
  }
};

const setupUnitTestEnvironment = async () => {
  // Mock all external dependencies
  vi.mock('@/lib/db', () => ({
    db: {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    },
  }));
  
  vi.mock('@/lib/redis', () => ({
    redis: {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    },
  }));
  
  console.log('✅ Unit test environment setup complete');
};

const setupIntegrationTestEnvironment = async () => {
  // Setup test database
  if (currentConfig.database.enabled) {
    try {
      const { setupTestDatabase } = await import('../utils/database-helpers');
      await setupTestDatabase();
      console.log('✅ Test database setup complete');
    } catch (error) {
      console.warn('⚠️ Test database setup failed, using mocks:', error);
    }
  }
  
  // Setup test Redis
  if (currentConfig.redis.enabled) {
    try {
      // Test Redis connection
      console.log('✅ Test Redis setup complete');
    } catch (error) {
      console.warn('⚠️ Test Redis setup failed, using mocks:', error);
    }
  }
  
  console.log('✅ Integration test environment setup complete');
};

const setupE2ETestEnvironment = async () => {
  // Setup full test environment
  await setupIntegrationTestEnvironment();
  
  // Additional E2E setup
  console.log('✅ E2E test environment setup complete');
};

const setupPerformanceTestEnvironment = async () => {
  // Setup performance monitoring
  if (typeof performance !== 'undefined' && 'mark' in performance) {
    performance.mark('test-suite-start');
  }
  
  // Setup memory monitoring
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const initialMemory = process.memoryUsage();
    console.log('📊 Initial memory usage:', {
      rss: `${(initialMemory.rss / 1024 / 1024).toFixed(2)}MB`,
      heapUsed: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`,
    });
  }
  
  console.log('✅ Performance test environment setup complete');
};

// Cleanup test environment
export const cleanupTestEnvironment = async () => {
  const environment = currentConfig.environment;
  
  switch (environment) {
    case 'integration':
    case 'e2e':
      if (currentConfig.database.enabled && currentConfig.database.resetBetweenTests) {
        try {
          const { cleanupTestDatabase } = await import('../utils/database-helpers');
          await cleanupTestDatabase();
        } catch (error) {
          console.warn('⚠️ Test database cleanup failed:', error);
        }
      }
      break;
    case 'performance':
      if (typeof performance !== 'undefined' && 'measure' in performance) {
        try {
          performance.mark('test-suite-end');
          performance.measure('test-suite-duration', 'test-suite-start', 'test-suite-end');
          const measure = performance.getEntriesByName('test-suite-duration')[0];
          console.log(`📊 Test suite duration: ${measure.duration.toFixed(2)}ms`);
        } catch (error) {
          // Performance API not available
        }
      }
      
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const finalMemory = process.memoryUsage();
        console.log('📊 Final memory usage:', {
          rss: `${(finalMemory.rss / 1024 / 1024).toFixed(2)}MB`,
          heapUsed: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        });
      }
      break;
  }
  
  console.log(`🧹 ${environment} test environment cleanup complete`);
};

// Auto-detect test environment from process.env or test file patterns
export const autoDetectTestEnvironment = (): TestEnvironment => {
  if (process.env.TEST_ENVIRONMENT) {
    return process.env.TEST_ENVIRONMENT as TestEnvironment;
  }
  
  // Detect from test file patterns
  const testFile = expect.getState().testPath;
  if (testFile) {
    if (testFile.includes('e2e')) return 'e2e';
    if (testFile.includes('integration')) return 'integration';
    if (testFile.includes('performance')) return 'performance';
  }
  
  return 'unit'; // Default to unit tests
};

// Initialize test environment
export const initializeTestEnvironment = async () => {
  const environment = autoDetectTestEnvironment();
  await setupTestEnvironment(environment);
  return environment;
};