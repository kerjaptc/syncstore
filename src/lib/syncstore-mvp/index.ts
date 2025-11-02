/**
 * SyncStore MVP Core Module
 * 
 * This is the main entry point for the SyncStore MVP core functionality.
 * It exports all types, interfaces, utilities, and services needed for
 * Shopee integration and product synchronization.
 */

// ============================================================================
// Type Exports
// ============================================================================

// Core types
export type {
  StoreConnection,
  Product,
  SyncStatus,
  SyncLog,
  ShopeeProduct,
  ShopeeOAuthCredentials,
  FetchOptions,
  SyncResult,
  ValidationResult,
  ConnectionStatus,
  AuthUrl,
  OAuthCredentials,
  Platform,
  SyncType,
  ProductStatus,
  ConnectionStatusType,
  SyncStatusType,
  SyncStoreConfig,
} from './types';

// Service interfaces
export type {
  PlatformAdapter,
  ShopeeIntegrationService,
  ProductSyncService,
  StoreConnectionService,
  ProductDataService,
  LoggingService,
  ConfigurationService,
  HealthCheckService,
  CacheService,
  PerformanceService,
  EventService,
  NotificationService,
} from './services/interfaces';

// ============================================================================
// Validation Schema Exports
// ============================================================================

export {
  StoreConnectionSchema,
  ProductSchema,
  SyncStatusSchema,
  SyncLogSchema,
  ShopeeProductSchema,
  ShopeeOAuthCredentialsSchema,
  ShopeeApiResponseSchema,
  OAuthInitiationRequestSchema,
  OAuthCallbackRequestSchema,
  FetchOptionsSchema,
  SyncRequestSchema,
  SyncStoreConfigSchema,
  ErrorResponseSchema,
  ValidationErrorSchema,
  validateData,
  validateDataSafe,
  createUpdateSchema,
  isConnectionValid,
} from './schemas/validation';

// Schema types (from validation)
export type {
  SyncRequest,
  ValidationError as ValidationErrorType,
} from './schemas/validation';

// ============================================================================
// Error Class Exports
// ============================================================================

export {
  SyncStoreError,
  ShopeeApiError,
  ValidationError,
  ConnectionError,
  SyncError,
  DatabaseError,
  ConfigurationError,
} from './utils/errors';

// ============================================================================
// Error Utility Exports
// ============================================================================

export {
  isRetryableError,
  getRetryDelay,
  categorizeError,
  sanitizeErrorForLogging,
  retryWithBackoff,
  CircuitBreaker,
  formatErrorForUser,
  createErrorContext,
} from './utils/errors';

// ============================================================================
// Error Handling Service Exports
// ============================================================================

export {
  GlobalErrorHandler,
  getGlobalErrorHandler,
  handleError,
  handleApiError,
  handleSyncError,
  handleDatabaseError,
  createRecoveryAction,
  initializeErrorHandling,
} from './services/error-handler';

export {
  ErrorLoggingService,
  getErrorLoggingService,
  logError,
  logMessage,
  initializeErrorLogging,
} from './services/error-logging';

export {
  ErrorRecoveryService,
  getErrorRecoveryService,
  recoverFromError,
  createRecoveryStrategy,
  initializeErrorRecovery,
} from './services/error-recovery';

// Error handling types
export type {
  ErrorHandlerConfig,
  ErrorLog,
  RecoveryAction,
  ErrorNotification,
} from './services/error-handler';

export type {
  ErrorLogEntry,
  ErrorMetrics,
  ErrorLoggingConfig,
  ErrorAlert,
} from './services/error-logging';

export type {
  RecoveryStrategy,
  RecoveryCondition,
  RecoveryConfig,
  RecoveryContext,
  RecoveryAttempt,
  RecoveryResult,
  RecoverySession,
} from './services/error-recovery';

// ============================================================================
// Performance Optimization Exports
// ============================================================================

export {
  PerformanceOptimizerService,
  getPerformanceOptimizer,
  cachedApiCall,
  measurePerformance,
  validateCacheConfig,
  initializePerformanceOptimization,
} from './services/performance-optimizer';

export type {
  CacheConfig,
  CacheEntry,
  CacheMetrics,
  QueryOptimization,
  LazyLoadingConfig,
  PerformanceMetrics,
} from './services/performance-optimizer';

// ============================================================================
// Component Exports
// ============================================================================

// Error handling components
export {
  SyncStoreMvpErrorBoundary,
  useErrorReporting,
  withErrorBoundary,
  useErrorRecovery,
} from './components/error-boundary';

export {
  ErrorDashboard,
} from './components/error-dashboard';

// Loading and feedback components
export {
  LoadingSpinner,
  LoadingButton,
  ProgressIndicator,
  SyncProgressDisplay,
  OperationStatusList,
  ProductListSkeleton,
  ConnectionStatusSkeleton,
  DashboardSkeleton,
  EmptyState,
  LoadingOverlay,
} from './components/loading-states';

export type {
  LoadingState,
  SyncProgress,
  OperationStatus,
} from './components/loading-states';

// Notification system
export {
  NotificationProvider,
  NotificationPanel,
  NotificationBell,
  useNotifications,
  useNotificationHelpers,
} from './components/notification-system';

export type {
  NotificationType,
  NotificationPriority,
  NotificationCategory,
  NotificationAction,
  Notification,
  NotificationContextType,
} from './components/notification-system';

// Dashboard components
export {
  ProductDashboard,
} from './components/product-dashboard';

export {
  ConnectionStatusDisplay,
} from './components/connection-status-display';

export {
  StoreConnectionWizard,
} from './components/store-connection-wizard';

// ============================================================================
// Service Exports (Limited - some require server-side database)
// ============================================================================

export {
  ShopeeOAuthService,
  createShopeeOAuthService,
} from './services/shopee-oauth';

export {
  CredentialStorageService,
} from './services/credential-storage';

export {
  ConnectionManagerService,
} from './services/connection-manager';

export {
  ShopeeApiClient,
  createShopeeApiClient,
} from './services/shopee-api-client';

export {
  ProductFetcherService,
} from './services/product-fetcher';

// Note: These services require database access and should only be used server-side
// export {
//   CoreSyncEngine,
//   createCoreSyncEngine,
// } from './services/sync-engine';

// export {
//   SyncSchedulerService,
//   createSyncSchedulerService,
// } from './services/sync-scheduler';

// ============================================================================
// Database Exports (Disabled - server-side only)
// ============================================================================

// Note: Database modules are available but should only be used server-side
// Uncomment when needed for server-side operations only

// export {
//   initializeMvpDatabase,
// } from './database/connection';

// export {
//   getMvpRepositories,
// } from './database/repositories';

// ============================================================================
// API Exports (Disabled - requires tRPC setup)
// ============================================================================

// Note: API routers are available but require tRPC configuration
// Uncomment when tRPC is properly configured in the main application

// export {
//   createProductRouter,
// } from './api/product-sync-router';

// export type {
//   SyncStoreMvpRouter,
// } from './api/trpc-router';

// ============================================================================
// Constants and Enums
// ============================================================================

/**
 * Supported platforms
 */
export const PLATFORMS = {
  SHOPEE: 'shopee',
} as const;

/**
 * Sync types
 */
export const SYNC_TYPES = {
  FULL: 'full',
  INCREMENTAL: 'incremental',
} as const;

/**
 * Connection statuses
 */
export const CONNECTION_STATUSES = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  ERROR: 'error',
} as const;

/**
 * Sync statuses
 */
export const SYNC_STATUSES = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  COMPLETED: 'completed',
  ERROR: 'error',
} as const;

/**
 * Product statuses
 */
export const PRODUCT_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  SYNC: {
    BATCH_SIZE: 50,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    MAX_RETRY_DELAY: 30000,
  },
  API: {
    TIMEOUT: 30000,
    RATE_LIMIT_DELAY: 1000,
  },
  CACHE: {
    DEFAULT_TTL: 300, // 5 minutes
    MAX_TTL: 3600, // 1 hour
  },
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 5,
    RECOVERY_TIMEOUT: 60000, // 1 minute
    SUCCESS_THRESHOLD: 2,
  },
} as const;

/**
 * Error codes
 */
export const ERROR_CODES = {
  // General errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  
  // Connection errors
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // API errors
  SHOPEE_API_ERROR: 'SHOPEE_API_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  API_TIMEOUT: 'API_TIMEOUT',
  
  // Sync errors
  SYNC_ERROR: 'SYNC_ERROR',
  SYNC_TIMEOUT: 'SYNC_TIMEOUT',
  SYNC_CANCELLED: 'SYNC_CANCELLED',
  
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  
  // System errors
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculates sync progress percentage
 */
export function calculateSyncProgress(syncedProducts: number, totalProducts: number): number {
  if (totalProducts === 0) return 0;
  return Math.round((syncedProducts / totalProducts) * 100);
}

/**
 * Formats a sync duration for display
 */
export function formatSyncDuration(startTime: Date, endTime?: Date): string {
  const end = endTime || new Date();
  const durationMs = end.getTime() - startTime.getTime();
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Generates a unique sync job ID
 */
export function generateSyncJobId(storeId: string, type: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `sync_${type}_${storeId}_${timestamp}_${random}`;
}

// ============================================================================
// Mock Data (for development and testing)
// ============================================================================

export {
  default as mockData,
  mockStoreConnections,
  mockProducts,
  mockSyncProgress,
  mockOperations,
  generateMockSyncProgress,
  generateMockOperation,
} from './mock-data';

// ============================================================================
// Version Information
// ============================================================================

export const VERSION = '1.0.0';
export const MODULE_NAME = 'SyncStore MVP Core';

/**
 * Module information
 */
export const MODULE_INFO = {
  name: MODULE_NAME,
  version: VERSION,
  description: 'Core functionality for SyncStore MVP with Shopee integration',
  features: [
    'Shopee OAuth integration',
    'Product synchronization',
    'Error handling and recovery',
    'Data validation',
    'Performance monitoring',
  ],
} as const;