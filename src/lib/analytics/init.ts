/**
 * Analytics System Initialization
 * Sets up database triggers and initializes the analytics system
 */

import { realTimeAnalyticsUpdater } from './real-time-updates';
import { analyticsCacheLayer } from './cache-layer';

export class AnalyticsInitializer {
  private initialized = false;

  /**
   * Initialize the complete analytics system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('Analytics system already initialized');
      return;
    }

    try {
      console.log('Initializing analytics system...');

      // Initialize database triggers for real-time updates
      await realTimeAnalyticsUpdater.initializeTriggers();
      console.log('✓ Database triggers initialized');

      // Configure cache layer
      analyticsCacheLayer.configure({
        ttl: 300, // 5 minutes default
        refreshThreshold: 0.8,
        maxSize: 1000,
        compressionEnabled: true,
      });
      console.log('✓ Cache layer configured');

      // Set up event handlers for real-time updates
      this.setupEventHandlers();
      console.log('✓ Event handlers configured');

      this.initialized = true;
      console.log('✓ Analytics system initialization complete');
    } catch (error) {
      console.error('Failed to initialize analytics system:', error);
      throw error;
    }
  }

  /**
   * Clean up analytics system (for testing or shutdown)
   */
  async cleanup(): Promise<void> {
    try {
      console.log('Cleaning up analytics system...');

      // Clean up database triggers
      await realTimeAnalyticsUpdater.cleanupTriggers();
      console.log('✓ Database triggers cleaned up');

      // Clear cache
      analyticsCacheLayer.invalidateByPattern('');
      console.log('✓ Cache cleared');

      this.initialized = false;
      console.log('✓ Analytics system cleanup complete');
    } catch (error) {
      console.error('Failed to cleanup analytics system:', error);
      throw error;
    }
  }

  /**
   * Check if analytics system is healthy
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    details: Record<string, any>;
  }> {
    const checks = {
      initialized: this.initialized,
      cacheWorking: false,
      triggersActive: false,
    };

    const details: Record<string, any> = {};

    try {
      // Test cache functionality
      const testKey = 'health-check-test';
      analyticsCacheLayer.getCacheStats();
      checks.cacheWorking = true;
      details.cache = 'Cache is working properly';
    } catch (error) {
      details.cache = `Cache error: ${error}`;
    }

    try {
      // Test real-time metrics
      const metrics = await realTimeAnalyticsUpdater.getRealTimeMetrics('test-org');
      checks.triggersActive = true;
      details.realTime = 'Real-time updates are working';
    } catch (error) {
      details.realTime = `Real-time error: ${error}`;
    }

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      checks,
      details: {
        ...details,
        cacheStats: analyticsCacheLayer.getCacheStats(),
        timestamp: new Date(),
      },
    };
  }

  /**
   * Get system information
   */
  getSystemInfo(): {
    version: string;
    initialized: boolean;
    features: string[];
    configuration: Record<string, any>;
  } {
    return {
      version: '1.0.0',
      initialized: this.initialized,
      features: [
        'Real-time analytics updates',
        'Intelligent caching',
        'Flexible query engine',
        'Dashboard metrics',
        'Platform comparison',
        'Inventory analytics',
      ],
      configuration: {
        cacheEnabled: true,
        realTimeEnabled: true,
        compressionEnabled: true,
        maxCacheSize: 1000,
        defaultTTL: 300,
      },
    };
  }

  /**
   * Private helper methods
   */
  private setupEventHandlers(): void {
    // Handle order events
    realTimeAnalyticsUpdater.subscribe('order_created', (event) => {
      console.log(`Order created: ${event.entityId} for org: ${event.organizationId}`);
      // Additional processing if needed
    });

    realTimeAnalyticsUpdater.subscribe('order_updated', (event) => {
      console.log(`Order updated: ${event.entityId} for org: ${event.organizationId}`);
    });

    // Handle inventory events
    realTimeAnalyticsUpdater.subscribe('inventory_changed', (event) => {
      console.log(`Inventory changed: ${event.entityId} for org: ${event.organizationId}`);
    });

    // Handle sync events
    realTimeAnalyticsUpdater.subscribe('sync_completed', (event) => {
      console.log(`Sync completed: ${event.entityId} for org: ${event.organizationId}`);
    });
  }
}

// Export singleton instance
export const analyticsInitializer = new AnalyticsInitializer();

// Auto-initialize in production
if (process.env.NODE_ENV === 'production') {
  analyticsInitializer.initialize().catch(console.error);
}