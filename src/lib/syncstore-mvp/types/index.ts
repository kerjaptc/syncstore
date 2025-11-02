/**
 * SyncStore MVP Core Types
 * 
 * This file contains all core TypeScript interfaces and types for the SyncStore MVP,
 * focusing on Shopee integration and product synchronization.
 */

// ============================================================================
// Core Data Models
// ============================================================================

export interface StoreConnection {
  id: string;
  organizationId: string;
  platform: 'shopee';
  storeId: string;
  storeName: string;
  credentials: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  };
  status: 'active' | 'expired' | 'error';
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  storeId: string;
  platformProductId: string;
  name: string;
  description?: string;
  sku: string;
  price: number;
  stock: number;
  images: string[];
  status: 'active' | 'inactive';
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncStatus {
  storeId: string;
  status: 'idle' | 'syncing' | 'completed' | 'error';
  progress: number; // 0-100
  totalProducts: number;
  syncedProducts: number;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
}

export interface SyncLog {
  id: string;
  storeId: string;
  type: 'full' | 'incremental';
  status: 'running' | 'completed' | 'failed';
  productsProcessed: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
}

// ============================================================================
// Shopee API Types
// ============================================================================

export interface ShopeeProduct {
  item_id: number;
  item_name: string;
  item_sku: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
  item_status: 'NORMAL' | 'DELETED' | 'BANNED';
  create_time: number;
  update_time: number;
}

export interface ShopeeOAuthCredentials {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  shop_id: number;
}

export interface ShopeeApiResponse<T> {
  error: string;
  message: string;
  response: T;
}

// ============================================================================
// Service Interfaces
// ============================================================================

export interface ShopeeIntegrationService {
  // Connection management
  initiateOAuth(organizationId: string): Promise<{ authUrl: string; state: string }>;
  handleOAuthCallback(code: string, state: string): Promise<StoreConnection>;
  refreshAccessToken(storeId: string): Promise<void>;
  
  // Product operations
  fetchAllProducts(storeId: string): Promise<ShopeeProduct[]>;
  getProductDetails(storeId: string, productId: string): Promise<ShopeeProduct>;
  
  // Health checks
  validateConnection(storeId: string): Promise<ConnectionStatus>;
}

export interface ProductSyncService {
  // Sync operations
  syncStoreProducts(storeId: string): Promise<SyncResult>;
  syncSingleProduct(storeId: string, productId: string): Promise<Product>;
  
  // Data management
  transformShopeeProduct(shopeeProduct: ShopeeProduct): Promise<Product>;
  validateProductData(product: Product): Promise<ValidationResult>;
  
  // Status tracking
  getSyncStatus(storeId: string): Promise<SyncStatus>;
  getSyncHistory(storeId: string): Promise<SyncLog[]>;
}

export interface PlatformAdapter {
  authenticate(credentials: OAuthCredentials): Promise<void>;
  fetchProducts(options: FetchOptions): Promise<Product[]>;
  validateConnection(): Promise<boolean>;
  handleRateLimit(): Promise<void>;
}

// ============================================================================
// API and Request Types
// ============================================================================

export interface AuthUrl {
  url: string;
  state: string;
}

export interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface FetchOptions {
  limit?: number;
  offset?: number;
  lastSyncAt?: Date;
}

export interface SyncResult {
  success: boolean;
  productsProcessed: number;
  errors: string[];
  duration: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConnectionStatus {
  isValid: boolean;
  error?: string;
  lastChecked: Date;
}

// ============================================================================
// Error Types
// ============================================================================

export class SyncStoreError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'SyncStoreError';
  }
}

export class ShopeeApiError extends SyncStoreError {
  constructor(
    message: string,
    public apiCode: string,
    public retryAfter?: number,
    context?: Record<string, any>
  ) {
    super(message, 'SHOPEE_API_ERROR', context);
    this.name = 'ShopeeApiError';
  }
}

export class ValidationError extends SyncStoreError {
  constructor(message: string, public field: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class ConnectionError extends SyncStoreError {
  constructor(message: string, public storeId: string, context?: Record<string, any>) {
    super(message, 'CONNECTION_ERROR', context);
    this.name = 'ConnectionError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export type Platform = 'shopee';

export type SyncType = 'full' | 'incremental';

export type ProductStatus = 'active' | 'inactive';

export type ConnectionStatusType = 'active' | 'expired' | 'error';

export type SyncStatusType = 'idle' | 'syncing' | 'completed' | 'error';

// ============================================================================
// Configuration Types
// ============================================================================

export interface SyncStoreConfig {
  shopee: {
    partnerId: string;
    partnerKey: string;
    baseUrl: string;
    redirectUrl: string;
  };
  database: {
    connectionString: string;
    maxConnections: number;
  };
  sync: {
    batchSize: number;
    retryAttempts: number;
    retryDelay: number;
  };
}

// ============================================================================
// Database Schema Types (for Drizzle)
// ============================================================================

export interface StoreConnectionSchema {
  id: string;
  organizationId: string;
  platform: string;
  storeId: string;
  storeName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  status: string;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSchema {
  id: string;
  storeId: string;
  platformProductId: string;
  name: string;
  description: string | null;
  sku: string;
  price: number;
  stock: number;
  images: string;
  status: string;
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncLogSchema {
  id: string;
  storeId: string;
  type: string;
  status: string;
  productsProcessed: number;
  errors: string;
  startedAt: Date;
  completedAt: Date | null;
}