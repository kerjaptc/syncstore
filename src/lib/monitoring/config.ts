/**
 * Monitoring Configuration
 * Controls monitoring behavior based on environment
 */

export const monitoringConfig = {
  // Disable heavy monitoring in development
  enablePerformanceMonitoring: process.env.NODE_ENV === 'production',
  enableSystemMetrics: process.env.NODE_ENV === 'production',
  enableMemoryTracking: process.env.NODE_ENV === 'production',
  
  // Intervals (in milliseconds)
  systemMetricsInterval: process.env.NODE_ENV === 'development' ? 60 * 1000 : 30 * 1000, // 1 min vs 30 sec
  cleanupInterval: process.env.NODE_ENV === 'development' ? 5 * 60 * 1000 : 60 * 60 * 1000, // 5 min vs 1 hour
  jobQueueInterval: process.env.NODE_ENV === 'development' ? 1000 : 100, // 1s vs 100ms
  
  // Data retention
  metricsMaxAge: process.env.NODE_ENV === 'development' ? 10 * 60 * 1000 : 24 * 60 * 60 * 1000, // 10 min vs 24 hours
  alertsMaxAge: process.env.NODE_ENV === 'development' ? 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 1 hour vs 7 days
  
  // Memory limits
  maxMetricsInMemory: process.env.NODE_ENV === 'development' ? 1000 : 10000,
  maxAlertsInMemory: process.env.NODE_ENV === 'development' ? 100 : 1000,
};

/**
 * Check if monitoring should be enabled
 */
export function shouldEnableMonitoring(): boolean {
  // Disable monitoring if explicitly set
  if (process.env.DISABLE_MONITORING === 'true') {
    return false;
  }
  
  // Enable in production, optional in development
  return process.env.NODE_ENV === 'production' || process.env.ENABLE_DEV_MONITORING === 'true';
}

/**
 * Get optimized interval based on environment
 */
export function getOptimizedInterval(productionMs: number, developmentMultiplier: number = 2): number {
  return process.env.NODE_ENV === 'development' 
    ? productionMs * developmentMultiplier 
    : productionMs;
}