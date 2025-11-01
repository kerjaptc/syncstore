/**
 * Request Cache
 * Caches frequently accessed data with TTL management
 */

interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number; // Time to live in milliseconds
  accessCount: number;
  lastAccessed: Date;
}

interface CacheConfig {
  defaultTtl: number; // Default TTL in milliseconds
  maxSize: number; // Maximum number of entries
  cleanupInterval: number; // Cleanup interval in milliseconds
}

export class RequestCache {
  private static instance: RequestCache;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000,
      cleanupInterval: 60 * 1000, // 1 minute
      ...config,
    };

    this.startCleanupTimer();
  }

  static getInstance(config?: Partial<CacheConfig>): RequestCache {
    if (!RequestCache.instance) {
      RequestCache.instance = new RequestCache(config);
    }
    return RequestCache.instance;
  }

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessed = new Date();

    return entry.data;
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const actualTtl = ttl || this.config.defaultTtl;
    
    // Check cache size limit
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      ttl: actualTtl,
      accessCount: 0,
      lastAccessed: new Date(),
    };

    this.cache.set(key, entry);
  }

  /**
   * Delete cached data
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get or set cached data with a factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Generate cache key for platform requests
   */
  static generateKey(
    platformName: string,
    endpoint: string,
    params?: Record<string, any>
  ): string {
    const paramString = params 
      ? Object.keys(params)
          .sort()
          .map(key => `${key}=${JSON.stringify(params[key])}`)
          .join('&')
      : '';
    
    return `${platformName}:${endpoint}${paramString ? `?${paramString}` : ''}`;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{
      key: string;
      size: number;
      ttl: number;
      age: number;
      accessCount: number;
      lastAccessed: Date;
    }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: this.estimateSize(entry.data),
      ttl: entry.ttl,
      age: Date.now() - entry.timestamp.getTime(),
      accessCount: entry.accessCount,
      lastAccessed: entry.lastAccessed,
    }));

    // Calculate hit rate (simplified)
    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const hitRate = totalAccesses > 0 ? (totalAccesses / (totalAccesses + entries.length)) : 0;

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate,
      entries,
    };
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: RegExp): number {
    let invalidated = 0;
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Invalidate cache entries for a specific platform
   */
  invalidatePlatform(platformName: string): number {
    return this.invalidatePattern(new RegExp(`^${platformName}:`));
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp.getTime() > entry.ttl;
  }

  private evictLeastRecentlyUsed(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed.getTime() < lruTime) {
        lruTime = entry.lastAccessed.getTime();
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp.getTime() > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private estimateSize(data: any): number {
    // Simple size estimation
    return JSON.stringify(data).length;
  }

  /**
   * Destroy the cache instance
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

// Singleton instance
export const requestCache = RequestCache.getInstance();