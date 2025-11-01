/**
 * Order Synchronization
 * Handles automated order fetching and status synchronization
 */

import { db } from '@/lib/db';
import { 
  orders,
  orderItems,
  storeProductMappings,
  stores,
  platforms
} from '@/lib/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { PlatformAdapterFactory } from '@/lib/platforms/adapter-factory';
import { StoreService } from '@/lib/services/store-service';
import { OrderService } from '@/lib/services/order-service';
import { OrderStatus, FinancialStatus, FulfillmentStatus } from '@/types';
import { orderSyncMonitor } from './order-sync-monitor';
import { orderDataNormalizer } from './order-data-normalizer';
import type { PlatformOrder, SelectOrder } from '@/types';

export interface OrderSyncOptions {
  batchSize?: number;
  startDate?: Date;
  endDate?: Date;
  orderStatuses?: string[];
  syncDirection?: 'pull' | 'push' | 'bidirectional';
  dryRun?: boolean;
}

export interface OrderSyncResult {
  totalProcessed: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  statusUpdates: number;
  errors: Array<{
    orderId: string;
    platformOrderId?: string;
    error: string;
  }>;
}

export interface OrderStatusMapping {
  platform: string;
  platformStatus: string;
  localStatus: OrderStatus;
  financialStatus?: FinancialStatus;
  fulfillmentStatus?: FulfillmentStatus;
}

export class OrderSyncService {
  private storeService: StoreService;
  private orderService: OrderService;
  private statusMappings: Map<string, OrderStatusMapping[]> = new Map();

  constructor() {
    this.storeService = new StoreService();
    this.orderService = new OrderService();
    this.initializeStatusMappings();
  }

  /**
   * Initialize platform-specific status mappings
   */
  private initializeStatusMappings(): void {
    // Shopee status mappings
    this.statusMappings.set('shopee', [
      {
        platform: 'shopee',
        platformStatus: 'UNPAID',
        localStatus: 'pending',
        financialStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
      },
      {
        platform: 'shopee',
        platformStatus: 'TO_SHIP',
        localStatus: 'paid',
        financialStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
      },
      {
        platform: 'shopee',
        platformStatus: 'SHIPPED',
        localStatus: 'shipped',
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
      },
      {
        platform: 'shopee',
        platformStatus: 'COMPLETED',
        localStatus: 'delivered',
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
      },
      {
        platform: 'shopee',
        platformStatus: 'CANCELLED',
        localStatus: 'cancelled',
        financialStatus: 'refunded',
        fulfillmentStatus: 'unfulfilled',
      },
    ]);

    // TikTok Shop status mappings
    this.statusMappings.set('tiktok_shop', [
      {
        platform: 'tiktok_shop',
        platformStatus: 'AWAITING_PAYMENT',
        localStatus: 'pending',
        financialStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
      },
      {
        platform: 'tiktok_shop',
        platformStatus: 'AWAITING_SHIPMENT',
        localStatus: 'paid',
        financialStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
      },
      {
        platform: 'tiktok_shop',
        platformStatus: 'SHIPPED',
        localStatus: 'shipped',
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
      },
      {
        platform: 'tiktok_shop',
        platformStatus: 'DELIVERED',
        localStatus: 'delivered',
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
      },
      {
        platform: 'tiktok_shop',
        platformStatus: 'CANCELLED',
        localStatus: 'cancelled',
        financialStatus: 'refunded',
        fulfillmentStatus: 'unfulfilled',
      },
    ]);
  }

  /**
   * Sync orders for all stores in an organization
   */
  async syncOrdersForOrganization(
    organizationId: string,
    options: OrderSyncOptions = {}
  ): Promise<OrderSyncResult> {
    const result: OrderSyncResult = {
      totalProcessed: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      statusUpdates: 0,
      errors: [],
    };

    try {
      // Get all active stores for the organization
      const storesResult = await this.storeService.getOrganizationStores(organizationId, {
        isActive: true,
      });

      const activeStores = storesResult.stores;

      // Sync orders for each store
      for (const store of activeStores) {
        try {
          const storeResult = await this.syncOrdersForStore(
            store.id,
            organizationId,
            options
          );

          // Aggregate results
          result.totalProcessed += storeResult.totalProcessed;
          result.imported += storeResult.imported;
          result.updated += storeResult.updated;
          result.skipped += storeResult.skipped;
          result.failed += storeResult.failed;
          result.statusUpdates += storeResult.statusUpdates;
          result.errors.push(...storeResult.errors);

        } catch (error) {
          result.errors.push({
            orderId: 'store_error',
            error: `Store ${store.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }

      // Monitor sync completion
      await orderSyncMonitor.monitorSyncJobCompletion(
        `org_sync_${Date.now()}`,
        result,
        organizationId
      );

      return result;

    } catch (error) {
      result.errors.push({
        orderId: 'organization_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Monitor sync failure
      await orderSyncMonitor.monitorSyncJobCompletion(
        `org_sync_${Date.now()}`,
        result,
        organizationId
      );
      
      return result;
    }
  }

  /**
   * Sync orders for a specific store
   */
  async syncOrdersForStore(
    storeId: string,
    organizationId: string,
    options: OrderSyncOptions = {}
  ): Promise<OrderSyncResult> {
    const result: OrderSyncResult = {
      totalProcessed: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      statusUpdates: 0,
      errors: [],
    };

    try {
      // Get store and platform adapter
      const store = await this.storeService.getStoreWithRelations(storeId);
      if (!store) {
        throw new Error('Store not found');
      }

      const credentials = await this.storeService.getStoreCredentials(storeId, organizationId);
      if (!credentials) {
        throw new Error('Store credentials not found');
      }

      const adapter = PlatformAdapterFactory.createAdapter(
        store.platform.name,
        credentials
      );

      // Determine sync direction
      const syncDirection = options.syncDirection || 'bidirectional';

      if (syncDirection === 'pull' || syncDirection === 'bidirectional') {
        // Pull orders from platform
        const pullResult = await this.pullOrdersFromPlatform(
          adapter,
          store,
          options,
          result
        );
        Object.assign(result, pullResult);
      }

      if (syncDirection === 'push' || syncDirection === 'bidirectional') {
        // Push order status updates to platform
        const pushResult = await this.pushOrderStatusToPlatform(
          adapter,
          store,
          options,
          result
        );
        result.statusUpdates += pushResult.statusUpdates;
        result.errors.push(...pushResult.errors);
      }

      // Monitor sync completion
      await orderSyncMonitor.monitorSyncJobCompletion(
        `store_sync_${storeId}_${Date.now()}`,
        result,
        organizationId,
        storeId
      );

      return result;

    } catch (error) {
      result.errors.push({
        orderId: 'store_sync_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Monitor sync failure
      await orderSyncMonitor.monitorSyncJobCompletion(
        `store_sync_${storeId}_${Date.now()}`,
        result,
        organizationId,
        storeId
      );
      
      return result;
    }
  }

  /**
   * Pull orders from platform
   */
  private async pullOrdersFromPlatform(
    adapter: any,
    store: any,
    options: OrderSyncOptions,
    result: OrderSyncResult
  ): Promise<OrderSyncResult> {
    try {
      // Calculate date range for fetching orders
      const endDate = options.endDate || new Date();
      const startDate = options.startDate || new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

      // Get orders from platform
      const platformResponse = await adapter.getOrders({
        startDate,
        endDate,
        limit: options.batchSize || 50,
        status: options.orderStatuses?.join(','),
      });

      if (!platformResponse.success) {
        throw new Error(`Failed to fetch platform orders: ${platformResponse.error?.message}`);
      }

      const platformOrders = platformResponse.data.items;

      for (const platformOrder of platformOrders) {
        try {
          result.totalProcessed++;

          if (options.dryRun) {
            result.imported++;
            continue;
          }

          // Check if order already exists
          const existingOrder = await this.getOrderByPlatformId(
            store.id,
            platformOrder.platformOrderId
          );

          if (existingOrder) {
            // Update existing order
            await this.updateExistingOrder(existingOrder, platformOrder, store);
            result.updated++;
          } else {
            // Create new order
            await this.createNewOrder(platformOrder, store);
            result.imported++;
          }

        } catch (error) {
          result.failed++;
          result.errors.push({
            orderId: platformOrder.platformOrderId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

    } catch (error) {
      result.errors.push({
        orderId: 'platform_pull_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return result;
  }

  /**
   * Push order status updates to platform
   */
  private async pushOrderStatusToPlatform(
    adapter: any,
    store: any,
    options: OrderSyncOptions,
    result: OrderSyncResult
  ): Promise<{ statusUpdates: number; errors: Array<{ orderId: string; error: string }> }> {
    const pushResult = {
      statusUpdates: 0,
      errors: [] as Array<{ orderId: string; error: string }>,
    };

    try {
      // Get orders that need status updates
      const ordersToUpdate = await this.getOrdersNeedingStatusUpdate(
        store.id,
        store.organizationId
      );

      for (const order of ordersToUpdate) {
        try {
          if (options.dryRun) {
            pushResult.statusUpdates++;
            continue;
          }

          // Update order status on platform
          const updateResponse = await adapter.updateOrderStatus(
            order.platformOrderId,
            this.mapLocalStatusToPlatform(order.status as OrderStatus, store.platform.name),
            order.fulfillmentStatus === 'fulfilled' ? {
              carrier: 'Default Carrier',
              trackingNumber: 'TRACK123', // This would come from actual fulfillment data
            } : undefined
          );

          if (updateResponse.success) {
            pushResult.statusUpdates++;
            
            // Mark order as synced
            await this.markOrderAsSynced(order.id);
          } else {
            pushResult.errors.push({
              orderId: order.id,
              error: updateResponse.error?.message || 'Unknown platform error',
            });
          }

        } catch (error) {
          pushResult.errors.push({
            orderId: order.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

    } catch (error) {
      pushResult.errors.push({
        orderId: 'status_push_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return pushResult;
  }

  /**
   * Create new order from platform data
   */
  private async createNewOrder(platformOrder: PlatformOrder, store: any): Promise<void> {
    try {
      // Normalize platform order data
      const normalizedOrder = orderDataNormalizer.normalizeOrder(
        store.platform.name,
        platformOrder
      );

      // Map order items and find product mappings
      const orderItems = [];
      for (const normalizedItem of normalizedOrder.items) {
        // Try to find local product mapping
        const mapping = await this.findProductMapping(
          store.id,
          normalizedItem.platformProductId,
          normalizedItem.platformVariantId
        );

        orderItems.push({
          productVariantId: mapping?.productVariantId,
          platformProductId: normalizedItem.platformProductId,
          platformVariantId: normalizedItem.platformVariantId,
          name: normalizedItem.name,
          sku: normalizedItem.sku,
          quantity: normalizedItem.quantity,
          price: normalizedItem.price,
        });
      }

      // Create order using order service
      await this.orderService.createOrder({
        organizationId: store.organizationId,
        storeId: store.id,
        platformOrderId: normalizedOrder.platformOrderId,
        orderNumber: normalizedOrder.orderNumber,
        customerInfo: normalizedOrder.customerInfo,
        status: normalizedOrder.status,
        financialStatus: normalizedOrder.financialStatus,
        fulfillmentStatus: normalizedOrder.fulfillmentStatus,
        items: orderItems,
        subtotal: normalizedOrder.totals.subtotal,
        taxAmount: normalizedOrder.totals.tax,
        shippingAmount: normalizedOrder.totals.shipping,
        discountAmount: normalizedOrder.totals.discount,
        totalAmount: normalizedOrder.totals.total,
        currency: normalizedOrder.currency,
        platformData: normalizedOrder.platformData,
        notes: normalizedOrder.notes,
        tags: normalizedOrder.tags,
        orderedAt: normalizedOrder.orderedAt,
      });
    } catch (error) {
      console.error('Failed to create normalized order:', error);
      throw new Error(`Order normalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update existing order with platform data
   */
  private async updateExistingOrder(
    existingOrder: SelectOrder,
    platformOrder: PlatformOrder,
    store: any
  ): Promise<void> {
    try {
      // Normalize platform order data
      const normalizedOrder = orderDataNormalizer.normalizeOrder(
        store.platform.name,
        platformOrder
      );
      
      // Update order status if changed
      if (existingOrder.status !== normalizedOrder.status ||
          existingOrder.financialStatus !== normalizedOrder.financialStatus ||
          existingOrder.fulfillmentStatus !== normalizedOrder.fulfillmentStatus) {
        
        await this.orderService.updateOrderStatus(
          existingOrder.id,
          store.organizationId,
          normalizedOrder.status,
          normalizedOrder.financialStatus,
          normalizedOrder.fulfillmentStatus
        );
      }
    } catch (error) {
      console.error('Failed to update order with normalized data:', error);
      throw new Error(`Order update normalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map platform status to local status
   */
  private mapPlatformStatusToLocal(
    platformStatus: string,
    platformName: string
  ): OrderStatusMapping {
    const mappings = this.statusMappings.get(platformName) || [];
    const mapping = mappings.find(m => m.platformStatus === platformStatus);
    
    return mapping || {
      platform: platformName,
      platformStatus,
      localStatus: 'pending',
      financialStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
    };
  }

  /**
   * Map local status to platform status
   */
  private mapLocalStatusToPlatform(localStatus: OrderStatus, platformName: string): string {
    const mappings = this.statusMappings.get(platformName) || [];
    const mapping = mappings.find(m => m.localStatus === localStatus);
    
    return mapping?.platformStatus || localStatus;
  }

  /**
   * Get order by platform ID
   */
  private async getOrderByPlatformId(storeId: string, platformOrderId: string): Promise<SelectOrder | null> {
    const result = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.storeId, storeId),
        eq(orders.platformOrderId, platformOrderId)
      ))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find product mapping for order item
   */
  private async findProductMapping(
    storeId: string,
    platformProductId: string,
    platformVariantId?: string
  ): Promise<any> {
    const conditions = [
      eq(storeProductMappings.storeId, storeId),
      eq(storeProductMappings.platformProductId, platformProductId),
    ];

    if (platformVariantId) {
      conditions.push(eq(storeProductMappings.platformVariantId, platformVariantId));
    }

    const result = await db
      .select()
      .from(storeProductMappings)
      .where(and(...conditions))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get orders that need status updates
   */
  private async getOrdersNeedingStatusUpdate(
    storeId: string,
    organizationId: string
  ): Promise<SelectOrder[]> {
    // Get orders that have been updated locally but not synced to platform
    // This is a simplified implementation - in practice, you'd track sync status
    const result = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.storeId, storeId),
        eq(orders.organizationId, organizationId),
        gte(orders.updatedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
      ))
      .orderBy(desc(orders.updatedAt))
      .limit(50);

    return result;
  }

  /**
   * Mark order as synced
   */
  private async markOrderAsSynced(orderId: string): Promise<void> {
    // In a full implementation, you'd have a sync status field
    // For now, just update the updatedAt timestamp
    await db
      .update(orders)
      .set({ updatedAt: new Date() })
      .where(eq(orders.id, orderId));
  }

  /**
   * Get order sync statistics
   */
  async getOrderSyncStats(
    organizationId: string,
    storeId?: string
  ): Promise<{
    totalOrders: number;
    syncedToday: number;
    pendingSync: number;
    lastSyncAt?: Date;
    errorCount: number;
  }> {
    const conditions = [eq(orders.organizationId, organizationId)];
    
    if (storeId) {
      conditions.push(eq(orders.storeId, storeId));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = await db
      .select({
        id: orders.id,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        status: orders.status,
      })
      .from(orders)
      .where(and(...conditions));

    const stats = {
      totalOrders: results.length,
      syncedToday: 0,
      pendingSync: 0,
      lastSyncAt: undefined as Date | undefined,
      errorCount: 0,
    };

    let latestSync: Date | undefined;

    for (const order of results) {
      // Count orders synced today
      if (order.createdAt >= today) {
        stats.syncedToday++;
      }

      // Track latest sync
      if (!latestSync || order.updatedAt > latestSync) {
        latestSync = order.updatedAt;
      }

      // Count pending sync (simplified logic)
      if (order.status === 'pending') {
        stats.pendingSync++;
      }
    }

    stats.lastSyncAt = latestSync;
    return stats;
  }

  /**
   * Schedule order sync for a store
   */
  async scheduleOrderSync(
    storeId: string,
    organizationId: string,
    intervalMinutes: number = 30
  ): Promise<void> {
    // This would integrate with the scheduler
    // For now, just log the scheduling
    console.log(`Scheduling order sync for store ${storeId} every ${intervalMinutes} minutes`);
  }

  /**
   * Get comprehensive order sync status with monitoring data
   */
  async getOrderSyncStatusWithMonitoring(
    organizationId: string,
    storeId?: string
  ): Promise<{
    syncStats: {
      totalOrders: number;
      syncedToday: number;
      pendingSync: number;
      lastSyncAt?: Date;
      errorCount: number;
    };
    metrics: any; // OrderSyncMetrics from monitor
    activeAlerts: any[]; // OrderSyncAlert[] from monitor
    recentErrors: Array<{
      orderId: string;
      error: string;
      timestamp: Date;
    }>;
  }> {
    // Get basic sync stats
    const syncStats = await this.getOrderSyncStats(organizationId, storeId);

    // Get monitoring metrics
    const metrics = await orderSyncMonitor.getSyncMetrics(organizationId, {
      storeId,
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    });

    // Get active alerts
    const activeAlerts = orderSyncMonitor.getActiveAlerts(organizationId, storeId);

    // Get recent sync errors from sync logs
    const recentErrors = await this.getRecentSyncErrors(organizationId, storeId);

    return {
      syncStats,
      metrics,
      activeAlerts,
      recentErrors,
    };
  }

  /**
   * Get recent sync errors
   */
  private async getRecentSyncErrors(
    organizationId: string,
    storeId?: string
  ): Promise<Array<{ orderId: string; error: string; timestamp: Date }>> {
    // This would query sync logs for recent errors
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Configure order sync monitoring and notifications
   */
  async configureOrderSyncMonitoring(
    organizationId: string,
    config: {
      thresholds?: {
        maxErrorRate?: number;
        maxSyncDelay?: number;
        minOrdersExpected?: number;
        maxConsecutiveFailures?: number;
        syncTimeoutMinutes?: number;
      };
      notifications?: Array<{
        type: 'email' | 'webhook' | 'slack' | 'teams';
        config: {
          recipients?: string[];
          webhookUrl?: string;
          slackChannel?: string;
          teamsWebhook?: string;
        };
        enabled: boolean;
        alertTypes: string[];
        severityThreshold: 'low' | 'medium' | 'high' | 'critical';
      }>;
    }
  ): Promise<void> {
    // Configure monitoring thresholds
    if (config.thresholds) {
      // Update monitor thresholds - this would be implemented in the monitor
      console.log('Configuring sync monitoring thresholds:', config.thresholds);
    }

    // Configure notification channels
    if (config.notifications) {
      orderSyncMonitor.configureNotificationChannels(organizationId, config.notifications as any);
    }
  }
}