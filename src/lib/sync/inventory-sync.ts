/**
 * Inventory Synchronization
 * Handles real-time inventory push to all connected platforms
 */

import { db } from '@/lib/db';
import { 
  inventoryItems,
  storeProductMappings,
  stores,
  platforms,
  productVariants,
  products
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { PlatformAdapterFactory } from '@/lib/platforms/adapter-factory';
import { StoreService } from '@/lib/services/store-service';
import { InventoryService } from '@/lib/services/inventory-service';

export interface InventorySyncOptions {
  batchSize?: number;
  locationId?: string;
  productVariantIds?: string[];
  forceUpdate?: boolean;
  dryRun?: boolean;
  maxRetries?: number;
  conflictResolution?: 'local_wins' | 'platform_wins' | 'manual_review' | 'auto_resolve';
  retryFailedOnly?: boolean;
}

export interface InventorySyncResult {
  totalProcessed: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{
    productVariantId: string;
    platformProductId?: string;
    error: string;
  }>;
}

export interface InventoryConflict {
  productVariantId: string;
  platformProductId: string;
  localQuantity: number;
  platformQuantity: number;
  resolution: 'local_wins' | 'platform_wins' | 'manual_review';
}

export class InventorySyncService {
  private storeService: StoreService;
  private inventoryService: InventoryService;

  constructor() {
    this.storeService = new StoreService();
    this.inventoryService = new InventoryService();
  }

  /**
   * Push inventory to all connected platforms for an organization
   */
  async pushInventoryToAllPlatforms(
    organizationId: string,
    options: InventorySyncOptions = {}
  ): Promise<InventorySyncResult> {
    const result: InventorySyncResult = {
      totalProcessed: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Get all active stores for the organization
      const storesResult = await this.storeService.getOrganizationStores(organizationId, {
        isActive: true,
      });

      const activeStores = storesResult.stores;

      // Push inventory to each store's platform
      for (const store of activeStores) {
        try {
          const storeResult = await this.pushInventoryToPlatform(
            store.id,
            organizationId,
            options
          );

          // Aggregate results
          result.totalProcessed += storeResult.totalProcessed;
          result.updated += storeResult.updated;
          result.skipped += storeResult.skipped;
          result.failed += storeResult.failed;
          result.errors.push(...storeResult.errors);

        } catch (error) {
          result.errors.push({
            productVariantId: 'store_error',
            error: `Store ${store.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }

      return result;

    } catch (error) {
      result.errors.push({
        productVariantId: 'general_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return result;
    }
  }

  /**
   * Push inventory to a specific platform with enhanced error handling
   */
  async pushInventoryToPlatform(
    storeId: string,
    organizationId: string,
    options: InventorySyncOptions = {}
  ): Promise<InventorySyncResult> {
    const result: InventorySyncResult = {
      totalProcessed: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const maxRetries = options.maxRetries || 3;
    const retryDelay = 1000; // Start with 1 second

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

      // Get inventory items to sync
      const inventoryItems = await this.getInventoryItemsToSync(
        organizationId,
        storeId,
        options
      );

      const batchSize = options.batchSize || 20;

      // Process in batches
      for (let i = 0; i < inventoryItems.length; i += batchSize) {
        const batch = inventoryItems.slice(i, i + batchSize);

        for (const item of batch) {
          result.totalProcessed++;

          if (options.dryRun) {
            result.updated++;
            continue;
          }

          // Retry logic for individual items
          let success = false;
          let lastError: Error | null = null;

          for (let attempt = 0; attempt <= maxRetries && !success; attempt++) {
            try {
              // Add exponential backoff delay for retries
              if (attempt > 0) {
                const delay = retryDelay * Math.pow(2, attempt - 1);
                await this.delay(delay);
              }

              // Update inventory on platform
              const updateResponse = await adapter.updateInventory(
                item.platformProductId,
                item.platformVariantId || item.platformProductId,
                item.availableQuantity
              );

              if (updateResponse.success) {
                result.updated++;
                success = true;
                
                // Update last sync time
                await this.updateInventorySyncTime(item.mappingId);

                // Log successful retry if it wasn't the first attempt
                if (attempt > 0) {
                  console.log(`Inventory update succeeded on attempt ${attempt + 1} for ${item.platformProductId}`);
                }
              } else {
                lastError = new Error(updateResponse.error?.message || 'Unknown platform error');
                
                // Check if error is retryable
                if (!this.isRetryableError(lastError)) {
                  break; // Don't retry for non-retryable errors
                }
              }

            } catch (error) {
              lastError = error instanceof Error ? error : new Error('Unknown error');
              
              // Check if error is retryable
              if (!this.isRetryableError(lastError)) {
                break; // Don't retry for non-retryable errors
              }
            }
          }

          if (!success) {
            result.failed++;
            result.errors.push({
              productVariantId: item.productVariantId,
              platformProductId: item.platformProductId,
              error: lastError?.message || 'Unknown error after all retry attempts',
            });

            // Record error in recovery system
            if (lastError) {
              try {
                const { errorRecoverySystem } = await import('./error-recovery');
                await errorRecoverySystem.recordError(
                  `inventory_sync_${storeId}_${item.productVariantId}`,
                  'inventory_push',
                  organizationId,
                  lastError,
                  {
                    storeId,
                    productVariantId: item.productVariantId,
                    platformProductId: item.platformProductId,
                    availableQuantity: item.availableQuantity,
                  },
                  storeId
                );
              } catch (errorRecordingError) {
                console.error('Failed to record error in recovery system:', errorRecordingError);
              }
            }
          }
        }

        // Add adaptive delay between batches based on error rate
        if (i + batchSize < inventoryItems.length) {
          const errorRate = result.failed / result.totalProcessed;
          const adaptiveDelay = errorRate > 0.1 ? 500 : 100; // Longer delay if high error rate
          await this.delay(adaptiveDelay);
        }
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({
        productVariantId: 'platform_error',
        error: errorMessage,
      });

      // Record critical error
      try {
        const { errorRecoverySystem } = await import('./error-recovery');
        await errorRecoverySystem.recordError(
          `inventory_sync_critical_${storeId}`,
          'inventory_push',
          organizationId,
          error instanceof Error ? error : new Error(errorMessage),
          { storeId, options },
          storeId
        );
      } catch (errorRecordingError) {
        console.error('Failed to record critical error in recovery system:', errorRecordingError);
      }

      return result;
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const retryablePatterns = [
      'network',
      'timeout',
      'rate limit',
      'temporary',
      'service unavailable',
      'internal server error',
      'bad gateway',
      'gateway timeout',
      'connection',
      'econnreset',
      'enotfound',
      'etimedout',
    ];

    const nonRetryablePatterns = [
      'unauthorized',
      'forbidden',
      'not found',
      'invalid',
      'malformed',
      'authentication',
      'permission',
      'bad request',
    ];

    // Check for non-retryable patterns first
    if (nonRetryablePatterns.some(pattern => message.includes(pattern))) {
      return false;
    }

    // Check for retryable patterns
    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Retry failed inventory sync operations
   */
  async retryFailedInventorySync(
    organizationId: string,
    options: {
      storeId?: string;
      maxAge?: number; // Maximum age of failed operations to retry (in hours)
      batchSize?: number;
    } = {}
  ): Promise<{
    retriedOperations: number;
    successfulRetries: number;
    failedRetries: number;
    errors: Array<{ operation: string; error: string }>;
  }> {
    const { storeId, maxAge = 24, batchSize = 10 } = options;
    
    // Get errors ready for retry from error recovery system
    const { errorRecoverySystem } = await import('./error-recovery');
    const errorsToRetry = errorRecoverySystem.getErrorsReadyForRetry()
      .filter((error: any) => 
        error.organizationId === organizationId &&
        error.jobType === 'inventory_push' &&
        (!storeId || error.storeId === storeId) &&
        error.createdAt > new Date(Date.now() - maxAge * 60 * 60 * 1000)
      );

    const retryResult = {
      retriedOperations: errorsToRetry.length,
      successfulRetries: 0,
      failedRetries: 0,
      errors: [] as Array<{ operation: string; error: string }>,
    };

    // Process retries in batches
    for (let i = 0; i < errorsToRetry.length; i += batchSize) {
      const batch = errorsToRetry.slice(i, i + batchSize);

      for (const errorRecord of batch) {
        try {
          const context = errorRecord.context;
          if (!context?.storeId || !context?.productVariantId) {
            continue;
          }

          // Retry the specific inventory update
          const syncResult = await this.pushInventoryToPlatform(
            context.storeId,
            organizationId,
            {
              productVariantIds: [context.productVariantId],
              batchSize: 1,
              maxRetries: 1, // Single retry attempt
            }
          );

          if (syncResult.updated > 0) {
            retryResult.successfulRetries++;
            errorRecoverySystem.resolveError(errorRecord.id, 'retry' as any);
          } else {
            retryResult.failedRetries++;
            await errorRecoverySystem.retryError(errorRecord.id);
          }

        } catch (error) {
          retryResult.failedRetries++;
          retryResult.errors.push({
            operation: errorRecord.id,
            error: error instanceof Error ? error.message : 'Unknown retry error',
          });
        }
      }

      // Add delay between batches
      if (i + batchSize < errorsToRetry.length) {
        await this.delay(1000);
      }
    }

    return retryResult;
  }

  /**
   * Pull inventory from platform and detect conflicts
   */
  async pullInventoryFromPlatform(
    storeId: string,
    organizationId: string,
    options: InventorySyncOptions = {}
  ): Promise<{
    result: InventorySyncResult;
    conflicts: InventoryConflict[];
  }> {
    const result: InventorySyncResult = {
      totalProcessed: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const conflicts: InventoryConflict[] = [];

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

      // Get platform products with inventory
      const platformResponse = await adapter.getProducts({
        limit: options.batchSize || 50,
      });

      if (!platformResponse.success) {
        throw new Error(`Failed to fetch platform products: ${platformResponse.error?.message}`);
      }

      const platformProducts = platformResponse.data?.items || [];

      for (const platformProduct of platformProducts) {
        for (const variant of platformProduct.variants) {
          try {
            result.totalProcessed++;

            // Find local mapping
            const mapping = await this.getPlatformProductMapping(
              storeId,
              platformProduct.platformProductId,
              variant.platformVariantId
            );

            if (!mapping) {
              result.skipped++;
              continue;
            }

            // Get local inventory
            const localQuantity = await this.inventoryService.getAvailableStock(
              mapping.productVariantId,
              options.locationId
            );

            const platformQuantity = variant.inventory.quantity;

            // Check for conflicts
            if (localQuantity !== platformQuantity) {
              conflicts.push({
                productVariantId: mapping.productVariantId,
                platformProductId: platformProduct.platformProductId,
                localQuantity,
                platformQuantity,
                resolution: 'manual_review', // Default to manual review
              });

              result.skipped++;
            } else {
              result.updated++;
            }

          } catch (error) {
            result.failed++;
            result.errors.push({
              productVariantId: variant.platformVariantId || 'unknown',
              platformProductId: platformProduct.platformProductId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      return { result, conflicts };

    } catch (error) {
      result.errors.push({
        productVariantId: 'platform_pull_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { result, conflicts };
    }
  }

  /**
   * Resolve inventory conflicts with enhanced strategies
   */
  async resolveInventoryConflicts(
    storeId: string,
    organizationId: string,
    conflicts: InventoryConflict[],
    resolution: 'local_wins' | 'platform_wins' | 'manual_review' | 'auto_resolve' = 'manual_review'
  ): Promise<InventorySyncResult> {
    const result: InventorySyncResult = {
      totalProcessed: conflicts.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    // Get store and platform adapter for resolution
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

    for (const conflict of conflicts) {
      try {
        let resolvedQuantity: number;
        let updateLocal = false;
        let updatePlatform = false;

        switch (resolution) {
          case 'local_wins':
            resolvedQuantity = conflict.localQuantity;
            updatePlatform = true;
            break;

          case 'platform_wins':
            resolvedQuantity = conflict.platformQuantity;
            updateLocal = true;
            break;

          case 'auto_resolve':
            // Use intelligent auto-resolution based on business rules
            const autoResolution = this.determineAutoResolution(conflict);
            resolvedQuantity = autoResolution.quantity;
            updateLocal = autoResolution.updateLocal;
            updatePlatform = autoResolution.updatePlatform;
            break;

          case 'manual_review':
          default:
            // Store conflict for manual review
            await this.storeConflictForReview(conflict, storeId, organizationId);
            result.skipped++;
            continue;
        }

        // Apply resolution
        if (updatePlatform) {
          const updateResponse = await adapter.updateInventory(
            conflict.platformProductId,
            conflict.platformProductId, // Use product ID as variant ID if no specific variant
            resolvedQuantity
          );

          if (!updateResponse.success) {
            throw new Error(updateResponse.error?.message || 'Failed to update platform inventory');
          }
        }

        if (updateLocal) {
          // Find the product variant and location
          const mapping = await this.getPlatformProductMapping(
            storeId,
            conflict.platformProductId
          );

          if (mapping) {
            // Calculate adjustment needed
            const adjustment = resolvedQuantity - conflict.localQuantity;
            
            if (adjustment !== 0) {
              await this.inventoryService.adjustInventory([{
                productVariantId: mapping.productVariantId,
                locationId: 'default', // Use default location or get from mapping
                quantityChange: adjustment,
                notes: `Conflict resolution: ${resolution} - Platform: ${conflict.platformProductId}`,
              }]);
            }
          }
        }

        // Log the resolution
        await this.logConflictResolution(conflict, resolution, resolvedQuantity);
        result.updated++;

      } catch (error) {
        result.failed++;
        result.errors.push({
          productVariantId: conflict.productVariantId,
          platformProductId: conflict.platformProductId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Determine auto-resolution strategy based on business rules
   */
  private determineAutoResolution(conflict: InventoryConflict): {
    quantity: number;
    updateLocal: boolean;
    updatePlatform: boolean;
    reason: string;
  } {
    const localQty = conflict.localQuantity;
    const platformQty = conflict.platformQuantity;
    const difference = Math.abs(localQty - platformQty);

    // Rule 1: If difference is small (< 5 units), use the lower quantity (conservative approach)
    if (difference <= 5) {
      const conservativeQty = Math.min(localQty, platformQty);
      return {
        quantity: conservativeQty,
        updateLocal: localQty > conservativeQty,
        updatePlatform: platformQty > conservativeQty,
        reason: 'Conservative approach for small differences',
      };
    }

    // Rule 2: If local quantity is 0 but platform has stock, likely a sync issue - use platform
    if (localQty === 0 && platformQty > 0) {
      return {
        quantity: platformQty,
        updateLocal: true,
        updatePlatform: false,
        reason: 'Local inventory appears to be out of sync',
      };
    }

    // Rule 3: If platform quantity is 0 but local has stock, likely oversold - use local
    if (platformQty === 0 && localQty > 0) {
      return {
        quantity: localQty,
        updateLocal: false,
        updatePlatform: true,
        reason: 'Platform may have oversold, using local inventory',
      };
    }

    // Rule 4: For large differences, use the lower quantity to prevent overselling
    const safeQty = Math.min(localQty, platformQty);
    return {
      quantity: safeQty,
      updateLocal: localQty > safeQty,
      updatePlatform: platformQty > safeQty,
      reason: 'Using conservative quantity for large difference',
    };
  }

  /**
   * Store conflict for manual review
   */
  private async storeConflictForReview(
    conflict: InventoryConflict,
    storeId: string,
    organizationId: string
  ): Promise<void> {
    // This would typically store in a conflicts table for manual review
    // For now, we'll log it with structured data
    console.log('Inventory conflict stored for manual review:', {
      storeId,
      organizationId,
      conflict,
      timestamp: new Date().toISOString(),
    });

    // In a real implementation, you would:
    // 1. Insert into an inventory_conflicts table
    // 2. Send notifications to administrators
    // 3. Create dashboard alerts
  }

  /**
   * Log conflict resolution
   */
  private async logConflictResolution(
    conflict: InventoryConflict,
    resolution: string,
    resolvedQuantity: number
  ): Promise<void> {
    console.log('Inventory conflict resolved:', {
      productVariantId: conflict.productVariantId,
      platformProductId: conflict.platformProductId,
      localQuantity: conflict.localQuantity,
      platformQuantity: conflict.platformQuantity,
      resolution,
      resolvedQuantity,
      timestamp: new Date().toISOString(),
    });

    // In a real implementation, you would:
    // 1. Insert into sync_logs or inventory_audit_logs table
    // 2. Update conflict status in database
    // 3. Send notifications if needed
  }

  /**
   * Detect inventory conflicts across all platforms
   */
  async detectInventoryConflicts(
    organizationId: string,
    options: {
      storeId?: string;
      productVariantIds?: string[];
      threshold?: number; // Minimum difference to consider a conflict
    } = {}
  ): Promise<{
    conflicts: InventoryConflict[];
    summary: {
      totalChecked: number;
      conflictsFound: number;
      averageDifference: number;
      maxDifference: number;
    };
  }> {
    const { storeId, productVariantIds, threshold = 1 } = options;
    const conflicts: InventoryConflict[] = [];
    let totalChecked = 0;
    let totalDifference = 0;
    let maxDifference = 0;

    // Get stores to check
    const storesToCheck = storeId 
      ? [await this.storeService.getStoreWithRelations(storeId)]
      : (await this.storeService.getOrganizationStores(organizationId, { isActive: true })).stores;

    for (const store of storesToCheck) {
      if (!store) continue;

      try {
        const { conflicts: storeConflicts } = await this.pullInventoryFromPlatform(
          store.id,
          organizationId,
          { productVariantIds }
        );

        // Filter conflicts by threshold
        const significantConflicts = storeConflicts.filter(conflict => {
          const difference = Math.abs(conflict.localQuantity - conflict.platformQuantity);
          totalChecked++;
          totalDifference += difference;
          maxDifference = Math.max(maxDifference, difference);
          
          return difference >= threshold;
        });

        conflicts.push(...significantConflicts);

      } catch (error) {
        console.error(`Error detecting conflicts for store ${store.id}:`, error);
      }
    }

    const averageDifference = totalChecked > 0 ? totalDifference / totalChecked : 0;

    return {
      conflicts,
      summary: {
        totalChecked,
        conflictsFound: conflicts.length,
        averageDifference,
        maxDifference,
      },
    };
  }

  /**
   * Schedule inventory sync for a store with configurable intervals
   */
  async scheduleInventorySync(
    storeId: string,
    organizationId: string,
    options: {
      intervalMinutes?: number;
      cronExpression?: string;
      enabled?: boolean;
      conflictResolution?: 'local_wins' | 'platform_wins' | 'manual_review';
      batchSize?: number;
      maxRetries?: number;
    } = {}
  ): Promise<{
    scheduleId: string;
    nextRunAt: Date;
    intervalMinutes?: number;
    cronExpression?: string;
  }> {
    const {
      intervalMinutes = 15,
      cronExpression,
      enabled = true,
      conflictResolution = 'manual_review',
      batchSize = 50,
      maxRetries = 3,
    } = options;

    // Import scheduler here to avoid circular dependencies
    const { getGlobalScheduler } = await import('./scheduler');
    const { SyncService } = await import('../services/sync-service');
    
    const syncService = new SyncService();
    const scheduler = getGlobalScheduler(syncService);

    // Use cron expression if provided, otherwise convert interval to cron
    const finalCronExpression = cronExpression || this.intervalToCron(intervalMinutes);

    const schedule = scheduler.addSchedule({
      name: `Inventory Sync - Store ${storeId}`,
      organizationId,
      storeId,
      jobType: 'inventory_push' as any,
      cronExpression: finalCronExpression,
      enabled,
      options: {
        batchSize,
        maxRetries,
        conflictResolution,
        priority: 'normal' as const,
      },
      metadata: {
        scheduleType: 'inventory_sync',
        intervalMinutes: cronExpression ? undefined : intervalMinutes,
      },
    });

    return {
      scheduleId: schedule.id,
      nextRunAt: schedule.nextRunAt!,
      intervalMinutes: cronExpression ? undefined : intervalMinutes,
      cronExpression: finalCronExpression,
    };
  }

  /**
   * Update inventory sync schedule
   */
  async updateInventorySchedule(
    scheduleId: string,
    updates: {
      intervalMinutes?: number;
      cronExpression?: string;
      enabled?: boolean;
      conflictResolution?: 'local_wins' | 'platform_wins' | 'manual_review';
      batchSize?: number;
      maxRetries?: number;
    }
  ): Promise<boolean> {
    const { getGlobalScheduler } = await import('./scheduler');
    const { SyncService } = await import('../services/sync-service');
    
    const syncService = new SyncService();
    const scheduler = getGlobalScheduler(syncService);

    const scheduleUpdates: any = {};

    if (updates.enabled !== undefined) {
      scheduleUpdates.enabled = updates.enabled;
    }

    if (updates.cronExpression || updates.intervalMinutes) {
      scheduleUpdates.cronExpression = updates.cronExpression || 
        this.intervalToCron(updates.intervalMinutes!);
    }

    if (updates.conflictResolution || updates.batchSize || updates.maxRetries) {
      const currentSchedule = scheduler.getSchedule(scheduleId);
      if (currentSchedule) {
        scheduleUpdates.options = {
          ...currentSchedule.options,
          ...(updates.conflictResolution && { conflictResolution: updates.conflictResolution }),
          ...(updates.batchSize && { batchSize: updates.batchSize }),
          ...(updates.maxRetries && { maxRetries: updates.maxRetries }),
        };
      }
    }

    if (updates.intervalMinutes && !updates.cronExpression) {
      const currentSchedule = scheduler.getSchedule(scheduleId);
      if (currentSchedule) {
        scheduleUpdates.metadata = {
          ...currentSchedule.metadata,
          intervalMinutes: updates.intervalMinutes,
        };
      }
    }

    const updatedSchedule = scheduler.updateSchedule(scheduleId, scheduleUpdates);
    return updatedSchedule !== null;
  }

  /**
   * Remove inventory sync schedule
   */
  async removeInventorySchedule(scheduleId: string): Promise<boolean> {
    const { getGlobalScheduler } = await import('./scheduler');
    const { SyncService } = await import('../services/sync-service');
    
    const syncService = new SyncService();
    const scheduler = getGlobalScheduler(syncService);

    return scheduler.removeSchedule(scheduleId);
  }

  /**
   * Get inventory sync schedules for a store
   */
  async getInventorySchedules(storeId: string): Promise<Array<{
    scheduleId: string;
    name: string;
    cronExpression: string;
    enabled: boolean;
    nextRunAt?: Date;
    lastRunAt?: Date;
    intervalMinutes?: number;
    options: any;
  }>> {
    const { getGlobalScheduler } = await import('./scheduler');
    const { SyncService } = await import('../services/sync-service');
    
    const syncService = new SyncService();
    const scheduler = getGlobalScheduler(syncService);

    const allSchedules = scheduler.getAllSchedules();
    
    return allSchedules
      .filter(schedule => 
        schedule.storeId === storeId && 
        schedule.jobType === 'inventory_push' &&
        schedule.metadata?.scheduleType === 'inventory_sync'
      )
      .map(schedule => ({
        scheduleId: schedule.id,
        name: schedule.name,
        cronExpression: schedule.cronExpression,
        enabled: schedule.enabled,
        nextRunAt: schedule.nextRunAt,
        lastRunAt: schedule.lastRunAt,
        intervalMinutes: schedule.metadata?.intervalMinutes,
        options: schedule.options || {},
      }));
  }

  /**
   * Convert interval minutes to cron expression
   */
  private intervalToCron(intervalMinutes: number): string {
    if (intervalMinutes < 60) {
      // Every X minutes
      return `*/${intervalMinutes} * * * *`;
    } else if (intervalMinutes === 60) {
      // Every hour
      return '0 * * * *';
    } else if (intervalMinutes % 60 === 0) {
      // Every X hours
      const hours = intervalMinutes / 60;
      return `0 */${hours} * * *`;
    } else {
      // Default to every hour for complex intervals
      return '0 * * * *';
    }
  }

  /**
   * Get inventory items that need syncing
   */
  private async getInventoryItemsToSync(
    organizationId: string,
    storeId: string,
    options: InventorySyncOptions
  ): Promise<Array<{
    productVariantId: string;
    platformProductId: string;
    platformVariantId?: string;
    availableQuantity: number;
    mappingId: string;
  }>> {
    const conditions = [
      eq(products.organizationId, organizationId),
      eq(storeProductMappings.storeId, storeId),
      eq(products.isActive, true),
      eq(productVariants.isActive, true)
    ];

    // Add location filter if specified
    if (options.locationId) {
      conditions.push(eq(inventoryItems.locationId, options.locationId));
    }

    // Add product variant filter if specified
    if (options.productVariantIds) {
      conditions.push(inArray(inventoryItems.productVariantId, options.productVariantIds));
    }

    const results = await db
      .select({
        productVariantId: inventoryItems.productVariantId,
        platformProductId: storeProductMappings.platformProductId,
        platformVariantId: storeProductMappings.platformVariantId,
        quantityOnHand: inventoryItems.quantityOnHand,
        quantityReserved: inventoryItems.quantityReserved,
        mappingId: storeProductMappings.id,
      })
      .from(inventoryItems)
      .innerJoin(storeProductMappings, eq(inventoryItems.productVariantId, storeProductMappings.productVariantId))
      .innerJoin(productVariants, eq(inventoryItems.productVariantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(...conditions));

    return results.map(item => ({
      productVariantId: item.productVariantId,
      platformProductId: item.platformProductId,
      platformVariantId: item.platformVariantId || undefined,
      availableQuantity: Math.max(0, item.quantityOnHand - item.quantityReserved),
      mappingId: item.mappingId,
    }));
  }

  /**
   * Get platform product mapping
   */
  private async getPlatformProductMapping(
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
   * Update inventory sync timestamp
   */
  private async updateInventorySyncTime(mappingId: string): Promise<void> {
    await db
      .update(storeProductMappings)
      .set({
        lastSyncAt: new Date(),
        syncStatus: 'synced',
      })
      .where(eq(storeProductMappings.id, mappingId));
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get inventory sync statistics
   */
  async getInventorySyncStats(
    organizationId: string,
    storeId?: string
  ): Promise<{
    totalMappings: number;
    syncedMappings: number;
    outdatedMappings: number;
    errorMappings: number;
    lastSyncAt?: Date;
  }> {
    const conditions = [eq(products.organizationId, organizationId)];
    
    if (storeId) {
      conditions.push(eq(storeProductMappings.storeId, storeId));
    }

    const results = await db
      .select({
        syncStatus: storeProductMappings.syncStatus,
        lastSyncAt: storeProductMappings.lastSyncAt,
      })
      .from(storeProductMappings)
      .innerJoin(productVariants, eq(storeProductMappings.productVariantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(...conditions));

    const stats = {
      totalMappings: results.length,
      syncedMappings: 0,
      outdatedMappings: 0,
      errorMappings: 0,
      lastSyncAt: undefined as Date | undefined,
    };

    let latestSync: Date | undefined;

    for (const result of results) {
      switch (result.syncStatus) {
        case 'synced':
          stats.syncedMappings++;
          break;
        case 'error':
          stats.errorMappings++;
          break;
        default:
          stats.outdatedMappings++;
          break;
      }

      if (result.lastSyncAt && (!latestSync || result.lastSyncAt > latestSync)) {
        latestSync = result.lastSyncAt;
      }
    }

    stats.lastSyncAt = latestSync;
    return stats;
  }

  /**
   * Bulk update inventory for multiple variants
   */
  async bulkUpdateInventory(
    updates: Array<{
      storeId: string;
      productVariantId: string;
      quantity: number;
    }>,
    organizationId: string
  ): Promise<InventorySyncResult> {
    const result: InventorySyncResult = {
      totalProcessed: updates.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    // Group updates by store
    const updatesByStore = new Map<string, typeof updates>();
    
    for (const update of updates) {
      if (!updatesByStore.has(update.storeId)) {
        updatesByStore.set(update.storeId, []);
      }
      updatesByStore.get(update.storeId)!.push(update);
    }

    // Process each store
    for (const [storeId, storeUpdates] of updatesByStore) {
      try {
        const storeResult = await this.pushInventoryToPlatform(storeId, organizationId, {
          productVariantIds: storeUpdates.map(u => u.productVariantId),
        });

        result.updated += storeResult.updated;
        result.skipped += storeResult.skipped;
        result.failed += storeResult.failed;
        result.errors.push(...storeResult.errors);

      } catch (error) {
        result.failed += storeUpdates.length;
        result.errors.push({
          productVariantId: 'bulk_update_error',
          error: `Store ${storeId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return result;
  }

  /**
   * Get real-time inventory sync status for organization
   */
  async getInventorySyncStatus(organizationId: string): Promise<{
    totalStores: number;
    activeStores: number;
    lastSyncTimes: Record<string, Date>;
    syncErrors: number;
    conflictsDetected: number;
    scheduledSyncs: number;
  }> {
    const stores = await this.storeService.getOrganizationStores(organizationId, {
      isActive: true,
    });

    const status = {
      totalStores: stores.stores.length,
      activeStores: 0,
      lastSyncTimes: {} as Record<string, Date>,
      syncErrors: 0,
      conflictsDetected: 0,
      scheduledSyncs: 0,
    };

    for (const store of stores.stores) {
      try {
        const stats = await this.getInventorySyncStats(organizationId, store.id);
        
        if (stats.lastSyncAt) {
          status.activeStores++;
          status.lastSyncTimes[store.id] = stats.lastSyncAt;
        }

        status.syncErrors += stats.errorMappings;

        // Get scheduled syncs for this store
        const schedules = await this.getInventorySchedules(store.id);
        status.scheduledSyncs += schedules.filter(s => s.enabled).length;

      } catch (error) {
        console.error(`Error getting sync status for store ${store.id}:`, error);
      }
    }

    return status;
  }

  /**
   * Perform health check on inventory sync system
   */
  async performInventorySyncHealthCheck(organizationId: string): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warning';
      message: string;
      details?: any;
    }>;
    recommendations: string[];
  }> {
    const checks = [];
    const recommendations = [];

    // Check 1: Store connectivity
    const stores = await this.storeService.getOrganizationStores(organizationId, {
      isActive: true,
    });

    let connectedStores = 0;
    for (const store of stores.stores) {
      try {
        const credentials = await this.storeService.getStoreCredentials(store.id, organizationId);
        if (credentials) {
          connectedStores++;
        }
      } catch (error) {
        // Store not properly connected
      }
    }

    checks.push({
      name: 'Store Connectivity',
      status: (connectedStores === stores.stores.length ? 'pass' : 
              connectedStores > 0 ? 'warning' : 'fail') as 'pass' | 'fail' | 'warning',
      message: `${connectedStores}/${stores.stores.length} stores properly connected`,
      details: { connectedStores, totalStores: stores.stores.length },
    });

    if (connectedStores < stores.stores.length) {
      recommendations.push('Check store credentials and reconnect failed stores');
    }

    // Check 2: Recent sync activity
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let recentSyncs = 0;

    for (const store of stores.stores) {
      const stats = await this.getInventorySyncStats(organizationId, store.id);
      if (stats.lastSyncAt && stats.lastSyncAt > last24Hours) {
        recentSyncs++;
      }
    }

    checks.push({
      name: 'Recent Sync Activity',
      status: (recentSyncs > 0 ? 'pass' : 'warning') as 'pass' | 'fail' | 'warning',
      message: `${recentSyncs} stores synced in last 24 hours`,
      details: { recentSyncs, totalStores: stores.stores.length },
    });

    if (recentSyncs === 0 && stores.stores.length > 0) {
      recommendations.push('No recent inventory sync activity detected. Check sync schedules.');
    }

    // Check 3: Error rate
    let totalErrors = 0;
    let totalMappings = 0;

    for (const store of stores.stores) {
      const stats = await this.getInventorySyncStats(organizationId, store.id);
      totalErrors += stats.errorMappings;
      totalMappings += stats.totalMappings;
    }

    const errorRate = totalMappings > 0 ? (totalErrors / totalMappings) * 100 : 0;

    checks.push({
      name: 'Error Rate',
      status: (errorRate < 5 ? 'pass' : errorRate < 15 ? 'warning' : 'fail') as 'pass' | 'fail' | 'warning',
      message: `${errorRate.toFixed(1)}% error rate (${totalErrors}/${totalMappings})`,
      details: { errorRate, totalErrors, totalMappings },
    });

    if (errorRate > 10) {
      recommendations.push('High error rate detected. Review sync logs and platform connectivity.');
    }

    // Check 4: Scheduled syncs
    let totalSchedules = 0;
    let enabledSchedules = 0;

    for (const store of stores.stores) {
      const schedules = await this.getInventorySchedules(store.id);
      totalSchedules += schedules.length;
      enabledSchedules += schedules.filter(s => s.enabled).length;
    }

    checks.push({
      name: 'Scheduled Syncs',
      status: (enabledSchedules > 0 ? 'pass' : 'warning') as 'pass' | 'fail' | 'warning',
      message: `${enabledSchedules}/${totalSchedules} schedules enabled`,
      details: { enabledSchedules, totalSchedules },
    });

    if (enabledSchedules === 0 && stores.stores.length > 0) {
      recommendations.push('No scheduled inventory syncs configured. Consider setting up automated syncs.');
    }

    // Determine overall status
    const failedChecks = checks.filter(c => c.status === 'fail').length;
    const warningChecks = checks.filter(c => c.status === 'warning').length;

    let overallStatus: 'healthy' | 'warning' | 'critical';
    if (failedChecks > 0) {
      overallStatus = 'critical';
    } else if (warningChecks > 0) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      checks,
      recommendations,
    };
  }

  /**
   * Get inventory sync performance metrics
   */
  async getInventorySyncMetrics(
    organizationId: string,
    options: {
      storeId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    syncFrequency: {
      daily: number;
      weekly: number;
      monthly: number;
    };
    performance: {
      averageItemsPerSync: number;
      averageSyncDuration: number;
      successRate: number;
      throughputPerHour: number;
    };
    conflicts: {
      totalDetected: number;
      autoResolved: number;
      manualReviewRequired: number;
      resolutionRate: number;
    };
    errors: {
      byType: Record<string, number>;
      retrySuccessRate: number;
      averageRetryAttempts: number;
    };
  }> {
    // This would typically query sync job logs and metrics
    // For now, return mock data structure that would be populated with real data
    const { storeId, startDate, endDate } = options;
    
    // In a real implementation, this would:
    // 1. Query sync job history from database
    // 2. Calculate performance metrics
    // 3. Analyze conflict resolution data
    // 4. Compute error statistics
    
    return {
      syncFrequency: {
        daily: 0,
        weekly: 0,
        monthly: 0,
      },
      performance: {
        averageItemsPerSync: 0,
        averageSyncDuration: 0,
        successRate: 0,
        throughputPerHour: 0,
      },
      conflicts: {
        totalDetected: 0,
        autoResolved: 0,
        manualReviewRequired: 0,
        resolutionRate: 0,
      },
      errors: {
        byType: {},
        retrySuccessRate: 0,
        averageRetryAttempts: 0,
      },
    };
  }
}