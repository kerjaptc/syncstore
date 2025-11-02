/**
 * SyncStore MVP Service Interfaces
 * 
 * This file defines the core service interfaces for the SyncStore MVP.
 * These interfaces establish contracts for all major services and ensure
 * consistent implementation across the application.
 */

import type {
  StoreConnection,
  Product,
  SyncStatus,
  SyncLog,
  ShopeeProduct,
  ShopeeOAuthCredentials,
  FetchOptions,
  SyncResult,
  ValidationResult,
  ConnectionStatus,
  AuthUrl,
  OAuthCredentials,
} from '../types';

// ============================================================================
// Platform Integration Interfaces
// ============================================================================

/**
 * Base interface for all platform adapters
 */
export interface PlatformAdapter {
  readonly platform: string;
  
  // Authentication
  authenticate(credentials: OAuthCredentials): Promise<void>;
  refreshToken(storeId: string): Promise<OAuthCredentials>;
  validateConnection(storeId: string): Promise<ConnectionStatus>;
  
  // Product operations
  fetchProducts(storeId: string, options?: FetchOptions): Promise<Product[]>;
  fetchProduct(storeId: string, productId: string): Promise<Product>;
  
  // Rate limiting and error handling
  handleRateLimit(retryAfter?: number): Promise<void>;
  isRateLimited(): boolean;
}

/**
 * Shopee-specific integration service
 */
export interface ShopeeIntegrationService extends PlatformAdapter {
  readonly platform: 'shopee';
  
  // OAuth flow
  initiateOAuth(organizationId: string): Promise<AuthUrl>;
  handleOAuthCallback(code: string, state: string): Promise<StoreConnection>;
  
  // Shopee-specific operations
  fetchShopeeProducts(storeId: string, options?: FetchOptions): Promise<ShopeeProduct[]>;
  getShopInfo(storeId: string): Promise<{ shop_id: number; shop_name: string }>;
  
  // Data transformation
  transformShopeeProduct(shopeeProduct: ShopeeProduct, storeId: string): Product;
}

// ============================================================================
// Data Management Interfaces
// ============================================================================

/**
 * Product synchronization service interface
 */
export interface ProductSyncService {
  // Sync operations
  syncStoreProducts(storeId: string, type?: 'full' | 'incremental'): Promise<SyncResult>;
  syncSingleProduct(storeId: string, productId: string): Promise<Product>;
  
  // Status and monitoring
  getSyncStatus(storeId: string): Promise<SyncStatus>;
  getSyncHistory(storeId: string, limit?: number): Promise<SyncLog[]>;
  
  // Data validation and transformation
  validateProductData(product: Partial<Product>): Promise<ValidationResult>;
  transformProductData(rawProduct: any, platform: string): Promise<Product>;
  
  // Sync management
  startSync(storeId: string, type?: 'full' | 'incremental'): Promise<string>; // returns sync job ID
  stopSync(storeId: string): Promise<void>;
  retryFailedSync(storeId: string): Promise<SyncResult>;
}

/**
 * Store connection management service interface
 */
export interface StoreConnectionService {
  // Connection CRUD
  createConnection(connection: Omit<StoreConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoreConnection>;
  getConnection(storeId: string): Promise<StoreConnection | null>;
  updateConnection(storeId: string, updates: Partial<StoreConnection>): Promise<StoreConnection>;
  deleteConnection(storeId: string): Promise<void>;
  
  // Connection management
  listConnections(organizationId: string): Promise<StoreConnection[]>;
  validateConnection(storeId: string): Promise<ConnectionStatus>;
  refreshConnection(storeId: string): Promise<StoreConnection>;
  
  // Health checks
  checkAllConnections(organizationId: string): Promise<Record<string, ConnectionStatus>>;
}

/**
 * Product data service interface
 */
export interface ProductDataService {
  // Product CRUD
  createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product>;
  getProduct(productId: string): Promise<Product | null>;
  updateProduct(productId: string, updates: Partial<Product>): Promise<Product>;
  deleteProduct(productId: string): Promise<void>;
  
  // Bulk operations
  createProducts(products: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Product[]>;
  updateProducts(updates: Array<{ id: string; data: Partial<Product> }>): Promise<Product[]>;
  deleteProducts(productIds: string[]): Promise<void>;
  
  // Queries
  getProductsByStore(storeId: string, options?: { limit?: number; offset?: number }): Promise<Product[]>;
  searchProducts(storeId: string, query: string): Promise<Product[]>;
  getProductCount(storeId: string): Promise<number>;
  
  // Sync-related operations
  getProductsForSync(storeId: string, lastSyncAt?: Date): Promise<Product[]>;
  markProductsSynced(productIds: string[]): Promise<void>;
}

// ============================================================================
// Error Handling and Recovery Interfaces
// ============================================================================

/**
 * Error recovery service interface
 */
export interface ErrorRecoveryService {
  // Automatic recovery
  retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelay: number
  ): Promise<T>;
  
  // Connection recovery
  recoverConnection(storeId: string): Promise<StoreConnection>;
  handleTokenExpiry(storeId: string): Promise<void>;
  
  // Sync recovery
  recoverFailedSync(storeId: string): Promise<SyncResult>;
  handleSyncErrors(storeId: string, errors: string[]): Promise<void>;
  
  // Circuit breaker
  isCircuitOpen(serviceKey: string): boolean;
  recordSuccess(serviceKey: string): void;
  recordFailure(serviceKey: string): void;
}

/**
 * Logging and monitoring service interface
 */
export interface LoggingService {
  // Sync logging
  logSyncStart(storeId: string, type: 'full' | 'incremental'): Promise<string>; // returns log ID
  logSyncProgress(logId: string, progress: number, message?: string): Promise<void>;
  logSyncComplete(logId: string, result: SyncResult): Promise<void>;
  logSyncError(logId: string, error: Error): Promise<void>;
  
  // Connection logging
  logConnectionEvent(storeId: string, event: string, details?: any): Promise<void>;
  logApiCall(storeId: string, endpoint: string, duration: number, success: boolean): Promise<void>;
  
  // Error logging
  logError(error: Error, context?: Record<string, any>): Promise<void>;
  logWarning(message: string, context?: Record<string, any>): Promise<void>;
}

// ============================================================================
// Configuration and Health Interfaces
// ============================================================================

/**
 * Configuration service interface
 */
export interface ConfigurationService {
  // Configuration management
  getConfig(): Promise<any>;
  updateConfig(updates: Partial<any>): Promise<void>;
  validateConfig(): Promise<ValidationResult>;
  
  // Environment-specific settings
  isDevelopment(): boolean;
  isProduction(): boolean;
  getApiKeys(): Promise<Record<string, string>>;
}

/**
 * Health check service interface
 */
export interface HealthCheckService {
  // System health
  checkSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, { status: string; message?: string; duration: number }>;
  }>;
  
  // Component health
  checkDatabaseHealth(): Promise<{ status: string; latency: number }>;
  checkPlatformHealth(platform: string): Promise<{ status: string; latency: number }>;
  checkCacheHealth(): Promise<{ status: string; hitRate: number }>;
  
  // Performance metrics
  getPerformanceMetrics(): Promise<{
    avgResponseTime: number;
    errorRate: number;
    throughput: number;
  }>;
}

// ============================================================================
// Cache and Performance Interfaces
// ============================================================================

/**
 * Cache service interface
 */
export interface CacheService {
  // Basic cache operations
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  
  // Batch operations
  getMany<T>(keys: string[]): Promise<(T | null)[]>;
  setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
  
  // Cache management
  exists(key: string): Promise<boolean>;
  getTTL(key: string): Promise<number>;
  getStats(): Promise<{ hits: number; misses: number; hitRate: number }>;
}

/**
 * Performance monitoring service interface
 */
export interface PerformanceService {
  // Timing
  startTimer(operation: string): string; // returns timer ID
  endTimer(timerId: string): number; // returns duration in ms
  
  // Metrics collection
  recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void>;
  incrementCounter(name: string, tags?: Record<string, string>): Promise<void>;
  
  // Performance analysis
  getAverageResponseTime(operation: string, timeRange?: string): Promise<number>;
  getErrorRate(operation: string, timeRange?: string): Promise<number>;
  getThroughput(operation: string, timeRange?: string): Promise<number>;
}

// ============================================================================
// Event and Notification Interfaces
// ============================================================================

/**
 * Event service interface for pub/sub functionality
 */
export interface EventService {
  // Event publishing
  publish(event: string, data: any): Promise<void>;
  
  // Event subscription
  subscribe(event: string, handler: (data: any) => Promise<void>): Promise<void>;
  unsubscribe(event: string, handler: (data: any) => Promise<void>): Promise<void>;
  
  // Event types
  publishSyncStarted(storeId: string, type: 'full' | 'incremental'): Promise<void>;
  publishSyncCompleted(storeId: string, result: SyncResult): Promise<void>;
  publishSyncFailed(storeId: string, error: Error): Promise<void>;
  publishConnectionStatusChanged(storeId: string, status: ConnectionStatus): Promise<void>;
}

/**
 * Notification service interface
 */
export interface NotificationService {
  // User notifications
  notifyUser(userId: string, message: string, type: 'info' | 'warning' | 'error'): Promise<void>;
  notifyOrganization(orgId: string, message: string, type: 'info' | 'warning' | 'error'): Promise<void>;
  
  // System notifications
  notifySystemError(error: Error, context?: Record<string, any>): Promise<void>;
  notifyPerformanceIssue(metric: string, value: number, threshold: number): Promise<void>;
  
  // Sync notifications
  notifySyncCompleted(storeId: string, result: SyncResult): Promise<void>;
  notifySyncFailed(storeId: string, error: Error): Promise<void>;
}