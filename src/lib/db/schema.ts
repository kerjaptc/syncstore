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
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Import master catalog schema
export * from './master-catalog-schema';

// Import sync logs schema
export * from './sync-logs-schema';

/**
 * Organizations table - Multi-tenant root entity
 * Each organization represents a business using StoreSync
 */
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    settings: jsonb('settings').default('{}').notNull(),
    subscriptionPlan: varchar('subscription_plan', { length: 50 }).default('free').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index('organizations_slug_idx').on(table.slug),
    nameIdx: index('organizations_name_idx').on(table.name),
  })
);

/**
 * Users table - Organization members with role-based access
 * Uses Clerk user IDs as primary keys
 */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(), // Clerk user ID (e.g., "user_xxxxx")
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    fullName: varchar('full_name', { length: 255 }),
    role: varchar('role', { length: 50 }).default('member').notNull(), // owner, admin, member, viewer
    isActive: boolean('is_active').default(true).notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('users_organization_idx').on(table.organizationId),
    emailIdx: index('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
  })
);

/**
 * Refresh tokens table - JWT refresh token storage
 * Stores refresh tokens for secure authentication
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: varchar('session_id', { length: 64 }).notNull().unique(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(), // Hashed refresh token
    isRevoked: boolean('is_revoked').default(false).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('refresh_tokens_session_idx').on(table.sessionId),
    userIdx: index('refresh_tokens_user_idx').on(table.userId),
    expiresIdx: index('refresh_tokens_expires_idx').on(table.expiresAt),
    revokedIdx: index('refresh_tokens_revoked_idx').on(table.isRevoked),
  })
);

/**
 * Revoked tokens table - Blacklist for revoked JWT tokens
 * Stores revoked access tokens until they expire
 */
export const revokedTokens = pgTable(
  'revoked_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    reason: varchar('reason', { length: 100 }), // 'logout', 'security', 'expired', etc.
  },
  (table) => ({
    tokenIdx: index('revoked_tokens_token_idx').on(table.tokenHash),
    userIdx: index('revoked_tokens_user_idx').on(table.userId),
    expiresIdx: index('revoked_tokens_expires_idx').on(table.expiresAt),
  })
);

/**
 * Platforms table - Supported marketplace platforms
 * Defines available platforms for store connections
 */
export const platforms = pgTable(
  'platforms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(), // 'shopee', 'tiktok_shop', 'custom_website'
    displayName: varchar('display_name', { length: 255 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    apiConfig: jsonb('api_config').default('{}').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: unique('platforms_name_unique').on(table.name),
    activeIdx: index('platforms_active_idx').on(table.isActive),
  })
);

/**
 * Stores table - Connected marketplace stores
 * Represents individual store connections to platforms
 */
export const stores = pgTable(
  'stores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    platformId: uuid('platform_id').references(() => platforms.id).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    platformStoreId: varchar('platform_store_id', { length: 255 }).notNull(), // External store ID
    credentials: jsonb('credentials').notNull(), // Encrypted API credentials
    settings: jsonb('settings').default('{}').notNull(),
    syncStatus: varchar('sync_status', { length: 50 }).default('active').notNull(), // active, paused, error
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgPlatformIdx: index('stores_org_platform_idx').on(table.organizationId, table.platformId),
    platformStoreUnique: unique('stores_platform_store_unique').on(table.platformId, table.platformStoreId),
    syncStatusIdx: index('stores_sync_status_idx').on(table.syncStatus),
  })
);

/**
 * Products table - Master product catalog
 * Central source of truth for all products
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    sku: varchar('sku', { length: 255 }).notNull(), // Master SKU
    name: varchar('name', { length: 500 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 255 }),
    brand: varchar('brand', { length: 255 }),
    costPrice: decimal('cost_price', { precision: 12, scale: 2 }),
    weight: decimal('weight', { precision: 8, scale: 2 }),
    dimensions: jsonb('dimensions'), // {length, width, height}
    images: jsonb('images').default('[]').notNull(), // Array of image URLs
    attributes: jsonb('attributes').default('{}').notNull(), // Custom attributes
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgSkuUnique: unique('products_org_sku_unique').on(table.organizationId, table.sku),
    orgIdx: index('products_org_idx').on(table.organizationId),
    skuIdx: index('products_sku_idx').on(table.sku),
    categoryIdx: index('products_category_idx').on(table.category),
    brandIdx: index('products_brand_idx').on(table.brand),
    activeIdx: index('products_active_idx').on(table.isActive),
  })
);

/**
 * Product variants table - Product variations
 * Handles different variants of the same product (size, color, etc.)
 */
export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
    variantSku: varchar('variant_sku', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }),
    attributes: jsonb('attributes').default('{}').notNull(), // {color: "red", size: "M"}
    costPrice: decimal('cost_price', { precision: 12, scale: 2 }),
    weight: decimal('weight', { precision: 8, scale: 2 }),
    images: jsonb('images').default('[]').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    productVariantUnique: unique('product_variants_product_variant_unique').on(table.productId, table.variantSku),
    productIdx: index('product_variants_product_idx').on(table.productId),
    skuIdx: index('product_variants_sku_idx').on(table.variantSku),
    activeIdx: index('product_variants_active_idx').on(table.isActive),
  })
);

/**
 * Store product mappings table - Platform-specific product mappings
 * Maps internal products to external platform products
 */
export const storeProductMappings = pgTable(
  'store_product_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
    productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'cascade' }).notNull(),
    platformProductId: varchar('platform_product_id', { length: 255 }).notNull(),
    platformVariantId: varchar('platform_variant_id', { length: 255 }),
    platformSku: varchar('platform_sku', { length: 255 }),
    price: decimal('price', { precision: 12, scale: 2 }).notNull(),
    compareAtPrice: decimal('compare_at_price', { precision: 12, scale: 2 }),
    isActive: boolean('is_active').default(true).notNull(),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    syncStatus: varchar('sync_status', { length: 50 }).default('pending').notNull(), // pending, synced, error
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storeVariantUnique: unique('store_mappings_store_variant_unique').on(
      table.storeId,
      table.platformProductId,
      table.platformVariantId
    ),
    storeIdx: index('store_mappings_store_idx').on(table.storeId),
    variantIdx: index('store_mappings_variant_idx').on(table.productVariantId),
    syncStatusIdx: index('store_mappings_sync_status_idx').on(table.syncStatus),
  })
);

/**
 * Inventory locations table - Warehouse/storage locations
 * Supports multi-location inventory management
 */
export const inventoryLocations = pgTable(
  'inventory_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    address: jsonb('address'),
    isDefault: boolean('is_default').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('inventory_locations_org_idx').on(table.organizationId),
    defaultIdx: index('inventory_locations_default_idx').on(table.isDefault),
  })
);

/**
 * Inventory items table - Stock levels per variant per location
 * Core inventory tracking with computed available quantity
 */
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productVariantId: uuid('product_variant_id').references(() => productVariants.id, { onDelete: 'cascade' }).notNull(),
    locationId: uuid('location_id').references(() => inventoryLocations.id, { onDelete: 'cascade' }).notNull(),
    quantityOnHand: integer('quantity_on_hand').default(0).notNull(),
    quantityReserved: integer('quantity_reserved').default(0).notNull(),
    // quantityAvailable is computed: quantityOnHand - quantityReserved
    reorderPoint: integer('reorder_point').default(0).notNull(),
    reorderQuantity: integer('reorder_quantity').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    variantLocationUnique: unique('inventory_items_variant_location_unique').on(table.productVariantId, table.locationId),
    variantIdx: index('inventory_items_variant_idx').on(table.productVariantId),
    locationIdx: index('inventory_items_location_idx').on(table.locationId),
    lowStockIdx: index('inventory_items_low_stock_idx').on(table.quantityOnHand, table.reorderPoint),
  })
);

/**
 * Inventory transactions table - Stock movement history
 * Audit trail for all inventory changes
 */
export const inventoryTransactions = pgTable(
  'inventory_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id, { onDelete: 'cascade' }).notNull(),
    transactionType: varchar('transaction_type', { length: 50 }).notNull(), // adjustment, sale, purchase, transfer, reservation
    quantityChange: integer('quantity_change').notNull(),
    referenceType: varchar('reference_type', { length: 50 }), // order, manual, import
    referenceId: uuid('reference_id'),
    notes: text('notes'),
    createdBy: text('created_by'), // Clerk user ID (text)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    inventoryItemIdx: index('inventory_transactions_item_idx').on(table.inventoryItemId),
    typeIdx: index('inventory_transactions_type_idx').on(table.transactionType),
    referenceIdx: index('inventory_transactions_reference_idx').on(table.referenceType, table.referenceId),
    createdAtIdx: index('inventory_transactions_created_at_idx').on(table.createdAt),
  })
);

/**
 * Orders table - Unified order management
 * Central repository for orders from all platforms
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    storeId: uuid('store_id').references(() => stores.id).notNull(),
    platformOrderId: varchar('platform_order_id', { length: 255 }).notNull(),
    orderNumber: varchar('order_number', { length: 255 }),
    customerInfo: jsonb('customer_info').notNull(), // name, email, phone, address
    status: varchar('status', { length: 50 }).notNull(), // pending, paid, shipped, delivered, cancelled
    financialStatus: varchar('financial_status', { length: 50 }), // pending, paid, refunded
    fulfillmentStatus: varchar('fulfillment_status', { length: 50 }), // unfulfilled, partial, fulfilled
    subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
    taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    shippingAmount: decimal('shipping_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('IDR').notNull(),
    platformData: jsonb('platform_data').default('{}').notNull(), // Raw platform data
    notes: text('notes'),
    tags: text('tags').array(),
    orderedAt: timestamp('ordered_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storePlatformOrderUnique: unique('orders_store_platform_order_unique').on(table.storeId, table.platformOrderId),
    orgIdx: index('orders_org_idx').on(table.organizationId),
    storeIdx: index('orders_store_idx').on(table.storeId),
    statusIdx: index('orders_status_idx').on(table.status),
    orderedAtIdx: index('orders_ordered_at_idx').on(table.orderedAt),
    totalIdx: index('orders_total_idx').on(table.totalAmount),
  })
);

/**
 * Order items table - Individual items within orders
 * Line items for each order
 */
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
    productVariantId: uuid('product_variant_id').references(() => productVariants.id),
    platformProductId: varchar('platform_product_id', { length: 255 }),
    platformVariantId: varchar('platform_variant_id', { length: 255 }),
    name: varchar('name', { length: 500 }).notNull(),
    sku: varchar('sku', { length: 255 }),
    quantity: integer('quantity').notNull(),
    price: decimal('price', { precision: 12, scale: 2 }).notNull(),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index('order_items_order_idx').on(table.orderId),
    variantIdx: index('order_items_variant_idx').on(table.productVariantId),
    skuIdx: index('order_items_sku_idx').on(table.sku),
  })
);

/**
 * Sync jobs table - Background synchronization jobs
 * Tracks sync operations between platforms
 */
export const syncJobs = pgTable(
  'sync_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    storeId: uuid('store_id').references(() => stores.id),
    jobType: varchar('job_type', { length: 100 }).notNull(), // product_sync, inventory_push, order_fetch
    status: varchar('status', { length: 50 }).notNull(), // pending, running, completed, failed
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    itemsTotal: integer('items_total').default(0).notNull(),
    itemsProcessed: integer('items_processed').default(0).notNull(),
    itemsFailed: integer('items_failed').default(0).notNull(),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0).notNull(),
    metadata: jsonb('metadata').default('{}').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('sync_jobs_org_idx').on(table.organizationId),
    storeIdx: index('sync_jobs_store_idx').on(table.storeId),
    statusIdx: index('sync_jobs_status_idx').on(table.status),
    typeIdx: index('sync_jobs_type_idx').on(table.jobType),
    createdAtIdx: index('sync_jobs_created_at_idx').on(table.createdAt),
  })
);

/**
 * Sync logs table - Detailed sync operation logs
 * Detailed logging for sync operations
 */
export const syncLogs = pgTable(
  'sync_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    syncJobId: uuid('sync_job_id').references(() => syncJobs.id, { onDelete: 'cascade' }).notNull(),
    level: varchar('level', { length: 20 }).notNull(), // info, warning, error
    message: text('message').notNull(),
    details: jsonb('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobIdx: index('sync_logs_job_idx').on(table.syncJobId),
    levelIdx: index('sync_logs_level_idx').on(table.level),
    createdAtIdx: index('sync_logs_created_at_idx').on(table.createdAt),
  })
);

/**
 * Webhook endpoints table - Platform webhook configurations
 * Manages webhook endpoints for real-time updates
 */
export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
    platformWebhookId: varchar('platform_webhook_id', { length: 255 }),
    eventTypes: text('event_types').array().notNull(),
    url: varchar('url', { length: 500 }).notNull(),
    secret: varchar('secret', { length: 255 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('webhook_endpoints_store_idx').on(table.storeId),
    activeIdx: index('webhook_endpoints_active_idx').on(table.isActive),
  })
);

/**
 * Webhook events table - Incoming webhook events
 * Stores and processes webhook events from platforms
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    webhookEndpointId: uuid('webhook_endpoint_id').references(() => webhookEndpoints.id),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    processed: boolean('processed').default(false).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    endpointIdx: index('webhook_events_endpoint_idx').on(table.webhookEndpointId),
    processedIdx: index('webhook_events_processed_idx').on(table.processed),
    typeIdx: index('webhook_events_type_idx').on(table.eventType),
    createdAtIdx: index('webhook_events_created_at_idx').on(table.createdAt),
  })
);

// ============================================================================
// RELATIONS - Define relationships between tables
// ============================================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  stores: many(stores),
  products: many(products),
  inventoryLocations: many(inventoryLocations),
  orders: many(orders),
  syncJobs: many(syncJobs),
  organizationSettings: many(organizationSettings),
  settingsAuditLog: many(settingsAuditLog),
  notificationSettings: many(notificationSettings),
  systemNotifications: many(systemNotifications),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  inventoryTransactions: many(inventoryTransactions),
  refreshTokens: many(refreshTokens),
  revokedTokens: many(revokedTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [refreshTokens.organizationId],
    references: [organizations.id],
  }),
}));

export const revokedTokensRelations = relations(revokedTokens, ({ one }) => ({
  user: one(users, {
    fields: [revokedTokens.userId],
    references: [users.id],
  }),
}));

export const platformsRelations = relations(platforms, ({ many }) => ({
  stores: many(stores),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [stores.organizationId],
    references: [organizations.id],
  }),
  platform: one(platforms, {
    fields: [stores.platformId],
    references: [platforms.id],
  }),
  productMappings: many(storeProductMappings),
  orders: many(orders),
  syncJobs: many(syncJobs),
  webhookEndpoints: many(webhookEndpoints),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [products.organizationId],
    references: [organizations.id],
  }),
  variants: many(productVariants),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  storeMappings: many(storeProductMappings),
  inventoryItems: many(inventoryItems),
  orderItems: many(orderItems),
}));

export const storeProductMappingsRelations = relations(storeProductMappings, ({ one }) => ({
  store: one(stores, {
    fields: [storeProductMappings.storeId],
    references: [stores.id],
  }),
  productVariant: one(productVariants, {
    fields: [storeProductMappings.productVariantId],
    references: [productVariants.id],
  }),
}));

export const inventoryLocationsRelations = relations(inventoryLocations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [inventoryLocations.organizationId],
    references: [organizations.id],
  }),
  inventoryItems: many(inventoryItems),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  productVariant: one(productVariants, {
    fields: [inventoryItems.productVariantId],
    references: [productVariants.id],
  }),
  location: one(inventoryLocations, {
    fields: [inventoryItems.locationId],
    references: [inventoryLocations.id],
  }),
  transactions: many(inventoryTransactions),
}));

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({ one }) => ({
  inventoryItem: one(inventoryItems, {
    fields: [inventoryTransactions.inventoryItemId],
    references: [inventoryItems.id],
  }),
  // Note: createdBy is a Clerk user ID (text) - no direct relation to users table
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [orders.organizationId],
    references: [organizations.id],
  }),
  store: one(stores, {
    fields: [orders.storeId],
    references: [stores.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  productVariant: one(productVariants, {
    fields: [orderItems.productVariantId],
    references: [productVariants.id],
  }),
}));

export const syncJobsRelations = relations(syncJobs, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [syncJobs.organizationId],
    references: [organizations.id],
  }),
  store: one(stores, {
    fields: [syncJobs.storeId],
    references: [stores.id],
  }),
  logs: many(syncLogs),
}));

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  syncJob: one(syncJobs, {
    fields: [syncLogs.syncJobId],
    references: [syncJobs.id],
  }),
}));

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  store: one(stores, {
    fields: [webhookEndpoints.storeId],
    references: [stores.id],
  }),
  events: many(webhookEvents),
}));

export const webhookEventsRelations = relations(webhookEvents, ({ one }) => ({
  webhookEndpoint: one(webhookEndpoints, {
    fields: [webhookEvents.webhookEndpointId],
    references: [webhookEndpoints.id],
  }),
}));



// ============================================================================
// ZOD SCHEMAS - Type-safe validation schemas
// ============================================================================

// Organization schemas
export const insertOrganizationSchema = createInsertSchema(organizations);
export const selectOrganizationSchema = createSelectSchema(organizations);
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type SelectOrganization = z.infer<typeof selectOrganizationSchema>;

// User schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SelectUser = z.infer<typeof selectUserSchema>;

// Refresh token schemas
export const insertRefreshTokenSchema = createInsertSchema(refreshTokens);
export const selectRefreshTokenSchema = createSelectSchema(refreshTokens);
export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;
export type SelectRefreshToken = z.infer<typeof selectRefreshTokenSchema>;

// Revoked token schemas
export const insertRevokedTokenSchema = createInsertSchema(revokedTokens);
export const selectRevokedTokenSchema = createSelectSchema(revokedTokens);
export type InsertRevokedToken = z.infer<typeof insertRevokedTokenSchema>;
export type SelectRevokedToken = z.infer<typeof selectRevokedTokenSchema>;

// Platform schemas
export const insertPlatformSchema = createInsertSchema(platforms);
export const selectPlatformSchema = createSelectSchema(platforms);
export type InsertPlatform = z.infer<typeof insertPlatformSchema>;
export type SelectPlatform = z.infer<typeof selectPlatformSchema>;

// Store schemas
export const insertStoreSchema = createInsertSchema(stores);
export const selectStoreSchema = createSelectSchema(stores);
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type SelectStore = z.infer<typeof selectStoreSchema>;

// Product schemas
export const insertProductSchema = createInsertSchema(products);
export const selectProductSchema = createSelectSchema(products);
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type SelectProduct = z.infer<typeof selectProductSchema>;

// Product variant schemas
export const insertProductVariantSchema = createInsertSchema(productVariants);
export const selectProductVariantSchema = createSelectSchema(productVariants);
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type SelectProductVariant = z.infer<typeof selectProductVariantSchema>;

// Store product mapping schemas
export const insertStoreProductMappingSchema = createInsertSchema(storeProductMappings);
export const selectStoreProductMappingSchema = createSelectSchema(storeProductMappings);
export type InsertStoreProductMapping = z.infer<typeof insertStoreProductMappingSchema>;
export type SelectStoreProductMapping = z.infer<typeof selectStoreProductMappingSchema>;

// Inventory location schemas
export const insertInventoryLocationSchema = createInsertSchema(inventoryLocations);
export const selectInventoryLocationSchema = createSelectSchema(inventoryLocations);
export type InsertInventoryLocation = z.infer<typeof insertInventoryLocationSchema>;
export type SelectInventoryLocation = z.infer<typeof selectInventoryLocationSchema>;

// Inventory item schemas
export const insertInventoryItemSchema = createInsertSchema(inventoryItems);
export const selectInventoryItemSchema = createSelectSchema(inventoryItems);
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type SelectInventoryItem = z.infer<typeof selectInventoryItemSchema>;

// Inventory transaction schemas
export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions);
export const selectInventoryTransactionSchema = createSelectSchema(inventoryTransactions);
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type SelectInventoryTransaction = z.infer<typeof selectInventoryTransactionSchema>;

// Order schemas
export const insertOrderSchema = createInsertSchema(orders);
export const selectOrderSchema = createSelectSchema(orders);
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type SelectOrder = z.infer<typeof selectOrderSchema>;

// Order item schemas
export const insertOrderItemSchema = createInsertSchema(orderItems);
export const selectOrderItemSchema = createSelectSchema(orderItems);
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type SelectOrderItem = z.infer<typeof selectOrderItemSchema>;

// Sync job schemas
export const insertSyncJobSchema = createInsertSchema(syncJobs);
export const selectSyncJobSchema = createSelectSchema(syncJobs);
export type InsertSyncJob = z.infer<typeof insertSyncJobSchema>;
export type SelectSyncJob = z.infer<typeof selectSyncJobSchema>;

// Sync log schemas
export const insertSyncLogSchema = createInsertSchema(syncLogs);
export const selectSyncLogSchema = createSelectSchema(syncLogs);
export type InsertSyncLog = z.infer<typeof insertSyncLogSchema>;
export type SelectSyncLog = z.infer<typeof selectSyncLogSchema>;

// Webhook endpoint schemas
export const insertWebhookEndpointSchema = createInsertSchema(webhookEndpoints);
export const selectWebhookEndpointSchema = createSelectSchema(webhookEndpoints);
export type InsertWebhookEndpoint = z.infer<typeof insertWebhookEndpointSchema>;
export type SelectWebhookEndpoint = z.infer<typeof selectWebhookEndpointSchema>;

// Webhook event schemas
export const insertWebhookEventSchema = createInsertSchema(webhookEvents);
export const selectWebhookEventSchema = createSelectSchema(webhookEvents);
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;
export type SelectWebhookEvent = z.infer<typeof selectWebhookEventSchema>;

/**
 * Organization settings table - Stores encrypted API keys and configuration
 */
export const organizationSettings = pgTable(
  'organization_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    settingKey: varchar('setting_key', { length: 100 }).notNull(),
    encryptedValue: text('encrypted_value').notNull(),
    isSensitive: boolean('is_sensitive').default(true).notNull(),
    description: text('description'),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    testStatus: varchar('test_status', { length: 20 }).default('untested').notNull(),
    testError: text('test_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgKeyIdx: index('organization_settings_org_key_idx').on(table.organizationId, table.settingKey),
    orgKeyUnique: unique('organization_settings_org_key_unique').on(table.organizationId, table.settingKey),
  })
);

/**
 * Settings audit log - Tracks all changes to sensitive settings
 */
export const settingsAuditLog = pgTable(
  'settings_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    userId: text('user_id').notNull(), // Clerk user ID
    action: varchar('action', { length: 50 }).notNull(),
    settingKey: varchar('setting_key', { length: 100 }).notNull(),
    oldValueHash: varchar('old_value_hash', { length: 64 }),
    newValueHash: varchar('new_value_hash', { length: 64 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    success: boolean('success').default(true).notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgTimeIdx: index('settings_audit_log_org_time_idx').on(table.organizationId, table.createdAt),
    userIdx: index('settings_audit_log_user_idx').on(table.userId),
    actionIdx: index('settings_audit_log_action_idx').on(table.action),
  })
);

/**
 * Notification settings table - Configuration for notifications
 */
export const notificationSettings = pgTable(
  'notification_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    notificationType: varchar('notification_type', { length: 50 }).notNull(),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    configuration: jsonb('configuration').default('{}').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgTypeUnique: unique('notification_settings_org_type_unique').on(table.organizationId, table.notificationType),
  })
);

/**
 * System notifications table - In-app notifications
 */
export const systemNotifications = pgTable(
  'system_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    userId: text('user_id'), // Clerk user ID (nullable for system-wide notifications)
    type: varchar('type', { length: 50 }).notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    metadata: jsonb('metadata').default('{}').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userUnreadIdx: index('system_notifications_user_unread_idx').on(table.organizationId, table.userId, table.isRead, table.createdAt),
    categoryIdx: index('system_notifications_category_idx').on(table.category),
    typeIdx: index('system_notifications_type_idx').on(table.type),
  })
);

// Organization settings schemas
export const insertOrganizationSettingSchema = createInsertSchema(organizationSettings);
export const selectOrganizationSettingSchema = createSelectSchema(organizationSettings);
export type InsertOrganizationSetting = z.infer<typeof insertOrganizationSettingSchema>;
export type SelectOrganizationSetting = z.infer<typeof selectOrganizationSettingSchema>;

// Settings audit log schemas
export const insertSettingsAuditLogSchema = createInsertSchema(settingsAuditLog);
export const selectSettingsAuditLogSchema = createSelectSchema(settingsAuditLog);
export type InsertSettingsAuditLog = z.infer<typeof insertSettingsAuditLogSchema>;
export type SelectSettingsAuditLog = z.infer<typeof selectSettingsAuditLogSchema>;

// Notification settings schemas
export const insertNotificationSettingSchema = createInsertSchema(notificationSettings);
export const selectNotificationSettingSchema = createSelectSchema(notificationSettings);
export type InsertNotificationSetting = z.infer<typeof insertNotificationSettingSchema>;
export type SelectNotificationSetting = z.infer<typeof selectNotificationSettingSchema>;

// System notifications schemas
export const insertSystemNotificationSchema = createInsertSchema(systemNotifications);
export const selectSystemNotificationSchema = createSelectSchema(systemNotifications);
export type InsertSystemNotification = z.infer<typeof insertSystemNotificationSchema>;
export type SelectSystemNotification = z.infer<typeof selectSystemNotificationSchema>;

// ============================================================================
// RELATIONS FOR NEW TABLES
// ============================================================================

export const organizationSettingsRelations = relations(organizationSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationSettings.organizationId],
    references: [organizations.id],
  }),
}));

export const settingsAuditLogRelations = relations(settingsAuditLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [settingsAuditLog.organizationId],
    references: [organizations.id],
  }),
}));

export const notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [notificationSettings.organizationId],
    references: [organizations.id],
  }),
}));

export const systemNotificationsRelations = relations(systemNotifications, ({ one }) => ({
  organization: one(organizations, {
    fields: [systemNotifications.organizationId],
    references: [organizations.id],
  }),
}));