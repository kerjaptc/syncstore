/**
 * Job Queue Manager
 * Redis-based job queue with priority, retry, and dead letter queue support
 */

export interface QueueJob {
  id: string;
  type: string;
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface QueueOptions {
  priority?: number;
  delay?: number;
  maxAttempts?: number;
  backoff?: 'fixed' | 'exponential';
  backoffDelay?: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface JobProcessor {
  (job: QueueJob): Promise<any>;
}

/**
 * In-memory job queue implementation
 * In production, this would be replaced with Redis-based implementation
 */
export class JobQueue {
  private name: string;
  private jobs: Map<string, QueueJob> = new Map();
  private waitingJobs: QueueJob[] = [];
  private activeJobs: Map<string, QueueJob> = new Map();
  private completedJobs: QueueJob[] = [];
  private failedJobs: QueueJob[] = [];
  private delayedJobs: QueueJob[] = [];
  private processors: Map<string, JobProcessor> = new Map();
  private isProcessing = false;
  private isPaused = false;
  private concurrency = 1;
  private processingInterval?: NodeJS.Timeout;

  constructor(name: string, options: { concurrency?: number } = {}) {
    this.name = name;
    this.concurrency = options.concurrency || 1;
  }

  /**
   * Add a job to the queue
   */
  async add(
    type: string,
    data: any,
    options: QueueOptions = {}
  ): Promise<QueueJob> {
    const job: QueueJob = {
      id: this.generateJobId(),
      type,
      data,
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      delay: options.delay || 0,
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);

    if (job.delay > 0) {
      // Add to delayed jobs
      this.delayedJobs.push(job);
      this.scheduleDelayedJob(job);
    } else {
      // Add to waiting queue
      this.waitingJobs.push(job);
      this.sortWaitingJobs();
    }

    // Start processing if not already running
    if (!this.isProcessing && !this.isPaused) {
      this.startProcessing();
    }

    return job;
  }

  /**
   * Register a job processor
   */
  process(type: string, processor: JobProcessor): void {
    this.processors.set(type, processor);
  }

  /**
   * Start processing jobs
   */
  private startProcessing(): void {
    if (this.isProcessing || this.isPaused) return;

    this.isProcessing = true;
    // Use longer interval in development to reduce CPU usage
    const interval = process.env.NODE_ENV === 'development' ? 1000 : 100; // 1s vs 100ms
    this.processingInterval = setInterval(() => {
      this.processNextJobs();
    }, interval);
  }

  /**
   * Stop processing jobs
   */
  async stop(): Promise<void> {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    // Wait for active jobs to complete
    while (this.activeJobs.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Pause the queue
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume the queue
   */
  resume(): void {
    this.isPaused = false;
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  /**
   * Process next jobs based on concurrency
   */
  private async processNextJobs(): Promise<void> {
    if (this.isPaused) return;

    const availableSlots = this.concurrency - this.activeJobs.size;
    if (availableSlots <= 0) return;

    // Move delayed jobs that are ready
    this.moveReadyDelayedJobs();

    // Process waiting jobs
    for (let i = 0; i < availableSlots && this.waitingJobs.length > 0; i++) {
      const job = this.waitingJobs.shift();
      if (job) {
        this.processJob(job);
      }
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: QueueJob): Promise<void> {
    const processor = this.processors.get(job.type);
    if (!processor) {
      await this.failJob(job, `No processor registered for job type: ${job.type}`);
      return;
    }

    // Move to active jobs
    this.activeJobs.set(job.id, job);
    job.processedAt = new Date();
    job.attempts++;

    try {
      // Execute the job
      await processor(job);
      
      // Job completed successfully
      await this.completeJob(job);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (job.attempts < job.maxAttempts) {
        // Retry the job
        await this.retryJob(job, errorMessage);
      } else {
        // Job failed permanently
        await this.failJob(job, errorMessage);
      }
    }
  }

  /**
   * Complete a job successfully
   */
  private async completeJob(job: QueueJob): Promise<void> {
    job.completedAt = new Date();
    this.activeJobs.delete(job.id);
    this.completedJobs.push(job);
    
    // Emit completion event (in production, use proper event emitter)
    console.log(`Job ${job.id} completed successfully`);
  }

  /**
   * Retry a failed job
   */
  private async retryJob(job: QueueJob, error: string): Promise<void> {
    job.error = error;
    this.activeJobs.delete(job.id);

    // Calculate retry delay
    const retryDelay = this.calculateRetryDelay(job);
    job.delay = retryDelay;

    if (retryDelay > 0) {
      this.delayedJobs.push(job);
      this.scheduleDelayedJob(job);
    } else {
      this.waitingJobs.push(job);
      this.sortWaitingJobs();
    }

    console.log(`Job ${job.id} failed, retrying in ${retryDelay}ms (attempt ${job.attempts}/${job.maxAttempts})`);
  }

  /**
   * Fail a job permanently
   */
  private async failJob(job: QueueJob, error: string): Promise<void> {
    job.error = error;
    job.failedAt = new Date();
    this.activeJobs.delete(job.id);
    this.failedJobs.push(job);

    console.error(`Job ${job.id} failed permanently: ${error}`);
  }

  /**
   * Calculate retry delay based on backoff strategy
   */
  private calculateRetryDelay(job: QueueJob): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 1 minute

    // Exponential backoff: delay = baseDelay * (2 ^ (attempts - 1))
    const delay = baseDelay * Math.pow(2, job.attempts - 1);
    return Math.min(delay, maxDelay);
  }

  /**
   * Schedule a delayed job
   */
  private scheduleDelayedJob(job: QueueJob): void {
    setTimeout(() => {
      const index = this.delayedJobs.findIndex(j => j.id === job.id);
      if (index >= 0) {
        this.delayedJobs.splice(index, 1);
        this.waitingJobs.push(job);
        this.sortWaitingJobs();
      }
    }, job.delay);
  }

  /**
   * Move ready delayed jobs to waiting queue
   */
  private moveReadyDelayedJobs(): void {
    const now = Date.now();
    const readyJobs: QueueJob[] = [];

    this.delayedJobs = this.delayedJobs.filter(job => {
      const isReady = (job.processedAt?.getTime() || job.createdAt.getTime()) + job.delay <= now;
      if (isReady) {
        readyJobs.push(job);
        return false;
      }
      return true;
    });

    if (readyJobs.length > 0) {
      this.waitingJobs.push(...readyJobs);
      this.sortWaitingJobs();
    }
  }

  /**
   * Sort waiting jobs by priority (higher priority first)
   */
  private sortWaitingJobs(): void {
    this.waitingJobs.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<QueueJob | null> {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Remove a job from the queue
   */
  async removeJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // Remove from all queues
    this.jobs.delete(jobId);
    this.activeJobs.delete(jobId);
    
    this.waitingJobs = this.waitingJobs.filter(j => j.id !== jobId);
    this.delayedJobs = this.delayedJobs.filter(j => j.id !== jobId);
    this.completedJobs = this.completedJobs.filter(j => j.id !== jobId);
    this.failedJobs = this.failedJobs.filter(j => j.id !== jobId);

    return true;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    return {
      waiting: this.waitingJobs.length,
      active: this.activeJobs.size,
      completed: this.completedJobs.length,
      failed: this.failedJobs.length,
      delayed: this.delayedJobs.length,
      paused: this.isPaused,
    };
  }

  /**
   * Clean completed and failed jobs
   */
  async clean(
    grace: number = 24 * 60 * 60 * 1000, // 24 hours
    limit: number = 100
  ): Promise<number> {
    const cutoff = new Date(Date.now() - grace);
    let cleaned = 0;

    // Clean completed jobs
    const completedToRemove = this.completedJobs
      .filter(job => job.completedAt && job.completedAt < cutoff)
      .slice(0, limit);

    for (const job of completedToRemove) {
      this.jobs.delete(job.id);
      cleaned++;
    }

    this.completedJobs = this.completedJobs.filter(
      job => !completedToRemove.includes(job)
    );

    // Clean failed jobs
    const failedToRemove = this.failedJobs
      .filter(job => job.failedAt && job.failedAt < cutoff)
      .slice(0, limit - cleaned);

    for (const job of failedToRemove) {
      this.jobs.delete(job.id);
      cleaned++;
    }

    this.failedJobs = this.failedJobs.filter(
      job => !failedToRemove.includes(job)
    );

    return cleaned;
  }

  /**
   * Get failed jobs for dead letter queue processing
   */
  async getFailedJobs(limit: number = 50): Promise<QueueJob[]> {
    return this.failedJobs.slice(0, limit);
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs(jobIds?: string[]): Promise<number> {
    let retried = 0;
    const jobsToRetry = jobIds 
      ? this.failedJobs.filter(job => jobIds.includes(job.id))
      : this.failedJobs.slice();

    for (const job of jobsToRetry) {
      // Reset job state
      job.attempts = 0;
      job.error = undefined;
      job.failedAt = undefined;
      job.delay = 0;

      // Move back to waiting queue
      const index = this.failedJobs.findIndex(j => j.id === job.id);
      if (index >= 0) {
        this.failedJobs.splice(index, 1);
        this.waitingJobs.push(job);
        retried++;
      }
    }

    if (retried > 0) {
      this.sortWaitingJobs();
    }

    return retried;
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get waiting jobs
   */
  async getWaitingJobs(limit: number = 50): Promise<QueueJob[]> {
    return this.waitingJobs.slice(0, limit);
  }

  /**
   * Get active jobs
   */
  async getActiveJobs(): Promise<QueueJob[]> {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Get completed jobs
   */
  async getCompletedJobs(limit: number = 50): Promise<QueueJob[]> {
    return this.completedJobs.slice(-limit);
  }

  /**
   * Drain the queue (wait for all jobs to complete)
   */
  async drain(): Promise<void> {
    // Wait for all waiting jobs to be processed
    while (this.waitingJobs.length > 0 || this.activeJobs.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Empty the queue (remove all jobs)
   */
  async empty(): Promise<void> {
    this.waitingJobs = [];
    this.delayedJobs = [];
    // Don't remove active jobs as they're currently being processed
  }
}

/**
 * Queue Manager - manages multiple job queues
 */
export class QueueManager {
  private queues: Map<string, JobQueue> = new Map();

  /**
   * Create or get a queue
   */
  getQueue(name: string, options?: { concurrency?: number }): JobQueue {
    if (!this.queues.has(name)) {
      this.queues.set(name, new JobQueue(name, options));
    }
    return this.queues.get(name)!;
  }

  /**
   * Remove a queue
   */
  async removeQueue(name: string): Promise<boolean> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.stop();
      this.queues.delete(name);
      return true;
    }
    return false;
  }

  /**
   * Get all queue names
   */
  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Get stats for all queues
   */
  async getAllStats(): Promise<Record<string, QueueStats>> {
    const stats: Record<string, QueueStats> = {};
    
    for (const [name, queue] of this.queues) {
      stats[name] = await queue.getStats();
    }

    return stats;
  }

  /**
   * Stop all queues
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.queues.values()).map(queue => queue.stop());
    await Promise.all(stopPromises);
  }

  /**
   * Clean all queues
   */
  async cleanAll(grace?: number, limit?: number): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    
    for (const [name, queue] of this.queues) {
      results[name] = await queue.clean(grace, limit);
    }

    return results;
  }
}

// Global queue manager instance
export const queueManager = new QueueManager();