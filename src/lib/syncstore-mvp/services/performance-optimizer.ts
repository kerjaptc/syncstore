/**
 * SyncStore MVP Performance Optimizer
 * 
 * This service provides comprehensive performance optimization features
 * including caching, query optimization, lazy loading, and resource management.
 */

import { z } from 'zod';
import { getErrorLoggingService } from './error-logging';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface CacheConfig {
  defaultTTL: number; // Time to live in seconds
  maxSize: number; // Maximum number of entries
  enableCompression: boolean;
  enableMetrics: boolean;
  cleanupInterval: number; // Cleanup interval in milliseconds
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: Date;
  ttl: number;
  hits: number;
  size: number;
  compressed?: boolean;
}

export interface CacheMetrics {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  averageResponseTime: number;
  memoryUsage: number;
}

export interface QueryOptimization {
  enableIndexHints: boolean;
  enableQueryPlan: boolean;
  enableBatchOperations: boolean;
  maxBatchSize: number;
  enablePagination: boolean;
  defaultPageSize: number;
  maxPageSize: number;
}

export interface LazyLoadingConfig {
  enableImageLazyLoading: boolean;
  enableDataLazyLoading: boolean;
  intersectionThreshold: number;
  rootMargin: string;
  preloadDistance: number;
}

export interface PerformanceMetrics {
  cacheMetrics: CacheMetrics;
  queryMetrics: {
    averageQueryTime: number;
    slowQueries: Array<{
      query: string;
      duration: number;
      timestamp: Date;
    }>;
    totalQueries: number;
    optimizedQueries: number;
  };
  resourceMetrics: {
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number;
    diskUsage: number;
  };
  userExperienceMetrics: {
    pageLoadTime: number;
    timeToInteractive: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
  };
}

// Validation schemas
const CacheConfigSchema = z.object({
  defaultTTL: z.number().min(1).max(86400), // 1 second to 1 day
  maxSize: z.number().min(10).max(100000),
  enableCompression: z.boolean(),
  enableMetrics: z.boolean(),
  cleanupInterval: z.number().min(1000).max(3600000), // 1 second to 1 hour
});

// ============================================================================
// Memory Cache Implementation
// ============================================================================

class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig) {
    this.config = config;
    this.metrics = {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      totalHits: 0,
      totalMisses: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
    };

    this.startCleanupTimer();
  }

  /**
   * Gets a value from cache
   */
  get<T>(key: string): T | null {
    const startTime = Date.now();
    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.totalMisses++;
      this.updateMetrics();
      return null;
    }

    // Check if entry has expired
    const now = new Date();
    const expiryTime = new Date(entry.timestamp.getTime() + entry.ttl * 1000);
    
    if (now > expiryTime) {
      this.cache.delete(key);
      this.metrics.totalMisses++;
      this.updateMetrics();
      return null;
    }

    // Update hit count and metrics
    entry.hits++;
    this.metrics.totalHits++;
    
    const responseTime = Date.now() - startTime;
    this.updateAverageResponseTime(responseTime);
    this.updateMetrics();

    return entry.compressed ? this.decompress(entry.value) : entry.value;
  }

  /**
   * Sets a value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const actualTTL = ttl || this.config.defaultTTL;
    const serializedValue = this.config.enableCompression ? this.compress(value) : value;
    const size = this.calculateSize(serializedValue);

    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      key,
      value: serializedValue,
      timestamp: new Date(),
      ttl: actualTTL,
      hits: 0,
      size,
      compressed: this.config.enableCompression,
    };

    this.cache.set(key, entry);
    this.updateMetrics();
  }

  /**
   * Deletes a value from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateMetrics();
    }
    return deleted;
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.updateMetrics();
  }

  /**
   * Gets cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Gets cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Checks if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    const now = new Date();
    const expiryTime = new Date(entry.timestamp.getTime() + entry.ttl * 1000);
    
    if (now > expiryTime) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Gets all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Private helper methods
  private evictLRU(): void {
    // Find least recently used entry (lowest hits)
    let lruKey = '';
    let minHits = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  private compress<T>(value: T): T {
    // Simple compression simulation - in real implementation would use actual compression
    return value;
  }

  private decompress<T>(value: T): T {
    // Simple decompression simulation
    return value;
  }

  private calculateSize(value: any): number {
    // Rough size calculation
    return JSON.stringify(value).length;
  }

  private updateMetrics(): void {
    this.metrics.totalEntries = this.cache.size;
    this.metrics.totalSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
    
    const totalRequests = this.metrics.totalHits + this.metrics.totalMisses;
    if (totalRequests > 0) {
      this.metrics.hitRate = this.metrics.totalHits / totalRequests;
      this.metrics.missRate = this.metrics.totalMisses / totalRequests;
    }

    // Estimate memory usage
    this.metrics.memoryUsage = this.metrics.totalSize * 1.5; // Rough estimate with overhead
  }

  private updateAverageResponseTime(responseTime: number): void {
    const totalRequests = this.metrics.totalHits + this.metrics.totalMisses;
    if (totalRequests === 1) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const expiryTime = new Date(entry.timestamp.getTime() + entry.ttl * 1000);
      if (now > expiryTime) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      this.updateMetrics();
    }
  }

  /**
   * Cleanup method to be called on shutdown
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
  }
}

// ============================================================================
// Query Optimizer
// ============================================================================

class QueryOptimizer {
  private config: QueryOptimization;
  private queryMetrics = {
    totalQueries: 0,
    optimizedQueries: 0,
    slowQueries: [] as Array<{ query: string; duration: number; timestamp: Date }>,
    averageQueryTime: 0,
  };

  constructor(config: QueryOptimization) {
    this.config = config;
  }

  /**
   * Optimizes a database query
   */
  optimizeQuery(query: string, params?: any[]): {
    optimizedQuery: string;
    optimizedParams?: any[];
    hints: string[];
  } {
    const startTime = Date.now();
    let optimizedQuery = query;
    const hints: string[] = [];

    // Add index hints if enabled
    if (this.config.enableIndexHints) {
      optimizedQuery = this.addIndexHints(optimizedQuery);
      hints.push('Added index hints');
    }

    // Optimize WHERE clauses
    optimizedQuery = this.optimizeWhereClauses(optimizedQuery);
    hints.push('Optimized WHERE clauses');

    // Add LIMIT if pagination is enabled and not present
    if (this.config.enablePagination && !optimizedQuery.toLowerCase().includes('limit')) {
      optimizedQuery += ` LIMIT ${this.config.defaultPageSize}`;
      hints.push('Added pagination limit');
    }

    const duration = Date.now() - startTime;
    this.recordQueryMetrics(query, duration);

    return {
      optimizedQuery,
      optimizedParams: params,
      hints,
    };
  }

  /**
   * Creates a batch operation from multiple queries
   */
  createBatchOperation(queries: string[]): {
    batchQuery: string;
    canBatch: boolean;
    batchSize: number;
  } {
    if (!this.config.enableBatchOperations || queries.length === 0) {
      return {
        batchQuery: queries.join('; '),
        canBatch: false,
        batchSize: queries.length,
      };
    }

    // Check if queries can be batched (similar operations)
    const canBatch = this.canBatchQueries(queries);
    
    if (canBatch && queries.length <= this.config.maxBatchSize) {
      const batchQuery = this.createOptimizedBatch(queries);
      return {
        batchQuery,
        canBatch: true,
        batchSize: queries.length,
      };
    }

    return {
      batchQuery: queries.join('; '),
      canBatch: false,
      batchSize: queries.length,
    };
  }

  /**
   * Gets pagination parameters
   */
  getPaginationParams(page: number = 1, pageSize?: number): {
    offset: number;
    limit: number;
    page: number;
    pageSize: number;
  } {
    const actualPageSize = Math.min(
      pageSize || this.config.defaultPageSize,
      this.config.maxPageSize
    );
    
    const offset = (page - 1) * actualPageSize;
    
    return {
      offset,
      limit: actualPageSize,
      page,
      pageSize: actualPageSize,
    };
  }

  /**
   * Gets query metrics
   */
  getMetrics() {
    return { ...this.queryMetrics };
  }

  // Private helper methods
  private addIndexHints(query: string): string {
    // Simple index hint addition - in real implementation would analyze query structure
    if (query.toLowerCase().includes('select') && query.toLowerCase().includes('where')) {
      // Add USE INDEX hint for common patterns
      if (query.toLowerCase().includes('store_id')) {
        return query.replace(/FROM\s+(\w+)/i, 'FROM $1 USE INDEX (idx_store_id)');
      }
      if (query.toLowerCase().includes('created_at')) {
        return query.replace(/FROM\s+(\w+)/i, 'FROM $1 USE INDEX (idx_created_at)');
      }
    }
    return query;
  }

  private optimizeWhereClauses(query: string): string {
    // Optimize common WHERE clause patterns
    let optimized = query;

    // Move more selective conditions first
    if (optimized.toLowerCase().includes('and')) {
      // This is a simplified optimization - real implementation would parse the query
      optimized = optimized.replace(
        /WHERE\s+(.+?)\s+AND\s+(.+?)(\s|$)/i,
        (match, condition1, condition2, rest) => {
          // Prioritize indexed columns
          if (condition2.includes('id') && !condition1.includes('id')) {
            return `WHERE ${condition2} AND ${condition1}${rest}`;
          }
          return match;
        }
      );
    }

    return optimized;
  }

  private canBatchQueries(queries: string[]): boolean {
    if (queries.length < 2) return false;

    // Check if all queries are of the same type (INSERT, UPDATE, etc.)
    const firstQueryType = this.getQueryType(queries[0]);
    return queries.every(query => this.getQueryType(query) === firstQueryType);
  }

  private getQueryType(query: string): string {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.startsWith('select')) return 'SELECT';
    if (trimmed.startsWith('insert')) return 'INSERT';
    if (trimmed.startsWith('update')) return 'UPDATE';
    if (trimmed.startsWith('delete')) return 'DELETE';
    return 'UNKNOWN';
  }

  private createOptimizedBatch(queries: string[]): string {
    const queryType = this.getQueryType(queries[0]);
    
    switch (queryType) {
      case 'INSERT':
        return this.optimizeInsertBatch(queries);
      case 'UPDATE':
        return this.optimizeUpdateBatch(queries);
      default:
        return queries.join('; ');
    }
  }

  private optimizeInsertBatch(queries: string[]): string {
    // Convert multiple INSERT statements into a single multi-value INSERT
    // This is a simplified implementation
    const firstQuery = queries[0];
    const match = firstQuery.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    
    if (match && queries.length > 1) {
      const [, table, columns] = match;
      const values = queries.map(query => {
        const valueMatch = query.match(/VALUES\s*\(([^)]+)\)/i);
        return valueMatch ? `(${valueMatch[1]})` : '';
      }).filter(Boolean);
      
      return `INSERT INTO ${table} (${columns}) VALUES ${values.join(', ')}`;
    }
    
    return queries.join('; ');
  }

  private optimizeUpdateBatch(queries: string[]): string {
    // For UPDATE queries, we might use CASE statements or temporary tables
    // This is a simplified implementation
    return queries.join('; ');
  }

  private recordQueryMetrics(query: string, duration: number): void {
    this.queryMetrics.totalQueries++;
    
    // Update average query time
    if (this.queryMetrics.totalQueries === 1) {
      this.queryMetrics.averageQueryTime = duration;
    } else {
      this.queryMetrics.averageQueryTime = 
        (this.queryMetrics.averageQueryTime * (this.queryMetrics.totalQueries - 1) + duration) / 
        this.queryMetrics.totalQueries;
    }

    // Record slow queries (> 1000ms)
    if (duration > 1000) {
      this.queryMetrics.slowQueries.push({
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        duration,
        timestamp: new Date(),
      });

      // Keep only last 50 slow queries
      if (this.queryMetrics.slowQueries.length > 50) {
        this.queryMetrics.slowQueries = this.queryMetrics.slowQueries.slice(-50);
      }
    }
  }
}

// ============================================================================
// Lazy Loading Manager
// ============================================================================

class LazyLoadingManager {
  private config: LazyLoadingConfig;
  private observer?: IntersectionObserver;
  private loadedItems = new Set<string>();

  constructor(config: LazyLoadingConfig) {
    this.config = config;
    this.initializeIntersectionObserver();
  }

  /**
   * Registers an element for lazy loading
   */
  observe(element: HTMLElement, loadCallback: () => Promise<void>): void {
    if (!this.observer) return;

    element.dataset.lazyLoadCallback = 'registered';
    element.addEventListener('lazy-load', async () => {
      const itemId = element.dataset.itemId || element.id;
      if (itemId && !this.loadedItems.has(itemId)) {
        try {
          await loadCallback();
          this.loadedItems.add(itemId);
          element.classList.add('lazy-loaded');
        } catch (error) {
          console.error('Lazy loading failed:', error);
          element.classList.add('lazy-load-error');
        }
      }
    });

    this.observer.observe(element);
  }

  /**
   * Unregisters an element from lazy loading
   */
  unobserve(element: HTMLElement): void {
    if (this.observer) {
      this.observer.unobserve(element);
    }
  }

  /**
   * Preloads items within the specified distance
   */
  preloadNearbyItems(currentIndex: number, totalItems: number): number[] {
    const preloadIndices: number[] = [];
    const distance = this.config.preloadDistance;

    for (let i = Math.max(0, currentIndex - distance); 
         i <= Math.min(totalItems - 1, currentIndex + distance); 
         i++) {
      if (i !== currentIndex) {
        preloadIndices.push(i);
      }
    }

    return preloadIndices;
  }

  /**
   * Creates a lazy loading placeholder
   */
  createPlaceholder(width: number, height: number): HTMLElement {
    const placeholder = document.createElement('div');
    placeholder.className = 'lazy-loading-placeholder';
    placeholder.style.width = `${width}px`;
    placeholder.style.height = `${height}px`;
    placeholder.style.backgroundColor = '#f0f0f0';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.innerHTML = '<div class="loading-spinner"></div>';
    
    return placeholder;
  }

  /**
   * Gets loading statistics
   */
  getStats(): {
    totalObserved: number;
    totalLoaded: number;
    loadingRate: number;
  } {
    const totalObserved = document.querySelectorAll('[data-lazy-load-callback="registered"]').length;
    const totalLoaded = this.loadedItems.size;
    
    return {
      totalObserved,
      totalLoaded,
      loadingRate: totalObserved > 0 ? totalLoaded / totalObserved : 0,
    };
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.loadedItems.clear();
  }

  // Private helper methods
  private initializeIntersectionObserver(): void {
    if (typeof window === 'undefined' || !window.IntersectionObserver) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            const event = new CustomEvent('lazy-load');
            element.dispatchEvent(event);
            
            // Stop observing once loaded
            this.observer?.unobserve(element);
          }
        });
      },
      {
        threshold: this.config.intersectionThreshold,
        rootMargin: this.config.rootMargin,
      }
    );
  }
}

// ============================================================================
// Performance Optimizer Service
// ============================================================================

export class PerformanceOptimizerService {
  private static instance: PerformanceOptimizerService;
  private cache: MemoryCache;
  private queryOptimizer: QueryOptimizer;
  private lazyLoadingManager: LazyLoadingManager;
  private loggingService = getErrorLoggingService();

  private constructor(
    cacheConfig?: Partial<CacheConfig>,
    queryConfig?: Partial<QueryOptimization>,
    lazyLoadConfig?: Partial<LazyLoadingConfig>
  ) {
    // Initialize cache
    this.cache = new MemoryCache({
      defaultTTL: 300, // 5 minutes
      maxSize: 1000,
      enableCompression: true,
      enableMetrics: true,
      cleanupInterval: 60000, // 1 minute
      ...cacheConfig,
    });

    // Initialize query optimizer
    this.queryOptimizer = new QueryOptimizer({
      enableIndexHints: true,
      enableQueryPlan: true,
      enableBatchOperations: true,
      maxBatchSize: 100,
      enablePagination: true,
      defaultPageSize: 20,
      maxPageSize: 100,
      ...queryConfig,
    });

    // Initialize lazy loading manager
    this.lazyLoadingManager = new LazyLoadingManager({
      enableImageLazyLoading: true,
      enableDataLazyLoading: true,
      intersectionThreshold: 0.1,
      rootMargin: '50px',
      preloadDistance: 2,
      ...lazyLoadConfig,
    });
  }

  static getInstance(
    cacheConfig?: Partial<CacheConfig>,
    queryConfig?: Partial<QueryOptimization>,
    lazyLoadConfig?: Partial<LazyLoadingConfig>
  ): PerformanceOptimizerService {
    if (!PerformanceOptimizerService.instance) {
      PerformanceOptimizerService.instance = new PerformanceOptimizerService(
        cacheConfig,
        queryConfig,
        lazyLoadConfig
      );
    }
    return PerformanceOptimizerService.instance;
  }

  // ============================================================================
  // Cache Methods
  // ============================================================================

  /**
   * Gets a value from cache
   */
  getCached<T>(key: string): T | null {
    return this.cache.get<T>(key);
  }

  /**
   * Sets a value in cache
   */
  setCached<T>(key: string, value: T, ttl?: number): void {
    this.cache.set(key, value, ttl);
  }

  /**
   * Deletes a value from cache
   */
  deleteCached(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clears all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Caches API response
   */
  async cacheApiResponse<T>(
    key: string,
    apiCall: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Check cache first
    const cached = this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Make API call and cache result
    try {
      const result = await apiCall();
      this.cache.set(key, result, ttl);
      return result;
    } catch (error) {
      await this.loggingService.logError(error as Error, { operation: 'cacheApiResponse', key });
      throw error;
    }
  }

  // ============================================================================
  // Query Optimization Methods
  // ============================================================================

  /**
   * Optimizes a database query
   */
  optimizeQuery(query: string, params?: any[]) {
    return this.queryOptimizer.optimizeQuery(query, params);
  }

  /**
   * Creates a batch operation
   */
  createBatchOperation(queries: string[]) {
    return this.queryOptimizer.createBatchOperation(queries);
  }

  /**
   * Gets pagination parameters
   */
  getPaginationParams(page: number = 1, pageSize?: number) {
    return this.queryOptimizer.getPaginationParams(page, pageSize);
  }

  // ============================================================================
  // Lazy Loading Methods
  // ============================================================================

  /**
   * Registers an element for lazy loading
   */
  observeLazyLoading(element: HTMLElement, loadCallback: () => Promise<void>): void {
    this.lazyLoadingManager.observe(element, loadCallback);
  }

  /**
   * Unregisters an element from lazy loading
   */
  unobserveLazyLoading(element: HTMLElement): void {
    this.lazyLoadingManager.unobserve(element);
  }

  /**
   * Preloads nearby items
   */
  preloadNearbyItems(currentIndex: number, totalItems: number): number[] {
    return this.lazyLoadingManager.preloadNearbyItems(currentIndex, totalItems);
  }

  // ============================================================================
  // Performance Monitoring
  // ============================================================================

  /**
   * Gets comprehensive performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const cacheMetrics = this.cache.getMetrics();
    const queryMetrics = this.queryOptimizer.getMetrics();
    const lazyLoadStats = this.lazyLoadingManager.getStats();

    // Get browser performance metrics if available
    let userExperienceMetrics = {
      pageLoadTime: 0,
      timeToInteractive: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
    };

    if (typeof window !== 'undefined' && window.performance) {
      const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        userExperienceMetrics = {
          pageLoadTime: navigation.loadEventEnd - navigation.loadEventStart,
          timeToInteractive: navigation.domInteractive - navigation.navigationStart,
          firstContentfulPaint: 0, // Would need Performance Observer API
          largestContentfulPaint: 0, // Would need Performance Observer API
        };
      }
    }

    return {
      cacheMetrics,
      queryMetrics,
      resourceMetrics: {
        memoryUsage: cacheMetrics.memoryUsage,
        cpuUsage: 0, // Would need system monitoring
        networkLatency: 0, // Would need network monitoring
        diskUsage: 0, // Would need system monitoring
      },
      userExperienceMetrics,
    };
  }

  /**
   * Measures function execution time
   */
  async measurePerformance<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      await this.loggingService.info(`Performance: ${name} completed in ${duration}ms`, {
        operation: name,
        duration,
        performance: true,
      });
      
      return { result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      await this.loggingService.logError(error as Error, {
        operation: name,
        duration,
        performance: true,
      });
      
      throw error;
    }
  }

  /**
   * Creates a performance-optimized data fetcher
   */
  createOptimizedFetcher<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: {
      ttl?: number;
      enableBatching?: boolean;
      enablePagination?: boolean;
    }
  ) {
    return async (): Promise<T> => {
      const cacheKey = `fetcher_${key}`;
      
      // Check cache first
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Measure performance and fetch data
      const { result, duration } = await this.measurePerformance(
        `fetch_${key}`,
        fetcher
      );

      // Cache the result
      this.cache.set(cacheKey, result, options?.ttl);

      return result;
    };
  }

  // ============================================================================
  // Cleanup and Shutdown
  // ============================================================================

  /**
   * Cleanup method to be called on shutdown
   */
  destroy(): void {
    this.cache.destroy();
    this.lazyLoadingManager.destroy();
  }
}

// ============================================================================
// Factory Functions and Utilities
// ============================================================================

/**
 * Gets the global performance optimizer instance
 */
export function getPerformanceOptimizer(
  cacheConfig?: Partial<CacheConfig>,
  queryConfig?: Partial<QueryOptimization>,
  lazyLoadConfig?: Partial<LazyLoadingConfig>
): PerformanceOptimizerService {
  return PerformanceOptimizerService.getInstance(cacheConfig, queryConfig, lazyLoadConfig);
}

/**
 * Creates a cached API call
 */
export async function cachedApiCall<T>(
  key: string,
  apiCall: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const optimizer = getPerformanceOptimizer();
  return optimizer.cacheApiResponse(key, apiCall, ttl);
}

/**
 * Measures function performance
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const optimizer = getPerformanceOptimizer();
  return optimizer.measurePerformance(name, fn);
}

/**
 * Validates cache configuration
 */
export function validateCacheConfig(config: Partial<CacheConfig>): string[] {
  const result = CacheConfigSchema.safeParse(config);
  if (result.success) {
    return [];
  }
  
  return result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
}

/**
 * Initializes performance optimization
 */
export function initializePerformanceOptimization(
  cacheConfig?: Partial<CacheConfig>,
  queryConfig?: Partial<QueryOptimization>,
  lazyLoadConfig?: Partial<LazyLoadingConfig>
): PerformanceOptimizerService {
  const optimizer = getPerformanceOptimizer(cacheConfig, queryConfig, lazyLoadConfig);
  
  console.log('✅ Performance optimization initialized');
  console.log('📊 Cache enabled with metrics tracking');
  console.log('🔍 Query optimization enabled');
  console.log('⚡ Lazy loading enabled');
  
  return optimizer;
}

export default PerformanceOptimizerService;