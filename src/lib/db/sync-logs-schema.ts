/**
 * Sync Logs Database Schema
 * Database tables for tracking sync operations
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { masterProducts } from './master-catalog-schema';

/**
 * Sync logs table - Detailed sync operation logs
 * Tracks all sync operations for auditing and debugging
 */
export const syncLogs = pgTable(
  'sync_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id'), // For batch operations (null for manual sync)
    productId: uuid('product_id').references(() => masterProducts.id, { onDelete: 'cascade' }).notNull(),
    platform: varchar('platform', { length: 50 }).notNull(), // 'shopee', 'tiktok', 'both'
    status: varchar('status', { length: 20 }).notNull(), // 'success', 'failed', 'pending'
    
    // Request and response data
    requestPayload: jsonb('request_payload').notNull().default('{}'),
    responsePayload: jsonb('response_payload').notNull().default('{}'),
    
    // Platform-specific IDs
    platformProductId: varchar('platform_product_id', { length: 255 }),
    
    // Error tracking
    errorMessage: text('error_message'),
    errorCode: varchar('error_code', { length: 50 }),
    
    // Retry tracking
    attempts: integer('attempts').notNull().default(1),
    
    // Timestamps
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Performance indexes
    productIdx: index('sync_logs_product_idx').on(table.productId),
    platformIdx: index('sync_logs_platform_idx').on(table.platform),
    statusIdx: index('sync_logs_status_idx').on(table.status),
    batchIdx: index('sync_logs_batch_idx').on(table.batchId),
    syncedAtIdx: index('sync_logs_synced_at_idx').on(table.syncedAt),
    createdAtIdx: index('sync_logs_created_at_idx').on(table.createdAt),
  })
);

/**
 * Sync events table - Real-time sync event tracking
 * Stores detailed events for sync operations for real-time monitoring
 */
export const syncEvents = pgTable(
  'sync_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    syncId: varchar('sync_id', { length: 100 }).notNull(), // Custom sync ID for tracking
    productId: uuid('product_id').references(() => masterProducts.id, { onDelete: 'cascade' }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('running'), // running, success, error
    events: jsonb('events').notNull().default('[]'), // Array of event objects
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Performance indexes
    syncIdIdx: index('sync_events_sync_id_idx').on(table.syncId),
    productIdx: index('sync_events_product_idx').on(table.productId),
    statusIdx: index('sync_events_status_idx').on(table.status),
    startedAtIdx: index('sync_events_started_at_idx').on(table.startedAt),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  masterProduct: one(masterProducts, {
    fields: [syncLogs.productId],
    references: [masterProducts.id],
  }),
}));

export const syncEventsRelations = relations(syncEvents, ({ one }) => ({
  masterProduct: one(masterProducts, {
    fields: [syncEvents.productId],
    references: [masterProducts.id],
  }),
}));

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const insertSyncLogSchema = createInsertSchema(syncLogs);
export const selectSyncLogSchema = createSelectSchema(syncLogs);
export type InsertSyncLog = z.infer<typeof insertSyncLogSchema>;
export type SelectSyncLog = z.infer<typeof selectSyncLogSchema>;

export const insertSyncEventSchema = createInsertSchema(syncEvents);
export const selectSyncEventSchema = createSelectSchema(syncEvents);
export type InsertSyncEvent = z.infer<typeof insertSyncEventSchema>;
export type SelectSyncEvent = z.infer<typeof selectSyncEventSchema>;