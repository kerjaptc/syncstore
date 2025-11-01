# Design Document - SyncStore Phase 2

## Overview

Phase 2 builds upon Phase 1's foundation by adding a comprehensive web-based user interface and real-time synchronization capabilities. The system will use Next.js for the frontend, implement a job queue system for reliable sync operations, and provide webhook handlers for real-time platform updates.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Dashboard   │  │   Product    │  │   Platform   │      │
│  │    Pages     │  │   Editor     │  │  Connector   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routes (Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Products   │  │     Sync     │  │   Webhooks   │      │
│  │     API      │  │     API      │  │   Handler    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Sync      │  │  Inventory   │  │   Conflict   │      │
│  │   Engine     │  │   Manager    │  │   Resolver   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Job Queue (BullMQ)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Sync Jobs   │  │ Webhook Jobs │  │  Bulk Jobs   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Layer (Phase 1 Foundation)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Master     │  │   Platform   │  │   Sync Log   │      │
│  │   Catalog    │  │   Mappings   │  │   Database   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- Next.js 15 (App Router)
- React 18 (stable version for consistency)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- TanStack Query (React Query) for data fetching
- Zustand for state management

**Backend:**
- Next.js API Routes (serverless)
- BullMQ for job queue (Redis-based)
- Drizzle ORM (existing from Phase 1)
- PostgreSQL (existing from Phase 1)

**Authentication:**
- Clerk (existing from current implementation)
- User session management via Clerk
- Webhook integration with Clerk

**Infrastructure:**
- Redis for job queue and caching (Upstash)
- Webhook endpoints on Vercel (API routes)
- **Background workers on Railway/Render** (separate from Vercel)
- PostgreSQL on Neon/Supabase
- Monitoring: Sentry for errors, LogRocket for sessions

**Worker Architecture:**
- Vercel: API routes only (stateless, serverless)
- Railway/Render: BullMQ workers (long-running processes)
- Communication: Redis queue between Vercel and workers

## Components and Interfaces

### 1. Dashboard Components

#### ProductListView
```typescript
interface ProductListViewProps {
  filters: ProductFilters;
  pagination: PaginationState;
  onProductSelect: (productId: string) => void;
}

interface ProductFilters {
  platform?: 'shopee' | 'tiktokshop' | 'all';
  category?: string;
  priceRange?: { min: number; max: number };
  syncStatus?: 'synced' | 'pending' | 'failed' | 'conflict';
  searchQuery?: string;
}

interface ProductListItem {
  id: string;
  title: string;
  thumbnail: string;
  basePrice: number;
  platforms: PlatformStatus[];
  lastSyncedAt: Date;
  syncStatus: SyncStatus;
}
```

#### ProductEditor
```typescript
interface ProductEditorProps {
  productId: string;
  onSave: (data: ProductUpdateData) => Promise<void>;
  onCancel: () => void;
}

interface ProductUpdateData {
  masterData: {
    title: string;
    description: string;
    basePrice: number;
    weight: number;
    dimensions: Dimensions;
    images: ImageData[];
    category: string;
  };
  platformOverrides: {
    shopee?: ShopeeOverrides;
    tiktokshop?: TikTokShopOverrides;
  };
  inventory: InventoryData;
}
```

#### PlatformConnector
```typescript
interface PlatformConnectorProps {
  platforms: ConnectedPlatform[];
  onConnect: (platform: PlatformType) => void;
  onDisconnect: (platformId: string) => void;
  onRefresh: (platformId: string) => void;
}

interface ConnectedPlatform {
  id: string;
  type: 'shopee' | 'tiktokshop';
  status: 'connected' | 'disconnected' | 'error';
  lastSyncedAt: Date;
  apiQuotaUsed: number;
  apiQuotaLimit: number;
}
```

### 2. Sync Engine

#### SyncService
```typescript
class SyncService {
  /**
   * Queue a sync job for a single product
   */
  async queueProductSync(
    productId: string,
    platforms: PlatformType[],
    options?: {
      priority?: 'high' | 'normal' | 'low';
      dryRun?: boolean;
      idempotencyKey?: string;
    }
  ): Promise<SyncJob>;

  /**
   * Queue bulk sync jobs for multiple products
   */
  async queueBulkSync(
    productIds: string[],
    platforms: PlatformType[],
    options?: {
      dryRun?: boolean;
      batchSize?: number;
    }
  ): Promise<BulkSyncResult>;

  /**
   * Execute sync for a single product to a platform
   * Supports dry-run mode for validation without actual sync
   */
  async syncProductToPlatform(
    productId: string,
    platform: PlatformType,
    options?: {
      dryRun?: boolean;
      idempotencyKey?: string;
    }
  ): Promise<SyncResult>;

  /**
   * Dry-run sync to validate data without pushing to platform
   */
  async dryRunSync(
    productId: string,
    platform: PlatformType
  ): Promise<DryRunResult>;

  /**
   * Get sync status for a product
   */
  async getSyncStatus(productId: string): Promise<ProductSyncStatus>;

  /**
   * Retry failed sync operations with idempotency
   */
  async retryFailedSync(
    syncLogId: string,
    options?: { force?: boolean }
  ): Promise<SyncResult>;

  /**
   * Get platform listing for a product
   */
  async getPlatformListing(
    productId: string,
    platform: PlatformType
  ): Promise<PlatformListing | null>;

  /**
   * Sync with rate limit awareness
   */
  async syncWithRateLimit(
    productId: string,
    platform: PlatformType
  ): Promise<SyncResult>;
}

interface DryRunResult {
  valid: boolean;
  productId: string;
  platform: PlatformType;
  transformedData: any;
  validationErrors: ValidationError[];
  estimatedApiCalls: number;
  wouldSucceed: boolean;
}

interface PlatformListing {
  id: string;
  productId: string;
  platform: PlatformType;
  platformListingId: string;
  status: 'active' | 'inactive' | 'deleted';
  title: string;
  price: number;
  stock: number;
  lastSyncedAt: Date;
  syncStatus: 'synced' | 'pending' | 'failed';
  metadata: Record<string, any>;
}

interface SyncJob {
  id: string;
  productId: string;
  platform: PlatformType;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  attempts: number;
  createdAt: Date;
  processedAt?: Date;
}

interface SyncResult {
  success: boolean;
  platform: PlatformType;
  productId: string;
  platformProductId?: string;
  error?: string;
  syncedAt: Date;
}
```

#### ConflictResolver
```typescript
class ConflictResolver {
  /**
   * Detect conflicts between master catalog and platform data
   */
  async detectConflicts(productId: string): Promise<ProductConflict[]>;

  /**
   * Resolve conflict by choosing a resolution strategy
   */
  async resolveConflict(
    conflictId: string,
    resolution: ConflictResolution
  ): Promise<void>;

  /**
   * Get all unresolved conflicts
   */
  async getUnresolvedConflicts(): Promise<ProductConflict[]>;
}

interface ProductConflict {
  id: string;
  productId: string;
  platform: PlatformType;
  field: string;
  masterValue: any;
  platformValue: any;
  detectedAt: Date;
  status: 'pending' | 'resolved';
}

type ConflictResolution = 
  | { strategy: 'use_master' }
  | { strategy: 'use_platform' }
  | { strategy: 'manual'; value: any };
```

### 3. Inventory Management

#### InventoryManager
```typescript
class InventoryManager {
  /**
   * Update inventory for a product across all platforms
   */
  async updateInventory(
    productId: string,
    quantity: number,
    platforms?: PlatformType[]
  ): Promise<InventoryUpdateResult>;

  /**
   * Get current inventory levels for a product
   */
  async getInventoryLevels(
    productId: string
  ): Promise<InventoryLevels>;

  /**
   * Set low stock alert threshold
   */
  async setLowStockAlert(
    productId: string,
    threshold: number
  ): Promise<void>;

  /**
   * Process inventory change from webhook
   */
  async processInventoryWebhook(
    platform: PlatformType,
    data: WebhookInventoryData
  ): Promise<void>;
}

interface InventoryLevels {
  productId: string;
  master: number;
  platforms: {
    shopee?: number;
    tiktokshop?: number;
  };
  lastUpdated: Date;
  lowStockAlert?: {
    threshold: number;
    isLow: boolean;
  };
}
```

### 4. Event Sourcing & Outbox Pattern

#### OutboxService
```typescript
class OutboxService {
  /**
   * Publish event to outbox for reliable processing
   */
  async publishEvent(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    payload: any
  ): Promise<void>;

  /**
   * Process pending outbox events
   */
  async processOutboxEvents(batchSize: number = 100): Promise<void>;

  /**
   * Retry failed outbox events
   */
  async retryFailedEvents(): Promise<void>;

  /**
   * Get outbox event status
   */
  async getEventStatus(eventId: string): Promise<OutboxEvent>;
}

interface OutboxEvent {
  id: string;
  aggregateId: string;
  aggregateType: 'product' | 'inventory' | 'sync';
  eventType: string;
  payload: any;
  status: 'pending' | 'processed' | 'failed';
  attempts: number;
  processedAt?: Date;
  createdAt: Date;
}
```

**Event Flow:**
1. User updates product → Save to DB + Publish to outbox (same transaction)
2. Background worker polls outbox → Process events → Mark as processed
3. If processing fails → Retry with exponential backoff
4. Events are idempotent (can be processed multiple times safely)

**Benefits:**
- Guaranteed event delivery (transactional outbox)
- Decoupled sync processing
- Automatic retry on failure
- Audit trail of all events

### 5. Webhook Handler

#### WebhookService
```typescript
class WebhookService {
  /**
   * Register webhook endpoints with platforms
   */
  async registerWebhooks(platform: PlatformType): Promise<void>;

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(
    platform: PlatformType,
    signature: string,
    payload: string
  ): boolean;

  /**
   * Process incoming webhook
   */
  async processWebhook(
    platform: PlatformType,
    event: WebhookEvent
  ): Promise<void>;

  /**
   * Get webhook logs
   */
  async getWebhookLogs(
    filters: WebhookLogFilters
  ): Promise<WebhookLog[]>;
}

interface WebhookEvent {
  type: 'product_update' | 'inventory_change' | 'order_created';
  platform: PlatformType;
  productId: string;
  data: any;
  timestamp: Date;
}
```

## Data Models

### New Database Tables

#### platform_listings
```typescript
export const platformListings = pgTable('platform_listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => masterProducts.id),
  platform: varchar('platform', { length: 50 }).notNull(),
  platformListingId: varchar('platform_listing_id', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(), // 'active', 'inactive', 'deleted'
  title: text('title'),
  price: decimal('price', { precision: 10, scale: 2 }),
  stock: integer('stock'),
  lastSyncedAt: timestamp('last_synced_at'),
  syncStatus: varchar('sync_status', { length: 20 }), // 'synced', 'pending', 'failed'
  metadata: jsonb('metadata'), // Platform-specific data
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

#### product_variants
```typescript
export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => masterProducts.id),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }),
  stock: integer('stock').default(0),
  attributes: jsonb('attributes'), // { size: 'L', color: 'Red' }
  platformVariantIds: jsonb('platform_variant_ids'), // { shopee: '123', tiktokshop: '456' }
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

#### sync_rules
```typescript
export const syncRules = pgTable('sync_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  platform: varchar('platform', { length: 50 }),
  conditions: jsonb('conditions').notNull(), // Rule conditions
  actions: jsonb('actions').notNull(), // Actions to perform
  priority: integer('priority').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

#### rate_limit_tracking
```typescript
export const rateLimitTracking = pgTable('rate_limit_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: varchar('platform', { length: 50 }).notNull(),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  requestCount: integer('request_count').default(0),
  windowStart: timestamp('window_start').notNull(),
  windowEnd: timestamp('window_end').notNull(),
  quotaLimit: integer('quota_limit'),
  createdAt: timestamp('created_at').defaultNow()
});
```

#### outbox_events
```typescript
export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  aggregateId: uuid('aggregate_id').notNull(),
  aggregateType: varchar('aggregate_type', { length: 100 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'processed', 'failed'
  attempts: integer('attempts').default(0),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow()
});
```

#### sync_logs
```typescript
export const syncLogs = pgTable('sync_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => masterProducts.id),
  platform: varchar('platform', { length: 50 }).notNull(),
  operation: varchar('operation', { length: 50 }).notNull(), // 'create', 'update', 'delete'
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'failed', 'pending'
  platformProductId: varchar('platform_product_id', { length: 255 }),
  errorMessage: text('error_message'),
  requestData: jsonb('request_data'),
  responseData: jsonb('response_data'),
  attempts: integer('attempts').default(1),
  syncedAt: timestamp('synced_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow()
});
```

#### platform_connections
```typescript
export const platformConnections = pgTable('platform_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: varchar('platform', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  shopId: varchar('shop_id', { length: 255 }),
  apiQuotaUsed: integer('api_quota_used').default(0),
  apiQuotaLimit: integer('api_quota_limit').default(1000),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

#### product_conflicts
```typescript
export const productConflicts = pgTable('product_conflicts', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => masterProducts.id),
  platform: varchar('platform', { length: 50 }).notNull(),
  field: varchar('field', { length: 100 }).notNull(),
  masterValue: jsonb('master_value'),
  platformValue: jsonb('platform_value'),
  status: varchar('status', { length: 20 }).default('pending'),
  resolution: jsonb('resolution'),
  detectedAt: timestamp('detected_at').defaultNow(),
  resolvedAt: timestamp('resolved_at')
});
```

#### webhook_logs
```typescript
export const webhookLogs = pgTable('webhook_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: varchar('platform', { length: 50 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  signature: text('signature'),
  status: varchar('status', { length: 20 }).notNull(),
  processedAt: timestamp('processed_at'),
  errorMessage: text('error_message'),
  receivedAt: timestamp('received_at').defaultNow()
});
```

#### inventory_history
```typescript
export const inventoryHistory = pgTable('inventory_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => masterProducts.id),
  platform: varchar('platform', { length: 50 }),
  previousQuantity: integer('previous_quantity').notNull(),
  newQuantity: integer('new_quantity').notNull(),
  changeReason: varchar('change_reason', { length: 100 }),
  changedBy: varchar('changed_by', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow()
});
```

## Error Handling

### Sync Error Handling
- Implement exponential backoff for failed sync operations
- Maximum 3 retry attempts before marking as failed
- Log all errors with detailed context
- Send notifications for critical failures

### Conflict Resolution
- Detect conflicts during sync operations
- Present conflicts to user with clear comparison
- Allow manual resolution or automatic strategies
- Log all conflict resolutions for audit

### Webhook Error Handling
- Validate all incoming webhooks
- Queue webhook processing for reliability
- Implement idempotency to handle duplicate events
- Log failed webhook processing for debugging

## Testing Strategy

### Unit Tests
- Test all service methods independently
- Mock external API calls
- Test error handling and edge cases
- Achieve >80% code coverage

### Integration Tests
- Test complete sync workflows
- Test webhook processing end-to-end
- Test conflict detection and resolution
- Test inventory synchronization

### E2E Tests
- Test complete user workflows in UI
- Test product creation and sync
- Test bulk operations
- Test platform connection flow

### Performance Tests
- Test sync performance with large product catalogs
- Test concurrent sync operations
- Test webhook processing under load
- Measure and optimize API response times

## Security Considerations

### Authentication & Authorization
- **User Authentication:** Clerk (existing implementation)
- **Role-based Access Control:** Admin, Editor, Viewer roles
- **Session Management:** Clerk session tokens with JWT
- **API Protection:** Clerk middleware on all protected routes

### Token Encryption
**Platform API Tokens:**
- **Algorithm:** AES-256-GCM encryption
- **Key Management:** Environment variable with rotation support
- **Per-record Nonce:** Unique nonce for each encrypted token
- **Storage:** Encrypted in `platform_connections.access_token`
- **Decryption:** Only in memory during API calls, never logged

```typescript
interface TokenEncryption {
  algorithm: 'aes-256-gcm';
  key: string; // From env: ENCRYPTION_KEY (32 bytes)
  nonce: Buffer; // 12 bytes, stored with ciphertext
  authTag: Buffer; // 16 bytes, for integrity
}
```

### Webhook Security
**Anti-Replay Protection:**
- **Timestamp Validation:** Reject requests older than 5 minutes
- **Nonce Tracking:** Store nonce in Redis with 10-minute TTL
- **HMAC Verification:** Validate signature using platform secret
- **Idempotency Key:** Use webhook event ID to prevent duplicate processing

```typescript
interface WebhookValidation {
  signature: string; // HMAC-SHA256 of payload
  timestamp: number; // Unix timestamp
  nonce: string; // Unique request ID
  idempotencyKey: string; // Event ID from platform
}
```

**Webhook Validation Flow:**
1. Check timestamp (must be within 5 minutes)
2. Check nonce (must not exist in Redis)
3. Verify HMAC signature
4. Check idempotency key (skip if already processed)
5. Store nonce in Redis
6. Process event

### API Security
- **Rate Limiting:** 100 requests/minute per user (using Upstash Rate Limit)
- **Input Validation:** Zod schemas for all API inputs
- **CSRF Protection:** Next.js built-in CSRF tokens
- **SQL Injection:** Drizzle ORM parameterized queries
- **XSS Protection:** React automatic escaping + Content Security Policy

### Rate Limit Management
**Platform API Rate Limits:**
- Track API calls per platform in `rate_limit_tracking` table
- Implement exponential backoff when approaching limits
- Queue requests when limit reached
- Alert when 80% of quota used

```typescript
interface RateLimitConfig {
  shopee: {
    requestsPerMinute: 60;
    requestsPerDay: 10000;
    backoffStrategy: 'exponential';
  };
  tiktokshop: {
    requestsPerMinute: 100;
    requestsPerDay: 50000;
    backoffStrategy: 'exponential';
  };
}
```

### Data Protection
- **Encryption at Rest:** PostgreSQL encryption (Neon/Supabase)
- **Encryption in Transit:** HTTPS/TLS 1.3 for all communications
- **Audit Logging:** All sensitive operations logged to `audit_logs` table
- **Data Retention:** Sync logs retained for 90 days, then archived
- **Backup Strategy:** Daily automated backups with 30-day retention

### Observability & Alerting
**Monitoring:**
- **Error Tracking:** Sentry for application errors
- **Performance:** LogRocket for session replay
- **Uptime:** Vercel Analytics + custom health checks
- **Queue Monitoring:** BullMQ dashboard for job status

**Alerts:**
- Sync failure rate > 10%
- Webhook processing delay > 5 minutes
- API rate limit > 80% used
- Database connection errors
- Worker process crashes

## Performance Optimization

### Caching Strategy
- Cache product list data (5 minutes TTL)
- Cache platform connection status
- Use Redis for session storage
- Implement optimistic UI updates

### Database Optimization
- Index frequently queried fields
- Use database connection pooling
- Implement pagination for large datasets
- Optimize sync log queries

### Job Queue Optimization
- Process sync jobs in batches
- Implement job prioritization
- Use separate queues for different job types
- Monitor queue performance metrics

## Deployment Strategy

### Development Environment
- Local development with Docker Compose
- Hot reload for frontend and backend
- Local Redis and PostgreSQL instances

### Staging Environment
- Deploy to Vercel (frontend + API routes)
- Managed PostgreSQL (Neon/Supabase)
- Managed Redis (Upstash)
- Test webhooks with ngrok

### Production Environment
- Deploy to Vercel with production domain
- Production database with backups
- Production Redis with persistence
- Configure webhook endpoints
- Set up monitoring and alerts

## Migration from Phase 1

### Database Migrations
- Add new tables for sync logs, conflicts, webhooks
- Add indexes for performance
- Migrate existing data if needed

### API Integration
- Reuse Phase 1 importers and validators
- Extend with sync capabilities
- Add webhook handlers

### Testing
- Verify Phase 1 functionality still works
- Test new features with existing data
- Perform data integrity checks
