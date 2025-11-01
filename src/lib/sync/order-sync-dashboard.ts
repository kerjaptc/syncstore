/**
 * Order Sync Dashboard Service
 * Provides real-time monitoring data and analytics for order synchronization
 */

import { db } from '@/lib/db';
import { 
  syncJobs, 
  syncLogs, 
  orders,
  stores,
  platforms
} from '@/lib/db/schema';
import { eq, and, desc, count, gte, lte, sql } from 'drizzle-orm';
import { SyncJobType, JobStatus } from '@/types';
import { orderSyncMonitor } from './order-sync-monitor';
import { OrderSyncService } from './order-sync';

export interface OrderSyncDashboardData {
  overview: {
    totalStores: number;
    activeStores: number;
    totalOrdersToday: number;
    syncSuccessRate: number;
    lastSyncAt?: Date;
    nextScheduledSync?: Date;
  };
  syncStatus: {
    running: number;
    queued: number;
    completed: number;
    failed: number;
  };
  recentActivity: Array<{
    id: string;
    type: 'sync_started' | 'sync_completed' | 'sync_failed' | 'orders_imported' | 'status_updated';
    message: string;
    timestamp: Date;
    storeId?: string;
    storeName?: string;
    details?: any;
  }>;
  alerts: Array<{
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    storeId?: string;
    storeName?: string;
    createdAt: Date;
  }>;
  metrics: {
    ordersProcessedToday: number;
    ordersImportedToday: number;
    ordersUpdatedToday: number;
    ordersFailedToday: number;
    statusUpdatesSuccessful: number;
    statusUpdatesFailed: number;
    averageSyncDuration: number;
    errorRate: number;
  };
  storeStatus: Array<{
    storeId: string;
    storeName: string;
    platformName: string;
    isActive: boolean;
    lastSyncAt?: Date;
    nextSyncAt?: Date;
    syncStatus: 'healthy' | 'warning' | 'error' | 'inactive';
    ordersToday: number;
    errorCount: number;
    successRate: number;
  }>;
  performanceTrends: {
    syncDuration: Array<{ timestamp: Date; duration: number }>;
    errorRate: Array<{ timestamp: Date; rate: number }>;
    throughput: Array<{ timestamp: Date; ordersPerHour: number }>;
  };
}

export interface OrderSyncHealthCheck {
  storeId: string;
  storeName: string;
  platformName: string;
  status: 'healthy' | 'warning' | 'error' | 'inactive';
  issues: Array<{
    type: 'sync_delay' | 'high_error_rate' | 'connection_error' | 'missing_orders';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details?: any;
  }>;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  metrics: {
    ordersProcessed: number;
    errorRate: number;
    averageSyncTime: number;
    successRate: number;
  };
}

export class OrderSyncDashboardService {
  private orderSyncService: OrderSyncService;

  constructor() {
    this.orderSyncService = new OrderSyncService();
  }

  /**
   * Get comprehensive dashboard data for organization
   */
  async getDashboardData(organizationId: string): Promise<OrderSyncDashboardData> {
    const [
      overview,
      syncStatus,
      recentActivity,
      alerts,
      metrics,
      storeStatus,
      performanceTrends
    ] = await Promise.all([
      this.getOverviewData(organizationId),
      this.getSyncStatusData(organizationId),
      this.getRecentActivity(organizationId),
      this.getActiveAlerts(organizationId),
      this.getMetricsData(organizationId),
      this.getStoreStatusData(organizationId),
      this.getPerformanceTrends(organizationId),
    ]);

    return {
      overview,
      syncStatus,
      recentActivity,
      alerts,
      metrics,
      storeStatus,
      performanceTrends,
    };
  }

  /**
   * Get overview data
   */
  private async getOverviewData(organizationId: string): Promise<OrderSyncDashboardData['overview']> {
    // Get store counts
    const [storeStats] = await db
      .select({
        totalStores: count(),
        activeStores: sql<number>`COUNT(CASE WHEN ${stores.isActive} = true THEN 1 END)`,
      })
      .from(stores)
      .where(eq(stores.organizationId, organizationId));

    // Get today's order count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [orderStats] = await db
      .select({
        totalOrdersToday: count(),
      })
      .from(orders)
      .where(and(
        eq(orders.organizationId, organizationId),
        gte(orders.createdAt, today)
      ));

    // Get sync success rate (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [syncStats] = await db
      .select({
        totalJobs: count(),
        successfulJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'completed' THEN 1 END)`,
      })
      .from(syncJobs)
      .where(and(
        eq(syncJobs.organizationId, organizationId),
        eq(syncJobs.jobType, 'ORDER_FETCH'.toLowerCase() as SyncJobType),
        gte(syncJobs.createdAt, last24Hours)
      ));

    const successRate = syncStats.totalJobs > 0 ? 
      (syncStats.successfulJobs / syncStats.totalJobs) * 100 : 100;

    // Get last sync time
    const [lastSync] = await db
      .select({ completedAt: syncJobs.completedAt })
      .from(syncJobs)
      .where(and(
        eq(syncJobs.organizationId, organizationId),
        eq(syncJobs.jobType, 'ORDER_FETCH'.toLowerCase() as SyncJobType),
        eq(syncJobs.status, 'COMPLETED'.toLowerCase() as JobStatus)
      ))
      .orderBy(desc(syncJobs.completedAt))
      .limit(1);

    return {
      totalStores: storeStats.totalStores || 0,
      activeStores: storeStats.activeStores || 0,
      totalOrdersToday: orderStats.totalOrdersToday || 0,
      syncSuccessRate: successRate,
      lastSyncAt: lastSync?.completedAt || undefined,
      nextScheduledSync: undefined, // TODO: Calculate from scheduled jobs
    };
  }

  /**
   * Get sync status data
   */
  private async getSyncStatusData(organizationId: string): Promise<OrderSyncDashboardData['syncStatus']> {
    const [statusStats] = await db
      .select({
        running: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'running' THEN 1 END)`,
        queued: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'pending' THEN 1 END)`,
        completed: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'completed' AND ${syncJobs.createdAt} >= ${new Date(Date.now() - 24 * 60 * 60 * 1000)} THEN 1 END)`,
        failed: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'failed' AND ${syncJobs.createdAt} >= ${new Date(Date.now() - 24 * 60 * 60 * 1000)} THEN 1 END)`,
      })
      .from(syncJobs)
      .where(and(
        eq(syncJobs.organizationId, organizationId),
        eq(syncJobs.jobType, 'ORDER_FETCH'.toLowerCase() as SyncJobType)
      ));

    return {
      running: statusStats.running || 0,
      queued: statusStats.queued || 0,
      completed: statusStats.completed || 0,
      failed: statusStats.failed || 0,
    };
  }

  /**
   * Get recent activity
   */
  private async getRecentActivity(organizationId: string): Promise<OrderSyncDashboardData['recentActivity']> {
    // Get recent sync jobs
    const recentJobs = await db
      .select({
        id: syncJobs.id,
        status: syncJobs.status,
        storeId: syncJobs.storeId,
        itemsTotal: syncJobs.itemsTotal,
        itemsProcessed: syncJobs.itemsProcessed,
        itemsFailed: syncJobs.itemsFailed,
        createdAt: syncJobs.createdAt,
        completedAt: syncJobs.completedAt,
        storeName: stores.name,
      })
      .from(syncJobs)
      .leftJoin(stores, eq(syncJobs.storeId, stores.id))
      .where(and(
        eq(syncJobs.organizationId, organizationId),
        eq(syncJobs.jobType, 'ORDER_FETCH'.toLowerCase() as SyncJobType)
      ))
      .orderBy(desc(syncJobs.createdAt))
      .limit(20);

    return recentJobs.map(job => {
      let type: OrderSyncDashboardData['recentActivity'][0]['type'];
      let message: string;

      switch (job.status) {
        case 'RUNNING'.toLowerCase() as JobStatus:
          type = 'sync_started';
          message = `Order sync started for ${job.storeName || 'store'}`;
          break;
        case 'COMPLETED'.toLowerCase() as JobStatus:
          type = 'sync_completed';
          message = `Order sync completed: ${job.itemsProcessed} orders processed`;
          break;
        case 'FAILED'.toLowerCase() as JobStatus:
          type = 'sync_failed';
          message = `Order sync failed for ${job.storeName || 'store'}`;
          break;
        default:
          type = 'sync_started';
          message = `Order sync queued for ${job.storeName || 'store'}`;
      }

      return {
        id: job.id,
        type,
        message,
        timestamp: job.completedAt || job.createdAt,
        storeId: job.storeId || undefined,
        storeName: job.storeName || undefined,
        details: {
          itemsTotal: job.itemsTotal,
          itemsProcessed: job.itemsProcessed,
          itemsFailed: job.itemsFailed,
        },
      };
    });
  }

  /**
   * Get active alerts
   */
  private async getActiveAlerts(organizationId: string): Promise<OrderSyncDashboardData['alerts']> {
    const activeAlerts = orderSyncMonitor.getActiveAlerts(organizationId);

    // Get store names for alerts
    const storeIds = activeAlerts
      .map(alert => alert.storeId)
      .filter(Boolean) as string[];

    const storeNames = new Map<string, string>();
    if (storeIds.length > 0) {
      const storeData = await db
        .select({ id: stores.id, name: stores.name })
        .from(stores)
        .where(eq(stores.id, storeIds[0])); // Simplified for demo

      storeData.forEach(store => {
        storeNames.set(store.id, store.name);
      });
    }

    return activeAlerts.map(alert => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      storeId: alert.storeId,
      storeName: alert.storeId ? storeNames.get(alert.storeId) : undefined,
      createdAt: alert.createdAt,
    }));
  }

  /**
   * Get metrics data
   */
  private async getMetricsData(organizationId: string): Promise<OrderSyncDashboardData['metrics']> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get sync job metrics for today
    const [syncMetrics] = await db
      .select({
        totalJobs: count(),
        completedJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'completed' THEN 1 END)`,
        failedJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'failed' THEN 1 END)`,
        totalProcessed: sql<number>`SUM(${syncJobs.itemsProcessed})`,
        totalFailed: sql<number>`SUM(${syncJobs.itemsFailed})`,
        avgDuration: sql<number>`AVG(EXTRACT(EPOCH FROM (${syncJobs.completedAt} - ${syncJobs.startedAt})))`,
      })
      .from(syncJobs)
      .where(and(
        eq(syncJobs.organizationId, organizationId),
        eq(syncJobs.jobType, 'ORDER_FETCH'.toLowerCase() as SyncJobType),
        gte(syncJobs.createdAt, today)
      ));

    const totalJobs = syncMetrics.totalJobs || 0;
    const errorRate = totalJobs > 0 ? 
      ((syncMetrics.failedJobs || 0) / totalJobs) * 100 : 0;

    return {
      ordersProcessedToday: Number(syncMetrics.totalProcessed) || 0,
      ordersImportedToday: 0, // TODO: Track separately
      ordersUpdatedToday: 0, // TODO: Track separately
      ordersFailedToday: Number(syncMetrics.totalFailed) || 0,
      statusUpdatesSuccessful: 0, // TODO: Track status updates
      statusUpdatesFailed: 0, // TODO: Track status updates
      averageSyncDuration: Number(syncMetrics.avgDuration) || 0,
      errorRate,
    };
  }

  /**
   * Get store status data
   */
  private async getStoreStatusData(organizationId: string): Promise<OrderSyncDashboardData['storeStatus']> {
    // Get all stores with platform info
    const storesData = await db
      .select({
        id: stores.id,
        name: stores.name,
        isActive: stores.isActive,
        lastSyncAt: stores.lastSyncAt,
        platformName: platforms.displayName,
      })
      .from(stores)
      .innerJoin(platforms, eq(stores.platformId, platforms.id))
      .where(eq(stores.organizationId, organizationId));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get sync stats for each store
    const storeStatusPromises = storesData.map(async (store) => {
      // Get today's order count
      const [orderCount] = await db
        .select({ count: count() })
        .from(orders)
        .where(and(
          eq(orders.storeId, store.id),
          gte(orders.createdAt, today)
        ));

      // Get sync success rate (last 7 days)
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [syncStats] = await db
        .select({
          totalJobs: count(),
          successfulJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'completed' THEN 1 END)`,
          failedJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'failed' THEN 1 END)`,
        })
        .from(syncJobs)
        .where(and(
          eq(syncJobs.storeId, store.id),
          eq(syncJobs.jobType, 'ORDER_FETCH'.toLowerCase() as SyncJobType),
          gte(syncJobs.createdAt, last7Days)
        ));

      const totalJobs = syncStats.totalJobs || 0;
      const successRate = totalJobs > 0 ? 
        (syncStats.successfulJobs / totalJobs) * 100 : 100;
      const errorCount = syncStats.failedJobs || 0;

      // Determine status
      let syncStatus: 'healthy' | 'warning' | 'error' | 'inactive';
      if (!store.isActive) {
        syncStatus = 'inactive';
      } else if (errorCount > 5 || successRate < 50) {
        syncStatus = 'error';
      } else if (errorCount > 2 || successRate < 80) {
        syncStatus = 'warning';
      } else {
        syncStatus = 'healthy';
      }

      return {
        storeId: store.id,
        storeName: store.name,
        platformName: store.platformName,
        isActive: store.isActive,
        lastSyncAt: store.lastSyncAt || undefined,
        nextSyncAt: undefined, // TODO: Calculate from scheduled jobs
        syncStatus,
        ordersToday: orderCount.count || 0,
        errorCount,
        successRate,
      };
    });

    return Promise.all(storeStatusPromises);
  }

  /**
   * Get performance trends
   */
  private async getPerformanceTrends(organizationId: string): Promise<OrderSyncDashboardData['performanceTrends']> {
    // This is a simplified implementation
    // In production, you'd aggregate data by time periods
    return {
      syncDuration: [],
      errorRate: [],
      throughput: [],
    };
  }

  /**
   * Perform health check for all stores
   */
  async performHealthCheck(organizationId: string): Promise<OrderSyncHealthCheck[]> {
    const storesData = await db
      .select({
        id: stores.id,
        name: stores.name,
        isActive: stores.isActive,
        lastSyncAt: stores.lastSyncAt,
        platformName: platforms.displayName,
      })
      .from(stores)
      .innerJoin(platforms, eq(stores.platformId, platforms.id))
      .where(eq(stores.organizationId, organizationId));

    const healthChecks = await Promise.all(
      storesData.map(store => this.performStoreHealthCheck(store))
    );

    return healthChecks;
  }

  /**
   * Perform health check for a specific store
   */
  private async performStoreHealthCheck(store: any): Promise<OrderSyncHealthCheck> {
    const issues: OrderSyncHealthCheck['issues'] = [];
    
    // Check sync delays
    if (store.lastSyncAt) {
      const hoursSinceLastSync = 
        (Date.now() - store.lastSyncAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastSync > 2) {
        issues.push({
          type: 'sync_delay',
          severity: hoursSinceLastSync > 6 ? 'high' : 'medium',
          message: `Last sync was ${Math.round(hoursSinceLastSync)} hours ago`,
        });
      }
    }

    // Get recent sync metrics
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [syncStats] = await db
      .select({
        totalJobs: count(),
        successfulJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'completed' THEN 1 END)`,
        failedJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'failed' THEN 1 END)`,
        avgDuration: sql<number>`AVG(EXTRACT(EPOCH FROM (${syncJobs.completedAt} - ${syncJobs.startedAt})))`,
        totalProcessed: sql<number>`SUM(${syncJobs.itemsProcessed})`,
      })
      .from(syncJobs)
      .where(and(
        eq(syncJobs.storeId, store.id),
        eq(syncJobs.jobType, 'ORDER_FETCH'.toLowerCase() as SyncJobType),
        gte(syncJobs.createdAt, last24Hours)
      ));

    const totalJobs = syncStats.totalJobs || 0;
    const successRate = totalJobs > 0 ? 
      (syncStats.successfulJobs / totalJobs) * 100 : 100;
    const errorRate = totalJobs > 0 ? 
      (syncStats.failedJobs / totalJobs) * 100 : 0;

    // Check error rate
    if (errorRate > 20) {
      issues.push({
        type: 'high_error_rate',
        severity: errorRate > 50 ? 'critical' : 'high',
        message: `High error rate: ${errorRate.toFixed(1)}%`,
        details: { errorRate, threshold: 20 },
      });
    }

    // Determine overall status
    let status: OrderSyncHealthCheck['status'];
    if (!store.isActive) {
      status = 'inactive';
    } else if (issues.some(i => i.severity === 'critical')) {
      status = 'error';
    } else if (issues.some(i => i.severity === 'high')) {
      status = 'error';
    } else if (issues.length > 0) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return {
      storeId: store.id,
      storeName: store.name,
      platformName: store.platformName,
      status,
      issues,
      lastSyncAt: store.lastSyncAt || undefined,
      nextSyncAt: undefined, // TODO: Calculate from scheduled jobs
      metrics: {
        ordersProcessed: Number(syncStats.totalProcessed) || 0,
        errorRate,
        averageSyncTime: Number(syncStats.avgDuration) || 0,
        successRate,
      },
    };
  }

  /**
   * Get real-time sync progress for active jobs
   */
  async getActiveSyncProgress(organizationId: string): Promise<Array<{
    jobId: string;
    storeId?: string;
    storeName?: string;
    progress: {
      itemsTotal: number;
      itemsProcessed: number;
      itemsFailed: number;
      percentage: number;
      estimatedTimeRemaining?: number;
    };
    startedAt: Date;
    currentItem?: string;
  }>> {
    const activeJobs = await db
      .select({
        id: syncJobs.id,
        storeId: syncJobs.storeId,
        itemsTotal: syncJobs.itemsTotal,
        itemsProcessed: syncJobs.itemsProcessed,
        itemsFailed: syncJobs.itemsFailed,
        startedAt: syncJobs.startedAt,
        storeName: stores.name,
      })
      .from(syncJobs)
      .leftJoin(stores, eq(syncJobs.storeId, stores.id))
      .where(and(
        eq(syncJobs.organizationId, organizationId),
        eq(syncJobs.jobType, 'ORDER_FETCH'.toLowerCase() as SyncJobType),
        eq(syncJobs.status, 'RUNNING'.toLowerCase() as JobStatus)
      ));

    return activeJobs.map(job => ({
      jobId: job.id,
      storeId: job.storeId || undefined,
      storeName: job.storeName || undefined,
      progress: {
        itemsTotal: job.itemsTotal,
        itemsProcessed: job.itemsProcessed,
        itemsFailed: job.itemsFailed,
        percentage: job.itemsTotal > 0 ? 
          (job.itemsProcessed / job.itemsTotal) * 100 : 0,
        estimatedTimeRemaining: undefined, // TODO: Calculate based on processing rate
      },
      startedAt: job.startedAt!,
      currentItem: undefined, // TODO: Track current item being processed
    }));
  }
}

// Export singleton instance
export const orderSyncDashboard = new OrderSyncDashboardService();