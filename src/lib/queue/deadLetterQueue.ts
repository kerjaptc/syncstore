/**
 * Dead Letter Queue Service
 * Task 6.3: Create dead-letter queue
 */

import { Queue, QueueOptions, Job } from 'bullmq';
import { redis } from './syncQueue';
import { db } from '../db';
import { syncLogs } from '../db/sync-logs-schema';
import { RetryStrategyService } from './retryStrategy';

export interface DeadLetterJob {
  original_job_id: string;
  product_id: string;
  platform: string;
  batch_id?: string;
  failed_at: Date;
  final_error: string;
  error_code: string;
  total_attempts: number;
  error_classification: any;
  original_data: any;
  failure_reason: string;
}

export interface DeadLetterStats {
  total_failed: number;
  by_platform: Record<string, number>;
  by_error_type: Record<string, number>;
  recent_failures: DeadLetterJob[];
  failure_rate: number;
}

/**
 * Dead Letter Queue Service
 */
export class DeadLetterQueueService {
  private static dlqQueue: Queue<DeadLetterJob>;

  /**
   * Initialize dead letter queue
   */
  static initialize() {
    if (!this.dlqQueue) {
      const queueOptions: QueueOptions = {
        connection: redis,
        defaultJobOptions: {
          removeOnComplete: 1000, // Keep more completed DLQ jobs for analysis
          removeOnFail: 500,
          attempts: 1, // DLQ jobs should not be retried
        },
      };

      this.dlqQueue = new Queue<DeadLetterJob>('dead-letter-queue', queueOptions);
      console.log('📮 Dead Letter Queue initialized');
    }
    return this.dlqQueue;
  }

  /**
   * Move failed job to dead letter queue
   */
  static async moveToDeadLetterQueue(
    failedJob: Job,
    finalError: Error,
    errorCode: string
  ): Promise<string> {
    this.initialize();

    try {
      const errorClassification = RetryStrategyService.classifyError(finalError);
      
      const deadLetterJobData: DeadLetterJob = {
        original_job_id: failedJob.id!,
        product_id: failedJob.data.product_id,
        platform: failedJob.data.platform,
        batch_id: failedJob.data.batch_id,
        failed_at: new Date(),
        final_error: finalError.message,
        error_code: errorCode,
        total_attempts: failedJob.attemptsMade || 0,
        error_classification: errorClassification,
        original_data: failedJob.data,
        failure_reason: this.determineFailureReason(finalError, failedJob.attemptsMade || 0),
      };

      // Add to dead letter queue
      const dlqJob = await this.dlqQueue.add(
        'process-dead-letter',
        deadLetterJobData,
        {
          jobId: `dlq_${failedJob.id}_${Date.now()}`,
          priority: this.getFailurePriority(errorClassification),
        }
      );

      // Log to database
      await this.logDeadLetterJob(deadLetterJobData);

      console.log(`📮 [DLQ] Job ${failedJob.id} moved to dead letter queue: ${dlqJob.id}`);
      console.log(`📮 [DLQ] Reason: ${deadLetterJobData.failure_reason}`);
      console.log(`📮 [DLQ] Error: ${finalError.message}`);

      return dlqJob.id!;
    } catch (error) {
      console.error('Failed to move job to dead letter queue:', error);
      throw error;
    }
  }

  /**
   * Get dead letter queue statistics
   */
  static async getDeadLetterStats(): Promise<DeadLetterStats> {
    this.initialize();

    try {
      // Get recent failed jobs from queue
      const failedJobs = await this.dlqQueue.getFailed(0, 100);
      const completedJobs = await this.dlqQueue.getCompleted(0, 100);
      
      const allJobs = [...failedJobs, ...completedJobs];
      
      // Calculate statistics
      const total_failed = allJobs.length;
      const by_platform: Record<string, number> = {};
      const by_error_type: Record<string, number> = {};
      
      allJobs.forEach(job => {
        const platform = job.data.platform;
        const errorType = job.data.error_classification?.category || 'UNKNOWN';
        
        by_platform[platform] = (by_platform[platform] || 0) + 1;
        by_error_type[errorType] = (by_error_type[errorType] || 0) + 1;
      });

      // Get recent failures (last 10)
      const recent_failures = allJobs
        .slice(0, 10)
        .map(job => job.data);

      // Calculate failure rate (approximate)
      const failure_rate = total_failed > 0 ? 
        Math.round((total_failed / (total_failed + 100)) * 100) : 0; // Rough estimate

      return {
        total_failed,
        by_platform,
        by_error_type,
        recent_failures,
        failure_rate,
      };
    } catch (error) {
      console.error('Error getting dead letter stats:', error);
      return {
        total_failed: 0,
        by_platform: {},
        by_error_type: {},
        recent_failures: [],
        failure_rate: 0,
      };
    }
  }

  /**
   * Retry job from dead letter queue
   */
  static async retryDeadLetterJob(dlqJobId: string): Promise<{ success: boolean; message: string; newJobId?: string }> {
    this.initialize();

    try {
      const dlqJob = await this.dlqQueue.getJob(dlqJobId);
      if (!dlqJob) {
        return {
          success: false,
          message: 'Dead letter job not found',
        };
      }

      const originalData = dlqJob.data.original_data;
      
      // Import syncQueueService to avoid circular dependency
      const { syncQueueService } = await import('./syncQueue');
      
      // Add job back to main queue with reset attempt count
      const newJobId = await syncQueueService.addSyncJob({
        ...originalData,
        retry_count: 0, // Reset retry count
        timestamp: new Date(),
        metadata: {
          ...originalData.metadata,
          retried_from_dlq: true,
          original_dlq_job: dlqJobId,
          retry_timestamp: new Date().toISOString(),
        },
      });

      // Mark DLQ job as completed
      await dlqJob.moveToCompleted('Retried successfully', dlqJob.token!);

      console.log(`📮 [DLQ] Job ${dlqJobId} retried as ${newJobId}`);

      return {
        success: true,
        message: 'Job successfully retried',
        newJobId,
      };
    } catch (error) {
      console.error('Error retrying dead letter job:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retry job',
      };
    }
  }

  /**
   * Bulk retry jobs by criteria
   */
  static async bulkRetryJobs(criteria: {
    platform?: string;
    error_type?: string;
    batch_id?: string;
    limit?: number;
  }): Promise<{ success: boolean; retried_count: number; failed_count: number; errors: string[] }> {
    this.initialize();

    try {
      const jobs = await this.dlqQueue.getFailed(0, criteria.limit || 50);
      let retried_count = 0;
      let failed_count = 0;
      const errors: string[] = [];

      for (const job of jobs) {
        // Check if job matches criteria
        if (criteria.platform && job.data.platform !== criteria.platform) continue;
        if (criteria.error_type && job.data.error_classification?.category !== criteria.error_type) continue;
        if (criteria.batch_id && job.data.batch_id !== criteria.batch_id) continue;

        try {
          const result = await this.retryDeadLetterJob(job.id!);
          if (result.success) {
            retried_count++;
          } else {
            failed_count++;
            errors.push(`Job ${job.id}: ${result.message}`);
          }
        } catch (error) {
          failed_count++;
          errors.push(`Job ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: true,
        retried_count,
        failed_count,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        retried_count: 0,
        failed_count: 0,
        errors: [error instanceof Error ? error.message : 'Bulk retry failed'],
      };
    }
  }

  /**
   * Clean up old dead letter jobs
   */
  static async cleanupOldJobs(olderThanDays: number = 30): Promise<number> {
    this.initialize();

    try {
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      const cleaned = await this.dlqQueue.clean(cutoffTime, 1000);
      
      console.log(`📮 [DLQ] Cleaned up ${cleaned.length} old jobs (older than ${olderThanDays} days)`);
      return cleaned.length;
    } catch (error) {
      console.error('Error cleaning up dead letter queue:', error);
      return 0;
    }
  }

  /**
   * Log dead letter job to database
   */
  private static async logDeadLetterJob(dlqJob: DeadLetterJob) {
    try {
      await db.insert(syncLogs).values({
        batchId: dlqJob.batch_id || null,
        productId: dlqJob.product_id,
        platform: dlqJob.platform,
        status: 'failed',
        requestPayload: {
          original_job_id: dlqJob.original_job_id,
          moved_to_dlq: true,
          failure_reason: dlqJob.failure_reason,
          error_classification: dlqJob.error_classification,
        },
        responsePayload: {
          final_error: dlqJob.final_error,
          error_code: dlqJob.error_code,
          total_attempts: dlqJob.total_attempts,
        },
        platformProductId: null,
        errorMessage: dlqJob.final_error,
        errorCode: dlqJob.error_code,
        attempts: dlqJob.total_attempts,
        syncedAt: dlqJob.failed_at,
      });
    } catch (error) {
      console.error('Failed to log dead letter job to database:', error);
    }
  }

  /**
   * Determine failure reason
   */
  private static determineFailureReason(error: Error, attempts: number): string {
    const classification = RetryStrategyService.classifyError(error);
    
    if (attempts >= 3) {
      return `Maximum retry attempts exceeded (${attempts}) - ${classification.description}`;
    }
    
    if (!classification.retryable) {
      return `Non-retryable error - ${classification.description}`;
    }
    
    return `Failed after ${attempts} attempts - ${classification.description}`;
  }

  /**
   * Get failure priority for queue ordering
   */
  private static getFailurePriority(classification: any): number {
    switch (classification.severity) {
      case 'CRITICAL': return 10;
      case 'HIGH': return 5;
      case 'MEDIUM': return 1;
      case 'LOW': return -5;
      default: return 0;
    }
  }

  /**
   * Get queue instance for external access
   */
  static getQueue(): Queue<DeadLetterJob> {
    return this.initialize();
  }
}

// Export singleton instance
export const deadLetterQueueService = new DeadLetterQueueService();