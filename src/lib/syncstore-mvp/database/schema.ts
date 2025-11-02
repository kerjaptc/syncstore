/**
 * SyncStore MVP Database Schema
 * 
 * This file defines the database schema specifically for the SyncStore MVP,
 * focusing on the core tables needed for Shopee integration and product synchronization.
 * It extends the existing schema with MVP-specific optimizations.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  boolean,
  decimal,
  integer,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// ============================================================================
// MVP Core Tables
// ============================================================================

/**
 * Store connections table - MVP focused store connections
 * Simplified version focusing on Shopee integration only
 */
export const mvpStoreConnections = pgTable(
  'mvp_store_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(), // References organizations.id
    platform: varchar('platform', { length: 50 }).notNull().default('shopee'),
    storeId: varchar('store_id', { length: 255 }).notNull(), // Shopee shop_id
    storeName: varchar('store_name', { length: 255 }).notNull(),
    
    // Encrypted credentials (stored separately for security)
    credentialsId: uuid('credentials_id').notNull(), // References encrypted storage
    
    status: varchar('status', { length: 50 }).notNull().default('active'), // active, expired, error
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    
    // Connection health tracking
    lastHealthCheck: timestamp('last_health_check', { withTimezone: true }),
    healthStatus: varchar('health_status', { length: 50 }).default('unknown'), // healthy, degraded, unhealthy, unknown
    
    // Metadata
    metadata: jsonb('metadata').default('{}').notNull(),
    
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('mvp_store_connections_org_idx').on(table.organizationId),
    storeIdUnique: unique('mvp_store_connections_store_id_unique').on(table.storeId),
    statusIdx: index('mvp_store_connections_status_idx').on(table.status),
    healthIdx: index('mvp_store_connections_health_idx').on(table.healthStatus),
    lastSyncIdx: index('mvp_store_connections_last_sync_idx').on(table.lastSyncAt),
  })
);

/**
 * Products table - MVP simplified product storage
 * Stores synchronized products from Shopee
 */
export const mvpProducts = pgTable(
  'mvp_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: varchar('store_id', { length: 255 }).notNull(), // References mvp_store_connections.storeId
    
    // Shopee product identifiers
    platformProductId: varchar('platform_product_id', { length: 255 }).notNull(), // Shopee item_id
    
    // Product information
    name: varchar('name', { length: 500 }).notNull(),
    description: text('description'),
    sku: varchar('sku', { length: 255 }).notNull(),
    price: decimal('price', { precision: 12, scale: 2 }).notNull(),
    stock: integer('stock').notNull().default(0),
    
    // Images and media
    images: jsonb('images').default('[]').notNull(), // Array of image URLs
    
    // Status and sync tracking
    status: varchar('status', { length: 50 }).notNull().default('active'), // active, inactive
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }).notNull(),
    
    // Raw platform data for debugging
    platformData: jsonb('platform_data').default('{}').notNull(),
    
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storeProductUnique: unique('mvp_products_store_product_unique').on(table.storeId, table.platformProductId),
    storeIdx: index('mvp_products_store_idx').on(table.storeId),
    skuIdx: index('mvp_products_sku_idx').on(table.sku),
    statusIdx: index('mvp_products_status_idx').on(table.status),
    lastSyncIdx: index('mvp_products_last_sync_idx').on(table.lastSyncAt),
    nameIdx: index('mvp_products_name_idx').on(table.name),
  })
);

/**
 * Sync status table - Real-time sync operation tracking
 * Tracks the status of ongoing sync operations
 */
export const mvpSyncStatus = pgTable(
  'mvp_sync_status',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: varchar('store_id', { length: 255 }).notNull(), // References mvp_store_connections.storeId
    
    // Sync operation details
    status: varchar('status', { length: 50 }).notNull().default('idle'), // idle, syncing, completed, error
    progress: integer('progress').notNull().default(0), // 0-100
    totalProducts: integer('total_products').notNull().default(0),
    syncedProducts: integer('synced_products').notNull().default(0),
    
    // Error tracking
    errors: jsonb('errors').default('[]').notNull(), // Array of error messages
    
    // Timing
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    
    // Metadata
    syncType: varchar('sync_type', { length: 50 }).default('full'), // full, incremental
    metadata: jsonb('metadata').default('{}').notNull(),
    
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storeUnique: unique('mvp_sync_status_store_unique').on(table.storeId),
    statusIdx: index('mvp_sync_status_status_idx').on(table.status),
    progressIdx: index('mvp_sync_status_progress_idx').on(table.progress),
    startedAtIdx: index('mvp_sync_status_started_at_idx').on(table.startedAt),
  })
);

/**
 * Sync logs table - Detailed sync operation history
 * Stores historical sync operations and their results
 */
export const mvpSyncLogs = pgTable(
  'mvp_sync_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: varchar('store_id', { length: 255 }).notNull(), // References mvp_store_connections.storeId
    
    // Sync operation details
    type: varchar('type', { length: 50 }).notNull(), // full, incremental
    status: varchar('status', { length: 50 }).notNull(), // running, completed, failed
    
    // Results
    productsProcessed: integer('products_processed').notNull().default(0),
    productsSucceeded: integer('products_succeeded').notNull().default(0),
    productsFailed: integer('products_failed').notNull().default(0),
    
    // Error tracking
    errors: jsonb('errors').default('[]').notNull(), // Array of error messages
    
    // Timing
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    duration: integer('duration'), // Duration in milliseconds
    
    // Metadata
    metadata: jsonb('metadata').default('{}').notNull(),
    
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('mvp_sync_logs_store_idx').on(table.storeId),
    statusIdx: index('mvp_sync_logs_status_idx').on(table.status),
    typeIdx: index('mvp_sync_logs_type_idx').on(table.type),
    startedAtIdx: index('mvp_sync_logs_started_at_idx').on(table.startedAt),
    createdAtIdx: index('mvp_sync_logs_created_at_idx').on(table.createdAt),
  })
);

/**
 * Encrypted credentials table - Secure credential storage
 * Stores encrypted OAuth tokens and sensitive data
 */
export const mvpEncryptedCredentials = pgTable(
  'mvp_encrypted_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    
    // Encrypted data
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    encryptedRefreshToken: text('encrypted_refresh_token').notNull(),
    
    // Token metadata
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    tokenType: varchar('token_type', { length: 50 }).default('bearer').notNull(),
    
    // Encryption metadata
    encryptionVersion: varchar('encryption_version', { length: 10 }).default('v1').notNull(),
    encryptedAt: timestamp('encrypted_at', { withTimezone: true }).defaultNow().notNull(),
    
    // Audit trail
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    usageCount: integer('usage_count').default(0).notNull(),
    
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    expiresAtIdx: index('mvp_encrypted_credentials_expires_at_idx').on(table.expiresAt),
    lastUsedIdx: index('mvp_encrypted_credentials_last_used_idx').on(table.lastUsedAt),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const mvpStoreConnectionsRelations = relations(mvpStoreConnections, ({ one, many }) => ({
  credentials: one(mvpEncryptedCredentials, {
    fields: [mvpStoreConnections.credentialsId],
    references: [mvpEncryptedCredentials.id],
  }),
  products: many(mvpProducts),
  syncStatus: one(mvpSyncStatus),
  syncLogs: many(mvpSyncLogs),
}));

export const mvpProductsRelations = relations(mvpProducts, ({ one }) => ({
  storeConnection: one(mvpStoreConnections, {
    fields: [mvpProducts.storeId],
    references: [mvpStoreConnections.storeId],
  }),
}));

export const mvpSyncStatusRelations = relations(mvpSyncStatus, ({ one }) => ({
  storeConnection: one(mvpStoreConnections, {
    fields: [mvpSyncStatus.storeId],
    references: [mvpStoreConnections.storeId],
  }),
}));

export const mvpSyncLogsRelations = relations(mvpSyncLogs, ({ one }) => ({
  storeConnection: one(mvpStoreConnections, {
    fields: [mvpSyncLogs.storeId],
    references: [mvpStoreConnections.storeId],
  }),
}));

export const mvpEncryptedCredentialsRelations = relations(mvpEncryptedCredentials, ({ many }) => ({
  storeConnections: many(mvpStoreConnections),
}));

// ============================================================================
// Zod Schemas for Type Safety
// ============================================================================

// Store connection schemas
export const insertMvpStoreConnectionSchema = createInsertSchema(mvpStoreConnections);
export const selectMvpStoreConnectionSchema = createSelectSchema(mvpStoreConnections);
export type InsertMvpStoreConnection = z.infer<typeof insertMvpStoreConnectionSchema>;
export type SelectMvpStoreConnection = z.infer<typeof selectMvpStoreConnectionSchema>;

// Product schemas
export const insertMvpProductSchema = createInsertSchema(mvpProducts);
export const selectMvpProductSchema = createSelectSchema(mvpProducts);
export type InsertMvpProduct = z.infer<typeof insertMvpProductSchema>;
export type SelectMvpProduct = z.infer<typeof selectMvpProductSchema>;

// Sync status schemas
export const insertMvpSyncStatusSchema = createInsertSchema(mvpSyncStatus);
export const selectMvpSyncStatusSchema = createSelectSchema(mvpSyncStatus);
export type InsertMvpSyncStatus = z.infer<typeof insertMvpSyncStatusSchema>;
export type SelectMvpSyncStatus = z.infer<typeof selectMvpSyncStatusSchema>;

// Sync log schemas
export const insertMvpSyncLogSchema = createInsertSchema(mvpSyncLogs);
export const selectMvpSyncLogSchema = createSelectSchema(mvpSyncLogs);
export type InsertMvpSyncLog = z.infer<typeof insertMvpSyncLogSchema>;
export type SelectMvpSyncLog = z.infer<typeof selectMvpSyncLogSchema>;

// Encrypted credentials schemas
export const insertMvpEncryptedCredentialsSchema = createInsertSchema(mvpEncryptedCredentials);
export const selectMvpEncryptedCredentialsSchema = createSelectSchema(mvpEncryptedCredentials);
export type InsertMvpEncryptedCredentials = z.infer<typeof insertMvpEncryptedCredentialsSchema>;
export type SelectMvpEncryptedCredentials = z.infer<typeof selectMvpEncryptedCredentialsSchema>;

// ============================================================================
// Database Connection and Configuration
// ============================================================================

/**
 * MVP Database configuration
 */
export interface MvpDatabaseConfig {
  connectionString: string;
  maxConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  ssl: boolean;
}

/**
 * Database connection pool configuration
 */
export const mvpDatabaseConfig: MvpDatabaseConfig = {
  connectionString: process.env.DATABASE_URL || '',
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10),
  idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '600000', 10), // 10 minutes
  ssl: process.env.NODE_ENV === 'production',
};

// ============================================================================
// Migration Utilities
// ============================================================================

/**
 * SQL for creating MVP tables
 * This would be used in a migration file
 */
export const createMvpTablesSQL = `
-- Create MVP store connections table
CREATE TABLE IF NOT EXISTS mvp_store_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  platform VARCHAR(50) NOT NULL DEFAULT 'shopee',
  store_id VARCHAR(255) NOT NULL,
  store_name VARCHAR(255) NOT NULL,
  credentials_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_health_check TIMESTAMP WITH TIME ZONE,
  health_status VARCHAR(50) DEFAULT 'unknown',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT mvp_store_connections_store_id_unique UNIQUE (store_id)
);

-- Create MVP products table
CREATE TABLE IF NOT EXISTS mvp_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255) NOT NULL,
  platform_product_id VARCHAR(255) NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  sku VARCHAR(255) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  images JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL,
  platform_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT mvp_products_store_product_unique UNIQUE (store_id, platform_product_id)
);

-- Create MVP sync status table
CREATE TABLE IF NOT EXISTS mvp_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'idle',
  progress INTEGER NOT NULL DEFAULT 0,
  total_products INTEGER NOT NULL DEFAULT 0,
  synced_products INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  sync_type VARCHAR(50) DEFAULT 'full',
  metadata JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT mvp_sync_status_store_unique UNIQUE (store_id)
);

-- Create MVP sync logs table
CREATE TABLE IF NOT EXISTS mvp_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  products_processed INTEGER NOT NULL DEFAULT 0,
  products_succeeded INTEGER NOT NULL DEFAULT 0,
  products_failed INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create MVP encrypted credentials table
CREATE TABLE IF NOT EXISTS mvp_encrypted_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  token_type VARCHAR(50) NOT NULL DEFAULT 'bearer',
  encryption_version VARCHAR(10) NOT NULL DEFAULT 'v1',
  encrypted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS mvp_store_connections_org_idx ON mvp_store_connections(organization_id);
CREATE INDEX IF NOT EXISTS mvp_store_connections_status_idx ON mvp_store_connections(status);
CREATE INDEX IF NOT EXISTS mvp_store_connections_health_idx ON mvp_store_connections(health_status);
CREATE INDEX IF NOT EXISTS mvp_store_connections_last_sync_idx ON mvp_store_connections(last_sync_at);

CREATE INDEX IF NOT EXISTS mvp_products_store_idx ON mvp_products(store_id);
CREATE INDEX IF NOT EXISTS mvp_products_sku_idx ON mvp_products(sku);
CREATE INDEX IF NOT EXISTS mvp_products_status_idx ON mvp_products(status);
CREATE INDEX IF NOT EXISTS mvp_products_last_sync_idx ON mvp_products(last_sync_at);
CREATE INDEX IF NOT EXISTS mvp_products_name_idx ON mvp_products(name);

CREATE INDEX IF NOT EXISTS mvp_sync_status_status_idx ON mvp_sync_status(status);
CREATE INDEX IF NOT EXISTS mvp_sync_status_progress_idx ON mvp_sync_status(progress);
CREATE INDEX IF NOT EXISTS mvp_sync_status_started_at_idx ON mvp_sync_status(started_at);

CREATE INDEX IF NOT EXISTS mvp_sync_logs_store_idx ON mvp_sync_logs(store_id);
CREATE INDEX IF NOT EXISTS mvp_sync_logs_status_idx ON mvp_sync_logs(status);
CREATE INDEX IF NOT EXISTS mvp_sync_logs_type_idx ON mvp_sync_logs(type);
CREATE INDEX IF NOT EXISTS mvp_sync_logs_started_at_idx ON mvp_sync_logs(started_at);
CREATE INDEX IF NOT EXISTS mvp_sync_logs_created_at_idx ON mvp_sync_logs(created_at);

CREATE INDEX IF NOT EXISTS mvp_encrypted_credentials_expires_at_idx ON mvp_encrypted_credentials(expires_at);
CREATE INDEX IF NOT EXISTS mvp_encrypted_credentials_last_used_idx ON mvp_encrypted_credentials(last_used_at);
`;

/**
 * SQL for dropping MVP tables (for rollback)
 */
export const dropMvpTablesSQL = `
DROP TABLE IF EXISTS mvp_sync_logs;
DROP TABLE IF EXISTS mvp_sync_status;
DROP TABLE IF EXISTS mvp_products;
DROP TABLE IF EXISTS mvp_store_connections;
DROP TABLE IF EXISTS mvp_encrypted_credentials;
`;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates database configuration
 */
export function validateDatabaseConfig(config: Partial<MvpDatabaseConfig>): string[] {
  const errors: string[] = [];
  
  if (!config.connectionString) {
    errors.push('Database connection string is required');
  }
  
  if (config.maxConnections && (config.maxConnections < 1 || config.maxConnections > 100)) {
    errors.push('Max connections must be between 1 and 100');
  }
  
  if (config.connectionTimeout && config.connectionTimeout < 1000) {
    errors.push('Connection timeout must be at least 1000ms');
  }
  
  if (config.idleTimeout && config.idleTimeout < 60000) {
    errors.push('Idle timeout must be at least 60000ms (1 minute)');
  }
  
  return errors;
}