/**
 * Platform Service
 * Main service for managing platform integrations
 */

import { db } from '@/lib/db';
import { stores, platforms } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { BasePlatformAdapter } from './base-adapter';
import { PlatformAdapterFactory } from './adapter-factory';
import { rateLimiter } from './rate-limiter';
import { requestCache, RequestCache } from './request-cache';
import { healthMonitor } from './health-monitor';
import { EncryptionService } from '@/lib/security/encryption';
import type { 
  PlatformCredentials, 
  PlatformProduct, 
  PlatformOrder,
  ApiResponse,
  PaginationParams,
  PaginatedResponse
} from './types';

export class PlatformService {
  private adapters: Map<string, BasePlatformAdapter> = new Map();
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  /**
   * Initialize platform adapter for a store
   */
  async initializeStoreAdapter(storeId: string): Promise<BasePlatformAdapter> {
    // Check if adapter already exists
    if (this.adapters.has(storeId)) {
      return this.adapters.get(storeId)!;
    }

    // Get store and platform data
    const storeData = await db
      .select({
        store: stores,
        platform: platforms,
      })
      .from(stores)
      .innerJoin(platforms, eq(stores.platformId, platforms.id))
      .where(eq(stores.id, storeId))
      .limit(1);

    if (storeData.length === 0) {
      throw new Error(`Store not found: ${storeId}`);
    }

    const { store, platform } = storeData[0];

    // Decrypt credentials
    const credentials = await this.encryptionService.decryptCredentials(
      store.credentials as string,
      store.organizationId
    ) as PlatformCredentials;

    // Create adapter
    const adapter = PlatformAdapterFactory.createAdapter(
      platform.name,
      credentials,
      platform.apiConfig as any
    );

    // Configure rate limiting
    const apiConfig = platform.apiConfig as any;
    rateLimiter.configurePlatform(platform.name, {
      requestsPerSecond: apiConfig?.rateLimits?.requestsPerSecond || 10,
      requestsPerMinute: apiConfig?.rateLimits?.requestsPerMinute || 600,
      requestsPerHour: apiConfig?.rateLimits?.requestsPerHour || 36000,
    });

    // Register with health monitor
    healthMonitor.registerAdapter(storeId, adapter);

    // Cache adapter
    this.adapters.set(storeId, adapter);

    return adapter;
  }

  /**
   * Get platform adapter for a store
   */
  async getAdapter(storeId: string): Promise<BasePlatformAdapter> {
    if (this.adapters.has(storeId)) {
      return this.adapters.get(storeId)!;
    }

    return await this.initializeStoreAdapter(storeId);
  }

  /**
   * Execute a platform request with rate limiting and caching
   */
  async executeRequest<T>(
    storeId: string,
    requestFn: (adapter: BasePlatformAdapter) => Promise<ApiResponse<T>>,
    options: {
      cacheKey?: string;
      cacheTtl?: number;
      priority?: number;
      skipCache?: boolean;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { cacheKey, cacheTtl, priority = 0, skipCache = false } = options;

    // Check cache first
    if (cacheKey && !skipCache) {
      const cached = requestCache.get<ApiResponse<T>>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Get adapter
    const adapter = await this.getAdapter(storeId);
    const platformName = adapter.getPlatformName();

    // Execute with rate limiting
    const result = await rateLimiter.queueRequest(
      platformName,
      async () => {
        const startTime = Date.now();
        
        try {
          const response = await requestFn(adapter);
          const responseTime = Date.now() - startTime;
          
          // Record metrics
          healthMonitor.recordRequest(storeId, response.success, responseTime);
          
          return response;
        } catch (error) {
          const responseTime = Date.now() - startTime;
          
          // Record metrics
          healthMonitor.recordRequest(storeId, false, responseTime);
          
          throw error;
        }
      },
      priority
    );

    // Cache successful results
    if (cacheKey && result.success && !skipCache) {
      requestCache.set(cacheKey, result, cacheTtl);
    }

    return result;
  }

  /**
   * Get products from platform
   */
  async getProducts(
    storeId: string,
    params?: PaginationParams
  ): Promise<ApiResponse<PaginatedResponse<PlatformProduct>>> {
    const cacheKey = RequestCache.generateKey(
      `store_${storeId}`,
      'products',
      params
    );

    return this.executeRequest(
      storeId,
      (adapter) => adapter.getProducts(params),
      { cacheKey, cacheTtl: 5 * 60 * 1000 } // 5 minutes
    );
  }

  /**
   * Get single product from platform
   */
  async getProduct(
    storeId: string,
    productId: string
  ): Promise<ApiResponse<PlatformProduct>> {
    const cacheKey = RequestCache.generateKey(
      `store_${storeId}`,
      `product_${productId}`
    );

    return this.executeRequest(
      storeId,
      (adapter) => adapter.getProduct(productId),
      { cacheKey, cacheTtl: 10 * 60 * 1000 } // 10 minutes
    );
  }

  /**
   * Create product on platform
   */
  async createProduct(
    storeId: string,
    product: Partial<PlatformProduct>
  ): Promise<ApiResponse<PlatformProduct>> {
    const result = await this.executeRequest(
      storeId,
      (adapter) => adapter.createProduct(product),
      { priority: 1, skipCache: true }
    );

    // Invalidate related cache entries
    if (result.success) {
      requestCache.invalidatePattern(new RegExp(`^store_${storeId}:products`));
    }

    return result;
  }

  /**
   * Update product on platform
   */
  async updateProduct(
    storeId: string,
    productId: string,
    updates: Partial<PlatformProduct>
  ): Promise<ApiResponse<PlatformProduct>> {
    const result = await this.executeRequest(
      storeId,
      (adapter) => adapter.updateProduct(productId, updates),
      { priority: 1, skipCache: true }
    );

    // Invalidate related cache entries
    if (result.success) {
      requestCache.delete(RequestCache.generateKey(`store_${storeId}`, `product_${productId}`));
      requestCache.invalidatePattern(new RegExp(`^store_${storeId}:products`));
    }

    return result;
  }

  /**
   * Update inventory on platform
   */
  async updateInventory(
    storeId: string,
    productId: string,
    variantId: string,
    quantity: number
  ): Promise<ApiResponse<void>> {
    const result = await this.executeRequest(
      storeId,
      (adapter) => adapter.updateInventory(productId, variantId, quantity),
      { priority: 2, skipCache: true }
    );

    // Invalidate related cache entries
    if (result.success) {
      requestCache.delete(RequestCache.generateKey(`store_${storeId}`, `product_${productId}`));
    }

    return result;
  }

  /**
   * Get orders from platform
   */
  async getOrders(
    storeId: string,
    params?: PaginationParams & { status?: string; startDate?: Date; endDate?: Date }
  ): Promise<ApiResponse<PaginatedResponse<PlatformOrder>>> {
    const cacheKey = RequestCache.generateKey(
      `store_${storeId}`,
      'orders',
      params
    );

    return this.executeRequest(
      storeId,
      (adapter) => adapter.getOrders(params),
      { cacheKey, cacheTtl: 2 * 60 * 1000 } // 2 minutes
    );
  }

  /**
   * Get single order from platform
   */
  async getOrder(
    storeId: string,
    orderId: string
  ): Promise<ApiResponse<PlatformOrder>> {
    const cacheKey = RequestCache.generateKey(
      `store_${storeId}`,
      `order_${orderId}`
    );

    return this.executeRequest(
      storeId,
      (adapter) => adapter.getOrder(orderId),
      { cacheKey, cacheTtl: 5 * 60 * 1000 } // 5 minutes
    );
  }

  /**
   * Update order status on platform
   */
  async updateOrderStatus(
    storeId: string,
    orderId: string,
    status: string,
    trackingInfo?: { carrier?: string; trackingNumber?: string }
  ): Promise<ApiResponse<void>> {
    const result = await this.executeRequest(
      storeId,
      (adapter) => adapter.updateOrderStatus(orderId, status, trackingInfo),
      { priority: 2, skipCache: true }
    );

    // Invalidate related cache entries
    if (result.success) {
      requestCache.delete(RequestCache.generateKey(`store_${storeId}`, `order_${orderId}`));
      requestCache.invalidatePattern(new RegExp(`^store_${storeId}:orders`));
    }

    return result;
  }

  /**
   * Test platform connection
   */
  async testConnection(storeId: string): Promise<ApiResponse<{ status: string; details: any }>> {
    try {
      const adapter = await this.getAdapter(storeId);
      return await adapter.healthCheck();
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Get platform health status
   */
  getPlatformHealth(storeId: string) {
    return healthMonitor.getMetrics(storeId);
  }

  /**
   * Get all platform health statuses
   */
  getAllPlatformHealth() {
    return healthMonitor.getAllMetrics();
  }

  /**
   * Get system health overview
   */
  getSystemHealth() {
    return healthMonitor.getSystemHealth();
  }

  /**
   * Get rate limiting status
   */
  getRateLimitStatus(platformName?: string) {
    if (platformName) {
      return rateLimiter.getQueueStatus(platformName);
    }
    return rateLimiter.getAllStatuses();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return requestCache.getStats();
  }

  /**
   * Clear cache for a store
   */
  clearStoreCache(storeId: string): number {
    return requestCache.invalidatePattern(new RegExp(`^store_${storeId}:`));
  }

  /**
   * Clear cache for a platform
   */
  clearPlatformCache(platformName: string): number {
    return requestCache.invalidatePlatform(platformName);
  }

  /**
   * Refresh store adapter (useful when credentials change)
   */
  async refreshStoreAdapter(storeId: string): Promise<void> {
    // Remove existing adapter
    if (this.adapters.has(storeId)) {
      healthMonitor.unregisterAdapter(storeId);
      this.adapters.delete(storeId);
    }

    // Clear cache
    this.clearStoreCache(storeId);

    // Initialize new adapter
    await this.initializeStoreAdapter(storeId);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Unregister all adapters from health monitor
    for (const storeId of this.adapters.keys()) {
      healthMonitor.unregisterAdapter(storeId);
    }

    // Clear adapters
    this.adapters.clear();

    // Destroy singletons
    healthMonitor.destroy();
    requestCache.destroy();
  }
}