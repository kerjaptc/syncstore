/**
 * Platform Integration Layer
 * Exports all platform-related components
 */

// Core types and interfaces
export * from './types';

// Base adapter and factory
export { BasePlatformAdapter } from './base-adapter';
export { PlatformAdapterFactory, DEFAULT_PLATFORM_CONFIGS } from './adapter-factory';

// Utility services
export { RateLimiter, rateLimiter } from './rate-limiter';
export { RequestCache, requestCache } from './request-cache';
export { HealthMonitor, healthMonitor } from './health-monitor';

// Platform adapters
export * from './shopee';
export * from './tiktokshop';

// Main platform service
export { PlatformService } from './platform-service';

// Re-export commonly used types
export type {
  PlatformCredentials,
  PlatformConfig,
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  PlatformProduct,
  PlatformProductVariant,
  PlatformOrder,
  PlatformOrderItem,
  WebhookPayload,
  RateLimitInfo,
  RequestContext
} from './types';

export {
  PlatformError,
  PlatformErrorType
} from './types';