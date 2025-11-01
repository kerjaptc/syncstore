/**
 * Monitoring System Tests
 * Tests for performance monitoring, database monitoring, and system health
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment variables for testing
vi.mock('@/env', () => ({
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    ENCRYPTION_KEY: 'test-encryption-key-32-characters',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_test',
    CLERK_SECRET_KEY: 'sk_test_test',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_APP_NAME: 'StoreSync',
    NEXT_PUBLIC_ENABLE_ANALYTICS: false,
    NEXT_PUBLIC_ENABLE_MONITORING: true,
  }
}));

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  }
}));

// Import after mocking
const { performanceMonitor } = await import('@/lib/monitoring/performance-monitor');
const { databaseMonitor } = await import('@/lib/monitoring/database-monitor');
const { cacheMonitor } = await import('@/lib/monitoring/cache-monitor');

// Mock process for testing
const mockProcess = {
  memoryUsage: () => ({
    rss: 100 * 1024 * 1024,
    heapTotal: 50 * 1024 * 1024,
    heapUsed: 30 * 1024 * 1024,
    external: 5 * 1024 * 1024,
  }),
  cpuUsage: () => ({
    user: 1000000,
    system: 500000,
  }),
};

// Mock global process
vi.stubGlobal('process', mockProcess);

describe('Performance Monitor', () => {
  beforeEach(() => {
    // Clear metrics before each test
    performanceMonitor.clearOldMetrics(0);
  });

  it('should track performance metrics', async () => {
    const metricId = performanceMonitor.startMetric('test_operation', 'custom', { test: true });
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));
    
    performanceMonitor.endMetric(metricId, true);
    
    const metrics = performanceMonitor.getMetrics('custom', 10);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].name).toBe('test_operation');
    expect(metrics[0].success).toBe(true);
    expect(metrics[0].duration).toBeGreaterThan(0);
  });

  it('should track function execution', async () => {
    const testFunction = async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return 'test result';
    };

    const result = await performanceMonitor.trackFunction(
      'test_function',
      'custom',
      testFunction,
      { context: 'test' }
    );

    expect(result).toBe('test result');
    
    const metrics = performanceMonitor.getMetrics('custom', 10);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].name).toBe('test_function');
    expect(metrics[0].success).toBe(true);
  });

  it('should handle function execution errors', async () => {
    const errorFunction = async () => {
      throw new Error('Test error');
    };

    await expect(
      performanceMonitor.trackFunction('error_function', 'custom', errorFunction)
    ).rejects.toThrow('Test error');

    const metrics = performanceMonitor.getMetrics('custom', 10);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].success).toBe(false);
    expect(metrics[0].error).toBe('Test error');
  });

  it('should collect system metrics', () => {
    const systemMetrics = performanceMonitor.collectSystemMetrics();
    
    expect(systemMetrics.memory.used).toBeGreaterThan(0);
    expect(systemMetrics.memory.total).toBeGreaterThan(0);
    expect(systemMetrics.memory.percentage).toBeGreaterThan(0);
    expect(systemMetrics.cpu.usage).toBeGreaterThanOrEqual(0);
  });

  it('should create alerts for performance issues', () => {
    // Start a metric that will exceed thresholds
    const metricId = performanceMonitor.startMetric('slow_operation', 'request');
    
    // Simulate a very slow operation (6 seconds)
    performanceMonitor.endMetric(metricId, true, undefined, { duration: 6000 });

    const alerts = performanceMonitor.getAlerts(false);
    expect(alerts.length).toBeGreaterThan(0);
    
    const slowAlert = alerts.find(alert => alert.type === 'high_response_time');
    expect(slowAlert).toBeDefined();
    expect(slowAlert?.severity).toBe('high');
  });
});

describe('Database Monitor', () => {
  it('should track database queries', async () => {
    const mockQuery = async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { rows: [{ id: 1 }], rowCount: 1 };
    };

    const result = await databaseMonitor.trackQuery(
      'SELECT * FROM users WHERE id = $1',
      mockQuery,
      { userId: 1 }
    );

    expect(result.rows).toHaveLength(1);
    
    const stats = databaseMonitor.getDatabaseStats();
    expect(stats.totalQueries).toBe(1);
    expect(stats.averageQueryTime).toBeGreaterThan(0);
  });

  it('should detect slow queries', async () => {
    const slowQuery = async () => {
      await new Promise(resolve => setTimeout(resolve, 1100)); // 1.1 seconds
      return { rows: [], rowCount: 0 };
    };

    await databaseMonitor.trackQuery(
      'SELECT * FROM large_table',
      slowQuery
    );

    const stats = databaseMonitor.getDatabaseStats();
    expect(stats.slowQueries).toBe(1);
    
    const slowQueries = databaseMonitor.getSlowQueriesByPattern();
    expect(slowQueries).toHaveLength(1);
    expect(slowQueries[0].averageDuration).toBeGreaterThan(1000);
  });

  it('should generate optimization suggestions', async () => {
    // Query without WHERE clause
    await databaseMonitor.trackQuery(
      'SELECT * FROM products',
      async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
        return { rows: [], rowCount: 0 };
      }
    );

    const suggestions = databaseMonitor.getOptimizationSuggestions();
    expect(suggestions.length).toBeGreaterThan(0);
    
    const fullTableScanSuggestion = suggestions.find(s => 
      s.issue.includes('Full table scan')
    );
    expect(fullTableScanSuggestion).toBeDefined();
  });

  it('should handle query errors', async () => {
    const errorQuery = async () => {
      throw new Error('Database connection failed');
    };

    await expect(
      databaseMonitor.trackQuery('SELECT 1', errorQuery)
    ).rejects.toThrow('Database connection failed');

    const stats = databaseMonitor.getDatabaseStats();
    expect(stats.totalQueries).toBe(1);
    expect(stats.errorRate).toBeGreaterThan(0);
  });
});

describe('Cache Monitor', () => {
  beforeEach(() => {
    cacheMonitor.clear('test');
  });

  it('should cache and retrieve data', async () => {
    const fetchFn = vi.fn(async () => 'cached data');

    // First call should fetch data
    const result1 = await cacheMonitor.get('test', 'key1', fetchFn, 60);
    expect(result1).toBe('cached data');
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const result2 = await cacheMonitor.get('test', 'key1', fetchFn, 60);
    expect(result2).toBe('cached data');
    expect(fetchFn).toHaveBeenCalledTimes(1); // Still only called once
  });

  it('should track cache metrics', async () => {
    const fetchFn = async () => 'test data';

    // Generate some cache hits and misses
    await cacheMonitor.get('test', 'key1', fetchFn, 60); // Miss
    await cacheMonitor.get('test', 'key1', fetchFn, 60); // Hit
    await cacheMonitor.get('test', 'key2', fetchFn, 60); // Miss
    await cacheMonitor.get('test', 'key2', fetchFn, 60); // Hit

    const metrics = cacheMonitor.getMetrics('test');
    expect(metrics.hits).toBe(2);
    expect(metrics.misses).toBe(2);
    expect(metrics.hitRate).toBe(50);
    expect(metrics.entryCount).toBe(2);
  });

  it('should handle cache expiration', async () => {
    const fetchFn = vi.fn(async () => 'fresh data');

    // Cache with very short TTL
    await cacheMonitor.get('test', 'key1', fetchFn, 0.001); // 1ms TTL
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Should fetch fresh data
    await cacheMonitor.get('test', 'key1', fetchFn, 60);
    
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('should evict entries when limits are exceeded', () => {
    // Set a small cache strategy for testing
    cacheMonitor.setStrategy('test', {
      name: 'test',
      maxSize: 1024, // 1KB
      maxEntries: 2,
      defaultTTL: 300,
      evictionPolicy: 'lru',
    });

    // Add entries that exceed the limit
    cacheMonitor.set('test', 'key1', 'data1');
    cacheMonitor.set('test', 'key2', 'data2');
    cacheMonitor.set('test', 'key3', 'data3'); // Should trigger eviction

    const metrics = cacheMonitor.getMetrics('test');
    expect(metrics.entryCount).toBeLessThanOrEqual(2);
  });
});

// Note: System Health tests are skipped due to complex dependencies
// In a real environment, these would be integration tests