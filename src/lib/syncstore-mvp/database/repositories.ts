/**
 * SyncStore MVP Data Access Layer
 * 
 * This file implements the repository pattern for data access with
 * transaction-safe operations, bulk operations, and data consistency validation.
 */

import { eq, and, desc, asc, count, gte, lte, like, inArray } from 'drizzle-orm';
import {
  mvpStoreConnections,
  mvpProducts,
  mvpSyncStatus,
  mvpSyncLogs,
  mvpEncryptedCredentials,
  type InsertMvpStoreConnection,
  type SelectMvpStoreConnection,
  type InsertMvpProduct,
  type SelectMvpProduct,
  type InsertMvpSyncStatus,
  type SelectMvpSyncStatus,
  type InsertMvpSyncLog,
  type SelectMvpSyncLog,
  type InsertMvpEncryptedCredentials,
  type SelectMvpEncryptedCredentials,
} from './schema';
import { getMvpDb, mvpTransaction } from './connection';
import {
  DatabaseError,
  ValidationError,
  createErrorContext,
  validateData,
  StoreConnectionSchema,
  ProductSchema,
  SyncStatusSchema,
} from '../index';
import { z } from 'zod';

// ============================================================================
// Base Repository Class
// ============================================================================

abstract class BaseRepository {
  protected db = getMvpDb();

  /**
   * Handles database errors with context
   */
  protected handleError(error: unknown, operation: string, table?: string, context?: any): never {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    throw new DatabaseError(
      `${operation} failed: ${errorMessage}`,
      operation,
      table,
      createErrorContext(operation, context)
    );
  }

  /**
   * Validates data before database operations
   */
  protected validateInput<T>(schema: z.ZodSchema<T>, data: unknown, fieldName: string): T {
    try {
      return validateData(schema, data, fieldName);
    } catch (error) {
      throw new ValidationError(
        `Invalid ${fieldName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        fieldName,
        data
      );
    }
  }
}

// ============================================================================
// Store Connection Repository
// ============================================================================

export class StoreConnectionRepository extends BaseRepository {
  /**
   * Creates a new store connection
   */
  async create(data: InsertMvpStoreConnection): Promise<SelectMvpStoreConnection> {
    try {
      const [connection] = await this.db
        .insert(mvpStoreConnections)
        .values(data)
        .returning();

      if (!connection) {
        throw new Error('Failed to create store connection');
      }

      return connection;
    } catch (error) {
      this.handleError(error, 'create', 'mvp_store_connections', { storeId: data.storeId });
    }
  }

  /**
   * Gets a store connection by store ID
   */
  async getByStoreId(storeId: string): Promise<SelectMvpStoreConnection | null> {
    try {
      const [connection] = await this.db
        .select()
        .from(mvpStoreConnections)
        .where(eq(mvpStoreConnections.storeId, storeId))
        .limit(1);

      return connection || null;
    } catch (error) {
      this.handleError(error, 'getByStoreId', 'mvp_store_connections', { storeId });
    }
  }

  /**
   * Gets a store connection by ID
   */
  async getById(id: string): Promise<SelectMvpStoreConnection | null> {
    try {
      const [connection] = await this.db
        .select()
        .from(mvpStoreConnections)
        .where(eq(mvpStoreConnections.id, id))
        .limit(1);

      return connection || null;
    } catch (error) {
      this.handleError(error, 'getById', 'mvp_store_connections', { id });
    }
  }

  /**
   * Lists store connections by organization
   */
  async listByOrganization(
    organizationId: string,
    options?: { limit?: number; offset?: number; status?: string }
  ): Promise<SelectMvpStoreConnection[]> {
    try {
      let query = this.db
        .select()
        .from(mvpStoreConnections)
        .where(eq(mvpStoreConnections.organizationId, organizationId));

      if (options?.status) {
        query = query.where(and(
          eq(mvpStoreConnections.organizationId, organizationId),
          eq(mvpStoreConnections.status, options.status)
        ));
      }

      query = query.orderBy(desc(mvpStoreConnections.createdAt));

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.offset(options.offset);
      }

      return await query;
    } catch (error) {
      this.handleError(error, 'listByOrganization', 'mvp_store_connections', { organizationId, options });
    }
  }

  /**
   * Updates a store connection
   */
  async update(
    storeId: string,
    data: Partial<InsertMvpStoreConnection>
  ): Promise<SelectMvpStoreConnection> {
    try {
      const [connection] = await this.db
        .update(mvpStoreConnections)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(mvpStoreConnections.storeId, storeId))
        .returning();

      if (!connection) {
        throw new Error('Store connection not found');
      }

      return connection;
    } catch (error) {
      this.handleError(error, 'update', 'mvp_store_connections', { storeId, data });
    }
  }

  /**
   * Deletes a store connection
   */
  async delete(storeId: string): Promise<void> {
    try {
      const result = await this.db
        .delete(mvpStoreConnections)
        .where(eq(mvpStoreConnections.storeId, storeId));

      if (result.rowCount === 0) {
        throw new Error('Store connection not found');
      }
    } catch (error) {
      this.handleError(error, 'delete', 'mvp_store_connections', { storeId });
    }
  }

  /**
   * Gets connections that need health checks
   */
  async getConnectionsNeedingHealthCheck(olderThan: Date): Promise<SelectMvpStoreConnection[]> {
    try {
      return await this.db
        .select()
        .from(mvpStoreConnections)
        .where(
          and(
            eq(mvpStoreConnections.status, 'active'),
            lte(mvpStoreConnections.lastHealthCheck, olderThan)
          )
        )
        .orderBy(asc(mvpStoreConnections.lastHealthCheck));
    } catch (error) {
      this.handleError(error, 'getConnectionsNeedingHealthCheck', 'mvp_store_connections', { olderThan });
    }
  }

  /**
   * Updates health status
   */
  async updateHealthStatus(
    storeId: string,
    healthStatus: string,
    lastHealthCheck: Date = new Date()
  ): Promise<void> {
    try {
      await this.db
        .update(mvpStoreConnections)
        .set({ healthStatus, lastHealthCheck, updatedAt: new Date() })
        .where(eq(mvpStoreConnections.storeId, storeId));
    } catch (error) {
      this.handleError(error, 'updateHealthStatus', 'mvp_store_connections', { storeId, healthStatus });
    }
  }
}

// ============================================================================
// Product Repository
// ============================================================================

export class ProductRepository extends BaseRepository {
  /**
   * Creates a new product
   */
  async create(data: InsertMvpProduct): Promise<SelectMvpProduct> {
    try {
      const [product] = await this.db
        .insert(mvpProducts)
        .values(data)
        .returning();

      if (!product) {
        throw new Error('Failed to create product');
      }

      return product;
    } catch (error) {
      this.handleError(error, 'create', 'mvp_products', { 
        storeId: data.storeId, 
        platformProductId: data.platformProductId 
      });
    }
  }

  /**
   * Creates multiple products in a transaction
   */
  async createMany(products: InsertMvpProduct[]): Promise<SelectMvpProduct[]> {
    try {
      return await mvpTransaction(async (tx) => {
        const createdProducts: SelectMvpProduct[] = [];
        
        // Insert in batches to avoid parameter limits
        const batchSize = 100;
        for (let i = 0; i < products.length; i += batchSize) {
          const batch = products.slice(i, i + batchSize);
          const batchResults = await tx
            .insert(mvpProducts)
            .values(batch)
            .returning();
          
          createdProducts.push(...batchResults);
        }
        
        return createdProducts;
      });
    } catch (error) {
      this.handleError(error, 'createMany', 'mvp_products', { count: products.length });
    }
  }

  /**
   * Gets a product by store and platform product ID
   */
  async getByStoreAndPlatformId(
    storeId: string,
    platformProductId: string
  ): Promise<SelectMvpProduct | null> {
    try {
      const [product] = await this.db
        .select()
        .from(mvpProducts)
        .where(
          and(
            eq(mvpProducts.storeId, storeId),
            eq(mvpProducts.platformProductId, platformProductId)
          )
        )
        .limit(1);

      return product || null;
    } catch (error) {
      this.handleError(error, 'getByStoreAndPlatformId', 'mvp_products', { storeId, platformProductId });
    }
  }

  /**
   * Gets a product by ID
   */
  async getById(id: string): Promise<SelectMvpProduct | null> {
    try {
      const [product] = await this.db
        .select()
        .from(mvpProducts)
        .where(eq(mvpProducts.id, id))
        .limit(1);

      return product || null;
    } catch (error) {
      this.handleError(error, 'getById', 'mvp_products', { id });
    }
  }

  /**
   * Lists products by store
   */
  async listByStore(
    storeId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
      search?: string;
      sortBy?: 'name' | 'price' | 'stock' | 'lastSyncAt';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{ products: SelectMvpProduct[]; total: number }> {
    try {
      let whereConditions = eq(mvpProducts.storeId, storeId);

      // Add status filter
      if (options?.status) {
        whereConditions = and(whereConditions, eq(mvpProducts.status, options.status));
      }

      // Add search filter
      if (options?.search) {
        whereConditions = and(
          whereConditions,
          like(mvpProducts.name, `%${options.search}%`)
        );
      }

      // Get total count
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(mvpProducts)
        .where(whereConditions);

      // Build main query
      let query = this.db
        .select()
        .from(mvpProducts)
        .where(whereConditions);

      // Add sorting
      const sortColumn = options?.sortBy || 'lastSyncAt';
      const sortOrder = options?.sortOrder || 'desc';
      
      switch (sortColumn) {
        case 'name':
          query = sortOrder === 'asc' ? query.orderBy(asc(mvpProducts.name)) : query.orderBy(desc(mvpProducts.name));
          break;
        case 'price':
          query = sortOrder === 'asc' ? query.orderBy(asc(mvpProducts.price)) : query.orderBy(desc(mvpProducts.price));
          break;
        case 'stock':
          query = sortOrder === 'asc' ? query.orderBy(asc(mvpProducts.stock)) : query.orderBy(desc(mvpProducts.stock));
          break;
        default:
          query = sortOrder === 'asc' ? query.orderBy(asc(mvpProducts.lastSyncAt)) : query.orderBy(desc(mvpProducts.lastSyncAt));
      }

      // Add pagination
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.offset(options.offset);
      }

      const products = await query;

      return { products, total };
    } catch (error) {
      this.handleError(error, 'listByStore', 'mvp_products', { storeId, options });
    }
  }

  /**
   * Updates a product
   */
  async update(
    storeId: string,
    platformProductId: string,
    data: Partial<InsertMvpProduct>
  ): Promise<SelectMvpProduct> {
    try {
      const [product] = await this.db
        .update(mvpProducts)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(mvpProducts.storeId, storeId),
            eq(mvpProducts.platformProductId, platformProductId)
          )
        )
        .returning();

      if (!product) {
        throw new Error('Product not found');
      }

      return product;
    } catch (error) {
      this.handleError(error, 'update', 'mvp_products', { storeId, platformProductId, data });
    }
  }

  /**
   * Updates multiple products in a transaction
   */
  async updateMany(
    updates: Array<{
      storeId: string;
      platformProductId: string;
      data: Partial<InsertMvpProduct>;
    }>
  ): Promise<SelectMvpProduct[]> {
    try {
      return await mvpTransaction(async (tx) => {
        const updatedProducts: SelectMvpProduct[] = [];
        
        for (const update of updates) {
          const [product] = await tx
            .update(mvpProducts)
            .set({ ...update.data, updatedAt: new Date() })
            .where(
              and(
                eq(mvpProducts.storeId, update.storeId),
                eq(mvpProducts.platformProductId, update.platformProductId)
              )
            )
            .returning();
          
          if (product) {
            updatedProducts.push(product);
          }
        }
        
        return updatedProducts;
      });
    } catch (error) {
      this.handleError(error, 'updateMany', 'mvp_products', { count: updates.length });
    }
  }

  /**
   * Deletes products by store
   */
  async deleteByStore(storeId: string): Promise<number> {
    try {
      const result = await this.db
        .delete(mvpProducts)
        .where(eq(mvpProducts.storeId, storeId));

      return result.rowCount || 0;
    } catch (error) {
      this.handleError(error, 'deleteByStore', 'mvp_products', { storeId });
    }
  }

  /**
   * Deletes specific products
   */
  async deleteMany(productIds: string[]): Promise<number> {
    try {
      if (productIds.length === 0) return 0;

      const result = await this.db
        .delete(mvpProducts)
        .where(inArray(mvpProducts.id, productIds));

      return result.rowCount || 0;
    } catch (error) {
      this.handleError(error, 'deleteMany', 'mvp_products', { productIds });
    }
  }

  /**
   * Gets products that need sync (older than specified date)
   */
  async getProductsNeedingSync(
    storeId: string,
    olderThan: Date,
    limit?: number
  ): Promise<SelectMvpProduct[]> {
    try {
      let query = this.db
        .select()
        .from(mvpProducts)
        .where(
          and(
            eq(mvpProducts.storeId, storeId),
            lte(mvpProducts.lastSyncAt, olderThan)
          )
        )
        .orderBy(asc(mvpProducts.lastSyncAt));

      if (limit) {
        query = query.limit(limit);
      }

      return await query;
    } catch (error) {
      this.handleError(error, 'getProductsNeedingSync', 'mvp_products', { storeId, olderThan, limit });
    }
  }

  /**
   * Marks products as synced
   */
  async markAsSynced(productIds: string[], syncTime: Date = new Date()): Promise<void> {
    try {
      if (productIds.length === 0) return;

      await this.db
        .update(mvpProducts)
        .set({ lastSyncAt: syncTime, updatedAt: syncTime })
        .where(inArray(mvpProducts.id, productIds));
    } catch (error) {
      this.handleError(error, 'markAsSynced', 'mvp_products', { productIds, syncTime });
    }
  }

  /**
   * Gets product count by store
   */
  async getCountByStore(storeId: string, status?: string): Promise<number> {
    try {
      let whereConditions = eq(mvpProducts.storeId, storeId);

      if (status) {
        whereConditions = and(whereConditions, eq(mvpProducts.status, status));
      }

      const [{ total }] = await this.db
        .select({ total: count() })
        .from(mvpProducts)
        .where(whereConditions);

      return total;
    } catch (error) {
      this.handleError(error, 'getCountByStore', 'mvp_products', { storeId, status });
    }
  }
}

// ============================================================================
// Sync Status Repository
// ============================================================================

export class SyncStatusRepository extends BaseRepository {
  /**
   * Creates or updates sync status
   */
  async upsert(data: InsertMvpSyncStatus): Promise<SelectMvpSyncStatus> {
    try {
      const [status] = await this.db
        .insert(mvpSyncStatus)
        .values(data)
        .onConflictDoUpdate({
          target: mvpSyncStatus.storeId,
          set: {
            status: data.status,
            progress: data.progress,
            totalProducts: data.totalProducts,
            syncedProducts: data.syncedProducts,
            errors: data.errors,
            startedAt: data.startedAt,
            completedAt: data.completedAt,
            syncType: data.syncType,
            metadata: data.metadata,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!status) {
        throw new Error('Failed to upsert sync status');
      }

      return status;
    } catch (error) {
      this.handleError(error, 'upsert', 'mvp_sync_status', { storeId: data.storeId });
    }
  }

  /**
   * Gets sync status by store ID
   */
  async getByStoreId(storeId: string): Promise<SelectMvpSyncStatus | null> {
    try {
      const [status] = await this.db
        .select()
        .from(mvpSyncStatus)
        .where(eq(mvpSyncStatus.storeId, storeId))
        .limit(1);

      return status || null;
    } catch (error) {
      this.handleError(error, 'getByStoreId', 'mvp_sync_status', { storeId });
    }
  }

  /**
   * Updates sync progress
   */
  async updateProgress(
    storeId: string,
    progress: number,
    syncedProducts: number,
    errors?: string[]
  ): Promise<void> {
    try {
      const updateData: Partial<InsertMvpSyncStatus> = {
        progress,
        syncedProducts,
        updatedAt: new Date(),
      };

      if (errors) {
        updateData.errors = errors;
      }

      await this.db
        .update(mvpSyncStatus)
        .set(updateData)
        .where(eq(mvpSyncStatus.storeId, storeId));
    } catch (error) {
      this.handleError(error, 'updateProgress', 'mvp_sync_status', { storeId, progress, syncedProducts });
    }
  }

  /**
   * Completes sync operation
   */
  async completeSync(storeId: string, finalStatus: 'completed' | 'error'): Promise<void> {
    try {
      await this.db
        .update(mvpSyncStatus)
        .set({
          status: finalStatus,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mvpSyncStatus.storeId, storeId));
    } catch (error) {
      this.handleError(error, 'completeSync', 'mvp_sync_status', { storeId, finalStatus });
    }
  }

  /**
   * Gets active sync operations
   */
  async getActiveSyncs(): Promise<SelectMvpSyncStatus[]> {
    try {
      return await this.db
        .select()
        .from(mvpSyncStatus)
        .where(eq(mvpSyncStatus.status, 'syncing'))
        .orderBy(asc(mvpSyncStatus.startedAt));
    } catch (error) {
      this.handleError(error, 'getActiveSyncs', 'mvp_sync_status');
    }
  }
}

// ============================================================================
// Sync Log Repository
// ============================================================================

export class SyncLogRepository extends BaseRepository {
  /**
   * Creates a sync log entry
   */
  async create(data: InsertMvpSyncLog): Promise<SelectMvpSyncLog> {
    try {
      const [log] = await this.db
        .insert(mvpSyncLogs)
        .values(data)
        .returning();

      if (!log) {
        throw new Error('Failed to create sync log');
      }

      return log;
    } catch (error) {
      this.handleError(error, 'create', 'mvp_sync_logs', { storeId: data.storeId });
    }
  }

  /**
   * Gets sync logs by store ID
   */
  async getByStoreId(
    storeId: string,
    options?: { limit?: number; offset?: number; status?: string }
  ): Promise<SelectMvpSyncLog[]> {
    try {
      let query = this.db
        .select()
        .from(mvpSyncLogs)
        .where(eq(mvpSyncLogs.storeId, storeId));

      if (options?.status) {
        query = query.where(
          and(
            eq(mvpSyncLogs.storeId, storeId),
            eq(mvpSyncLogs.status, options.status)
          )
        );
      }

      query = query.orderBy(desc(mvpSyncLogs.startedAt));

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.offset(options.offset);
      }

      return await query;
    } catch (error) {
      this.handleError(error, 'getByStoreId', 'mvp_sync_logs', { storeId, options });
    }
  }

  /**
   * Updates a sync log
   */
  async update(id: string, data: Partial<InsertMvpSyncLog>): Promise<SelectMvpSyncLog> {
    try {
      const [log] = await this.db
        .update(mvpSyncLogs)
        .set(data)
        .where(eq(mvpSyncLogs.id, id))
        .returning();

      if (!log) {
        throw new Error('Sync log not found');
      }

      return log;
    } catch (error) {
      this.handleError(error, 'update', 'mvp_sync_logs', { id, data });
    }
  }

  /**
   * Deletes old sync logs
   */
  async deleteOlderThan(olderThan: Date): Promise<number> {
    try {
      const result = await this.db
        .delete(mvpSyncLogs)
        .where(lte(mvpSyncLogs.createdAt, olderThan));

      return result.rowCount || 0;
    } catch (error) {
      this.handleError(error, 'deleteOlderThan', 'mvp_sync_logs', { olderThan });
    }
  }
}

// ============================================================================
// Encrypted Credentials Repository
// ============================================================================

export class EncryptedCredentialsRepository extends BaseRepository {
  /**
   * Creates encrypted credentials
   */
  async create(data: InsertMvpEncryptedCredentials): Promise<SelectMvpEncryptedCredentials> {
    try {
      const [credentials] = await this.db
        .insert(mvpEncryptedCredentials)
        .values(data)
        .returning();

      if (!credentials) {
        throw new Error('Failed to create encrypted credentials');
      }

      return credentials;
    } catch (error) {
      this.handleError(error, 'create', 'mvp_encrypted_credentials');
    }
  }

  /**
   * Gets encrypted credentials by ID
   */
  async getById(id: string): Promise<SelectMvpEncryptedCredentials | null> {
    try {
      const [credentials] = await this.db
        .select()
        .from(mvpEncryptedCredentials)
        .where(eq(mvpEncryptedCredentials.id, id))
        .limit(1);

      return credentials || null;
    } catch (error) {
      this.handleError(error, 'getById', 'mvp_encrypted_credentials', { id });
    }
  }

  /**
   * Updates encrypted credentials
   */
  async update(
    id: string,
    data: Partial<InsertMvpEncryptedCredentials>
  ): Promise<SelectMvpEncryptedCredentials> {
    try {
      const [credentials] = await this.db
        .update(mvpEncryptedCredentials)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(mvpEncryptedCredentials.id, id))
        .returning();

      if (!credentials) {
        throw new Error('Encrypted credentials not found');
      }

      return credentials;
    } catch (error) {
      this.handleError(error, 'update', 'mvp_encrypted_credentials', { id, data });
    }
  }

  /**
   * Records credential usage
   */
  async recordUsage(id: string): Promise<void> {
    try {
      await this.db
        .update(mvpEncryptedCredentials)
        .set({
          lastUsedAt: new Date(),
          usageCount: mvpEncryptedCredentials.usageCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(mvpEncryptedCredentials.id, id));
    } catch (error) {
      this.handleError(error, 'recordUsage', 'mvp_encrypted_credentials', { id });
    }
  }

  /**
   * Deletes encrypted credentials
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await this.db
        .delete(mvpEncryptedCredentials)
        .where(eq(mvpEncryptedCredentials.id, id));

      if (result.rowCount === 0) {
        throw new Error('Encrypted credentials not found');
      }
    } catch (error) {
      this.handleError(error, 'delete', 'mvp_encrypted_credentials', { id });
    }
  }

  /**
   * Gets expired credentials
   */
  async getExpiredCredentials(): Promise<SelectMvpEncryptedCredentials[]> {
    try {
      return await this.db
        .select()
        .from(mvpEncryptedCredentials)
        .where(lte(mvpEncryptedCredentials.expiresAt, new Date()))
        .orderBy(asc(mvpEncryptedCredentials.expiresAt));
    } catch (error) {
      this.handleError(error, 'getExpiredCredentials', 'mvp_encrypted_credentials');
    }
  }
}

// ============================================================================
// Repository Factory
// ============================================================================

export class MvpRepositories {
  public readonly storeConnections = new StoreConnectionRepository();
  public readonly products = new ProductRepository();
  public readonly syncStatus = new SyncStatusRepository();
  public readonly syncLogs = new SyncLogRepository();
  public readonly encryptedCredentials = new EncryptedCredentialsRepository();
}

// Singleton instance
let repositories: MvpRepositories | null = null;

/**
 * Gets the singleton repositories instance
 */
export function getMvpRepositories(): MvpRepositories {
  if (!repositories) {
    repositories = new MvpRepositories();
  }
  return repositories;
}

// Export individual repositories for convenience
export const storeConnectionRepo = () => getMvpRepositories().storeConnections;
export const productRepo = () => getMvpRepositories().products;
export const syncStatusRepo = () => getMvpRepositories().syncStatus;
export const syncLogRepo = () => getMvpRepositories().syncLogs;
export const encryptedCredentialsRepo = () => getMvpRepositories().encryptedCredentials;