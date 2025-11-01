/**
 * Platform Adapter Types
 * Common types and interfaces for platform integrations
 */

export interface PlatformCredentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  apiSecret?: string;
  shopId?: string;
  sellerId?: string;
  [key: string]: any;
}

export interface PlatformConfig {
  baseUrl: string;
  apiVersion: string;
  rateLimits: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  retryConfig: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  };
  timeout: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId?: string;
    timestamp: Date;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page?: number;
    limit?: number;
    offset?: number;
    cursor?: string;
    total?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
}

// Platform-specific product data
export interface PlatformProduct {
  platformProductId: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  images: string[];
  variants: PlatformProductVariant[];
  status: 'active' | 'inactive' | 'draft';
  platformData: Record<string, any>;
}

export interface PlatformProductVariant {
  platformVariantId: string;
  name: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  inventory: {
    quantity: number;
    tracked: boolean;
  };
  attributes: Record<string, any>;
  images: string[];
  status: 'active' | 'inactive';
}

// Platform-specific order data
export interface PlatformOrder {
  platformOrderId: string;
  orderNumber?: string;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    address: {
      street: string;
      city: string;
      state?: string;
      country: string;
      postalCode: string;
    };
  };
  items: PlatformOrderItem[];
  totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
  };
  currency: string;
  orderedAt: Date;
  platformData: Record<string, any>;
}

export interface PlatformOrderItem {
  platformProductId: string;
  platformVariantId?: string;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  totalAmount: number;
}

// Webhook data
export interface WebhookPayload {
  event: string;
  data: any;
  timestamp: Date;
  signature?: string;
}

// Error types
export enum PlatformErrorType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  RATE_LIMIT = 'rate_limit',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  SERVER_ERROR = 'server_error',
  UNKNOWN = 'unknown'
}

export class PlatformError extends Error {
  constructor(
    public type: PlatformErrorType,
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}

// Rate limiting
export interface RateLimitInfo {
  remaining: number;
  reset: Date;
  limit: number;
}

// Request context
export interface RequestContext {
  requestId: string;
  timestamp: Date;
  endpoint: string;
  method: string;
  retryCount: number;
}