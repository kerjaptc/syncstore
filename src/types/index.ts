/**
 * Core Types for StoreSync Application
 */

// Base Types
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Pagination Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// User & Organization Types
export interface User extends BaseEntity {
  email: string;
  fullName?: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  isActive: boolean;
  lastActiveAt?: Date;
}

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  settings: Record<string, any>;
  subscriptionPlan: string;
}

// Product Types
export interface Product extends BaseEntity {
  organizationId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  costPrice?: number;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  images: string[];
  attributes: Record<string, any>;
  isActive: boolean;
}

export interface ProductVariant extends BaseEntity {
  productId: string;
  variantSku: string;
  name?: string;
  attributes: Record<string, any>;
  costPrice?: number;
  weight?: number;
  images: string[];
  isActive: boolean;
}

// Store & Platform Types
export interface Platform extends BaseEntity {
  name: string;
  displayName: string;
  isActive: boolean;
  apiConfig: Record<string, any>;
}

export interface Store extends BaseEntity {
  organizationId: string;
  platformId: string;
  name: string;
  platformStoreId: string;
  credentials: Record<string, any>;
  settings: Record<string, any>;
  syncStatus: 'active' | 'paused' | 'error';
  lastSyncAt?: Date;
  isActive: boolean;
}

// Order Types
export interface Order extends BaseEntity {
  organizationId: string;
  storeId: string;
  platformOrderId: string;
  orderNumber?: string;
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
    address: any;
  };
  status: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  platformData: Record<string, any>;
  notes?: string;
  tags?: string[];
  orderedAt: Date;
}

export interface OrderItem extends BaseEntity {
  orderId: string;
  productVariantId?: string;
  platformProductId?: string;
  platformVariantId?: string;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  totalAmount: number;
}

// Inventory Types
export interface InventoryLocation extends BaseEntity {
  organizationId: string;
  name: string;
  address?: any;
  isDefault: boolean;
  isActive: boolean;
}

export interface InventoryItem extends BaseEntity {
  productVariantId: string;
  locationId: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number;
  reorderQuantity: number;
}

export interface InventoryTransaction extends BaseEntity {
  inventoryItemId: string;
  transactionType: 'adjustment' | 'sale' | 'purchase' | 'transfer' | 'reservation';
  quantityChange: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdBy?: string;
}

// Sync Types
export interface SyncJob extends BaseEntity {
  organizationId: string;
  storeId?: string;
  jobType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
  errorMessage?: string;
  retryCount: number;
  metadata: Record<string, any>;
}

export interface SyncLog extends BaseEntity {
  syncJobId: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  details?: any;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// Platform Integration Types
export interface PlatformCredentials {
  [key: string]: string | number | boolean;
}

export interface PlatformProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  sku: string;
  images: string[];
  variants?: PlatformProductVariant[];
  attributes: Record<string, any>;
}

export interface PlatformProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  attributes: Record<string, any>;
}

export interface PlatformOrder {
  id: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  items: PlatformOrderItem[];
  total: number;
  status: string;
  createdAt: Date;
}

export interface PlatformOrderItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
}

// Storefront Types
export interface StorefrontProduct extends Omit<Product, 'organizationId' | 'costPrice'> {
  variants: StorefrontVariant[];
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  inStock: boolean;
}

export interface StorefrontVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  quantityAvailable: number;
  inStock: boolean;
}

// Cart Types
export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  price: number;
  quantity: number;
  image?: string;
  attributes?: Record<string, any>;
}

// Checkout Types
export interface CustomerInfo {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface ShippingInfo {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  description: string;
  cost: number;
  estimatedDays: number;
}

// Analytics Types
export interface AnalyticsMetric {
  name: string;
  value: number;
  change?: number;
  changeType?: 'increase' | 'decrease';
  period: string;
}

export interface AnalyticsData {
  metrics: AnalyticsMetric[];
  charts: ChartData[];
  period: {
    start: Date;
    end: Date;
  };
}

export interface ChartData {
  name: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  data: Array<{
    label: string;
    value: number;
    date?: Date;
  }>;
}

// Security Types
export interface JWTPayload {
  userId: string;
  organizationId: string;
  role: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenData {
  userId: string;
  organizationId: string;
  expiresAt: Date;
  isRevoked: boolean;
}

// Webhook Types
export interface WebhookEndpoint extends BaseEntity {
  storeId: string;
  platformWebhookId?: string;
  eventTypes: string[];
  url: string;
  secret?: string;
  isActive: boolean;
}

export interface WebhookEvent extends BaseEntity {
  webhookEndpointId?: string;
  eventType: string;
  payload: any;
  processed: boolean;
  processedAt?: Date;
  errorMessage?: string;
  retryCount: number;
}

// Form Types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  validation?: any;
}

// Filter Types
export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface FilterGroup {
  name: string;
  label: string;
  type: 'checkbox' | 'radio' | 'range' | 'select';
  options: FilterOption[];
}

// Order Status Types
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
export type FinancialStatus = 'pending' | 'paid' | 'refunded';
export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled';

// Sync Job Types
export type SyncJobType = 'products' | 'inventory' | 'orders' | 'full_sync';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

// User Role Types
export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

// User with Organization Type
export interface UserWithOrganization extends User {
  organization: Organization;
}

// Order with Items Type
export interface OrderWithItems extends Order {
  items: OrderItem[];
  store?: StoreWithRelations;
}

// Store with Relations Type
export interface StoreWithRelations extends Store {
  platform: Platform;
  _count?: {
    orders?: number;
    products?: number;
  };
}

// Product with Variants Type
export interface ProductWithVariants extends Product {
  variants: ProductVariant[];
}

// Sync Job with Logs Type
export interface SyncJobWithLogs extends SyncJob {
  logs: SyncLog[];
}

// Analytics Types
export interface AnalyticsQuery {
  metric: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  filters?: Record<string, any>;
  groupBy?: string;
}

export interface AnalyticsResult {
  data: Array<{
    label: string;
    value: number;
    date?: Date;
    metadata?: Record<string, any>;
  }>;
  summary: {
    total: number;
    change?: number;
    changePercent?: number;
  };
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  topProducts: Array<{
    name: string;
    revenue: number;
    orders: number;
  }>;
  revenueChange: number;
  ordersChange: number;
  aovChange: number;
  conversionChange: number;
}

// Inventory Transaction Type
export type InventoryTransactionType = 'adjustment' | 'sale' | 'purchase' | 'transfer' | 'reservation';

// Select Types (for database queries)
export type SelectOrder = Order;
export type SelectOrderItem = OrderItem;
export type SelectPlatform = Platform;

// Order Item with Product Type
export interface OrderItemWithProduct extends OrderItem {
  product?: Product;
  productVariant?: ProductVariant;
}

// Export all types
export type {
  // Re-export commonly used types
  BaseEntity,
  PaginationParams,
  PaginatedResponse,
  ApiResponse,
  ApiError,
  // Order types
  SelectOrderItem,
  OrderItemWithProduct,
};