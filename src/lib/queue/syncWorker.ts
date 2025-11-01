/**
 * Sync Worker
 * BullMQ worker for processing product synchronization jobs
 */

import { Worker, Job } from 'bullmq';
import { db } from '@/lib/db';
import { masterProducts } from '@/lib/db/master-catalog-schema';
import { syncLogs } from '@/lib/db/sync-logs-schema';
import { eq, and } from 'drizzle-orm';
import { redis } from './syncQueue';
import type { SyncJob, BatchSyncJob } from './syncQueue';

/**
 * Sync Worker Class
 */
export class SyncWorker {
  private worker: Worker;
  private batchWorker: Worker;

  constructor() {
    // Create worker for individual sync jobs
    this.worker = new Worker(
      'product-sync',
      this.processSyncJob.bind(this),
      {
        connection: redis,
        concurrency: 5, // Process up to 5 jobs concurrently
        removeOnComplete: 50,
        removeOnFail: 100,
      }
    );

    // Create worker for batch sync jobs
    this.batchWorker = new Worker(
      'batch-sync',
      this.processBatchSyncJob.bind(this),
      {
        connection: redis,
        concurrency: 2, // Process up to 2 batch jobs concurrently
        removeOnComplete: 10,
        removeOnFail: 20,
      }
    );

    this.setupEventHandlers();
  }

  /**
   * Process individual sync job
   */
  private async processSyncJob(job: Job<SyncJob>) {
    const { product_id, platform, batch_id, timestamp } = job.data;
    
    console.log(`[WORKER] Processing sync job ${job.id} - Product: ${product_id}, Platform: ${platform}`);

    try {
      // Update job progress
      await job.updateProgress(10);

      // Get product from master catalog
      const product = await this.getProduct(product_id, job.data.metadata?.organization_id);
      if (!product) {
        throw new Error(`Product ${product_id} not found in master catalog`);
      }

      await job.updateProgress(30);

      // Perform sync operation
      const syncResult = await this.performSync(product, platform, job.id!);
      
      await job.updateProgress(80);

      // Log sync operation to database
      await this.logSyncOperation(
        product_id,
        platform,
        syncResult.success ? 'success' : 'failed',
        {
          job_id: job.id,
          batch_id,
          product_sku: product.masterSku,
          product_name: product.name,
          base_price: product.basePrice,
          target_platform: platform,
          timestamp: timestamp.toISOString(),
        },
        syncResult.success ? {
          external_id: syncResult.external_id,
          pricing: syncResult.pricing,
          seo_titles: syncResult.seo_titles,
        } : {
          error_code: syncResult.error_code,
          error_message: syncResult.error_message,
        },
        syncResult.success ? null : syncResult.error_message,
        syncResult.success ? null : syncResult.error_code,
        batch_id
      );

      await job.updateProgress(100);

      if (!syncResult.success) {
        throw new Error(`Sync failed: ${syncResult.error_message}`);
      }

      console.log(`[WORKER] Sync job ${job.id} completed successfully`);
      return {
        success: true,
        product_id,
        platform,
        external_id: syncResult.external_id,
        synced_at: new Date().toISOString(),
      };

    } catch (error) {
      console.error(`[WORKER] Sync job ${job.id} failed:`, error);
      
      // Log failed operation
      await this.logSyncOperation(
        product_id,
        platform,
        'failed',
        {
          job_id: job.id,
          batch_id,
          target_platform: platform,
          timestamp: timestamp.toISOString(),
        },
        {
          error_message: error instanceof Error ? error.message : 'Unknown error',
        },
        error instanceof Error ? error.message : 'Unknown error',
        'WORKER_ERROR',
        batch_id
      );

      throw error;
    }
  }

  /**
   * Process batch sync job
   */
  private async processBatchSyncJob(job: Job<BatchSyncJob>) {
    const { product_ids, platform, batch_id, organization_id } = job.data;
    
    console.log(`[BATCH_WORKER] Processing batch sync job ${job.id} - ${product_ids.length} products`);

    try {
      await job.updateProgress(10);

      // This is a coordinator job - it doesn't do the actual sync
      // The individual sync jobs are added separately
      // This job just tracks the overall batch progress

      await job.updateProgress(100);

      console.log(`[BATCH_WORKER] Batch sync job ${job.id} completed - ${product_ids.length} individual jobs queued`);
      
      return {
        success: true,
        batch_id,
        total_products: product_ids.length,
        queued_at: new Date().toISOString(),
      };

    } catch (error) {
      console.error(`[BATCH_WORKER] Batch sync job ${job.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Get product from master catalog
   */
  private async getProduct(productId: string, organizationId?: string) {
    const conditions = [eq(masterProducts.id, productId)];
    if (organizationId) {
      conditions.push(eq(masterProducts.organizationId, organizationId));
    }

    const products = await db
      .select()
      .from(masterProducts)
      .where(and(...conditions))
      .limit(1);

    return products.length > 0 ? products[0] : null;
  }

  /**
   * Perform sync operation (simulated for now)
   */
  private async performSync(product: any, platform: 'shopee' | 'tiktok' | 'both', jobId: string) {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      const errorCodes = ['RATE_LIMITED', 'NETWORK_ERROR', 'INVALID_CREDENTIALS'];
      const errorCode = errorCodes[Math.floor(Math.random() * errorCodes.length)];
      
      return {
        success: false,
        error_code: errorCode,
        error_message: this.getErrorMessage(errorCode),
      };
    }

    // Calculate platform-specific pricing
    const basePrice = parseFloat(product.basePrice);
    const pricing: any = {};

    if (platform === 'shopee' || platform === 'both') {
      pricing.shopee = (basePrice * 1.15).toFixed(2);
    }
    
    if (platform === 'tiktok' || platform === 'both') {
      pricing.tiktok = (basePrice * 1.20).toFixed(2);
    }

    // Generate mock external IDs
    const external_id = platform === 'both' ? {
      shopee: `shopee_${jobId}_${Date.now()}`,
      tiktok: `tiktok_${jobId}_${Date.now()}`,
    } : `${platform}_${jobId}_${Date.now()}`;

    return {
      success: true,
      external_id,
      pricing,
      seo_titles: this.generateSEOTitles(product, platform),
    };
  }

  /**
   * Log sync operation to database
   */
  private async logSyncOperation(
    productId: string,
    platform: string,
    status: 'success' | 'failed',
    requestPayload: any,
    responsePayload: any,
    errorMessage: string | null,
    errorCode: string | null,
    batchId?: string
  ) {
    try {
      await db.insert(syncLogs).values({
        batchId: batchId || null,
        productId,
        platform,
        status,
        requestPayload,
        responsePayload,
        platformProductId: status === 'success' ? 
          (typeof responsePayload.external_id === 'string' ? responsePayload.external_id : JSON.stringify(responsePayload.external_id)) : null,
        errorMessage,
        errorCode,
        attempts: 1,
        syncedAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to log sync operation:', error);
    }
  }

  /**
   * Generate SEO titles (70-80% similar to master, 20-30% variation)
   */
  private generateSEOTitles(product: any, platform: 'shopee' | 'tiktok' | 'both') {
    const masterTitle = product.name;
    const brand = product.brand;
    
    const titles: any = {};

    if (platform === 'shopee' || platform === 'both') {
      titles.shopee = `${masterTitle} ${brand} [BEST SELLER] - Original & Berkualitas`;
    }

    if (platform === 'tiktok' || platform === 'both') {
      titles.tiktok = `${brand} ${masterTitle} - Kualitas Premium untuk FPV Racing`;
    }

    return titles;
  }

  /**
   * Get user-friendly error messages
   */
  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'RATE_LIMITED':
        return 'API rate limit exceeded. Please try again in a few minutes.';
      case 'NETWORK_ERROR':
        return 'Network connection error. Please check your internet connection.';
      case 'INVALID_CREDENTIALS':
        return 'Platform credentials are invalid or expired. Please reconnect your account.';
      case 'INVALID_PRODUCT':
        return 'Product data is invalid or incomplete.';
      default:
        return 'An unknown error occurred during sync.';
    }
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers() {
    // Individual sync worker events
    this.worker.on('completed', (job) => {
      console.log(`[WORKER] Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[WORKER] Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('[WORKER] Worker error:', err);
    });

    // Batch sync worker events
    this.batchWorker.on('completed', (job) => {
      console.log(`[BATCH_WORKER] Batch job ${job.id} completed successfully`);
    });

    this.batchWorker.on('failed', (job, err) => {
      console.error(`[BATCH_WORKER] Batch job ${job?.id} failed:`, err.message);
    });

    this.batchWorker.on('error', (err) => {
      console.error('[BATCH_WORKER] Batch worker error:', err);
    });
  }

  /**
   * Graceful shutdown
   */
  async close() {
    await this.worker.close();
    await this.batchWorker.close();
    await redis.disconnect();
  }
}

// Export singleton instance
export const syncWorker = new SyncWorker();