import { pgTable, text, timestamp, integer, boolean, json } from 'drizzle-orm/pg-core';

export const shopConnections = pgTable('shop_connections', {
  id: text('id').primaryKey().notNull(),
  platform: text('platform').notNull(), // 'shopee', 'tokopedia', etc.
  shopId: text('shop_id').notNull(),
  environment: text('environment').notNull(), // 'sandbox', 'production'
  
  // OAuth tokens
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresIn: integer('expires_in').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  
  // Shop info
  shopName: text('shop_name'),
  shopStatus: text('shop_status'),
  shopInfo: json('shop_info'), // Store additional shop metadata
  
  // Security
  partnerKeyMasked: text('partner_key_masked'), // Only store masked version for display
  
  // Status
  isActive: boolean('is_active').default(true),
  lastHealthCheck: timestamp('last_health_check'),
  healthStatus: text('health_status'), // 'ok', 'unauthorized', 'rate_limited', 'error'
  
  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Unique constraint on platform + shop_id + environment
export type ShopConnection = typeof shopConnections.$inferSelect;
export type InsertShopConnection = typeof shopConnections.$inferInsert;