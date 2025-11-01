/**
 * Sync Queue Service
 * BullMQ-based job queue for product synchronization
 */

import { Queue, QueueOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { RetryStrategyService } from './retryStrategy';

// Job interface for sync operations
export interface SyncJob {
  product_id: string;
  platform: 'shopee' | 'tiktok' | 'both';
  batch_id?: string;
  timestamp: Date;
  priority?: 'high' | 'normal' | 'low';
  retry_count?: number;
  metadata?: Record<string, any>;
}

// Batch sync job interface
export interface BatchSyncJob {
  product_ids: string[];
  platform: 'shopee' | 'tiktok' | 'both';
  batch_id: string;
  batch_size?: number;
  created_by?: string;
  organization_id: string;
}

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
};

// Create Redis connection
export const redis = new Redis(redisConfig);

// Queue options with enhanced retry configuration
const queueOptions: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    attempts: 3, // Default attempts, can be overridden per platform
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds, then 4s, 8s
    },
    removeOnComplete: 50, // Keep last 50 completed jobs
    removeOnFail: 100, // Keep last 100 failed jobs
  },
};

// Create sync queue
export const syncQueue = new Queue('product-sync', queueOptions);

// Create batch sync queue  
export const batchSyncQueue = new Queue('batch-sync', queueOptions);

/**
 * Sync Queue Service Class
 */
export class SyncQueueService {
  /**
   * Add a single product sync job to the queue with platform-specific retry config
   */
  async addSyncJob(jobData: SyncJob): Promise<string> {
    // Get platform-specific retry configuration
    const retryConfig = RetryStrategyService.getRetryConfig(jobData.platform);
    
    const job = await syncQueue.add(
      'sync-product',
      jobData,
      {
        priority: this.getPriority(jobData.priority),
        delay: 0,
        jobId: `sync_${jobData.product_id}_${jobData.platform}_${Date.now()}`,
        // Apply platform-specific retry settings
        attempts: retryConfig.maxAttempts,
        backoff: {
          type: 'exponential',
          delay: retryConfig.baseDelay,
        },
      }
    );

    console.log(`📋 Added sync job: ${job.id} for product ${jobData.product_id} to ${jobData.platform} (max attempts: ${retryConfig.maxAttempts})`);
    return job.id!;
  }

  /**
   * Add a batch sync job to the queue
   */
  async addBatchSyncJob(jobData: BatchSyncJob): Promise<string> {
    const job = await batchSyncQueue.add(
      'batch-sync-products',
      jobData,
      {
        priority: 1, // Normal priority for batch jobs
        jobId: `batch_${jobData.batch_id}`,
      }
    );

    return job.id!;
  }

  /**
   * Add multiple individual sync jobs for batch processing
   */
  async addBatchJobs(
    productIds: string[],
    platform: 'shopee' | 'tiktok' | 'both',
    batchId: string,
    organizationId: string
  ): Promise<string[]> {
    // Get platform-specific retry configuration
    const retryConfig = RetryStrategyService.getRetryConfig(platform);
    
    const jobs = productIds.map((productId, index) => ({
      name: 'sync-product',
      data: {
        product_id: productId,
        platform,
        batch_id: batchId,
        timestamp: new Date(),
        priority: 'normal' as const,
        metadata: {
          batch_index: index,
          total_in_batch: productIds.length,
          organization_id: organizationId,
        },
      },
      opts: {
        priority: 1,
        delay: index * 100, // Stagger jobs by 100ms to avoid rate limits
        jobId: `sync_${productId}_${platform}_${batchId}_${index}`,
        // Apply platform-specific retry settings
        attempts: retryConfig.maxAttempts,
        backoff: {
          type: 'exponential',
          delay: retryConfig.baseDelay,
        },
      },
    }));

    const addedJobs = await syncQueue.addBulk(jobs);
    return addedJobs.map(job => job.id!);
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string) {
    const job = await syncQueue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
      attemptsMade: job.attemptsMade,
      opts: job.opts,
    };
  }

  /**
   * Get batch status by batch ID
   */
  async getBatchStatus(batchId: string) {
    // Get all jobs for this batch
    const jobs = await syncQueue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, -1);
    const batchJobs = jobs.filter(job => job.data.batch_id === batchId);

    const total = batchJobs.length;
    const completed = batchJobs.filter(job => job.finishedOn && !job.failedReason).length;
    const failed = batchJobs.filter(job => job.failedReason).length;
    const inProgress = batchJobs.filter(job => job.processedOn && !job.finishedOn).length;
    const pending = total - completed - failed - inProgress;

    return {
      batch_id: batchId,
      total_jobs: total,
      completed,
      failed,
      in_progress: inProgress,
      pending,
      status: this.getBatchStatusString(completed, failed, inProgress, pending, total),
      jobs: batchJobs.map(job => ({
        job_id: job.id,
        product_id: job.data.product_id,
        platform: job.data.platform,
        status: this.getJobStatusString(job),
        error: job.failedReason || null,
        processed_at: job.processedOn ? new Date(job.processedOn) : null,
        finished_at: job.finishedOn ? new Date(job.finishedOn) : null,
      })),
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const waiting = await syncQueue.getWaiting();
    const active = await syncQueue.getActive();
    const completed = await syncQueue.getCompleted();
    const failed = await syncQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length,
    };
  }

  /**
   * Clean up old jobs
   */
  async cleanupJobs(olderThanMs: number = 24 * 60 * 60 * 1000) { // Default: 24 hours
    await syncQueue.clean(olderThanMs, 100, 'completed');
    await syncQueue.clean(olderThanMs, 100, 'failed');
  }

  /**
   * Pause/Resume queue
   */
  async pauseQueue() {
    await syncQueue.pause();
  }

  async resumeQueue() {
    await syncQueue.resume();
  }

  /**
   * Get priority number from string
   */
  private getPriority(priority?: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':
        return 10;
      case 'low':
        return -10;
      default:
        return 1;
    }
  }

  /**
   * Get job status string
   */
  private getJobStatusString(job: any): string {
    if (job.failedReason) return 'failed';
    if (job.finishedOn) return 'completed';
    if (job.processedOn) return 'processing';
    return 'pending';
  }

  /**
   * Get batch status string
   */
  private getBatchStatusString(
    completed: number,
    failed: number,
    inProgress: number,
    pending: number,
    total: number
  ): string {
    if (failed > 0 && completed + failed === total) return 'completed_with_errors';
    if (completed === total) return 'completed';
    if (inProgress > 0 || pending < total) return 'running';
    return 'pending';
  }
}

// Export singleton instance
export const syncQueueService = new SyncQueueService();

// Export queue instances for worker access
export { syncQueue as defaultSyncQueue, batchSyncQueue as defaultBatchSyncQueue };