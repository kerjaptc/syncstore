/**
 * Analytics Caching Layer
 * Provides intelligent caching for analytics queries with performance optimization
 */

import { cache } from '@/lib/cache';
import { AnalyticsQuery, AnalyticsResult } from '@/types';
import { analyticsService } from '@/lib/services/analytics-service';
import { analyticsQueryEngine } from './query-engine';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  refreshThreshold: number; // Refresh when cache is X% of TTL old
  maxSize: number; // Maximum cache entries
  compressionEnabled: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalQueries: number;
  cacheSize: number;
  memoryUsage: number;
}

export class AnalyticsCacheLayer {
  private config: CacheConfig = {
    ttl: 300, // 5 minutes default
    refreshThreshold: 0.8, // Refresh when 80% of TTL has passed
    maxSize: 1000,
    compressionEnabled: true,
  };

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalQueries: 0,
    cacheSize: 0,
    memoryUsage: 0,
  };

  private refreshQueue: Set<string> = new Set();

  /**
   * Get analytics data with intelligent caching
   */
  async getAnalytics(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const cacheKey = this.generateCacheKey(query);
    const ttl = this.calculateTTL(query);

    this.stats.totalQueries++;

    try {
      // Try to get from cache first
      const cachedResult = await this.getCachedResult(cacheKey);
      
      if (cachedResult) {
        this.stats.hits++;
        this.updateHitRate();

        // Check if we should refresh in background
        if (this.shouldRefreshInBackground(cacheKey, ttl)) {
          this.scheduleBackgroundRefresh(query, cacheKey, ttl);
        }

        return cachedResult;
      }

      // Cache miss - fetch fresh data
      this.stats.misses++;
      this.updateHitRate();

      const result = await this.fetchFreshData(query);
      
      // Cache the result
      await this.cacheResult(cacheKey, result, ttl);
      
      return result;
    } catch (error) {
      console.error('Error in analytics cache layer:', error);
      // Fallback to direct query
      return await this.fetchFreshData(query);
    }
  }

  /**
   * Get dashboard metrics with caching
   */
  async getDashboardMetrics(organizationId: string): Promise<any> {
    const cacheKey = `dashboard-metrics:${organizationId}`;
    const ttl = 300; // 5 minutes for dashboard metrics

    return cache.get(cacheKey, async () => {
      return await analyticsService.getDashboardMetrics(organizationId);
    }, ttl);
  }

  /**
   * Preload common analytics queries
   */
  async preloadCommonQueries(organizationId: string): Promise<void> {
    const commonQueries = this.getCommonQueries(organizationId);
    
    // Preload in parallel but limit concurrency
    const batchSize = 3;
    for (let i = 0; i < commonQueries.length; i += batchSize) {
      const batch = commonQueries.slice(i, i + batchSize);
      await Promise.all(
        batch.map(query => this.getAnalytics(query).catch(console.error))
      );
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    const cacheStats = cache.getStats();
    const keysToDelete = cacheStats.keys.filter(key => key.includes(pattern));
    
    keysToDelete.forEach(key => cache.delete(key));
    
    console.log(`Invalidated ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
  }

  /**
   * Invalidate organization-specific cache
   */
  async invalidateOrganizationCache(organizationId: string): Promise<void> {
    await this.invalidateByPattern(organizationId);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const cacheStats = cache.getStats();
    return {
      ...this.stats,
      cacheSize: cacheStats.size,
      memoryUsage: this.estimateMemoryUsage(cacheStats),
    };
  }

  /**
   * Optimize cache performance
   */
  async optimizeCache(): Promise<void> {
    // Clear expired entries
    cache.clearExpired();

    // Remove least recently used entries if over max size
    const stats = cache.getStats();
    if (stats.size > this.config.maxSize) {
      const excessCount = stats.size - this.config.maxSize;
      console.log(`Cache size (${stats.size}) exceeds max (${this.config.maxSize}), removing ${excessCount} entries`);
      
      // Simple LRU - in a real implementation, you'd track access times
      const keysToRemove = stats.keys.slice(0, excessCount);
      keysToRemove.forEach(key => cache.delete(key));
    }

    // Update stats
    this.updateCacheStats();
  }

  /**
   * Configure cache settings
   */
  configure(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Private helper methods
   */
  private generateCacheKey(query: AnalyticsQuery): string {
    const keyParts = [
      'analytics',
      query.organizationId,
      query.storeIds?.sort().join(',') || 'all-stores',
      query.dateRange.start.toISOString().split('T')[0],
      query.dateRange.end.toISOString().split('T')[0],
      query.metrics.sort().join(','),
      query.groupBy?.sort().join(',') || 'no-group',
      JSON.stringify(query.filters || {}),
    ];

    return keyParts.join(':');
  }

  private calculateTTL(query: AnalyticsQuery): number {
    const { dateRange } = query;
    const now = new Date();
    const daysDiff = Math.ceil((now.getTime() - dateRange.end.getTime()) / (1000 * 60 * 60 * 24));

    // Historical data can be cached longer
    if (daysDiff > 7) {
      return 3600; // 1 hour for data older than a week
    } else if (daysDiff > 1) {
      return 1800; // 30 minutes for data older than a day
    } else {
      return 300; // 5 minutes for recent data
    }
  }

  private async getCachedResult(cacheKey: string): Promise<AnalyticsResult | null> {
    try {
      // In a real implementation, you might use Redis or another cache store
      const cached = cache.get(cacheKey, async () => null, 0);
      return await cached;
    } catch (error) {
      console.error('Error getting cached result:', error);
      return null;
    }
  }

  private async fetchFreshData(query: AnalyticsQuery): Promise<AnalyticsResult> {
    // Determine which service method to use based on query
    if (query.metrics.some(m => m.includes('platform'))) {
      return await analyticsService.getPlatformComparison(
        query.organizationId,
        query.dateRange
      );
    } else if (query.metrics.some(m => m.includes('inventory') || m.includes('stock'))) {
      return await analyticsService.getInventoryAnalytics(query);
    } else {
      return await analyticsService.getSalesAnalytics(query);
    }
  }

  private async cacheResult(cacheKey: string, result: AnalyticsResult, ttl: number): Promise<void> {
    try {
      // Compress large results if enabled
      let dataToCache = result;
      if (this.config.compressionEnabled && this.shouldCompress(result)) {
        dataToCache = this.compressResult(result);
      }

      cache.set(cacheKey, dataToCache, ttl);
    } catch (error) {
      console.error('Error caching result:', error);
    }
  }

  private shouldRefreshInBackground(cacheKey: string, ttl: number): boolean {
    // Check if cache entry is approaching expiration
    // This is a simplified check - in practice, you'd track cache timestamps
    return Math.random() < 0.1; // 10% chance to refresh in background
  }

  private scheduleBackgroundRefresh(query: AnalyticsQuery, cacheKey: string, ttl: number): void {
    if (this.refreshQueue.has(cacheKey)) {
      return; // Already scheduled
    }

    this.refreshQueue.add(cacheKey);

    // Schedule refresh in background
    setTimeout(async () => {
      try {
        const freshResult = await this.fetchFreshData(query);
        await this.cacheResult(cacheKey, freshResult, ttl);
        this.refreshQueue.delete(cacheKey);
      } catch (error) {
        console.error('Background refresh failed:', error);
        this.refreshQueue.delete(cacheKey);
      }
    }, 100); // Small delay to avoid blocking
  }

  private getCommonQueries(organizationId: string): AnalyticsQuery[] {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return [
      // Last 30 days sales
      {
        organizationId,
        dateRange: { start: thirtyDaysAgo, end: now },
        metrics: ['count', 'revenue', 'averageOrderValue'],
        groupBy: ['day'],
      },
      // Last 7 days sales
      {
        organizationId,
        dateRange: { start: sevenDaysAgo, end: now },
        metrics: ['count', 'revenue'],
        groupBy: ['day'],
      },
      // Platform comparison (last 30 days)
      {
        organizationId,
        dateRange: { start: thirtyDaysAgo, end: now },
        metrics: ['platformRevenue', 'platformOrders'],
        groupBy: ['store'],
      },
      // Inventory analytics
      {
        organizationId,
        dateRange: { start: thirtyDaysAgo, end: now },
        metrics: ['stockLevel', 'stockMovement'],
      },
    ];
  }

  private shouldCompress(result: AnalyticsResult): boolean {
    // Compress if data array is large
    return result.data.length > 100 || JSON.stringify(result).length > 10000;
  }

  private compressResult(result: AnalyticsResult): AnalyticsResult {
    // Simple compression - in practice, you might use actual compression libraries
    return {
      ...result,
      data: result.data.slice(0, 1000), // Limit data size
      compressed: true,
    } as any;
  }

  private updateHitRate(): void {
    this.stats.hitRate = this.stats.totalQueries > 0 
      ? (this.stats.hits / this.stats.totalQueries) * 100 
      : 0;
  }

  private updateCacheStats(): void {
    const cacheStats = cache.getStats();
    this.stats.cacheSize = cacheStats.size;
    this.stats.memoryUsage = this.estimateMemoryUsage(cacheStats);
  }

  private estimateMemoryUsage(cacheStats: { size: number; keys: string[] }): number {
    // Rough estimation - in practice, you'd use more sophisticated methods
    return cacheStats.size * 1024; // Assume 1KB per entry on average
  }
}

export const analyticsCacheLayer = new AnalyticsCacheLayer();