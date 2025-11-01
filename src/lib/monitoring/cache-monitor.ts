/**
 * Cache Performance Monitor
 * Enhanced caching system with performance monitoring and optimization
 */

import { getLogger } from '@/lib/error-handling';
import { performanceMonitor } from './performance-monitor';

const logger = getLogger('cache-monitor');

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
  size: number; // Estimated size in bytes
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  entryCount: number;
  averageAccessTime: number;
  topKeys: Array<{
    key: string;
    accessCount: number;
    size: number;
    lastAccessed: Date;
  }>;
}

export interface CacheStrategy {
  name: string;
  maxSize: number; // Maximum cache size in bytes
  maxEntries: number; // Maximum number of entries
  defaultTTL: number; // Default TTL in seconds
  evictionPolicy: 'lru' | 'lfu' | 'ttl'; // Eviction policy
}

class CachePerformanceMonitor {
  private caches = new Map<string, Map<string, CacheEntry<any>>>();
  private metrics = new Map<string, {
    hits: number;
    misses: number;
    totalAccessTime: number;
    accessCount: number;
  }>();
  private strategies = new Map<string, CacheStrategy>();

  constructor() {
    // Default cache strategies
    this.strategies.set('default', {
      name: 'default',
      maxSize: 100 * 1024 * 1024, // 100MB
      maxEntries: 10000,
      defaultTTL: 300, // 5 minutes
      evictionPolicy: 'lru',
    });

    this.strategies.set('analytics', {
      name: 'analytics',
      maxSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 5000,
      defaultTTL: 600, // 10 minutes
      evictionPolicy: 'lfu',
    });

    this.strategies.set('products', {
      name: 'products',
      maxSize: 200 * 1024 * 1024, // 200MB
      maxEntries: 20000,
      defaultTTL: 1800, // 30 minutes
      evictionPolicy: 'lru',
    });

    this.strategies.set('sessions', {
      name: 'sessions',
      maxSize: 20 * 1024 * 1024, // 20MB
      maxEntries: 2000,
      defaultTTL: 3600, // 1 hour
      evictionPolicy: 'ttl',
    });
  }

  /**
   * Get or set cache entry with performance monitoring
   */
  async get<T>(
    cacheKey: string,
    key: string,
    fetchFn?: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T | null> {
    const startTime = performance.now();
    const cache = this.getCache(cacheKey);
    const strategy = this.strategies.get(cacheKey) || this.strategies.get('default')!;

    try {
      const entry = cache.get(key);
      const now = Date.now();

      // Check if entry exists and is not expired
      if (entry && entry.expiresAt > now) {
        // Update access statistics
        entry.accessCount++;
        entry.lastAccessed = now;
        
        this.recordHit(cacheKey, performance.now() - startTime);
        
        logger.debug('Cache hit', { cacheKey, key, accessCount: entry.accessCount });
        return entry.data;
      }

      // Cache miss - remove expired entry if it exists
      if (entry) {
        cache.delete(key);
      }

      this.recordMiss(cacheKey, performance.now() - startTime);

      // If no fetch function provided, return null
      if (!fetchFn) {
        return null;
      }

      // Fetch new data
      const metricId = performanceMonitor.startMetric(`cache_fetch_${cacheKey}`, 'cache', {
        cacheKey,
        key,
      });

      try {
        const data = await fetchFn();
        const ttl = ttlSeconds || strategy.defaultTTL;
        
        // Store in cache
        this.set(cacheKey, key, data, ttl);
        
        performanceMonitor.endMetric(metricId, true);
        
        logger.debug('Cache miss - data fetched and cached', { cacheKey, key, ttl });
        return data;
      } catch (error) {
        performanceMonitor.endMetric(metricId, false, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    } catch (error) {
      logger.error('Cache get error', error instanceof Error ? error : undefined, { cacheKey, key });
      throw error;
    }
  }

  /**
   * Set cache entry
   */
  set<T>(cacheKey: string, key: string, data: T, ttlSeconds?: number): void {
    const cache = this.getCache(cacheKey);
    const strategy = this.strategies.get(cacheKey) || this.strategies.get('default')!;
    const ttl = ttlSeconds || strategy.defaultTTL;
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      expiresAt: now + (ttl * 1000),
      createdAt: now,
      accessCount: 0,
      lastAccessed: now,
      size: this.estimateSize(data),
    };

    // Check if we need to evict entries
    this.evictIfNeeded(cacheKey, entry.size);

    cache.set(key, entry);

    logger.debug('Cache set', { cacheKey, key, ttl, size: entry.size });
  }

  /**
   * Delete cache entry
   */
  delete(cacheKey: string, key: string): boolean {
    const cache = this.getCache(cacheKey);
    const deleted = cache.delete(key);
    
    if (deleted) {
      logger.debug('Cache delete', { cacheKey, key });
    }
    
    return deleted;
  }

  /**
   * Clear entire cache
   */
  clear(cacheKey: string): void {
    const cache = this.getCache(cacheKey);
    const size = cache.size;
    cache.clear();
    
    logger.info('Cache cleared', { cacheKey, entriesRemoved: size });
  }

  /**
   * Get cache metrics
   */
  getMetrics(cacheKey: string): CacheMetrics {
    const cache = this.getCache(cacheKey);
    const metrics = this.metrics.get(cacheKey) || { hits: 0, misses: 0, totalAccessTime: 0, accessCount: 0 };

    const totalRequests = metrics.hits + metrics.misses;
    const hitRate = totalRequests > 0 ? (metrics.hits / totalRequests) * 100 : 0;
    const averageAccessTime = metrics.accessCount > 0 ? metrics.totalAccessTime / metrics.accessCount : 0;

    // Calculate total size and get top keys
    let totalSize = 0;
    const keyStats: Array<{
      key: string;
      accessCount: number;
      size: number;
      lastAccessed: Date;
    }> = [];

    for (const [key, entry] of cache.entries()) {
      totalSize += entry.size;
      keyStats.push({
        key,
        accessCount: entry.accessCount,
        size: entry.size,
        lastAccessed: new Date(entry.lastAccessed),
      });
    }

    // Sort by access count and take top 10
    const topKeys = keyStats
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    return {
      hits: metrics.hits,
      misses: metrics.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalSize,
      entryCount: cache.size,
      averageAccessTime: Math.round(averageAccessTime * 100) / 100,
      topKeys,
    };
  }

  /**
   * Get all cache metrics
   */
  getAllMetrics(): Record<string, CacheMetrics> {
    const result: Record<string, CacheMetrics> = {};
    
    for (const cacheKey of this.caches.keys()) {
      result[cacheKey] = this.getMetrics(cacheKey);
    }
    
    return result;
  }

  /**
   * Clean expired entries from all caches
   */
  cleanExpired(): void {
    const now = Date.now();
    let totalCleaned = 0;

    for (const [cacheKey, cache] of this.caches.entries()) {
      let cleaned = 0;
      
      for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt <= now) {
          cache.delete(key);
          cleaned++;
        }
      }
      
      totalCleaned += cleaned;
      
      if (cleaned > 0) {
        logger.debug('Expired entries cleaned', { cacheKey, cleaned });
      }
    }

    if (totalCleaned > 0) {
      logger.info('Cache cleanup completed', { totalCleaned });
    }
  }

  /**
   * Get cache strategy
   */
  getStrategy(cacheKey: string): CacheStrategy | undefined {
    return this.strategies.get(cacheKey);
  }

  /**
   * Set cache strategy
   */
  setStrategy(cacheKey: string, strategy: CacheStrategy): void {
    this.strategies.set(cacheKey, strategy);
    logger.info('Cache strategy updated', { cacheKey, strategy: strategy.name });
  }

  /**
   * Get or create cache instance
   */
  private getCache(cacheKey: string): Map<string, CacheEntry<any>> {
    let cache = this.caches.get(cacheKey);
    if (!cache) {
      cache = new Map();
      this.caches.set(cacheKey, cache);
      
      // Initialize metrics
      this.metrics.set(cacheKey, {
        hits: 0,
        misses: 0,
        totalAccessTime: 0,
        accessCount: 0,
      });
    }
    return cache;
  }

  /**
   * Record cache hit
   */
  private recordHit(cacheKey: string, accessTime: number): void {
    const metrics = this.metrics.get(cacheKey)!;
    metrics.hits++;
    metrics.totalAccessTime += accessTime;
    metrics.accessCount++;
  }

  /**
   * Record cache miss
   */
  private recordMiss(cacheKey: string, accessTime: number): void {
    const metrics = this.metrics.get(cacheKey)!;
    metrics.misses++;
    metrics.totalAccessTime += accessTime;
    metrics.accessCount++;
  }

  /**
   * Evict entries if cache limits are exceeded
   */
  private evictIfNeeded(cacheKey: string, newEntrySize: number): void {
    const cache = this.getCache(cacheKey);
    const strategy = this.strategies.get(cacheKey) || this.strategies.get('default')!;

    // Check entry count limit
    if (cache.size >= strategy.maxEntries) {
      this.evictEntries(cacheKey, 1);
    }

    // Check size limit
    const currentSize = this.calculateCacheSize(cache);
    if (currentSize + newEntrySize > strategy.maxSize) {
      const targetSize = strategy.maxSize * 0.8; // Evict to 80% of max size
      this.evictToSize(cacheKey, targetSize);
    }
  }

  /**
   * Evict entries based on strategy
   */
  private evictEntries(cacheKey: string, count: number): void {
    const cache = this.getCache(cacheKey);
    const strategy = this.strategies.get(cacheKey) || this.strategies.get('default')!;

    const entries = Array.from(cache.entries());
    let toEvict: string[] = [];

    switch (strategy.evictionPolicy) {
      case 'lru':
        // Least Recently Used
        toEvict = entries
          .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
          .slice(0, count)
          .map(([key]) => key);
        break;

      case 'lfu':
        // Least Frequently Used
        toEvict = entries
          .sort(([, a], [, b]) => a.accessCount - b.accessCount)
          .slice(0, count)
          .map(([key]) => key);
        break;

      case 'ttl':
        // Shortest Time To Live
        toEvict = entries
          .sort(([, a], [, b]) => a.expiresAt - b.expiresAt)
          .slice(0, count)
          .map(([key]) => key);
        break;
    }

    toEvict.forEach(key => cache.delete(key));

    if (toEvict.length > 0) {
      logger.debug('Cache entries evicted', { 
        cacheKey, 
        count: toEvict.length, 
        policy: strategy.evictionPolicy 
      });
    }
  }

  /**
   * Evict entries to reach target size
   */
  private evictToSize(cacheKey: string, targetSize: number): void {
    const cache = this.getCache(cacheKey);
    let currentSize = this.calculateCacheSize(cache);

    while (currentSize > targetSize && cache.size > 0) {
      this.evictEntries(cacheKey, Math.max(1, Math.floor(cache.size * 0.1))); // Evict 10% at a time
      currentSize = this.calculateCacheSize(cache);
    }
  }

  /**
   * Calculate total cache size
   */
  private calculateCacheSize(cache: Map<string, CacheEntry<any>>): number {
    let totalSize = 0;
    for (const entry of cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  /**
   * Estimate object size in bytes
   */
  private estimateSize(obj: any): number {
    const jsonString = JSON.stringify(obj);
    return new Blob([jsonString]).size;
  }
}

// Export singleton instance
export const cacheMonitor = new CachePerformanceMonitor();

// Clean expired entries every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    cacheMonitor.cleanExpired();
  }, 5 * 60 * 1000);
}