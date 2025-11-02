/**
 * SyncStore MVP Product and Sync tRPC Router
 * 
 * This file defines the tRPC API endpoints for product management and sync operations
 * with real-time progress updates and comprehensive error handling.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '@/lib/trpc';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';
import {
  CoreSyncEngine,
  SyncSchedulerService,
  ConnectionManagerService,
  getMvpRepositories,
  SyncRequestSchema,
  ValidationError,
  SyncError,
  DatabaseError,
} from '../index';

// ============================================================================
// Event Emitter for Real-time Updates
// ============================================================================

const syncEventEmitter = new EventEmitter();

// ============================================================================
// Input Validation Schemas
// ============================================================================

const ProductListInputSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'price', 'stock', 'lastSyncAt']).optional().default('lastSyncAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const ProductDetailInputSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
});

const SyncHistoryInputSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  limit: z.number().min(1).max(50).optional().default(10),
});

const SyncReportInputSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
});

const SystemReportInputSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
});

// ============================================================================
// Error Handler (reused from auth router)
// ============================================================================

function handleServiceError(error: unknown): never {
  console.error('Service error:', error);

  if (error instanceof ValidationError) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof SyncError) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof DatabaseError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database error. Please try again later.',
      cause: error,
    });
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    cause: error,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

async function verifyStoreAccess(storeId: string, userOrgId: string, connectionManager: ConnectionManagerService) {
  const connection = await connectionManager.getConnection(storeId);
  if (!connection) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Store connection not found',
    });
  }

  if (connection.organizationId !== userOrgId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Access denied to this store',
    });
  }

  return connection;
}

// ============================================================================
// Product Router
// ============================================================================

export function createProductRouter(
  syncEngine: CoreSyncEngine,
  connectionManager: ConnectionManagerService
) {
  const repositories = getMvpRepositories();

  return createTRPCRouter({
    /**
     * Lists products for a store with pagination and filtering
     */
    list: protectedProcedure
      .input(ProductListInputSchema)
      .query(async ({ input, ctx }) => {
        try {
          const { storeId, limit, offset, status, search, sortBy, sortOrder } = input;
          
          // Verify store access
          await verifyStoreAccess(storeId, ctx.user.organizationId, connectionManager);

          const result = await repositories.products.listByStore(storeId, {
            limit,
            offset,
            status,
            search,
            sortBy,
            sortOrder,
          });

          return {
            success: true,
            data: {
              products: result.products.map(product => ({
                id: product.id,
                platformProductId: product.platformProductId,
                name: product.name,
                description: product.description,
                sku: product.sku,
                price: product.price,
                stock: product.stock,
                images: product.images,
                status: product.status,
                lastSyncAt: product.lastSyncAt,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
              })),
              pagination: {
                total: result.total,
                limit,
                offset,
                hasMore: offset + limit < result.total,
              },
            },
          };
        } catch (error) {
          handleServiceError(error);
        }
      }),

    /**
     * Gets detailed information for a specific product
     */
    getDetail: protectedProcedure
      .input(ProductDetailInputSchema)
      .query(async ({ input, ctx }) => {
        try {
          const { storeId, productId } = input;
          
          // Verify store access
          await verifyStoreAccess(storeId, ctx.user.organizationId, connectionManager);

          const product = await repositories.products.getById(productId);
          if (!product || product.storeId !== storeId) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Product not found',
            });
          }

          return {
            success: true,
            data: {
              product: {
                id: product.id,
                storeId: product.storeId,
                platformProductId: product.platformProductId,
                name: product.name,
                description: product.description,
                sku: product.sku,
                price: product.price,
                stock: product.stock,
                images: product.images,
                status: product.status,
                lastSyncAt: product.lastSyncAt,
                platformData: product.platformData,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
              },
            },
          };
        } catch (error) {
          handleServiceError(error);
        }
      }),

    /**
     * Gets product count and statistics for a store
     */
    getStats: protectedProcedure
      .input(z.object({
        storeId: z.string().min(1, 'Store ID is required'),
      }))
      .query(async ({ input, ctx }) => {
        try {
          const { storeId } = input;
          
          // Verify store access
          await verifyStoreAccess(storeId, ctx.user.organizationId, connectionManager);

          const totalProducts = await repositories.products.getCountByStore(storeId);
          const activeProducts = await repositories.products.getCountByStore(storeId, 'active');
          const inactiveProducts = await repositories.products.getCountByStore(storeId, 'inactive');

          // Get products that need sync (older than 1 hour)
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const productsNeedingSync = await repositories.products.getProductsNeedingSync(
            storeId,
            oneHourAgo,
            1 // Just count, don't fetch all
          );

          return {
            success: true,
            data: {
              stats: {
                totalProducts,
                activeProducts,
                inactiveProducts,
                productsNeedingSync: productsNeedingSync.length,
                lastUpdated: new Date(),
              },
            },
          };
        } catch (error) {
          handleServiceError(error);
        }
      }),

    /**
     * Syncs a single product
     */
    syncSingle: protectedProcedure
      .input(ProductDetailInputSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const { storeId, productId } = input;
          
          // Verify store access
          await verifyStoreAccess(storeId, ctx.user.organizationId, connectionManager);

          const product = await syncEngine.syncSingleProduct(storeId, productId);

          // Emit real-time update
          syncEventEmitter.emit('productSynced', {
            storeId,
            productId: product.id,
            product,
          });

          return {
            success: true,
            data: {
              product: {
                id: product.id,
                platformProductId: product.platformProductId,
                name: product.name,
                sku: product.sku,
                price: product.price,
                stock: product.stock,
                status: product.status,
                lastSyncAt: product.lastSyncAt,
              },
            },
          };
        } catch (error) {
          handleServiceError(error);
        }
      }),
  });
}

// ============================================================================
// Sync Router
// ============================================================================

export function createSyncRouter(
  syncEngine: CoreSyncEngine,
  syncScheduler: SyncSchedulerService,
  connectionManager: ConnectionManagerService
) {
  return createTRPCRouter({
    /**
     * Starts a sync operation for a store
     */
    start: protectedProcedure
      .input(SyncRequestSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const { storeId, type = 'full' } = input;
          
          // Verify store access
          await verifyStoreAccess(storeId, ctx.user.organizationId, connectionManager);

          const jobId = await syncScheduler.scheduleSync(storeId, type, 'high');

          // Emit real-time update
          syncEventEmitter.emit('syncStarted', {
            storeId,
            type,
            jobId,
            startedAt: new Date(),
          });

          return {
            success: true,
            data: {
              jobId,
              type,
              message: `${type} sync started for store`,
            },
          };
        } catch (error) {
          handleServiceError(error);
        }
      }),

    /**
     * Stops a running sync operation
     */
    stop: protectedProcedure
      .input(z.object({
        storeId: z.string().min(1, 'Store ID is required'),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { storeId } = input;
          
          // Verify store access
          await verifyStoreAccess(storeId, ctx.user.organizationId, connectionManager);

          await syncScheduler.cancelScheduledSync(storeId);
          await syncEngine.stopSync(storeId);

          // Emit real-time update
          syncEventEmitter.emit('syncStopped', {
            storeId,
            stoppedAt: new Date(),
          });

          return {
            success: true,
            message: 'Sync stopped successfully',
          };
        } catch (error) {
          handleServiceError(error);
        }
      }),

    /**
     * Gets current sync status for a store
     */
    getStatus: protectedProcedure
      .input(z.object({
        storeId: z.string().min(1, 'Store ID is required'),
      }))
      .query(async ({ input, ctx }) => {
        try {
          const { storeId } = input;
          
          // Verify store access
          await verifyStoreAccess(storeId, ctx.user.organizationId, connectionManager);

          const status = await syncEngine.getSyncStatus(storeId);

          return {
            success: true,
            data: {
              status: {
                storeId: status.storeId,
                status: status.status,
                progress: status.progress,
                totalProducts: status.totalProducts,
                syncedProducts: status.syncedProducts,
                errors: status.errors,
                startedAt: status.startedAt,
                completedAt: status.completedAt,
              },
            },
          };
        } catch (error) {
          handleServiceError(error);
        }
      }),

    /**
     * Gets sync history for a store
     */
    getHistory: protectedProcedure
      .input(SyncHistoryInputSchema)
      .query(async ({ input, ctx }) => {
        try {
          const { storeId, limit } = input;
          
          // Verify store access
          await verifyStoreAccess(storeId, ctx.user.organizationId, connectionManager);

          const history = await syncEngine.getSyncHistory(storeId, limit);

          return {
            success: true,
            data: {
              history: history.map(log => ({
                id: log.id,
                type: log.type,
                status: log.status,
                productsProcessed: log.productsProcessed,
                errors: log.errors,
                startedAt: log.startedAt,
                completedAt: log.completedAt,
              })),
            },
          };
        } catch (error) {
          handleServiceError(error);
        }
      }),

    /**
     * Retries a failed sync
     */
    retry: protectedProcedure
      .input(z.object({
        storeId: z.string().min(1, 'Store ID is required'),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { storeId } = input;
          
          // Verify store access
          await verifyStoreAccess(storeId, ctx.user.organizationId, connectionManager);

          const result = await syncEngine.retryFailedSync(storeId);

          // Emit real-time update
          syncEventEmitter.emit('syncRetried', {
            storeId,
            retriedAt: new Date(),
            success: result.success,
          });

          return {
            success: true,
            data: {
              result: {
                success: result.success,
                productsProcessed: result.productsProcessed,
                errors: result.errors,
                duration: result.duration,
              },
            },
          };
        } catch (error) {
          handleServiceError(error);
        }
      }),

    /**
     * Gets scheduled syncs
     */
    getScheduled: protectedProcedure
      .input(z.object({
        organizationId: z.string().min(1, 'Organization ID is required'),
      }))
      .query(async ({ input, ctx }) => {
        try {
          const { organizationId } = input;
          
          // Verify organization access
          if (ctx.user.organizationId !== organizationId) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Access denied to this organization',
            });
          }

          const scheduledSyncs = syncScheduler.getScheduledSyncs();
          
          // Filter by organization (would need to check store ownership)
          const orgConnections = await connectionManager.listConnections(organizationId);
          const orgStoreIds = new Set(orgConnections.map(conn => conn.storeId));
          
          const filteredSyncs = scheduledSyncs.filter(sync => orgStoreIds.has(sync.storeId));

          return {
            success: true,
            data: {
              scheduledSyncs: filteredSyncs,
            },
          };
        } catch (error) {
          handleServiceError(error);
        }
      }),

    /**
     * Real-time sync progress subscription
     */
    subscribeToProgress: protectedProcedure
      .input(z.object({
        storeId: z.string().min(1, 'Store ID is required'),
      }))
      .subscription(async ({ input, ctx }) => {
        const { storeId } = input;
        
        // Verify store access
        await verifyStoreAccess(storeId, ctx.user.organizationId, connectionManager);

        return observable<{
          type: 'progress' | 'completed' | 'error' | 'started' | 'stopped';
          data: any;
        }>((emit) => {
          const onSyncStarted = (data: any) => {
            if (data.storeId === storeId) {
              emit.next({ type: 'started', data });
            }
          };

          const onSyncProgress = (data: any) => {
            if (data.storeId === storeId) {
              emit.next({ type: 'progress', data });
            }
          };

          const onSyncCompleted = (data: any) => {
            if (data.storeId === storeId) {
              emit.next({ type: 'completed', data });
            }
          };

          const onSyncError = (data: any) => {
            if (data.storeId === storeId) {
              emit.next({ type: 'error', data });
            }
          };

          const onSyncStopped = (data: any) => {
            if (data.storeId === storeId) {
              emit.next({ type: 'stopped', data });
            }
          };

          // Subscribe to events
          syncEventEmitter.on('syncStarted', onSyncStarted);
          syncEventEmitter.on('syncProgress', onSyncProgress);
          syncEventEmitter.on('syncCompleted', onSyncCompleted);
          syncEventEmitter.on('syncError', onSyncError);
          syncEventEmitter.on('syncStopped', onSyncStopped);

          // Cleanup on unsubscribe
          return () => {
            syncEventEmitter.off('syncStarted', onSyncStarted);
            syncEventEmitter.off('syncProgress', onSyncProgress);
            syncEventEmitter.off('syncCompleted', onSyncCompleted);
            syncEventEmitter.off('syncError', onSyncError);
            syncEventEmitter.off('syncStopped', onSyncStopped);
          };
        });
      }),
  });
}

// ============================================================================
// Reporting Router
// ============================================================================

export function createReportingRouter(
  syncScheduler: SyncSchedulerService,
  connectionManager: ConnectionManagerService
) {
  return createTRPCRouter({
    /**
     * Generates a sync report for a specific store
     */
    getStoreReport: protectedProcedure
      .input(SyncReportInputSchema)
      .query(async ({ input, ctx }) => {
        try {
          const { storeId } = input;
          
          // Verify store access
          await verifyStoreAccess(storeId, ctx.user.organizationId, connectionManager);

          const report = await syncScheduler.generateStoreReport(storeId);

          return {
            success: true,
            data: { report },
          };
        } catch (error) {
          handleServiceError(error);
        }
      }),

    /**
     * Generates a system-wide sync report for an organization
     */
    getSystemReport: protectedProcedure
      .input(SystemReportInputSchema)
      .query(async ({ input, ctx }) => {
        try {
          const { organizationId } = input;
          
          // Verify organization access
          if (ctx.user.organizationId !== organizationId) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Access denied to this organization',
            });
          }

          const report = await syncScheduler.generateSystemReport(organizationId);

          return {
            success: true,
            data: { report },
          };
        } catch (error) {
          handleServiceError(error);
        }
      }),

    /**
     * Gets scheduler status and metrics
     */
    getSchedulerStatus: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          const status = syncScheduler.getSchedulerStatus();

          return {
            success: true,
            data: { status },
          };
        } catch (error) {
          handleServiceError(error);
        }
      }),
  });
}

// ============================================================================
// Utility Functions for Event Emission
// ============================================================================

export function emitSyncProgress(storeId: string, progress: any) {
  syncEventEmitter.emit('syncProgress', { storeId, ...progress });
}

export function emitSyncCompleted(storeId: string, result: any) {
  syncEventEmitter.emit('syncCompleted', { storeId, ...result });
}

export function emitSyncError(storeId: string, error: any) {
  syncEventEmitter.emit('syncError', { storeId, error });
}