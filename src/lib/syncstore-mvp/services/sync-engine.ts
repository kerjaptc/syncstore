/**
 * SyncStore MVP Core Sync Engine
 * 
 * This service orchestrates the complete product synchronization workflow,
 * including full and incremental sync, progress tracking, and error recovery.
 */

import {
  ProductSyncService,
  SyncResult,
  ValidationResult,
  Product,
  SyncStatus,
  SyncLog,
  SyncError,
  DatabaseError,
  createErrorContext,
  retryWithBackoff,
  CircuitBreaker,
  generateSyncJobId,
  calculateSyncProgress,
} from '../index';
import { ShopeeApiClient } from './shopee-api-client';
import { ProductFetcherService } from './product-fetcher';
import { ConnectionManagerService } from './connection-manager';
// Database imports disabled for client-side compatibility
// import {
//   getMvpRepositories,
//   type SelectMvpStoreConnection,
//   type SelectMvpProduct,
//   type InsertMvpProduct,
//   type InsertMvpSyncStatus,
//   type InsertMvpSyncLog,
// } from '../database/repositories';
// import { mvpTransaction } from '../database/connection';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SyncEngineConfig {
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  progressUpdateInterval: number;
  enableIncrementalSync: boolean;
  maxConcurrentSyncs: number;
}

export interface SyncJobContext {
  jobId: string;
  storeId: string;
  type: 'full' | 'incremental';
  startTime: Date;
  connection: SelectMvpStoreConnection;
  totalProducts: number;
  processedProducts: number;
  successfulProducts: number;
  failedProducts: number;
  errors: string[];
}

export interface SyncProgress {
  jobId: string;
  storeId: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  totalProducts: number;
  processedProducts: number;
  successfulProducts: number;
  failedProducts: number;
  errors: string[];
  startedAt: Date;
  estimatedCompletion?: Date;
  currentBatch?: number;
  totalBatches?: number;
}

// ============================================================================
// Core Sync Engine
// ============================================================================

export class CoreSyncEngine implements ProductSyncService {
  private config: SyncEngineConfig;
  private apiClient: ShopeeApiClient;
  private productFetcher: ProductFetcherService;
  private connectionManager: ConnectionManagerService;
  // private repositories = getMvpRepositories(); // Disabled - server-side only
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private activeSyncs = new Map<string, SyncJobContext>();

  constructor(
    apiClient: ShopeeApiClient,
    productFetcher: ProductFetcherService,
    connectionManager: ConnectionManagerService,
    config?: Partial<SyncEngineConfig>
  ) {
    this.apiClient = apiClient;
    this.productFetcher = productFetcher;
    this.connectionManager = connectionManager;
    
    this.config = {
      batchSize: 50,
      maxRetries: 3,
      retryDelay: 1000,
      progressUpdateInterval: 5000, // 5 seconds
      enableIncrementalSync: true,
      maxConcurrentSyncs: 3,
      ...config,
    };
  }

  // ============================================================================
  // Main Sync Operations
  // ============================================================================

  /**
   * Starts a product synchronization for a store
   */
  async syncStoreProducts(storeId: string, type: 'full' | 'incremental' = 'full'): Promise<SyncResult> {
    const jobId = generateSyncJobId(storeId, type);
    const startTime = Date.now();

    try {
      // Check if sync is already running
      if (this.activeSyncs.has(storeId)) {
        throw new SyncError(
          'Sync already in progress for this store',
          storeId,
          type,
          0
        );
      }

      // Check concurrent sync limit
      if (this.activeSyncs.size >= this.config.maxConcurrentSyncs) {
        throw new SyncError(
          'Maximum concurrent syncs reached',
          storeId,
          type,
          0
        );
      }

      // Get store connection
      const connection = await this.connectionManager.getConnection(storeId);
      if (!connection) {
        throw new SyncError(
          'Store connection not found',
          storeId,
          type,
          0
        );
      }

      // Validate connection
      const connectionStatus = await this.connectionManager.validateConnection(storeId);
      if (!connectionStatus.isValid) {
        throw new SyncError(
          `Store connection invalid: ${connectionStatus.error}`,
          storeId,
          type,
          0
        );
      }

      // Initialize sync context
      const context: SyncJobContext = {
        jobId,
        storeId,
        type,
        startTime: new Date(),
        connection,
        totalProducts: 0,
        processedProducts: 0,
        successfulProducts: 0,
        failedProducts: 0,
        errors: [],
      };

      this.activeSyncs.set(storeId, context);

      // Create sync log
      await this.repositories.syncLogs.create({
        storeId,
        type,
        status: 'running',
        productsProcessed: 0,
        productsSucceeded: 0,
        productsFailed: 0,
        errors: [],
        startedAt: context.startTime,
        metadata: { jobId, config: this.config },
      });

      // Initialize sync status
      await this.repositories.syncStatus.upsert({
        storeId,
        status: 'syncing',
        progress: 0,
        totalProducts: 0,
        syncedProducts: 0,
        errors: [],
        startedAt: context.startTime,
        syncType: type,
        metadata: { jobId },
      });

      console.log(`🚀 Starting ${type} sync for store ${storeId} (Job: ${jobId})`);

      // Execute sync based on type
      const result = type === 'incremental' && this.config.enableIncrementalSync
        ? await this.executeIncrementalSync(context)
        : await this.executeFullSync(context);

      // Complete sync
      await this.completeSync(context, result);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle sync failure
      await this.handleSyncFailure(storeId, jobId, errorMessage);
      
      const result: SyncResult = {
        success: false,
        productsProcessed: this.activeSyncs.get(storeId)?.processedProducts || 0,
        errors: [errorMessage],
        duration,
      };

      this.activeSyncs.delete(storeId);
      return result;
    }
  }

  /**
   * Syncs a single product
   */
  async syncSingleProduct(storeId: string, productId: string): Promise<Product> {
    try {
      const connection = await this.connectionManager.getConnection(storeId);
      if (!connection) {
        throw new SyncError('Store connection not found', storeId, 'incremental', 0);
      }

      // Get credentials
      const credentials = await this.repositories.encryptedCredentials.getById(connection.credentialsId);
      if (!credentials) {
        throw new SyncError('Store credentials not found', storeId, 'incremental', 0);
      }

      // Fetch single product
      const product = await this.productFetcher.fetchProduct(
        storeId,
        credentials.encryptedAccessToken, // Would need decryption in real implementation
        connection.storeId,
        productId
      );

      // Save to database
      const existingProduct = await this.repositories.products.getByStoreAndPlatformId(
        storeId,
        product.platformProductId
      );

      if (existingProduct) {
        return await this.repositories.products.update(
          storeId,
          product.platformProductId,
          {
            name: product.name,
            description: product.description,
            sku: product.sku,
            price: product.price,
            stock: product.stock,
            images: product.images,
            status: product.status,
            lastSyncAt: new Date(),
            platformData: {},
          }
        );
      } else {
        return await this.repositories.products.create({
          storeId,
          platformProductId: product.platformProductId,
          name: product.name,
          description: product.description,
          sku: product.sku,
          price: product.price,
          stock: product.stock,
          images: product.images,
          status: product.status,
          lastSyncAt: new Date(),
          platformData: {},
        });
      }

    } catch (error) {
      const context = createErrorContext('syncSingleProduct', { storeId, productId });
      throw new SyncError(
        `Failed to sync single product: ${error instanceof Error ? error.message : 'Unknown error'}`,
        storeId,
        'incremental',
        0,
        context
      );
    }
  }

  // ============================================================================
  // Sync Status and History
  // ============================================================================

  /**
   * Gets current sync status for a store
   */
  async getSyncStatus(storeId: string): Promise<SyncStatus> {
    try {
      const dbStatus = await this.repositories.syncStatus.getByStoreId(storeId);
      const activeSync = this.activeSyncs.get(storeId);

      if (activeSync) {
        // Return real-time status from active sync
        return {
          storeId,
          status: 'syncing',
          progress: calculateSyncProgress(activeSync.processedProducts, activeSync.totalProducts),
          totalProducts: activeSync.totalProducts,
          syncedProducts: activeSync.successfulProducts,
          errors: activeSync.errors,
          startedAt: activeSync.startTime,
          completedAt: undefined,
        };
      }

      if (dbStatus) {
        return {
          storeId: dbStatus.storeId,
          status: dbStatus.status as any,
          progress: dbStatus.progress,
          totalProducts: dbStatus.totalProducts,
          syncedProducts: dbStatus.syncedProducts,
          errors: dbStatus.errors as string[],
          startedAt: dbStatus.startedAt,
          completedAt: dbStatus.completedAt,
        };
      }

      // Default status
      return {
        storeId,
        status: 'idle',
        progress: 0,
        totalProducts: 0,
        syncedProducts: 0,
        errors: [],
        startedAt: undefined,
        completedAt: undefined,
      };

    } catch (error) {
      throw new DatabaseError(
        `Failed to get sync status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getSyncStatus',
        'mvp_sync_status',
        createErrorContext('getSyncStatus', { storeId })
      );
    }
  }

  /**
   * Gets sync history for a store
   */
  async getSyncHistory(storeId: string, limit: number = 10): Promise<SyncLog[]> {
    try {
      const logs = await this.repositories.syncLogs.getByStoreId(storeId, { limit });
      
      return logs.map(log => ({
        id: log.id,
        storeId: log.storeId,
        type: log.type as 'full' | 'incremental',
        status: log.status as 'running' | 'completed' | 'failed',
        productsProcessed: log.productsProcessed,
        errors: log.errors as string[],
        startedAt: log.startedAt,
        completedAt: log.completedAt,
      }));

    } catch (error) {
      throw new DatabaseError(
        `Failed to get sync history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getSyncHistory',
        'mvp_sync_logs',
        createErrorContext('getSyncHistory', { storeId, limit })
      );
    }
  }

  // ============================================================================
  // Sync Management
  // ============================================================================

  /**
   * Starts a sync operation and returns job ID
   */
  async startSync(storeId: string, type: 'full' | 'incremental' = 'full'): Promise<string> {
    const jobId = generateSyncJobId(storeId, type);
    
    // Start sync in background
    this.syncStoreProducts(storeId, type).catch(error => {
      console.error(`Background sync failed for store ${storeId}:`, error);
    });

    return jobId;
  }

  /**
   * Stops a running sync operation
   */
  async stopSync(storeId: string): Promise<void> {
    const activeSync = this.activeSyncs.get(storeId);
    if (!activeSync) {
      throw new SyncError('No active sync found for store', storeId, 'full', 0);
    }

    // Mark as stopped
    activeSync.errors.push('Sync stopped by user');
    
    // Update status
    await this.repositories.syncStatus.upsert({
      storeId,
      status: 'error',
      progress: calculateSyncProgress(activeSync.processedProducts, activeSync.totalProducts),
      totalProducts: activeSync.totalProducts,
      syncedProducts: activeSync.successfulProducts,
      errors: activeSync.errors,
      startedAt: activeSync.startTime,
      completedAt: new Date(),
      syncType: activeSync.type,
      metadata: { jobId: activeSync.jobId, stopped: true },
    });

    this.activeSyncs.delete(storeId);
    console.log(`🛑 Sync stopped for store ${storeId}`);
  }

  /**
   * Retries a failed sync
   */
  async retryFailedSync(storeId: string): Promise<SyncResult> {
    try {
      // Get last sync status
      const lastStatus = await this.repositories.syncStatus.getByStoreId(storeId);
      const syncType = lastStatus?.syncType === 'incremental' ? 'incremental' : 'full';
      
      return await this.syncStoreProducts(storeId, syncType);
    } catch (error) {
      throw new SyncError(
        `Failed to retry sync: ${error instanceof Error ? error.message : 'Unknown error'}`,
        storeId,
        'full',
        0
      );
    }
  }

  // ============================================================================
  // Data Validation and Transformation
  // ============================================================================

  /**
   * Validates product data
   */
  async validateProductData(product: Partial<Product>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic validation
      if (!product.name || product.name.trim() === '') {
        errors.push('Product name is required');
      }

      if (!product.sku || product.sku.trim() === '') {
        warnings.push('Product SKU is missing');
      }

      if (typeof product.price !== 'number' || product.price < 0) {
        errors.push('Product price must be a non-negative number');
      }

      if (typeof product.stock !== 'number' || product.stock < 0) {
        errors.push('Product stock must be a non-negative number');
      }

      if (product.name && product.name.length > 500) {
        warnings.push('Product name is very long and may be truncated');
      }

      if (product.price === 0) {
        warnings.push('Product price is zero');
      }

      if (!product.images || product.images.length === 0) {
        warnings.push('Product has no images');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
      };
    }
  }

  /**
   * Transforms product data from platform format
   */
  async transformProductData(rawProduct: any, platform: string): Promise<Product> {
    if (platform !== 'shopee') {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // This would use the ProductFetcherService transformer
    // For now, return a basic transformation
    return {
      id: crypto.randomUUID(),
      storeId: rawProduct.storeId || '',
      platformProductId: rawProduct.item_id?.toString() || '',
      name: rawProduct.item_name || 'Untitled Product',
      description: rawProduct.description,
      sku: rawProduct.item_sku || '',
      price: rawProduct.price || 0,
      stock: rawProduct.stock || 0,
      images: rawProduct.images || [],
      status: rawProduct.item_status === 'NORMAL' ? 'active' : 'inactive',
      lastSyncAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Executes a full sync operation
   */
  private async executeFullSync(context: SyncJobContext): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      console.log(`📊 Starting full sync for store ${context.storeId}`);

      // Get credentials (would need decryption in real implementation)
      const credentials = await this.repositories.encryptedCredentials.getById(context.connection.credentialsId);
      if (!credentials) {
        throw new Error('Store credentials not found');
      }

      // Fetch all products from Shopee
      const fetchResult = await this.productFetcher.fetchAllProducts(
        context.storeId,
        credentials.encryptedAccessToken, // Would need decryption
        context.connection.storeId,
        {
          limit: undefined, // Fetch all
          validateData: true,
          transformData: true,
        }
      );

      context.totalProducts = fetchResult.totalProducts;
      context.errors.push(...fetchResult.errors);

      // Update total products in status
      await this.repositories.syncStatus.upsert({
        storeId: context.storeId,
        status: 'syncing',
        progress: 0,
        totalProducts: context.totalProducts,
        syncedProducts: 0,
        errors: context.errors,
        startedAt: context.startTime,
        syncType: context.type,
        metadata: { jobId: context.jobId },
      });

      // Process products in batches
      const products = fetchResult.products;
      const batches = this.createBatches(products, this.config.batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} products)`);

        try {
          await this.processBatch(context, batch);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          context.errors.push(`Batch ${i + 1} failed: ${errorMessage}`);
          console.error(`❌ Batch ${i + 1} failed:`, error);
        }

        // Update progress
        const progress = calculateSyncProgress(context.processedProducts, context.totalProducts);
        await this.repositories.syncStatus.updateProgress(
          context.storeId,
          progress,
          context.successfulProducts,
          context.errors
        );
      }

      const duration = Date.now() - startTime;
      const success = context.failedProducts === 0;

      console.log(`✅ Full sync completed for store ${context.storeId}`);
      console.log(`📊 Processed: ${context.processedProducts}, Success: ${context.successfulProducts}, Failed: ${context.failedProducts}`);

      return {
        success,
        productsProcessed: context.processedProducts,
        errors: context.errors,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      context.errors.push(errorMessage);

      return {
        success: false,
        productsProcessed: context.processedProducts,
        errors: context.errors,
        duration,
      };
    }
  }

  /**
   * Executes an incremental sync operation
   */
  private async executeIncrementalSync(context: SyncJobContext): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Starting incremental sync for store ${context.storeId}`);

      // Get last sync time
      const lastSync = await this.repositories.syncStatus.getByStoreId(context.storeId);
      const lastSyncTime = lastSync?.completedAt || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24h ago

      // Get credentials
      const credentials = await this.repositories.encryptedCredentials.getById(context.connection.credentialsId);
      if (!credentials) {
        throw new Error('Store credentials not found');
      }

      // Fetch updated products
      const fetchResult = await this.productFetcher.fetchAllProducts(
        context.storeId,
        credentials.encryptedAccessToken,
        context.connection.storeId,
        {
          lastSyncAt: lastSyncTime,
          validateData: true,
          transformData: true,
        }
      );

      context.totalProducts = fetchResult.products.length;
      context.errors.push(...fetchResult.errors);

      if (context.totalProducts === 0) {
        console.log(`ℹ️  No products to sync for store ${context.storeId}`);
        return {
          success: true,
          productsProcessed: 0,
          errors: [],
          duration: Date.now() - startTime,
        };
      }

      // Process products
      const batches = this.createBatches(fetchResult.products, this.config.batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        await this.processBatch(context, batch);

        // Update progress
        const progress = calculateSyncProgress(context.processedProducts, context.totalProducts);
        await this.repositories.syncStatus.updateProgress(
          context.storeId,
          progress,
          context.successfulProducts,
          context.errors
        );
      }

      const duration = Date.now() - startTime;
      const success = context.failedProducts === 0;

      console.log(`✅ Incremental sync completed for store ${context.storeId}`);
      console.log(`📊 Processed: ${context.processedProducts}, Success: ${context.successfulProducts}, Failed: ${context.failedProducts}`);

      return {
        success,
        productsProcessed: context.processedProducts,
        errors: context.errors,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      context.errors.push(errorMessage);

      return {
        success: false,
        productsProcessed: context.processedProducts,
        errors: context.errors,
        duration,
      };
    }
  }

  /**
   * Processes a batch of products
   */
  private async processBatch(context: SyncJobContext, products: Product[]): Promise<void> {
    try {
      await mvpTransaction(async (tx) => {
        for (const product of products) {
          try {
            // Check if product exists
            const existing = await this.repositories.products.getByStoreAndPlatformId(
              context.storeId,
              product.platformProductId
            );

            if (existing) {
              // Update existing product
              await this.repositories.products.update(
                context.storeId,
                product.platformProductId,
                {
                  name: product.name,
                  description: product.description,
                  sku: product.sku,
                  price: product.price,
                  stock: product.stock,
                  images: product.images,
                  status: product.status,
                  lastSyncAt: new Date(),
                  platformData: {},
                }
              );
            } else {
              // Create new product
              await this.repositories.products.create({
                storeId: context.storeId,
                platformProductId: product.platformProductId,
                name: product.name,
                description: product.description,
                sku: product.sku,
                price: product.price,
                stock: product.stock,
                images: product.images,
                status: product.status,
                lastSyncAt: new Date(),
                platformData: {},
              });
            }

            context.processedProducts++;
            context.successfulProducts++;

          } catch (error) {
            context.processedProducts++;
            context.failedProducts++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            context.errors.push(`Product ${product.platformProductId}: ${errorMessage}`);
            console.error(`❌ Failed to process product ${product.platformProductId}:`, error);
          }
        }
      });
    } catch (error) {
      throw new DatabaseError(
        `Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'processBatch',
        'mvp_products',
        createErrorContext('processBatch', { storeId: context.storeId, batchSize: products.length })
      );
    }
  }

  /**
   * Creates batches from products array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Completes a sync operation
   */
  private async completeSync(context: SyncJobContext, result: SyncResult): Promise<void> {
    const finalStatus = result.success ? 'completed' : 'error';
    const completedAt = new Date();

    // Update sync status
    await this.repositories.syncStatus.upsert({
      storeId: context.storeId,
      status: finalStatus,
      progress: 100,
      totalProducts: context.totalProducts,
      syncedProducts: context.successfulProducts,
      errors: context.errors,
      startedAt: context.startTime,
      completedAt,
      syncType: context.type,
      metadata: { jobId: context.jobId, duration: result.duration },
    });

    // Update sync log
    const logs = await this.repositories.syncLogs.getByStoreId(context.storeId, { limit: 1 });
    if (logs.length > 0) {
      await this.repositories.syncLogs.update(logs[0].id, {
        status: finalStatus,
        productsProcessed: context.processedProducts,
        productsSucceeded: context.successfulProducts,
        productsFailed: context.failedProducts,
        errors: context.errors,
        completedAt,
        duration: result.duration,
      });
    }

    // Update store connection last sync time
    await this.repositories.storeConnections.update(context.storeId, {
      lastSyncAt: completedAt,
    });

    // Remove from active syncs
    this.activeSyncs.delete(context.storeId);

    console.log(`🏁 Sync ${result.success ? 'completed successfully' : 'failed'} for store ${context.storeId}`);
  }

  /**
   * Handles sync failure
   */
  private async handleSyncFailure(storeId: string, jobId: string, errorMessage: string): Promise<void> {
    try {
      // Update sync status
      await this.repositories.syncStatus.upsert({
        storeId,
        status: 'error',
        progress: 0,
        totalProducts: 0,
        syncedProducts: 0,
        errors: [errorMessage],
        startedAt: new Date(),
        completedAt: new Date(),
        syncType: 'full',
        metadata: { jobId, failed: true },
      });

      // Update sync log if exists
      const logs = await this.repositories.syncLogs.getByStoreId(storeId, { limit: 1 });
      if (logs.length > 0) {
        await this.repositories.syncLogs.update(logs[0].id, {
          status: 'failed',
          errors: [errorMessage],
          completedAt: new Date(),
        });
      }

      console.error(`❌ Sync failed for store ${storeId}: ${errorMessage}`);
    } catch (error) {
      console.error('Failed to handle sync failure:', error);
    }
  }

  /**
   * Gets circuit breaker for a store
   */
  private getCircuitBreaker(storeId: string): CircuitBreaker {
    let circuitBreaker = this.circuitBreakers.get(storeId);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(5, 60000, 2);
      this.circuitBreakers.set(storeId, circuitBreaker);
    }
    return circuitBreaker;
  }

  /**
   * Gets active sync information
   */
  getActiveSyncs(): SyncProgress[] {
    return Array.from(this.activeSyncs.values()).map(context => ({
      jobId: context.jobId,
      storeId: context.storeId,
      status: 'running',
      progress: calculateSyncProgress(context.processedProducts, context.totalProducts),
      totalProducts: context.totalProducts,
      processedProducts: context.processedProducts,
      successfulProducts: context.successfulProducts,
      failedProducts: context.failedProducts,
      errors: context.errors,
      startedAt: context.startTime,
    }));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates CoreSyncEngine with all dependencies
 */
export function createCoreSyncEngine(
  apiClient: ShopeeApiClient,
  productFetcher: ProductFetcherService,
  connectionManager: ConnectionManagerService,
  config?: Partial<SyncEngineConfig>
): CoreSyncEngine {
  return new CoreSyncEngine(apiClient, productFetcher, connectionManager, config);
}