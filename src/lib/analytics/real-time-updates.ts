/**
 * Real-time Analytics Updates
 * Implements real-time analytics updates using database triggers and events
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { cache } from '@/lib/cache';

export interface AnalyticsEvent {
  type: 'order_created' | 'order_updated' | 'inventory_changed' | 'sync_completed';
  organizationId: string;
  entityId: string;
  data: Record<string, any>;
  timestamp: Date;
}

export class RealTimeAnalyticsUpdater {
  private eventHandlers: Map<string, ((event: AnalyticsEvent) => void)[]> = new Map();

  /**
   * Initialize database triggers for real-time updates
   */
  async initializeTriggers(): Promise<void> {
    try {
      // Create trigger function for order events
      await db.execute(sql`
        CREATE OR REPLACE FUNCTION notify_analytics_order_change()
        RETURNS TRIGGER AS $$
        BEGIN
          PERFORM pg_notify(
            'analytics_update',
            json_build_object(
              'type', CASE 
                WHEN TG_OP = 'INSERT' THEN 'order_created'
                ELSE 'order_updated'
              END,
              'organization_id', COALESCE(NEW.organization_id, OLD.organization_id),
              'entity_id', COALESCE(NEW.id, OLD.id),
              'data', row_to_json(NEW),
              'timestamp', NOW()
            )::text
          );
          RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
      `);

      // Create trigger for orders table
      await db.execute(sql`
        DROP TRIGGER IF EXISTS analytics_order_trigger ON orders;
        CREATE TRIGGER analytics_order_trigger
          AFTER INSERT OR UPDATE ON orders
          FOR EACH ROW
          EXECUTE FUNCTION notify_analytics_order_change();
      `);

      // Create trigger function for inventory events
      await db.execute(sql`
        CREATE OR REPLACE FUNCTION notify_analytics_inventory_change()
        RETURNS TRIGGER AS $$
        DECLARE
          org_id UUID;
        BEGIN
          -- Get organization ID through product relationship
          SELECT p.organization_id INTO org_id
          FROM inventory_items ii
          JOIN product_variants pv ON ii.product_variant_id = pv.id
          JOIN products p ON pv.product_id = p.id
          WHERE ii.id = COALESCE(NEW.inventory_item_id, OLD.inventory_item_id);

          PERFORM pg_notify(
            'analytics_update',
            json_build_object(
              'type', 'inventory_changed',
              'organization_id', org_id,
              'entity_id', COALESCE(NEW.id, OLD.id),
              'data', row_to_json(NEW),
              'timestamp', NOW()
            )::text
          );
          RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
      `);

      // Create trigger for inventory transactions
      await db.execute(sql`
        DROP TRIGGER IF EXISTS analytics_inventory_trigger ON inventory_transactions;
        CREATE TRIGGER analytics_inventory_trigger
          AFTER INSERT OR UPDATE ON inventory_transactions
          FOR EACH ROW
          EXECUTE FUNCTION notify_analytics_inventory_change();
      `);

      // Create trigger function for sync job events
      await db.execute(sql`
        CREATE OR REPLACE FUNCTION notify_analytics_sync_change()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Only notify on completion or failure
          IF NEW.status IN ('completed', 'failed') AND OLD.status != NEW.status THEN
            PERFORM pg_notify(
              'analytics_update',
              json_build_object(
                'type', 'sync_completed',
                'organization_id', NEW.organization_id,
                'entity_id', NEW.id,
                'data', row_to_json(NEW),
                'timestamp', NOW()
              )::text
            );
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      // Create trigger for sync jobs
      await db.execute(sql`
        DROP TRIGGER IF EXISTS analytics_sync_trigger ON sync_jobs;
        CREATE TRIGGER analytics_sync_trigger
          AFTER UPDATE ON sync_jobs
          FOR EACH ROW
          EXECUTE FUNCTION notify_analytics_sync_change();
      `);

      console.log('Analytics triggers initialized successfully');
    } catch (error) {
      console.error('Failed to initialize analytics triggers:', error);
      throw error;
    }
  }

  /**
   * Subscribe to analytics events
   */
  subscribe(eventType: string, handler: (event: AnalyticsEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Unsubscribe from analytics events
   */
  unsubscribe(eventType: string, handler: (event: AnalyticsEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Handle incoming analytics events
   */
  async handleEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Invalidate relevant cache entries
      await this.invalidateCache(event);

      // Notify subscribers
      const handlers = this.eventHandlers.get(event.type) || [];
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in analytics event handler:', error);
        }
      });

      // Update real-time metrics
      await this.updateRealTimeMetrics(event);
    } catch (error) {
      console.error('Error handling analytics event:', error);
    }
  }

  /**
   * Invalidate cache entries based on event
   */
  private async invalidateCache(event: AnalyticsEvent): Promise<void> {
    const { type, organizationId } = event;

    // Invalidate dashboard metrics cache
    cache.delete(`dashboard-metrics:${organizationId}`);

    // Invalidate specific analytics caches based on event type
    switch (type) {
      case 'order_created':
      case 'order_updated':
        // Invalidate order-related analytics
        cache.delete(`sales-analytics:${organizationId}`);
        cache.delete(`platform-comparison:${organizationId}`);
        break;

      case 'inventory_changed':
        // Invalidate inventory-related analytics
        cache.delete(`inventory-analytics:${organizationId}`);
        cache.delete(`stock-trends:${organizationId}`);
        break;

      case 'sync_completed':
        // Invalidate sync-related analytics
        cache.delete(`sync-analytics:${organizationId}`);
        break;
    }

    // Invalidate date-range specific caches
    const today = new Date().toISOString().split('T')[0];
    cache.delete(`analytics:${organizationId}:${today}`);
  }

  /**
   * Update real-time metrics
   */
  private async updateRealTimeMetrics(event: AnalyticsEvent): Promise<void> {
    const { type, organizationId, data } = event;

    try {
      switch (type) {
        case 'order_created':
          await this.updateOrderMetrics(organizationId, data, 'created');
          break;

        case 'order_updated':
          await this.updateOrderMetrics(organizationId, data, 'updated');
          break;

        case 'inventory_changed':
          await this.updateInventoryMetrics(organizationId, data);
          break;

        case 'sync_completed':
          await this.updateSyncMetrics(organizationId, data);
          break;
      }
    } catch (error) {
      console.error('Error updating real-time metrics:', error);
    }
  }

  /**
   * Update order-related metrics
   */
  private async updateOrderMetrics(organizationId: string, orderData: any, action: 'created' | 'updated'): Promise<void> {
    const metricsKey = `real-time-metrics:orders:${organizationId}`;
    
    // Get current metrics or initialize
    const currentMetrics = await cache.get(metricsKey, async () => ({
      todayOrders: 0,
      todayRevenue: 0,
      pendingOrders: 0,
      processingOrders: 0,
    }), 3600); // Cache for 1 hour

    if (action === 'created') {
      // Check if order is from today
      const orderDate = new Date(orderData.ordered_at);
      const today = new Date();
      
      if (orderDate.toDateString() === today.toDateString()) {
        currentMetrics.todayOrders += 1;
        currentMetrics.todayRevenue += Number(orderData.total_amount) || 0;
      }
    }

    // Update status counts
    if (orderData.status === 'pending') {
      currentMetrics.pendingOrders += action === 'created' ? 1 : 0;
    } else if (orderData.status === 'processing') {
      currentMetrics.processingOrders += action === 'created' ? 1 : 0;
    }

    // Update cache
    cache.set(metricsKey, currentMetrics, 3600);
  }

  /**
   * Update inventory-related metrics
   */
  private async updateInventoryMetrics(organizationId: string, transactionData: any): Promise<void> {
    const metricsKey = `real-time-metrics:inventory:${organizationId}`;
    
    const currentMetrics = await cache.get(metricsKey, async () => ({
      todayMovements: 0,
      totalMovement: 0,
      lowStockAlerts: 0,
    }), 3600);

    // Update movement metrics
    const quantityChange = Number(transactionData.quantity_change) || 0;
    currentMetrics.todayMovements += 1;
    currentMetrics.totalMovement += quantityChange;

    // Update cache
    cache.set(metricsKey, currentMetrics, 3600);
  }

  /**
   * Update sync-related metrics
   */
  private async updateSyncMetrics(organizationId: string, syncData: any): Promise<void> {
    const metricsKey = `real-time-metrics:sync:${organizationId}`;
    
    const currentMetrics = await cache.get(metricsKey, async () => ({
      todayJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      successRate: 0,
    }), 3600);

    // Update sync metrics
    currentMetrics.todayJobs += 1;
    
    if (syncData.status === 'completed') {
      currentMetrics.successfulJobs += 1;
    } else if (syncData.status === 'failed') {
      currentMetrics.failedJobs += 1;
    }

    // Calculate success rate
    const totalJobs = currentMetrics.successfulJobs + currentMetrics.failedJobs;
    currentMetrics.successRate = totalJobs > 0 
      ? (currentMetrics.successfulJobs / totalJobs) * 100 
      : 0;

    // Update cache
    cache.set(metricsKey, currentMetrics, 3600);
  }

  /**
   * Get real-time metrics for organization
   */
  async getRealTimeMetrics(organizationId: string): Promise<Record<string, any>> {
    const [orderMetrics, inventoryMetrics, syncMetrics] = await Promise.all([
      cache.get(`real-time-metrics:orders:${organizationId}`, async () => ({})),
      cache.get(`real-time-metrics:inventory:${organizationId}`, async () => ({})),
      cache.get(`real-time-metrics:sync:${organizationId}`, async () => ({})),
    ]);

    return {
      orders: orderMetrics,
      inventory: inventoryMetrics,
      sync: syncMetrics,
      lastUpdated: new Date(),
    };
  }

  /**
   * Clean up triggers (for testing or maintenance)
   */
  async cleanupTriggers(): Promise<void> {
    try {
      await db.execute(sql`DROP TRIGGER IF EXISTS analytics_order_trigger ON orders;`);
      await db.execute(sql`DROP TRIGGER IF EXISTS analytics_inventory_trigger ON inventory_transactions;`);
      await db.execute(sql`DROP TRIGGER IF EXISTS analytics_sync_trigger ON sync_jobs;`);
      
      await db.execute(sql`DROP FUNCTION IF EXISTS notify_analytics_order_change();`);
      await db.execute(sql`DROP FUNCTION IF EXISTS notify_analytics_inventory_change();`);
      await db.execute(sql`DROP FUNCTION IF EXISTS notify_analytics_sync_change();`);

      console.log('Analytics triggers cleaned up successfully');
    } catch (error) {
      console.error('Failed to cleanup analytics triggers:', error);
      throw error;
    }
  }
}

export const realTimeAnalyticsUpdater = new RealTimeAnalyticsUpdater();