/**
 * Job Status Tracking Service
 * Task 5.2: Implement job status tracking
 */

import { syncQueue } from './syncQueue';
import { db } from '../db';
import { syncLogs } from '../db/sync-logs-schema';
import { eq, and, count, desc } from 'drizzle-orm';

// JobStatus interface
export interface JobStatus {
  batch_id: string;
  total_jobs: number;
  completed: number;
  failed: number;
  in_progress: number;
  queued: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'mixed';
  progress_percentage: number;
  estimated_completion_time?: string;
  started_at?: string;
  completed_at?: string;
  duration?: string;
  error_summary?: {
    total_errors: number;
    error_types: Record<string, number>;
  };
  jobs?: JobDetail[];
}

export interface JobDetail {
  job_id: string;
  product_id: string;
  platform: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  processed_at?: Date;
  finished_at?: Date;
  attempts?: number;
  progress?: number;
}

export class JobStatusService {
  /**
   * Get real-time job status for a batch
   */
  static async getBatchStatus(batch_id: string): Promise<JobStatus | null> {
    try {
      // Get job status from BullMQ queue
      const [waiting, active, completed, failed] = await Promise.all([
        syncQueue.getWaiting(),
        syncQueue.getActive(),
        syncQueue.getCompleted(),
        syncQueue.getFailed(),
      ]);

      // Filter jobs by batch_id
      const batchJobs = {
        waiting: waiting.filter(job => job.data.batch_id === batch_id),
        active: active.filter(job => job.data.batch_id === batch_id),
        completed: completed.filter(job => job.data.batch_id === batch_id),
        failed: failed.filter(job => job.data.batch_id === batch_id),
      };

      const total_jobs = batchJobs.waiting.length + batchJobs.active.length + 
                        batchJobs.completed.length + batchJobs.failed.length;

      if (total_jobs === 0) {
        // Check database for historical data
        return await this.getBatchStatusFromDatabase(batch_id);
      }

      const completed_count = batchJobs.completed.length;
      const failed_count = batchJobs.failed.length;
      const in_progress = batchJobs.active.length;
      const queued = batchJobs.waiting.length;

      // Calculate progress
      const progress_percentage = total_jobs > 0 ? 
        Math.round(((completed_count + failed_count) / total_jobs) * 100) : 0;

      // Determine overall status
      let status: JobStatus['status'] = 'queued';
      if (in_progress > 0) {
        status = 'processing';
      } else if (completed_count === total_jobs) {
        status = 'completed';
      } else if (failed_count === total_jobs) {
        status = 'failed';
      } else if (completed_count + failed_count === total_jobs) {
        status = 'mixed';
      }

      // Estimate completion time
      const estimated_completion_time = this.estimateCompletionTime(
        queued + in_progress,
        in_progress
      );

      // Get timing information
      const allJobs = [...batchJobs.waiting, ...batchJobs.active, ...batchJobs.completed, ...batchJobs.failed];
      const timestamps = allJobs.map(job => job.timestamp).filter(Boolean).sort();
      const started_at = timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : undefined;

      let completed_at: string | undefined;
      let duration: string | undefined;

      if (status === 'completed' || status === 'failed' || status === 'mixed') {
        const finishedJobs = [...batchJobs.completed, ...batchJobs.failed];
        if (finishedJobs.length > 0) {
          const finishTimestamps = finishedJobs
            .map(job => job.finishedOn || job.processedOn)
            .filter(Boolean)
            .sort();
          if (finishTimestamps.length > 0) {
            completed_at = new Date(Math.max(...finishTimestamps)).toISOString();
            if (started_at) {
              const durationMs = new Date(completed_at).getTime() - new Date(started_at).getTime();
              duration = this.formatDuration(durationMs);
            }
          }
        }
      }

      // Get error summary
      const error_summary = failed_count > 0 ? await this.getErrorSummary(batch_id) : undefined;

      // Get job details
      const jobs = this.mapJobsToDetails(allJobs);

      return {
        batch_id,
        total_jobs,
        completed: completed_count,
        failed: failed_count,
        in_progress,
        queued,
        status,
        progress_percentage,
        estimated_completion_time,
        started_at,
        completed_at,
        duration,
        error_summary,
        jobs,
      };
    } catch (error) {
      console.error('Error getting batch status:', error);
      return null;
    }
  }

  /**
   * Get batch status from database (for completed batches)
   */
  static async getBatchStatusFromDatabase(batch_id: string): Promise<JobStatus | null> {
    try {
      // Get all sync logs for this batch
      const logs = await db
        .select()
        .from(syncLogs)
        .where(eq(syncLogs.batchId, batch_id))
        .orderBy(desc(syncLogs.syncedAt));

      if (logs.length === 0) {
        return null;
      }

      const total_jobs = logs.length;
      const completed = logs.filter(log => log.status === 'success').length;
      const failed = logs.filter(log => log.status === 'failed').length;
      const progress_percentage = 100; // All jobs are done if they're in the database

      let status: JobStatus['status'] = 'completed';
      if (failed === total_jobs) {
        status = 'failed';
      } else if (failed > 0) {
        status = 'mixed';
      }

      // Get timing information
      const timestamps = logs.map(log => log.syncedAt).sort();
      const started_at = timestamps[0]?.toISOString();
      const completed_at = timestamps[timestamps.length - 1]?.toISOString();
      
      let duration: string | undefined;
      if (started_at && completed_at) {
        const durationMs = new Date(completed_at).getTime() - new Date(started_at).getTime();
        duration = this.formatDuration(durationMs);
      }

      // Get error summary
      const error_summary = failed > 0 ? await this.getErrorSummaryFromLogs(logs) : undefined;

      // Map logs to job details
      const jobs = logs.map(log => ({
        job_id: `log_${log.id}`,
        product_id: log.productId,
        platform: log.platform,
        status: log.status === 'success' ? 'completed' as const : 'failed' as const,
        error: log.errorMessage || undefined,
        processed_at: log.syncedAt,
        finished_at: log.syncedAt,
        attempts: log.attempts,
      }));

      return {
        batch_id,
        total_jobs,
        completed,
        failed,
        in_progress: 0,
        queued: 0,
        status,
        progress_percentage,
        started_at,
        completed_at,
        duration,
        error_summary,
        jobs,
      };
    } catch (error) {
      console.error('Error getting batch status from database:', error);
      return null;
    }
  }

  /**
   * Get individual job status
   */
  static async getJobStatus(job_id: string): Promise<JobDetail | null> {
    try {
      const job = await syncQueue.getJob(job_id);
      if (!job) return null;

      return {
        job_id: job.id!,
        product_id: job.data.product_id,
        platform: job.data.platform,
        status: this.getJobStatusString(job) as JobDetail['status'],
        error: job.failedReason || undefined,
        processed_at: job.processedOn ? new Date(job.processedOn) : undefined,
        finished_at: job.finishedOn ? new Date(job.finishedOn) : undefined,
        attempts: job.attemptsMade,
        progress: job.progress,
      };
    } catch (error) {
      console.error('Error getting job status:', error);
      return null;
    }
  }

  /**
   * Get error summary for a batch
   */
  static async getErrorSummary(batch_id: string) {
    try {
      const errorLogs = await db
        .select()
        .from(syncLogs)
        .where(and(
          eq(syncLogs.batchId, batch_id),
          eq(syncLogs.status, 'failed')
        ));

      const error_types: Record<string, number> = {};
      errorLogs.forEach(log => {
        const errorCode = log.errorCode || 'UNKNOWN_ERROR';
        error_types[errorCode] = (error_types[errorCode] || 0) + 1;
      });

      return {
        total_errors: errorLogs.length,
        error_types,
      };
    } catch (error) {
      console.error('Error getting error summary:', error);
      return {
        total_errors: 0,
        error_types: {},
      };
    }
  }

  /**
   * Get error summary from logs array
   */
  static async getErrorSummaryFromLogs(logs: any[]) {
    const errorLogs = logs.filter(log => log.status === 'failed');
    const error_types: Record<string, number> = {};
    
    errorLogs.forEach(log => {
      const errorCode = log.errorCode || 'UNKNOWN_ERROR';
      error_types[errorCode] = (error_types[errorCode] || 0) + 1;
    });

    return {
      total_errors: errorLogs.length,
      error_types,
    };
  }

  /**
   * Estimate completion time
   */
  static estimateCompletionTime(remainingJobs: number, activeJobs: number): string {
    if (remainingJobs === 0) return '0 minutes';
    
    // Assume average 2.5 seconds per job, with 5 concurrent workers
    const avgJobTime = 2.5; // seconds
    const concurrency = Math.min(5, activeJobs + remainingJobs);
    const estimatedSeconds = (remainingJobs * avgJobTime) / concurrency;
    
    if (estimatedSeconds < 60) {
      return `${Math.ceil(estimatedSeconds)} seconds`;
    } else {
      return `${Math.ceil(estimatedSeconds / 60)} minutes`;
    }
  }

  /**
   * Format duration in human readable format
   */
  static formatDuration(durationMs: number): string {
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
   * Get job status string
   */
  static getJobStatusString(job: any): string {
    if (job.failedReason) return 'failed';
    if (job.finishedOn) return 'completed';
    if (job.processedOn) return 'processing';
    return 'pending';
  }

  /**
   * Map BullMQ jobs to JobDetail format
   */
  static mapJobsToDetails(jobs: any[]): JobDetail[] {
    return jobs.map(job => ({
      job_id: job.id!,
      product_id: job.data.product_id,
      platform: job.data.platform,
      status: this.getJobStatusString(job) as JobDetail['status'],
      error: job.failedReason || undefined,
      processed_at: job.processedOn ? new Date(job.processedOn) : undefined,
      finished_at: job.finishedOn ? new Date(job.finishedOn) : undefined,
      attempts: job.attemptsMade,
      progress: job.progress,
    }));
  }

  /**
   * Get queue statistics
   */
  static async getQueueStatistics() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        syncQueue.getWaiting(),
        syncQueue.getActive(),
        syncQueue.getCompleted(),
        syncQueue.getFailed(),
        syncQueue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting queue statistics:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
export const jobStatusService = new JobStatusService();