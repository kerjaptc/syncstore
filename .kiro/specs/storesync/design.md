# Design Document

## Overview

StoreSync is designed as a modular monolith with microservices readiness, providing a unified platform for managing e-commerce operations across multiple marketplaces. The system employs a layered architecture with clear separation of concerns, enabling scalability and maintainability while supporting complex multi-platform synchronization requirements.

The design prioritizes data consistency, real-time synchronization, and extensibility to accommodate future marketplace integrations. The system uses Next.js 15 with App Router for the frontend, PostgreSQL for data persistence, and Redis for caching and job queuing.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Web App       │  │   Mobile Web    │  │   Admin Panel   │  │
│  │  (Next.js 15)   │  │   (Responsive)  │  │   (Dashboard)   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTPS/WebSocket
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  API GATEWAY LAYER                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           Next.js App Router + tRPC                         │ │
│  │     (Authentication, Rate Limiting, Request Routing)        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                 BUSINESS LOGIC LAYER                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │   Store     │ │  Inventory  │ │    Order    │ │ Integration │ │
│  │  Service    │ │   Service   │ │   Service   │ │   Service   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ Analytics   │ │    User     │ │ Notification│ │   Sync      │ │
│  │  Service    │ │  Service    │ │   Service   │ │  Service    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATA ACCESS LAYER                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Drizzle ORM                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PERSISTENCE LAYER                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ PostgreSQL  │ │    Redis    │ │    Files    │ │   Queues    │ │
│  │ (Primary)   │ │   (Cache)   │ │ (S3/Local)  │ │  (Redis)    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

The system employs an event-driven architecture for handling synchronization and business operations:

```
Customer Orders → Event Queue → Business Logic → Database → Platform APIs
     ↑                                                           ↓
Platform Events ← Webhook Handlers ← External Platforms ←────────┘
```

## Components and Interfaces

### Core Services

#### 1. Store Service
**Responsibility:** Manages marketplace connections and credentials

```typescript
interface StoreService {
  // Store management
  connectStore(organizationId: string, platform: Platform, credentials: any): Promise<Store>;
  disconnectStore(storeId: string): Promise<void>;
  refreshCredentials(storeId: string): Promise<Store>;
  
  // Health monitoring
  checkStoreHealth(storeId: string): Promise<HealthStatus>;
  getStoreMetrics(storeId: string): Promise<StoreMetrics>;
}

interface Store {
  id: string;
  organizationId: string;
  platform: Platform;
  name: string;
  platformStoreId: string;
  credentials: EncryptedCredentials;
  settings: StoreSettings;
  syncStatus: SyncStatus;
  lastSyncAt?: Date;
  isActive: boolean;
}
```

#### 2. Product Service
**Responsibility:** Manages master product catalog and variants

```typescript
interface ProductService {
  // Product management
  createProduct(organizationId: string, productData: CreateProductInput): Promise<Product>;
  updateProduct(productId: string, updates: UpdateProductInput): Promise<Product>;
  deleteProduct(productId: string): Promise<void>;
  
  // Variant management
  createVariant(productId: string, variantData: CreateVariantInput): Promise<ProductVariant>;
  updateVariant(variantId: string, updates: UpdateVariantInput): Promise<ProductVariant>;
  
  // Bulk operations
  bulkImportProducts(organizationId: string, products: ImportProductInput[]): Promise<BulkResult>;
  bulkUpdateProducts(productIds: string[], updates: BulkUpdateInput): Promise<BulkResult>;
}

interface Product {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  costPrice?: number;
  weight?: number;
  dimensions?: Dimensions;
  images: string[];
  attributes: Record<string, any>;
  variants: ProductVariant[];
  isActive: boolean;
}
```

#### 3. Inventory Service
**Responsibility:** Manages stock levels and reservations

```typescript
interface InventoryService {
  // Stock management
  updateStock(variantId: string, locationId: string, quantity: number): Promise<InventoryItem>;
  reserveStock(variantId: string, locationId: string, quantity: number, orderId: string): Promise<void>;
  releaseReservation(orderId: string): Promise<void>;
  
  // Stock queries
  getAvailableStock(variantId: string, locationId?: string): Promise<number>;
  getLowStockItems(organizationId: string): Promise<InventoryItem[]>;
  
  // Adjustments
  adjustInventory(adjustments: InventoryAdjustment[]): Promise<void>;
  getStockHistory(variantId: string, locationId: string): Promise<InventoryTransaction[]>;
}

interface InventoryItem {
  id: string;
  productVariantId: string;
  locationId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderPoint: number;
  reorderQuantity: number;
}
```

#### 4. Order Service
**Responsibility:** Manages unified order processing

```typescript
interface OrderService {
  // Order management
  createOrder(orderData: CreateOrderInput): Promise<Order>;
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order>;
  fulfillOrder(orderId: string, fulfillmentData: FulfillmentInput): Promise<Order>;
  
  // Order queries
  getOrders(organizationId: string, filters: OrderFilters): Promise<PaginatedOrders>;
  getOrderById(orderId: string): Promise<Order>;
  
  // Bulk operations
  bulkUpdateOrders(orderIds: string[], updates: BulkOrderUpdate): Promise<BulkResult>;
}

interface Order {
  id: string;
  organizationId: string;
  storeId: string;
  platformOrderId: string;
  orderNumber: string;
  customer: CustomerInfo;
  status: OrderStatus;
  financialStatus: FinancialStatus;
  fulfillmentStatus: FulfillmentStatus;
  items: OrderItem[];
  totals: OrderTotals;
  orderedAt: Date;
}
```

#### 5. Sync Service
**Responsibility:** Orchestrates data synchronization between platforms

```typescript
interface SyncService {
  // Sync operations
  syncProducts(storeId: string, options?: SyncOptions): Promise<SyncJob>;
  syncInventory(storeId: string, variantIds?: string[]): Promise<SyncJob>;
  syncOrders(storeId: string, since?: Date): Promise<SyncJob>;
  
  // Sync management
  scheduleSyncJob(jobConfig: SyncJobConfig): Promise<SyncJob>;
  cancelSyncJob(jobId: string): Promise<void>;
  retrySyncJob(jobId: string): Promise<SyncJob>;
  
  // Sync monitoring
  getSyncStatus(storeId: string): Promise<SyncStatus>;
  getSyncHistory(storeId: string, limit?: number): Promise<SyncJob[]>;
}

interface SyncJob {
  id: string;
  organizationId: string;
  storeId?: string;
  jobType: SyncJobType;
  status: JobStatus;
  progress: SyncProgress;
  error?: string;
  retryCount: number;
  metadata: Record<string, any>;
}
```

### Platform Adapters

#### Platform Adapter Interface
```typescript
interface PlatformAdapter {
  readonly platform: Platform;
  
  // Authentication
  authenticateStore(credentials: any): Promise<StoreConnection>;
  refreshToken(connection: StoreConnection): Promise<StoreConnection>;
  
  // Products
  fetchProducts(connection: StoreConnection, options?: FetchOptions): Promise<PlatformProduct[]>;
  updateProduct(connection: StoreConnection, product: PlatformProduct): Promise<void>;
  updateInventory(connection: StoreConnection, updates: InventoryUpdate[]): Promise<void>;
  
  // Orders
  fetchOrders(connection: StoreConnection, options?: FetchOptions): Promise<PlatformOrder[]>;
  updateOrderStatus(connection: StoreConnection, orderId: string, status: string): Promise<void>;
  
  // Webhooks (optional)
  setupWebhooks?(connection: StoreConnection, events: string[]): Promise<void>;
}
```

#### Shopee Adapter Implementation
```typescript
class ShopeeAdapter implements PlatformAdapter {
  readonly platform = Platform.SHOPEE;
  
  async authenticateStore(credentials: ShopeeCredentials): Promise<StoreConnection> {
    // Implement Shopee OAuth flow
    // Handle token exchange and validation
  }
  
  async fetchProducts(connection: StoreConnection, options?: FetchOptions): Promise<PlatformProduct[]> {
    // Implement Shopee product fetching with pagination
    // Handle rate limiting and error recovery
  }
  
  // Additional Shopee-specific implementations...
}
```

#### TikTok Shop Adapter Implementation
```typescript
class TikTokShopAdapter implements PlatformAdapter {
  readonly platform = Platform.TIKTOK_SHOP;
  
  async authenticateStore(credentials: TikTokShopCredentials): Promise<StoreConnection> {
    // Implement TikTok Shop OAuth flow
  }
  
  async fetchProducts(connection: StoreConnection, options?: FetchOptions): Promise<PlatformProduct[]> {
    // Implement TikTok Shop product fetching
  }
  
  // Additional TikTok Shop-specific implementations...
}
```

## Data Models

### Core Entities

#### Organization and User Models
```typescript
interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: OrganizationSettings;
  subscriptionPlan: SubscriptionPlan;
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string; // Clerk user ID
  organizationId: string;
  email: string;
  fullName?: string;
  role: UserRole;
  isActive: boolean;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Product and Inventory Models
```typescript
interface Product {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  costPrice?: number;
  weight?: number;
  dimensions?: Dimensions;
  images: string[];
  attributes: Record<string, any>;
  variants: ProductVariant[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductVariant {
  id: string;
  productId: string;
  variantSku: string;
  name: string;
  attributes: Record<string, any>;
  costPrice?: number;
  weight?: number;
  images: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface InventoryItem {
  id: string;
  productVariantId: string;
  locationId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number; // computed field
  reorderPoint: number;
  reorderQuantity: number;
  updatedAt: Date;
}
```

### Database Schema Design

The database schema follows a normalized design with proper indexing for performance:

- **Row Level Security (RLS)** for multi-tenant data isolation
- **Optimized indexes** for common query patterns
- **Generated columns** for computed values
- **JSONB fields** for flexible attribute storage
- **Foreign key constraints** for data integrity

## Error Handling

### Error Classification
```typescript
enum ErrorType {
  VALIDATION_ERROR = 'validation_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  PLATFORM_API_ERROR = 'platform_api_error',
  SYNC_ERROR = 'sync_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  NETWORK_ERROR = 'network_error',
  INTERNAL_ERROR = 'internal_error'
}

interface AppError {
  type: ErrorType;
  message: string;
  code: string;
  details?: Record<string, any>;
  retryable: boolean;
  timestamp: Date;
}
```

### Error Handling Strategies

1. **Graceful Degradation**: System continues operating with reduced functionality
2. **Circuit Breaker Pattern**: Prevents cascading failures from external APIs
3. **Retry Mechanisms**: Exponential backoff for transient failures
4. **Error Boundaries**: React error boundaries for UI error handling
5. **Comprehensive Logging**: Structured logging for debugging and monitoring

### Platform API Error Handling
```typescript
class PlatformErrorHandler {
  async handleApiError(error: PlatformApiError, context: ErrorContext): Promise<ErrorResponse> {
    switch (error.type) {
      case 'rate_limit':
        return this.handleRateLimit(error, context);
      case 'authentication':
        return this.handleAuthError(error, context);
      case 'network':
        return this.handleNetworkError(error, context);
      default:
        return this.handleGenericError(error, context);
    }
  }
  
  private async handleRateLimit(error: RateLimitError, context: ErrorContext): Promise<ErrorResponse> {
    // Implement exponential backoff and queue management
    const retryAfter = error.retryAfter || this.calculateBackoff(context.retryCount);
    await this.scheduleRetry(context.operation, retryAfter);
    return { handled: true, retryScheduled: true };
  }
}
```

## Testing Strategy

### Testing Pyramid

1. **Unit Tests (70%)**
   - Service layer logic
   - Utility functions
   - Data transformations
   - Business rule validation

2. **Integration Tests (20%)**
   - Database operations
   - API endpoint testing
   - Platform adapter testing
   - Sync operation testing

3. **End-to-End Tests (10%)**
   - Critical user journeys
   - Multi-platform workflows
   - Error scenarios
   - Performance testing

### Test Implementation

```typescript
// Example service test
describe('ProductService', () => {
  let productService: ProductService;
  let mockDb: MockDatabase;
  
  beforeEach(() => {
    mockDb = new MockDatabase();
    productService = new ProductService(mockDb);
  });
  
  describe('createProduct', () => {
    it('should create product with valid data', async () => {
      const productData = createMockProductData();
      const result = await productService.createProduct('org-1', productData);
      
      expect(result.id).toBeDefined();
      expect(result.sku).toBe(productData.sku);
      expect(mockDb.products.create).toHaveBeenCalledWith(
        expect.objectContaining(productData)
      );
    });
    
    it('should throw validation error for duplicate SKU', async () => {
      mockDb.products.findBySku.mockResolvedValue(createMockProduct());
      
      await expect(
        productService.createProduct('org-1', { sku: 'existing-sku' })
      ).rejects.toThrow(ValidationError);
    });
  });
});
```

### Platform Adapter Testing
```typescript
describe('ShopeeAdapter', () => {
  let adapter: ShopeeAdapter;
  let mockHttpClient: MockHttpClient;
  
  beforeEach(() => {
    mockHttpClient = new MockHttpClient();
    adapter = new ShopeeAdapter(mockHttpClient);
  });
  
  describe('fetchProducts', () => {
    it('should handle API rate limiting gracefully', async () => {
      mockHttpClient.get
        .mockRejectedValueOnce(new RateLimitError('Rate limit exceeded'))
        .mockResolvedValueOnce(createMockProductResponse());
      
      const result = await adapter.fetchProducts(mockConnection);
      
      expect(result).toHaveLength(1);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });
  });
});
```

This design provides a robust foundation for the StoreSync system, addressing all requirements while maintaining scalability, maintainability, and extensibility for future enhancements.