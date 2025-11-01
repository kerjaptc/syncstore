/**
 * Master Catalog Database Schema
 * Database tables for the master product catalog system
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

/**
 * Master products table - Central product catalog
 * Single source of truth for all products across platforms
 */
export const masterProducts = pgTable(
  'master_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(), // References organizations.id
    masterSku: varchar('master_sku', { length: 255 }).notNull(),
    
    // Universal fields (common across platforms)
    name: varchar('name', { length: 500 }).notNull(),
    description: text('description').notNull(),
    weight: decimal('weight', { precision: 8, scale: 3 }).notNull(), // kg with 3 decimal precision
    dimensions: jsonb('dimensions').notNull(), // {length, width, height, unit}
    
    // Normalized universal data
    images: jsonb('images').notNull().default('[]'), // Array of ProductImage objects
    category: jsonb('category').notNull(), // ProductCategory object
    brand: varchar('brand', { length: 255 }).notNull(),
    
    // Pricing information
    basePrice: decimal('base_price', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('IDR'),
    costPrice: decimal('cost_price', { precision: 12, scale: 2 }),
    platformPrices: jsonb('platform_prices').notNull().default('{}'), // Platform-specific calculated prices
    
    // Variants
    hasVariants: boolean('has_variants').notNull().default(false),
    
    // SEO and marketing
    seoData: jsonb('seo_data').default('{}'), // SEO optimization data
    tags: jsonb('tags').notNull().default('[]'), // Array of strings
    
    // Inventory tracking
    totalStock: integer('total_stock').notNull().default(0),
    reservedStock: integer('reserved_stock').notNull().default(0),
    availableStock: integer('available_stock').notNull().default(0),
    
    // Quality and validation
    dataQualityScore: integer('data_quality_score'), // 0-100
    validationErrors: jsonb('validation_errors').notNull().default('[]'),
    validationWarnings: jsonb('validation_warnings').notNull().default('[]'),
    
    // Product status and metadata
    status: varchar('status', { length: 20 }).notNull().default('draft'), // active, inactive, draft, archived
    
    // Import metadata
    importSource: varchar('import_source', { length: 50 }), // shopee, tiktokshop, manual, bulk_import
    importedAt: timestamp('imported_at', { withTimezone: true }),
    importBatchId: varchar('import_batch_id', { length: 255 }),
    
    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: text('created_by'), // Clerk user ID
    updatedBy: text('updated_by'), // Clerk user ID
  },
  (table) => ({
    // Unique constraints
    orgSkuUnique: unique('master_products_org_sku_unique').on(table.organizationId, table.masterSku),
    
    // Performance indexes
    orgIdx: index('master_products_org_idx').on(table.organizationId),
    skuIdx: index('master_products_sku_idx').on(table.masterSku),
    statusIdx: index('master_products_status_idx').on(table.status),
    brandIdx: index('master_products_brand_idx').on(table.brand),
    importSourceIdx: index('master_products_import_source_idx').on(table.importSource),
    importBatchIdx: index('master_products_import_batch_idx').on(table.importBatchId),
    qualityScoreIdx: index('master_products_quality_score_idx').on(table.dataQualityScore),
    createdAtIdx: index('master_products_created_at_idx').on(table.createdAt),
    updatedAtIdx: index('master_products_updated_at_idx').on(table.updatedAt),
  })
);

/**
 * Master product variants table - Product variations
 * Handles different variants of master products (size, color, etc.)
 */
export const masterProductVariants = pgTable(
  'master_product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterProductId: uuid('master_product_id').references(() => masterProducts.id, { onDelete: 'cascade' }).notNull(),
    variantSku: varchar('variant_sku', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    
    // Variant-specific attributes
    attributes: jsonb('attributes').notNull().default('{}'), // {color: "red", size: "M"}
    
    // Variant-specific pricing and inventory
    priceOverride: decimal('price_override', { precision: 12, scale: 2 }), // Override base price if needed
    stock: integer('stock').notNull().default(0),
    reservedStock: integer('reserved_stock').notNull().default(0),
    
    // Variant-specific data
    images: jsonb('images').default('[]'), // Variant-specific images
    weight: decimal('weight', { precision: 8, scale: 3 }), // Override weight if different
    
    // Status
    isActive: boolean('is_active').notNull().default(true),
    
    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraints
    productVariantUnique: unique('master_product_variants_product_variant_unique').on(
      table.masterProductId, 
      table.variantSku
    ),
    
    // Performance indexes
    productIdx: index('master_product_variants_product_idx').on(table.masterProductId),
    skuIdx: index('master_product_variants_sku_idx').on(table.variantSku),
    activeIdx: index('master_product_variants_active_idx').on(table.isActive),
  })
);

/**
 * Platform mappings table - Links master products to platform-specific data
 * Stores platform-specific product mappings and sync status
 */
export const platformMappings = pgTable(
  'platform_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterProductId: uuid('master_product_id').references(() => masterProducts.id, { onDelete: 'cascade' }).notNull(),
    masterVariantId: uuid('master_variant_id').references(() => masterProductVariants.id, { onDelete: 'cascade' }),
    
    // Platform identification
    platform: varchar('platform', { length: 50 }).notNull(), // shopee, tiktokshop, website
    platformProductId: varchar('platform_product_id', { length: 255 }).notNull(),
    platformVariantId: varchar('platform_variant_id', { length: 255 }),
    platformSku: varchar('platform_sku', { length: 255 }),
    
    // Platform-specific data (stored as JSONB)
    platformData: jsonb('platform_data').notNull().default('{}'), // Raw platform-specific data
    
    // Sync status and control
    isActive: boolean('is_active').notNull().default(true),
    syncStatus: varchar('sync_status', { length: 20 }).notNull().default('pending'), // synced, pending, error, disabled
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    syncErrors: jsonb('sync_errors').notNull().default('[]'), // Array of error messages
    
    // Platform-specific pricing
    platformPrice: decimal('platform_price', { precision: 12, scale: 2 }),
    feePercentage: decimal('fee_percentage', { precision: 5, scale: 2 }), // Platform fee percentage
    
    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraints
    platformProductUnique: unique('platform_mappings_platform_product_unique').on(
      table.platform,
      table.platformProductId,
      table.platformVariantId
    ),
    
    // Performance indexes
    masterProductIdx: index('platform_mappings_master_product_idx').on(table.masterProductId),
    masterVariantIdx: index('platform_mappings_master_variant_idx').on(table.masterVariantId),
    platformIdx: index('platform_mappings_platform_idx').on(table.platform),
    syncStatusIdx: index('platform_mappings_sync_status_idx').on(table.syncStatus),
    activeIdx: index('platform_mappings_active_idx').on(table.isActive),
    lastSyncIdx: index('platform_mappings_last_sync_idx').on(table.lastSyncAt),
  })
);

/**
 * Import batches table - Tracks import operations
 * Stores metadata about import batches for auditing and rollback
 */
export const importBatches = pgTable(
  'import_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(), // References organizations.id
    batchId: varchar('batch_id', { length: 255 }).notNull().unique(),
    
    // Import metadata
    platform: varchar('platform', { length: 50 }).notNull(), // shopee, tiktokshop
    importType: varchar('import_type', { length: 50 }).notNull(), // full_import, incremental, manual
    
    // Import statistics
    totalProducts: integer('total_products').notNull().default(0),
    successfulProducts: integer('successful_products').notNull().default(0),
    failedProducts: integer('failed_products').notNull().default(0),
    skippedProducts: integer('skipped_products').notNull().default(0),
    
    // Import status
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, running, completed, failed
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    
    // Error tracking
    errors: jsonb('errors').notNull().default('[]'), // Array of error objects
    warnings: jsonb('warnings').notNull().default('[]'), // Array of warning objects
    
    // Configuration and metadata
    importConfig: jsonb('import_config').notNull().default('{}'), // Import configuration used
    rawDataPath: varchar('raw_data_path', { length: 500 }), // Path to raw data files
    
    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: text('created_by'), // Clerk user ID
  },
  (table) => ({
    // Performance indexes
    orgIdx: index('import_batches_org_idx').on(table.organizationId),
    platformIdx: index('import_batches_platform_idx').on(table.platform),
    statusIdx: index('import_batches_status_idx').on(table.status),
    createdAtIdx: index('import_batches_created_at_idx').on(table.createdAt),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const masterProductsRelations = relations(masterProducts, ({ many }) => ({
  variants: many(masterProductVariants),
  platformMappings: many(platformMappings),
}));

export const masterProductVariantsRelations = relations(masterProductVariants, ({ one, many }) => ({
  masterProduct: one(masterProducts, {
    fields: [masterProductVariants.masterProductId],
    references: [masterProducts.id],
  }),
  platformMappings: many(platformMappings),
}));

export const platformMappingsRelations = relations(platformMappings, ({ one }) => ({
  masterProduct: one(masterProducts, {
    fields: [platformMappings.masterProductId],
    references: [masterProducts.id],
  }),
  masterVariant: one(masterProductVariants, {
    fields: [platformMappings.masterVariantId],
    references: [masterProductVariants.id],
  }),
}));

export const importBatchesRelations = relations(importBatches, ({ many }) => ({
  // Note: masterProducts reference importBatchId but no direct relation to avoid circular dependency
}));

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

// Master product schemas
export const insertMasterProductSchema = createInsertSchema(masterProducts);
export const selectMasterProductSchema = createSelectSchema(masterProducts);
export type InsertMasterProduct = z.infer<typeof insertMasterProductSchema>;
export type SelectMasterProduct = z.infer<typeof selectMasterProductSchema>;

// Master product variant schemas
export const insertMasterProductVariantSchema = createInsertSchema(masterProductVariants);
export const selectMasterProductVariantSchema = createSelectSchema(masterProductVariants);
export type InsertMasterProductVariant = z.infer<typeof insertMasterProductVariantSchema>;
export type SelectMasterProductVariant = z.infer<typeof selectMasterProductVariantSchema>;

// Platform mapping schemas
export const insertPlatformMappingSchema = createInsertSchema(platformMappings);
export const selectPlatformMappingSchema = createSelectSchema(platformMappings);
export type InsertPlatformMapping = z.infer<typeof insertPlatformMappingSchema>;
export type SelectPlatformMapping = z.infer<typeof selectPlatformMappingSchema>;

// Import batch schemas
export const insertImportBatchSchema = createInsertSchema(importBatches);
export const selectImportBatchSchema = createSelectSchema(importBatches);
export type InsertImportBatch = z.infer<typeof insertImportBatchSchema>;
export type SelectImportBatch = z.infer<typeof selectImportBatchSchema>;