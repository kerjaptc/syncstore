/**
 * Analytics System Exports
 * Central export point for all analytics functionality
 */

// Core services
export { analyticsService } from '@/lib/services/analytics-service';
export { AnalyticsService } from '@/lib/services/analytics-service';

// Query engine
export { analyticsQueryEngine, AnalyticsQueryEngine } from './query-engine';
export type { QueryBuilder } from './query-engine';

// Real-time updates (server-side only)
export type { AnalyticsEvent } from './real-time-updates';

// Caching layer
export { analyticsCacheLayer, AnalyticsCacheLayer } from './cache-layer';
export type { CacheConfig, CacheStats } from './cache-layer';

// Initialization
export { analyticsInitializer, AnalyticsInitializer } from './init';

// Cache utility (server-side only)

// Re-export types from main types file
export type { 
  AnalyticsQuery, 
  AnalyticsResult, 
  DashboardMetrics 
} from '@/types';

// Client-safe utilities
export { 
  ANALYTICS_CONFIG, 
  ANALYTICS_METRICS, 
  ANALYTICS_GROUP_BY, 
  analyticsUtils 
} from './utils';