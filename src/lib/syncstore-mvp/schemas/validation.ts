/**
 * SyncStore MVP Validation Schemas
 * 
 * This file contains Zod validation schemas for all data types used in the SyncStore MVP.
 * These schemas ensure data integrity and provide runtime type checking.
 */

import { z } from 'zod';

// ============================================================================
// Core Data Validation Schemas
// ============================================================================

export const StoreConnectionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  platform: z.literal('shopee'),
  storeId: z.string().min(1, 'Store ID is required'),
  storeName: z.string().min(1, 'Store name is required'),
  credentials: z.object({
    accessToken: z.string().min(1, 'Access token is required'),
    refreshToken: z.string().min(1, 'Refresh token is required'),
    expiresAt: z.date(),
  }),
  status: z.enum(['active', 'expired', 'error']),
  lastSyncAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ProductSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  platformProductId: z.string().min(1, 'Platform product ID is required'),
  name: z.string().min(1, 'Product name is required').max(500, 'Product name too long'),
  description: z.string().max(5000, 'Description too long').optional(),
  sku: z.string().min(1, 'SKU is required').max(255, 'SKU too long'),
  price: z.number().min(0, 'Price must be non-negative').max(999999.99, 'Price too high'),
  stock: z.number().int().min(0, 'Stock must be non-negative'),
  images: z.array(z.string().url('Invalid image URL')),
  status: z.enum(['active', 'inactive']),
  lastSyncAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SyncStatusSchema = z.object({
  storeId: z.string().uuid(),
  status: z.enum(['idle', 'syncing', 'completed', 'error']),
  progress: z.number().min(0).max(100),
  totalProducts: z.number().int().min(0),
  syncedProducts: z.number().int().min(0),
  errors: z.array(z.string()),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
});

export const SyncLogSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  type: z.enum(['full', 'incremental']),
  status: z.enum(['running', 'completed', 'failed']),
  productsProcessed: z.number().int().min(0),
  errors: z.array(z.string()),
  startedAt: z.date(),
  completedAt: z.date().optional(),
});

// ============================================================================
// Shopee API Validation Schemas
// ============================================================================

export const ShopeeProductSchema = z.object({
  item_id: z.number().int().positive(),
  item_name: z.string().min(1, 'Item name is required'),
  item_sku: z.string().min(1, 'Item SKU is required'),
  description: z.string(),
  price: z.number().min(0, 'Price must be non-negative'),
  stock: z.number().int().min(0, 'Stock must be non-negative'),
  images: z.array(z.string().url('Invalid image URL')),
  item_status: z.enum(['NORMAL', 'DELETED', 'BANNED']),
  create_time: z.number().int().positive(),
  update_time: z.number().int().positive(),
});

export const ShopeeOAuthCredentialsSchema = z.object({
  access_token: z.string().min(1, 'Access token is required'),
  refresh_token: z.string().min(1, 'Refresh token is required'),
  expires_in: z.number().int().positive(),
  shop_id: z.number().int().positive(),
});

export const ShopeeApiResponseSchema = <T>(dataSchema: z.ZodSchema<T>) =>
  z.object({
    error: z.string(),
    message: z.string(),
    response: dataSchema,
  });

// ============================================================================
// Request/Response Validation Schemas
// ============================================================================

export const OAuthInitiationRequestSchema = z.object({
  organizationId: z.string().uuid(),
});

export const OAuthCallbackRequestSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
});

export const FetchOptionsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  lastSyncAt: z.date().optional(),
});

export const SyncRequestSchema = z.object({
  storeId: z.string().uuid(),
  type: z.enum(['full', 'incremental']).optional().default('full'),
});

// ============================================================================
// Configuration Validation Schema
// ============================================================================

export const SyncStoreConfigSchema = z.object({
  shopee: z.object({
    partnerId: z.string().min(1, 'Shopee Partner ID is required'),
    partnerKey: z.string().min(1, 'Shopee Partner Key is required'),
    baseUrl: z.string().url('Invalid Shopee API base URL'),
    redirectUrl: z.string().url('Invalid redirect URL'),
  }),
  database: z.object({
    connectionString: z.string().min(1, 'Database connection string is required'),
    maxConnections: z.number().int().min(1).max(100),
  }),
  sync: z.object({
    batchSize: z.number().int().min(1).max(1000),
    retryAttempts: z.number().int().min(0).max(10),
    retryDelay: z.number().int().min(100).max(60000),
  }),
});

// ============================================================================
// Error Validation Schemas
// ============================================================================

export const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  context: z.record(z.any()).optional(),
});

export const ValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  value: z.any().optional(),
});

// ============================================================================
// Utility Functions for Validation
// ============================================================================

/**
 * Validates data against a schema and throws a ValidationError if invalid
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown, fieldName: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
    throw new Error(`Validation failed for ${fieldName}: ${errors.join(', ')}`);
  }
  return result.data;
}

/**
 * Validates data against a schema and returns validation result
 */
export function validateDataSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
  return { success: false, errors };
}

/**
 * Creates a partial schema for update operations
 */
export function createUpdateSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial();
}

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type StoreConnection = z.infer<typeof StoreConnectionSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type SyncStatus = z.infer<typeof SyncStatusSchema>;
export type SyncLog = z.infer<typeof SyncLogSchema>;
export type ShopeeProduct = z.infer<typeof ShopeeProductSchema>;
export type ShopeeOAuthCredentials = z.infer<typeof ShopeeOAuthCredentialsSchema>;
export type FetchOptions = z.infer<typeof FetchOptionsSchema>;
export type SyncRequest = z.infer<typeof SyncRequestSchema>;
export type SyncStoreConfig = z.infer<typeof SyncStoreConfigSchema>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Checks if a store connection is valid (not expired)
 */
export function isConnectionValid(connection: StoreConnection): boolean {
  if (connection.status !== 'active') {
    return false;
  }
  
  const now = new Date();
  const expiresAt = connection.credentials.expiresAt;
  
  // Check if token is expired (with 5 minute buffer)
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
  return expiresAt.getTime() > (now.getTime() + bufferTime);
}