/**
 * Store Service
 * Handles marketplace store connections and management
 */

import { db } from '@/lib/db';
import { stores, platforms, organizations } from '@/lib/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { EncryptionService } from '@/lib/security/encryption';
import type {
  // SelectStore, // TODO: Define proper types 
  SelectStore, 
  SelectPlatform,
  StoreWithRelations,
  PlatformCredentials,
  SyncStatus 
} from '@/lib/types-patch';

export class StoreService {
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  /**
   * Connect a new store to an organization
   */
  async connectStore(data: {
    organizationId: string;
    platformId: string;
    name: string;
    platformStoreId: string;
    credentials: Record<string, any>;
    settings?: Record<string, any>;
  }): Promise<SelectStore> {
    // Verify platform exists and is active
    const platform = await db
      .select()
      .from(platforms)
      .where(and(
        eq(platforms.id, data.platformId),
        eq(platforms.isActive, true)
      ))
      .limit(1);

    if (platform.length === 0) {
      throw new Error('Platform not found or inactive');
    }

    // Check if store already exists
    const existingStore = await db
      .select()
      .from(stores)
      .where(and(
        eq(stores.platformId, data.platformId),
        eq(stores.platformStoreId, data.platformStoreId)
      ))
      .limit(1);

    if (existingStore.length > 0) {
      throw new Error('Store already connected to this platform');
    }

    // Encrypt credentials
    const encryptedCredentials = await this.encryptionService.encrypt(
      JSON.stringify(data.credentials),
      data.organizationId
    );

    // Create store record
    const [store] = await db
      .insert(stores)
      .values({
        organizationId: data.organizationId,
        platformId: data.platformId,
        name: data.name,
        platformStoreId: data.platformStoreId,
        credentials: encryptedCredentials,
        settings: data.settings || {
          autoSyncInventory: true,
          autoSyncOrders: true,
          syncIntervalMinutes: 15,
          priceMarkupPercentage: 0,
        },
        syncStatus: 'active',
        isActive: true,
      })
      .returning();

    return store;
  }

  /**
   * Get store with platform and organization data
   */
  async getStoreWithRelations(storeId: string): Promise<StoreWithRelations | null> {
    const result = await db
      .select({
        id: stores.id,
        organizationId: stores.organizationId,
        platformId: stores.platformId,
        name: stores.name,
        platformStoreId: stores.platformStoreId,
        credentials: stores.credentials,
        settings: stores.settings,
        syncStatus: stores.syncStatus,
        lastSyncAt: stores.lastSyncAt,
        isActive: stores.isActive,
        createdAt: stores.createdAt,
        updatedAt: stores.updatedAt,
        platform: {
          id: platforms.id,
          name: platforms.name,
          displayName: platforms.displayName,
          isActive: platforms.isActive,
          apiConfig: platforms.apiConfig,
          createdAt: platforms.createdAt,
        },
        organization: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          settings: organizations.settings,
          subscriptionPlan: organizations.subscriptionPlan,
          createdAt: organizations.createdAt,
          updatedAt: organizations.updatedAt,
        },
      })
      .from(stores)
      .innerJoin(platforms, eq(stores.platformId, platforms.id))
      .innerJoin(organizations, eq(stores.organizationId, organizations.id))
      .where(eq(stores.id, storeId))
      .limit(1);

    if (result.length === 0) return null;

    const store = result[0];

    return {
      ...store,
      _count: {
        products: 0, // TODO: Implement when product mappings are available
        orders: 0,   // TODO: Implement when orders are available
      },
    } as StoreWithRelations;
  }

  /**
   * Get decrypted credentials for a store
   */
  async getStoreCredentials(storeId: string, organizationId: string): Promise<Record<string, any> | null> {
    const store = await db
      .select({
        credentials: stores.credentials,
        organizationId: stores.organizationId,
      })
      .from(stores)
      .where(and(
        eq(stores.id, storeId),
        eq(stores.organizationId, organizationId)
      ))
      .limit(1);

    if (store.length === 0) return null;

    try {
      const decryptedCredentials = await this.encryptionService.decrypt(
        store[0].credentials as string,
        organizationId
      );
      return JSON.parse(decryptedCredentials);
    } catch (error) {
      console.error('Failed to decrypt store credentials:', error);
      throw new Error('Failed to decrypt store credentials');
    }
  }

  /**
   * Update store credentials
   */
  async updateStoreCredentials(
    storeId: string,
    organizationId: string,
    credentials: Record<string, any>
  ): Promise<SelectStore | null> {
    // Encrypt new credentials
    const encryptedCredentials = await this.encryptionService.encrypt(
      JSON.stringify(credentials),
      organizationId
    );

    const [store] = await db
      .update(stores)
      .set({
        credentials: encryptedCredentials,
        updatedAt: new Date(),
      })
      .where(and(
        eq(stores.id, storeId),
        eq(stores.organizationId, organizationId)
      ))
      .returning();

    return store || null;
  }

  /**
   * Update store settings
   */
  async updateStoreSettings(
    storeId: string,
    organizationId: string,
    settings: Record<string, any>
  ): Promise<SelectStore | null> {
    const [store] = await db
      .update(stores)
      .set({
        settings,
        updatedAt: new Date(),
      })
      .where(and(
        eq(stores.id, storeId),
        eq(stores.organizationId, organizationId)
      ))
      .returning();

    return store || null;
  }

  /**
   * Update store sync status
   */
  async updateSyncStatus(
    storeId: string,
    status: SyncStatus,
    lastSyncAt?: Date
  ): Promise<SelectStore | null> {
    const updateData: any = {
      syncStatus: status,
      updatedAt: new Date(),
    };

    if (lastSyncAt) {
      updateData.lastSyncAt = lastSyncAt;
    }

    const [store] = await db
      .update(stores)
      .set(updateData)
      .where(eq(stores.id, storeId))
      .returning();

    return store || null;
  }

  /**
   * Get organization stores with pagination
   */
  async getOrganizationStores(
    organizationId: string,
    options: {
      page?: number;
      limit?: number;
      platformId?: string;
      syncStatus?: SyncStatus;
      isActive?: boolean;
    } = {}
  ): Promise<{
    stores: StoreWithRelations[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, platformId, syncStatus, isActive } = options;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(stores.organizationId, organizationId)];
    
    if (platformId) {
      conditions.push(eq(stores.platformId, platformId));
    }
    
    if (syncStatus) {
      conditions.push(eq(stores.syncStatus, syncStatus));
    }
    
    if (isActive !== undefined) {
      conditions.push(eq(stores.isActive, isActive));
    }

    // Get stores with relations
    const storeResults = await db
      .select({
        id: stores.id,
        organizationId: stores.organizationId,
        platformId: stores.platformId,
        name: stores.name,
        platformStoreId: stores.platformStoreId,
        credentials: stores.credentials,
        settings: stores.settings,
        syncStatus: stores.syncStatus,
        lastSyncAt: stores.lastSyncAt,
        isActive: stores.isActive,
        createdAt: stores.createdAt,
        updatedAt: stores.updatedAt,
        platform: {
          id: platforms.id,
          name: platforms.name,
          displayName: platforms.displayName,
          isActive: platforms.isActive,
          apiConfig: platforms.apiConfig,
          createdAt: platforms.createdAt,
        },
        organization: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          settings: organizations.settings,
          subscriptionPlan: organizations.subscriptionPlan,
          createdAt: organizations.createdAt,
          updatedAt: organizations.updatedAt,
        },
      })
      .from(stores)
      .innerJoin(platforms, eq(stores.platformId, platforms.id))
      .innerJoin(organizations, eq(stores.organizationId, organizations.id))
      .where(and(...conditions))
      .orderBy(desc(stores.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(stores)
      .where(and(...conditions));

    // Add counts for each store (simplified for now)
    const storesWithCounts = storeResults.map(store => ({
      ...store,
      _count: {
        products: 0, // TODO: Implement when product mappings are available
        orders: 0,   // TODO: Implement when orders are available
      },
    })) as StoreWithRelations[];

    return {
      stores: storesWithCounts,
      total,
      page,
      limit,
    };
  }

  /**
   * Disconnect store (soft delete)
   */
  async disconnectStore(storeId: string, organizationId: string): Promise<void> {
    await db
      .update(stores)
      .set({
        isActive: false,
        syncStatus: 'paused',
        updatedAt: new Date(),
      })
      .where(and(
        eq(stores.id, storeId),
        eq(stores.organizationId, organizationId)
      ));
  }

  /**
   * Permanently delete store and all related data
   */
  async deleteStore(storeId: string, organizationId: string): Promise<void> {
    // TODO: Add cascade deletion for related data (product mappings, orders, etc.)
    await db
      .delete(stores)
      .where(and(
        eq(stores.id, storeId),
        eq(stores.organizationId, organizationId)
      ));
  }

  /**
   * Check store connection health
   */
  async checkStoreHealth(storeId: string): Promise<{
    isHealthy: boolean;
    lastChecked: Date;
    error?: string;
  }> {
    // TODO: Implement actual health check by calling platform APIs
    // For now, return a simple health status based on sync status
    const store = await db
      .select({
        syncStatus: stores.syncStatus,
        lastSyncAt: stores.lastSyncAt,
      })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);

    if (store.length === 0) {
      return {
        isHealthy: false,
        lastChecked: new Date(),
        error: 'Store not found',
      };
    }

    const isHealthy = store[0].syncStatus === 'active';
    
    return {
      isHealthy,
      lastChecked: new Date(),
      error: isHealthy ? undefined : 'Store sync is not active',
    };
  }

  /**
   * Get store metrics and statistics
   */
  async getStoreMetrics(storeId: string): Promise<{
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
    lastSyncAt: Date | null;
    syncStatus: string;
  }> {
    const store = await db
      .select({
        lastSyncAt: stores.lastSyncAt,
        syncStatus: stores.syncStatus,
      })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);

    if (store.length === 0) {
      throw new Error('Store not found');
    }

    // TODO: Implement actual metrics calculation when related tables are available
    return {
      totalProducts: 0,
      totalOrders: 0,
      totalRevenue: 0,
      lastSyncAt: store[0].lastSyncAt,
      syncStatus: store[0].syncStatus,
    };
  }

  /**
   * Get available platforms for store connection
   */
  async getAvailablePlatforms(): Promise<SelectPlatform[]> {
    return await db
      .select()
      .from(platforms)
      .where(eq(platforms.isActive, true))
      .orderBy(platforms.displayName);
  }

  /**
   * Validate store credentials format
   */
  validateCredentials(platformName: string, credentials: Record<string, any>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    switch (platformName) {
      case 'shopee':
        if (!credentials.partner_id) errors.push('Partner ID is required');
        if (!credentials.partner_key) errors.push('Partner Key is required');
        break;
      
      case 'tiktok_shop':
        if (!credentials.app_key) errors.push('App Key is required');
        if (!credentials.app_secret) errors.push('App Secret is required');
        break;
      
      case 'custom_website':
        if (!credentials.domain) errors.push('Domain is required');
        break;
      
      default:
        errors.push('Unknown platform');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Test store connection
   */
  async testConnection(
    platformName: string,
    credentials: Record<string, any>
  ): Promise<{
    success: boolean;
    error?: string;
    storeInfo?: {
      id: string;
      name: string;
      status: string;
    };
  }> {
    // Validate credentials first
    const validation = this.validateCredentials(platformName, credentials);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', '),
      };
    }

    // TODO: Implement actual platform API calls to test connection
    // For now, return a mock successful response
    return {
      success: true,
      storeInfo: {
        id: 'mock-store-id',
        name: 'Mock Store',
        status: 'active',
      },
    };
  }
}