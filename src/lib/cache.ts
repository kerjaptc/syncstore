/**
 * Enhanced Cache utility with performance monitoring
 * Provides in-memory caching with TTL support and monitoring
 */

import { cacheMonitor } from './monitoring/cache-monitor';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 300; // 5 minutes in seconds

  /**
   * Get data from cache or execute function and cache result
   */
  async get<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = this.defaultTTL
  ): Promise<T> {
    // Use the enhanced cache monitor for better performance tracking
    return cacheMonitor.get('default', key, fetchFn, ttlSeconds);
  }

  /**
   * Set data in cache with TTL
   */
  set<T>(key: string, data: T, ttlSeconds: number = this.defaultTTL): void {
    cacheMonitor.set('default', key, data, ttlSeconds);
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): void {
    cacheMonitor.delete('default', key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    cacheMonitor.clear('default');
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    cacheMonitor.cleanExpired();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    const metrics = cacheMonitor.getMetrics('default');
    return {
      size: metrics.entryCount,
      keys: metrics.topKeys.map(k => k.key),
    };
  }

  /**
   * Get detailed cache metrics
   */
  getDetailedMetrics() {
    return cacheMonitor.getMetrics('default');
  }
}

export const cache = new CacheManager();

// Enhanced cache functions for specific use cases
export const analyticsCache = {
  get: <T>(key: string, fetchFn: () => Promise<T>, ttlSeconds?: number) =>
    cacheMonitor.get('analytics', key, fetchFn, ttlSeconds),
  set: <T>(key: string, data: T, ttlSeconds?: number) =>
    cacheMonitor.set('analytics', key, data, ttlSeconds),
  delete: (key: string) => cacheMonitor.delete('analytics', key),
  clear: () => cacheMonitor.clear('analytics'),
};

export const productsCache = {
  get: <T>(key: string, fetchFn: () => Promise<T>, ttlSeconds?: number) =>
    cacheMonitor.get('products', key, fetchFn, ttlSeconds),
  set: <T>(key: string, data: T, ttlSeconds?: number) =>
    cacheMonitor.set('products', key, data, ttlSeconds),
  delete: (key: string) => cacheMonitor.delete('products', key),
  clear: () => cacheMonitor.clear('products'),
};

export const sessionsCache = {
  get: <T>(key: string, fetchFn: () => Promise<T>, ttlSeconds?: number) =>
    cacheMonitor.get('sessions', key, fetchFn, ttlSeconds),
  set: <T>(key: string, data: T, ttlSeconds?: number) =>
    cacheMonitor.set('sessions', key, data, ttlSeconds),
  delete: (key: string) => cacheMonitor.delete('sessions', key),
  clear: () => cacheMonitor.clear('sessions'),
};