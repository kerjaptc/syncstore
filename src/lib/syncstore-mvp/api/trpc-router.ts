/**
 * SyncStore MVP tRPC Router
 * 
 * This file defines the tRPC API endpoints for authentication, connection management,
 * and sync operations with proper validation and error handling.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '@/lib/trpc';
import {
  ShopeeOAuthService,
  ConnectionManagerService,
  CoreSyncEngine,
  SyncSchedulerService,
  createShopeeOAuthService,
  createCredentialStorageService,
  createConnectionManagerService,
  createShopeeApiClient,
  createProductFetcherService,
  createCoreSyncEngine,
  createSyncSchedulerService,
  StoreConnectionSchema,
  OAuthInitiationRequestSchema,
  OAuthCallbackRequestSchema,
  SyncRequestSchema,
  ValidationError,
  ConnectionError,
  ShopeeApiError,
  SyncError,
  DatabaseError,
} from '../index';

// ============================================================================
// Service Initialization
// ============================================================================

// Initialize services (in a real app, these would be dependency injected)
const oauthService = createShopeeOAuthService();
const credentialStorage = createCredentialStorageService();
const connectionManager = createConnectionManagerService(oauthService, credentialStorage);
const apiClient = createShopeeApiClient();
const productFetcher = createProductFetcherService(apiClient);
const syncEngine = createCoreSyncEngine(apiClient, productFetcher, connectionManager);
const syncScheduler = createSyncSchedulerService(syncEngine, connectionManager);

// Start scheduler
syncScheduler.start().catch(console.error);

// ============================================================================
// Input Validation Schemas
// ============================================================================

const ConnectionStatusInputSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
});

const UpdateConnectionInputSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  updates: z.object({
    storeName: z.string().optional(),
    status: z.enum(['active', 'expired', 'error']).optional(),
  }),
});

const ListConnectionsInputSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  status: z.string().optional(),
});

// ============================================================================
// Error Handler Utility
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

  if (error instanceof ConnectionError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof ShopeeApiError) {
    if (error.isRateLimited) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.',
        cause: error,
      });
    }

    if (error.isTokenExpired) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Store connection expired. Please reconnect your store.',
        cause: error,
      });
    }

    throw new TRPCError({
      code: 'BAD_GATEWAY',
      message: 'External service error. Please try again later.',
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

  // Generic error
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    cause: error,
  });
}

// ============================================================================
// Authentication and Connection Router
// ============================================================================

export const authConnectionRouter = createTRPCRouter({
  /**
   * Initiates OAuth flow for Shopee store connection
   */
  initiateOAuth: protectedProcedure
    .input(OAuthInitiationRequestSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { organizationId } = input;
        
        // Verify user has access to organization
        if (ctx.user.organizationId !== organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this organization',
          });
        }

        const result = await oauthService.initiateOAuth(organizationId);
        
        return {
          success: true,
          data: {
            authUrl: result.url,
            state: result.state,
          },
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  /**
   * Handles OAuth callback and creates store connection
   */
  handleOAuthCallback: protectedProcedure
    .input(OAuthCallbackRequestSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { code, state } = input;
        
        const connection = await oauthService.handleOAuthCallback(code, state);
        
        // Verify user has access to the organization
        if (ctx.user.organizationId !== connection.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this organization',
          });
        }

        return {
          success: true,
          data: {
            connection: {
              id: connection.id,
              storeId: connection.storeId,
              storeName: connection.storeName,
              platform: connection.platform,
              status: connection.status,
              createdAt: connection.createdAt,
            },
          },
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  /**
   * Gets store connection details
   */
  getConnection: protectedProcedure
    .input(ConnectionStatusInputSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { storeId } = input;
        
        const connection = await connectionManager.getConnection(storeId);
        if (!connection) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Store connection not found',
          });
        }

        // Verify user has access to the organization
        if (ctx.user.organizationId !== connection.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this store connection',
          });
        }

        return {
          success: true,
          data: {
            connection: {
              id: connection.id,
              storeId: connection.storeId,
              storeName: connection.storeName,
              platform: connection.platform,
              status: connection.status,
              lastSyncAt: connection.lastSyncAt,
              createdAt: connection.createdAt,
              updatedAt: connection.updatedAt,
            },
          },
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  /**
   * Lists all store connections for an organization
   */
  listConnections: protectedProcedure
    .input(ListConnectionsInputSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { organizationId, limit, offset, status } = input;
        
        // Verify user has access to organization
        if (ctx.user.organizationId !== organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this organization',
          });
        }

        const connections = await connectionManager.listConnections(organizationId);
        
        // Apply filters
        let filteredConnections = connections;
        if (status) {
          filteredConnections = connections.filter(conn => conn.status === status);
        }

        // Apply pagination
        const startIndex = offset || 0;
        const endIndex = limit ? startIndex + limit : undefined;
        const paginatedConnections = filteredConnections.slice(startIndex, endIndex);

        return {
          success: true,
          data: {
            connections: paginatedConnections.map(conn => ({
              id: conn.id,
              storeId: conn.storeId,
              storeName: conn.storeName,
              platform: conn.platform,
              status: conn.status,
              lastSyncAt: conn.lastSyncAt,
              createdAt: conn.createdAt,
              updatedAt: conn.updatedAt,
            })),
            total: filteredConnections.length,
            hasMore: endIndex ? endIndex < filteredConnections.length : false,
          },
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  /**
   * Updates store connection
   */
  updateConnection: protectedProcedure
    .input(UpdateConnectionInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { storeId, updates } = input;
        
        // Get existing connection to verify access
        const existingConnection = await connectionManager.getConnection(storeId);
        if (!existingConnection) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Store connection not found',
          });
        }

        // Verify user has access to the organization
        if (ctx.user.organizationId !== existingConnection.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this store connection',
          });
        }

        const updatedConnection = await connectionManager.updateConnection(storeId, updates);

        return {
          success: true,
          data: {
            connection: {
              id: updatedConnection.id,
              storeId: updatedConnection.storeId,
              storeName: updatedConnection.storeName,
              platform: updatedConnection.platform,
              status: updatedConnection.status,
              lastSyncAt: updatedConnection.lastSyncAt,
              createdAt: updatedConnection.createdAt,
              updatedAt: updatedConnection.updatedAt,
            },
          },
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  /**
   * Deletes store connection
   */
  deleteConnection: protectedProcedure
    .input(ConnectionStatusInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { storeId } = input;
        
        // Get existing connection to verify access
        const existingConnection = await connectionManager.getConnection(storeId);
        if (!existingConnection) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Store connection not found',
          });
        }

        // Verify user has access to the organization
        if (ctx.user.organizationId !== existingConnection.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this store connection',
          });
        }

        await connectionManager.deleteConnection(storeId);

        return {
          success: true,
          message: 'Store connection deleted successfully',
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  /**
   * Validates store connection
   */
  validateConnection: protectedProcedure
    .input(ConnectionStatusInputSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { storeId } = input;
        
        // Get existing connection to verify access
        const existingConnection = await connectionManager.getConnection(storeId);
        if (!existingConnection) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Store connection not found',
          });
        }

        // Verify user has access to the organization
        if (ctx.user.organizationId !== existingConnection.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this store connection',
          });
        }

        const status = await connectionManager.validateConnection(storeId);

        return {
          success: true,
          data: {
            isValid: status.isValid,
            error: status.error,
            lastChecked: status.lastChecked,
          },
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  /**
   * Refreshes store connection tokens
   */
  refreshConnection: protectedProcedure
    .input(ConnectionStatusInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { storeId } = input;
        
        // Get existing connection to verify access
        const existingConnection = await connectionManager.getConnection(storeId);
        if (!existingConnection) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Store connection not found',
          });
        }

        // Verify user has access to the organization
        if (ctx.user.organizationId !== existingConnection.organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this store connection',
          });
        }

        const refreshedConnection = await connectionManager.refreshConnection(storeId);

        return {
          success: true,
          data: {
            connection: {
              id: refreshedConnection.id,
              storeId: refreshedConnection.storeId,
              storeName: refreshedConnection.storeName,
              platform: refreshedConnection.platform,
              status: refreshedConnection.status,
              lastSyncAt: refreshedConnection.lastSyncAt,
              createdAt: refreshedConnection.createdAt,
              updatedAt: refreshedConnection.updatedAt,
            },
          },
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  /**
   * Gets connection health status for all stores in organization
   */
  getConnectionHealth: protectedProcedure
    .input(z.object({
      organizationId: z.string().min(1, 'Organization ID is required'),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const { organizationId } = input;
        
        // Verify user has access to organization
        if (ctx.user.organizationId !== organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this organization',
          });
        }

        const healthStatuses = await connectionManager.checkAllConnections(organizationId);

        return {
          success: true,
          data: {
            healthStatuses,
            summary: {
              total: Object.keys(healthStatuses).length,
              healthy: Object.values(healthStatuses).filter(status => status.isValid).length,
              unhealthy: Object.values(healthStatuses).filter(status => !status.isValid).length,
            },
          },
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),

  /**
   * Gets connection metrics for monitoring
   */
  getConnectionMetrics: protectedProcedure
    .input(z.object({
      organizationId: z.string().min(1, 'Organization ID is required'),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const { organizationId } = input;
        
        // Verify user has access to organization
        if (ctx.user.organizationId !== organizationId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this organization',
          });
        }

        const metrics = await connectionManager.getConnectionMetrics(organizationId);

        return {
          success: true,
          data: metrics,
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),
});

// ============================================================================
// Health Check Router
// ============================================================================

export const healthRouter = createTRPCRouter({
  /**
   * Basic health check endpoint
   */
  check: publicProcedure
    .query(async () => {
      try {
        // Perform basic health checks
        const schedulerStatus = syncScheduler.getSchedulerStatus();
        
        return {
          success: true,
          data: {
            status: 'healthy',
            timestamp: new Date(),
            services: {
              scheduler: schedulerStatus.isRunning ? 'running' : 'stopped',
              database: 'connected', // Would check actual DB connection
              apiClient: 'ready',
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          data: {
            status: 'unhealthy',
            timestamp: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    }),

  /**
   * Detailed system status
   */
  status: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const schedulerStatus = syncScheduler.getSchedulerStatus();
        
        return {
          success: true,
          data: {
            scheduler: schedulerStatus,
            activeSyncs: syncEngine.getActiveSyncs(),
            timestamp: new Date(),
          },
        };
      } catch (error) {
        handleServiceError(error);
      }
    }),
});

// ============================================================================
// Main Router Export
// ============================================================================

export const syncStoreMvpRouter = createTRPCRouter({
  auth: authConnectionRouter,
  health: healthRouter,
});

export type SyncStoreMvpRouter = typeof syncStoreMvpRouter;