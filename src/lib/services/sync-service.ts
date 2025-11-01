/**
 * Sync Service Core Implementation
 * Handles job scheduling, queue management, and synchronization operations
 */

import { db } from '@/lib/db';
import { 
  syncJobs, 
  syncLogs, 
  stores, 
  platforms, 
  organizations,
  SelectSyncJob,
  SelectSyncLog,
  InsertSyncJob,
  InsertSyncLog
} from '@/lib/db/schema';
import { eq, and, desc, count, gte, lte, inArray, sql } from 'drizzle-orm';
import { SyncJobType, JobStatus } from '@/types';
import { PlatformAdapterFactory } from '@/lib/platforms/adapter-factory';
import { StoreService } from './store-service';
import { createPaginatedResponse } from '@/lib/db/utils';
import { queueManager } from '@/lib/sync/job-queue';
import { performanceMonitor } from '@/lib/sync/performance-monitor';
import { errorRecoverySystem } from '@/lib/sync/error-recovery';
import { defaultConflictResolver } from '@/lib/sync/conflict-resolver';
import { ProductSyncService } from '@/lib/sync/product-sync';
import { InventorySyncService } from '@/lib/sync/inventory-sync';
import { OrderSyncService } from '@/lib/sync/order-sync';
import type { PaginatedResponse, SyncJobWithLogs } from '@/types';

// Sync configuration interfaces
export interface SyncOptions {
  batchSize?: number;
  maxRetries?: number;
  priority?: 'low' | 'normal' | 'high';
  conflictResolution?: 'platform_wins' | 'local_wins' | 'manual_review';
  dryRun?: boolean;
}

export interface SyncJobConfig {
  organizationId: string;
  storeId?: string;
  jobType: SyncJobType;
  options?: SyncOptions;
  scheduledAt?: Date;
  cronExpression?: string;
  metadata?: Record<string, any>;
}

export interface SyncProgress {
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
  percentage: number;
  estimatedTimeRemaining?: number;
  currentItem?: string;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  activeJobs: number;
  queuedJobs: number;
  failedJobs: number;
  successRate: number;
}

export interface ConflictResolutionStrategy {
  strategy: 'platform_wins' | 'local_wins' | 'manual_review' | 'merge';
  rules?: Record<string, any>;
}

export interface SyncMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  successRate: number;
  throughputPerHour: number;
  errorsByType: Record<string, number>;
}

export class SyncService {
  private storeService: StoreService;
  private productSyncService: ProductSyncService;
  private inventorySyncService: InventorySyncService;
  private orderSyncService: OrderSyncService;
  private syncQueue = queueManager.getQueue('sync-jobs', { concurrency: 3 });
  private defaultBatchSize = 50;
  private maxConcurrentJobs = 3;

  constructor() {
    this.storeService = new StoreService();
    this.productSyncService = new ProductSyncService();
    this.inventorySyncService = new InventorySyncService();
    this.orderSyncService = new OrderSyncService();
    this.initializeJobProcessors();
  }

  /**
   * Initialize job processors for different sync types
   */
  private initializeJobProcessors(): void {
    this.syncQueue.process('PRODUCT_SYNC'.toLowerCase() as SyncJobType, async (job) => {
      return this.executeProductSync(job.id, job.data, new AbortController().signal);
    });

    this.syncQueue.process('INVENTORY_PUSH'.toLowerCase() as SyncJobType, async (job) => {
      return this.executeInventorySync(job.id, job.data, new AbortController().signal);
    });

    this.syncQueue.process('ORDER_FETCH'.toLowerCase() as SyncJobType, async (job) => {
      return this.executeOrderSync(job.id, job.data, new AbortController().signal);
    });
  }

  /**
   * Create and queue a sync job
   */
  async createSyncJob(config: SyncJobConfig): Promise<SelectSyncJob> {
    const [job] = await db
      .insert(syncJobs)
      .values({
        organizationId: config.organizationId,
        storeId: config.storeId,
        jobType: config.jobType,
        status: 'PENDING'.toLowerCase() as JobStatus,
        itemsTotal: 0,
        itemsProcessed: 0,
        itemsFailed: 0,
        retryCount: 0,
        metadata: {
          options: config.options || {},
          scheduledAt: config.scheduledAt?.toISOString(),
          cronExpression: config.cronExpression,
          ...config.metadata,
        },
      })
      .returning();

    await this.logSyncEvent(job.id, 'info', 'Sync job created', {
      jobType: config.jobType,
      options: config.options,
    });

    // Add to queue if not scheduled for later
    if (!config.scheduledAt || config.scheduledAt <= new Date()) {
      const priority = this.getPriorityValue(config.options?.priority || 'normal');
      await this.syncQueue.add(config.jobType, { jobId: job.id, config }, { priority });
    }

    return job;
  }

  /**
   * Schedule a sync job with cron-like expression
   */
  async scheduleSyncJob(config: SyncJobConfig): Promise<SelectSyncJob> {
    if (!config.cronExpression && !config.scheduledAt) {
      throw new Error('Either cronExpression or scheduledAt must be provided for scheduled jobs');
    }

    const job = await this.createSyncJob({
      ...config,
      scheduledAt: config.scheduledAt || this.parseNextCronExecution(config.cronExpression!),
    });

    await this.logSyncEvent(job.id, 'info', 'Sync job scheduled', {
      scheduledAt: config.scheduledAt?.toISOString(),
      cronExpression: config.cronExpression,
    });

    return job;
  }

  /**
   * Cancel a sync job
   */
  async cancelSyncJob(jobId: string): Promise<void> {
    // Try to remove from queue
    await this.syncQueue.removeJob(jobId);

    // Update job status
    await db
      .update(syncJobs)
      .set({
        status: 'FAILED'.toLowerCase() as JobStatus,
        completedAt: new Date(),
        errorMessage: 'Job cancelled by user',
      })
      .where(eq(syncJobs.id, jobId));

    await this.logSyncEvent(jobId, 'info', 'Sync job cancelled');
  }

  /**
   * Retry a failed sync job
   */
  async retrySyncJob(jobId: string): Promise<SelectSyncJob> {
    const job = await this.getSyncJob(jobId);
    if (!job) {
      throw new Error('Sync job not found');
    }

    if (job.status !== 'FAILED'.toLowerCase() as JobStatus) {
      throw new Error('Only failed jobs can be retried');
    }

    const maxRetries = (job.metadata as any)?.options?.maxRetries || 3;
    if (job.retryCount >= maxRetries) {
      throw new Error('Maximum retry attempts exceeded');
    }

    // Reset job status and increment retry count
    const [updatedJob] = await db
      .update(syncJobs)
      .set({
        status: 'PENDING'.toLowerCase() as JobStatus,
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        retryCount: job.retryCount + 1,
        itemsProcessed: 0,
        itemsFailed: 0,
      })
      .where(eq(syncJobs.id, jobId))
      .returning();

    await this.logSyncEvent(jobId, 'info', `Retrying sync job (attempt ${updatedJob.retryCount + 1})`);

    // Add back to queue
    const config: SyncJobConfig = {
      organizationId: job.organizationId,
      storeId: job.storeId || undefined,
      jobType: job.jobType as SyncJobType,
      options: (job.metadata as any)?.options,
      metadata: job.metadata as Record<string, any>,
    };

    const priority = this.getPriorityValue(config.options?.priority || 'normal');
    await this.syncQueue.add(config.jobType, { jobId, config }, { priority });

    return updatedJob;
  }

  /**
   * Get sync job by ID
   */
  async getSyncJob(jobId: string): Promise<SelectSyncJob | null> {
    const result = await db
      .select()
      .from(syncJobs)
      .where(eq(syncJobs.id, jobId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get sync job with logs
   */
  async getSyncJobWithLogs(jobId: string): Promise<SyncJobWithLogs | null> {
    const job = await this.getSyncJob(jobId);
    if (!job) return null;

    // Get store and platform data if storeId exists
    let storeData = undefined;
    if (job.storeId) {
      const storeResult = await db
        .select({
          id: stores.id,
          organizationId: stores.organizationId,
          platformId: stores.platformId,
          name: stores.name,
          platformStoreId: stores.platformStoreId,
          credentials: stores.credentials,
          settings: stores.settings,
          syncStatus: stores.syncStatus,
          lastSyncAt: stores.lastSyncAt,
          isActive: stores.isActive,
          createdAt: stores.createdAt,
          updatedAt: stores.updatedAt,
          platform: {
            id: platforms.id,
            name: platforms.name,
            displayName: platforms.displayName,
            isActive: platforms.isActive,
            apiConfig: platforms.apiConfig,
            createdAt: platforms.createdAt,
          },
        })
        .from(stores)
        .innerJoin(platforms, eq(stores.platformId, platforms.id))
        .where(eq(stores.id, job.storeId))
        .limit(1);

      storeData = storeResult[0];
    }

    // Get logs
    const logs = await db
      .select({
        id: syncLogs.id,
        level: syncLogs.level,
        message: syncLogs.message,
        details: syncLogs.details,
        createdAt: syncLogs.createdAt,
      })
      .from(syncLogs)
      .where(eq(syncLogs.syncJobId, jobId))
      .orderBy(syncLogs.createdAt);

    return {
      ...job,
      store: storeData,
      logs,
    } as SyncJobWithLogs;
  }

  /**
   * Get sync status for a store
   */
  async getSyncStatus(storeId: string): Promise<SyncStatus> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get job counts
    const [jobStats] = await db
      .select({
        activeJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'running' THEN 1 END)`,
        queuedJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'pending' THEN 1 END)`,
        failedJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'failed' AND ${syncJobs.createdAt} >= ${last24Hours} THEN 1 END)`,
        totalJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.createdAt} >= ${last24Hours} THEN 1 END)`,
        completedJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'completed' AND ${syncJobs.createdAt} >= ${last24Hours} THEN 1 END)`,
      })
      .from(syncJobs)
      .where(eq(syncJobs.storeId, storeId));

    // Get last sync time
    const [lastSync] = await db
      .select({ lastSyncAt: syncJobs.completedAt })
      .from(syncJobs)
      .where(and(
        eq(syncJobs.storeId, storeId),
        eq(syncJobs.status, 'COMPLETED'.toLowerCase() as JobStatus)
      ))
      .orderBy(desc(syncJobs.completedAt))
      .limit(1);

    const totalJobs = jobStats.totalJobs || 0;
    const completedJobs = jobStats.completedJobs || 0;
    const successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

    return {
      isRunning: (jobStats.activeJobs || 0) > 0,
      lastSyncAt: lastSync?.lastSyncAt || undefined,
      nextSyncAt: undefined, // TODO: Calculate based on scheduled jobs
      activeJobs: jobStats.activeJobs || 0,
      queuedJobs: jobStats.queuedJobs || 0,
      failedJobs: jobStats.failedJobs || 0,
      successRate,
    };
  }

  /**
   * Get sync history for a store
   */
  async getSyncHistory(
    storeId: string,
    options: {
      limit?: number;
      jobType?: SyncJobType;
      status?: JobStatus;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<SelectSyncJob[]> {
    const { limit = 50, jobType, status, startDate, endDate } = options;

    const conditions = [eq(syncJobs.storeId, storeId)];

    if (jobType) {
      conditions.push(eq(syncJobs.jobType, jobType));
    }

    if (status) {
      conditions.push(eq(syncJobs.status, status));
    }

    if (startDate) {
      conditions.push(gte(syncJobs.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(syncJobs.createdAt, endDate));
    }

    return await db
      .select()
      .from(syncJobs)
      .where(and(...conditions))
      .orderBy(desc(syncJobs.createdAt))
      .limit(limit);
  }

  /**
   * Get sync metrics for organization
   */
  async getSyncMetrics(
    organizationId: string,
    options: {
      storeId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<SyncMetrics> {
    const { storeId, startDate, endDate } = options;

    const conditions = [eq(syncJobs.organizationId, organizationId)];

    if (storeId) {
      conditions.push(eq(syncJobs.storeId, storeId));
    }

    if (startDate) {
      conditions.push(gte(syncJobs.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(syncJobs.createdAt, endDate));
    }

    // Get basic metrics
    const [basicStats] = await db
      .select({
        totalJobs: count(),
        completedJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'completed' THEN 1 END)`,
        failedJobs: sql<number>`COUNT(CASE WHEN ${syncJobs.status} = 'failed' THEN 1 END)`,
        averageProcessingTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${syncJobs.completedAt} - ${syncJobs.startedAt})))`,
      })
      .from(syncJobs)
      .where(and(...conditions));

    const totalJobs = basicStats.totalJobs || 0;
    const completedJobs = basicStats.completedJobs || 0;
    const failedJobs = basicStats.failedJobs || 0;
    const successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

    // Calculate throughput (jobs per hour)
    const timeRange = endDate && startDate ? 
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60) : 24;
    const throughputPerHour = totalJobs / timeRange;

    return {
      totalJobs,
      completedJobs,
      failedJobs,
      averageProcessingTime: Number(basicStats.averageProcessingTime) || 0,
      successRate,
      throughputPerHour,
      errorsByType: {}, // TODO: Implement error classification
    };
  }

  /**
   * Get priority value for queue
   */
  private getPriorityValue(priority: 'low' | 'normal' | 'high'): number {
    switch (priority) {
      case 'high': return 10;
      case 'normal': return 5;
      case 'low': return 1;
      default: return 5;
    }
  }

  /**
   * Execute product synchronization (placeholder)
   */
  private async executeProductSync(
    jobId: string,
    data: { jobId: string; config: SyncJobConfig },
    signal: AbortSignal
  ): Promise<void> {
    const { config } = data;
    const metric = performanceMonitor.startJobMonitoring(
      jobId,
      'PRODUCT_SYNC'.toLowerCase() as SyncJobType,
      config.organizationId,
      config.storeId
    );

    try {
      // Update job status to running
      await db
        .update(syncJobs)
        .set({
          status: 'RUNNING'.toLowerCase() as JobStatus,
          startedAt: new Date(),
        })
        .where(eq(syncJobs.id, jobId));

      await this.logSyncEvent(jobId, 'info', 'Starting product synchronization');
      
      // Execute product synchronization
      const syncOptions = {
        direction: config.options?.conflictResolution === 'platform_wins' ? 'pull' : 
                  config.options?.conflictResolution === 'local_wins' ? 'push' : 'bidirectional',
        batchSize: config.options?.batchSize || this.defaultBatchSize,
        conflictResolution: config.options?.conflictResolution || 'manual_review',
        dryRun: false,
      } as any;

      const syncResult = await this.productSyncService.syncProducts(
        config.storeId!,
        config.organizationId,
        syncOptions
      );

      // Update progress based on sync results
      const totalItems = syncResult.totalProcessed;
      const processedItems = syncResult.created + syncResult.updated + syncResult.skipped;
      const failedItems = syncResult.failed;

      performanceMonitor.updateJobProgress(metric.id, processedItems, failedItems);
      await this.updateJobProgress(jobId, { 
        itemsTotal: totalItems, 
        itemsProcessed: processedItems, 
        itemsFailed: failedItems 
      });

      // Log sync results
      await this.logSyncEvent(jobId, 'info', 'Product synchronization completed', {
        result: syncResult,
      });
      
      // Mark job as completed
      await db
        .update(syncJobs)
        .set({
          status: 'COMPLETED'.toLowerCase() as JobStatus,
          completedAt: new Date(),
        })
        .where(eq(syncJobs.id, jobId));

      await this.logSyncEvent(jobId, 'info', 'Product synchronization completed successfully');
      performanceMonitor.completeJobMonitoring(metric.id);

    } catch (error) {
      await this.handleJobError(jobId, config, error as Error, metric.id);
      throw error;
    }
  }

  /**
   * Execute inventory synchronization (placeholder)
   */
  private async executeInventorySync(
    jobId: string,
    data: { jobId: string; config: SyncJobConfig },
    signal: AbortSignal
  ): Promise<void> {
    const { config } = data;
    const metric = performanceMonitor.startJobMonitoring(
      jobId,
      'INVENTORY_PUSH'.toLowerCase() as SyncJobType,
      config.organizationId,
      config.storeId
    );

    try {
      // Update job status to running
      await db
        .update(syncJobs)
        .set({
          status: 'RUNNING'.toLowerCase() as JobStatus,
          startedAt: new Date(),
        })
        .where(eq(syncJobs.id, jobId));

      await this.logSyncEvent(jobId, 'info', 'Starting inventory synchronization');
      
      // Execute inventory synchronization
      const syncOptions = {
        batchSize: config.options?.batchSize || this.defaultBatchSize,
        forceUpdate: false,
        dryRun: false,
      };

      const syncResult = config.storeId 
        ? await this.inventorySyncService.pushInventoryToPlatform(
            config.storeId,
            config.organizationId,
            syncOptions
          )
        : await this.inventorySyncService.pushInventoryToAllPlatforms(
            config.organizationId,
            syncOptions
          );

      // Update progress based on sync results
      const totalItems = syncResult.totalProcessed;
      const processedItems = syncResult.updated + syncResult.skipped;
      const failedItems = syncResult.failed;

      performanceMonitor.updateJobProgress(metric.id, processedItems, failedItems);
      await this.updateJobProgress(jobId, { 
        itemsTotal: totalItems, 
        itemsProcessed: processedItems, 
        itemsFailed: failedItems 
      });

      // Log sync results
      await this.logSyncEvent(jobId, 'info', 'Inventory synchronization completed', {
        result: syncResult,
      });
      
      // Mark job as completed
      await db
        .update(syncJobs)
        .set({
          status: 'COMPLETED'.toLowerCase() as JobStatus,
          completedAt: new Date(),
        })
        .where(eq(syncJobs.id, jobId));

      await this.logSyncEvent(jobId, 'info', 'Inventory synchronization completed successfully');
      performanceMonitor.completeJobMonitoring(metric.id);

    } catch (error) {
      await this.handleJobError(jobId, config, error as Error, metric.id);
      throw error;
    }
  }

  /**
   * Execute order synchronization (placeholder)
   */
  private async executeOrderSync(
    jobId: string,
    data: { jobId: string; config: SyncJobConfig },
    signal: AbortSignal
  ): Promise<void> {
    const { config } = data;
    const metric = performanceMonitor.startJobMonitoring(
      jobId,
      'ORDER_FETCH'.toLowerCase() as SyncJobType,
      config.organizationId,
      config.storeId
    );

    try {
      // Update job status to running
      await db
        .update(syncJobs)
        .set({
          status: 'RUNNING'.toLowerCase() as JobStatus,
          startedAt: new Date(),
        })
        .where(eq(syncJobs.id, jobId));

      await this.logSyncEvent(jobId, 'info', 'Starting order synchronization');
      
      // Execute order synchronization
      const syncOptions = {
        batchSize: config.options?.batchSize || this.defaultBatchSize,
        syncDirection: 'bidirectional' as const,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        dryRun: false,
      };

      const syncResult = config.storeId 
        ? await this.orderSyncService.syncOrdersForStore(
            config.storeId,
            config.organizationId,
            syncOptions
          )
        : await this.orderSyncService.syncOrdersForOrganization(
            config.organizationId,
            syncOptions
          );

      // Update progress based on sync results
      const totalItems = syncResult.totalProcessed;
      const processedItems = syncResult.imported + syncResult.updated + syncResult.skipped + syncResult.statusUpdates;
      const failedItems = syncResult.failed;

      performanceMonitor.updateJobProgress(metric.id, processedItems, failedItems);
      await this.updateJobProgress(jobId, { 
        itemsTotal: totalItems, 
        itemsProcessed: processedItems, 
        itemsFailed: failedItems 
      });

      // Log sync results
      await this.logSyncEvent(jobId, 'info', 'Order synchronization completed', {
        result: syncResult,
      });
      
      // Mark job as completed
      await db
        .update(syncJobs)
        .set({
          status: 'COMPLETED'.toLowerCase() as JobStatus,
          completedAt: new Date(),
        })
        .where(eq(syncJobs.id, jobId));

      await this.logSyncEvent(jobId, 'info', 'Order synchronization completed successfully');
      performanceMonitor.completeJobMonitoring(metric.id);

    } catch (error) {
      await this.handleJobError(jobId, config, error as Error, metric.id);
      throw error;
    }
  }

  /**
   * Handle job errors with recovery system
   */
  private async handleJobError(
    jobId: string,
    config: SyncJobConfig,
    error: Error,
    metricId: string
  ): Promise<void> {
    // Record error in recovery system
    await errorRecoverySystem.recordError(
      jobId,
      config.jobType,
      config.organizationId,
      error,
      { config },
      config.storeId
    );

    // Update job status
    await db
      .update(syncJobs)
      .set({
        status: 'FAILED'.toLowerCase() as JobStatus,
        completedAt: new Date(),
        errorMessage: error.message,
      })
      .where(eq(syncJobs.id, jobId));

    // Log error
    await this.logSyncEvent(jobId, 'error', `Sync job failed: ${error.message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });

    // Complete performance monitoring
    performanceMonitor.completeJobMonitoring(metricId);
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(
    jobId: string,
    progress: Partial<SyncProgress>
  ): Promise<void> {
    const updateData: any = {};

    if (progress.itemsTotal !== undefined) {
      updateData.itemsTotal = progress.itemsTotal;
    }

    if (progress.itemsProcessed !== undefined) {
      updateData.itemsProcessed = progress.itemsProcessed;
    }

    if (progress.itemsFailed !== undefined) {
      updateData.itemsFailed = progress.itemsFailed;
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(syncJobs)
        .set(updateData)
        .where(eq(syncJobs.id, jobId));
    }
  }

  /**
   * Log sync event
   */
  private async logSyncEvent(
    jobId: string,
    level: 'info' | 'warning' | 'error',
    message: string,
    details?: any
  ): Promise<void> {
    await db
      .insert(syncLogs)
      .values({
        syncJobId: jobId,
        level,
        message,
        details,
      });
  }

  /**
   * Parse next cron execution (simplified implementation)
   */
  private parseNextCronExecution(cronExpression: string): Date {
    // This is a simplified implementation
    // In production, use a proper cron parser like 'node-cron' or 'cron-parser'
    const now = new Date();
    
    // For now, just add 1 hour as a placeholder
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  /**
   * Get sync progress for a job
   */
  async getSyncProgress(jobId: string): Promise<SyncProgress | null> {
    const job = await this.getSyncJob(jobId);
    if (!job) return null;

    const percentage = job.itemsTotal > 0 ? 
      (job.itemsProcessed / job.itemsTotal) * 100 : 0;

    return {
      itemsTotal: job.itemsTotal,
      itemsProcessed: job.itemsProcessed,
      itemsFailed: job.itemsFailed,
      percentage,
      estimatedTimeRemaining: undefined, // TODO: Calculate based on processing rate
      currentItem: undefined, // TODO: Track current item being processed
    };
  }

  /**
   * Bulk cancel sync jobs
   */
  async bulkCancelSyncJobs(jobIds: string[]): Promise<{
    cancelled: number;
    errors: Array<{ jobId: string; error: string }>;
  }> {
    const results = {
      cancelled: 0,
      errors: [] as Array<{ jobId: string; error: string }>,
    };

    for (const jobId of jobIds) {
      try {
        await this.cancelSyncJob(jobId);
        results.cancelled++;
      } catch (error) {
        results.errors.push({
          jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Clean up old sync jobs and logs
   */
  async cleanupOldSyncData(
    organizationId: string,
    options: {
      olderThanDays?: number;
      keepSuccessfulJobs?: boolean;
      keepFailedJobs?: boolean;
    } = {}
  ): Promise<{ deletedJobs: number; deletedLogs: number }> {
    const { olderThanDays = 30, keepSuccessfulJobs = true, keepFailedJobs = true } = options;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const conditions = [
      eq(syncJobs.organizationId, organizationId),
      lte(syncJobs.createdAt, cutoffDate),
    ];

    // Add status conditions based on options
    const statusesToDelete: JobStatus[] = [];
    if (!keepSuccessfulJobs) {
      statusesToDelete.push('COMPLETED'.toLowerCase() as JobStatus);
    }
    if (!keepFailedJobs) {
      statusesToDelete.push('FAILED'.toLowerCase() as JobStatus);
    }

    if (statusesToDelete.length > 0) {
      conditions.push(inArray(syncJobs.status, statusesToDelete));
    }

    // Get jobs to delete
    const jobsToDelete = await db
      .select({ id: syncJobs.id })
      .from(syncJobs)
      .where(and(...conditions));

    if (jobsToDelete.length === 0) {
      return { deletedJobs: 0, deletedLogs: 0 };
    }

    const jobIds = jobsToDelete.map(job => job.id);

    // Delete logs first (due to foreign key constraint)
    const deletedLogs = await db
      .delete(syncLogs)
      .where(inArray(syncLogs.syncJobId, jobIds));

    // Delete jobs
    const deletedJobs = await db
      .delete(syncJobs)
      .where(inArray(syncJobs.id, jobIds));

    return {
      deletedJobs: deletedJobs.rowCount || 0,
      deletedLogs: deletedLogs.rowCount || 0,
    };
  }
}