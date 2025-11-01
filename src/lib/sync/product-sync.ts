/**
 * Product Synchronization
 * Handles bi-directional product sync between master catalog and platforms
 */

import { db } from '@/lib/db';
import { 
  products, 
  productVariants, 
  storeProductMappings,
  stores,
  platforms
} from '@/lib/db/schema';
import { eq, and, inArray, desc, isNull, or, count } from 'drizzle-orm';
import { PlatformAdapterFactory } from '@/lib/platforms/adapter-factory';
import { StoreService } from '@/lib/services/store-service';
import { ProductService } from '@/lib/services/product-service';
import { ProductMappingService } from '@/lib/services/product-mapping-service';
import { ProductConflictService } from '@/lib/services/product-conflict-service';
import { defaultConflictResolver, ConflictData } from './conflict-resolver';
import type { 
  PlatformProduct, 
  PlatformProductVariant,
  SelectProduct,
  SelectProductVariant,
  ProductWithVariants,
  SelectStoreProductMapping
} from '@/lib/types-patch';

export interface ProductSyncOptions {
  direction: 'push' | 'pull' | 'bidirectional';
  batchSize?: number;
  conflictResolution?: 'platform_wins' | 'local_wins' | 'newest_wins' | 'merge' | 'manual_review';
  dryRun?: boolean;
  productIds?: string[];
  platformProductIds?: string[];
  forceSync?: boolean; // Force sync even if no changes detected
  syncVariants?: boolean; // Whether to sync product variants
  syncPricing?: boolean; // Whether to sync pricing information
  syncImages?: boolean; // Whether to sync product images
  transformationRules?: ProductTransformationRules;
}

export interface ProductSyncResult {
  totalProcessed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  conflicts: Array<{
    productId: string;
    field: string;
    localValue: any;
    platformValue: any;
    resolution: string;
  }>;
  errors: Array<{
    productId: string;
    error: string;
  }>;
}

export interface ProductMapping {
  id: string;
  storeId: string;
  localProductId: string;
  localVariantId: string;
  platformProductId: string;
  platformVariantId?: string;
  platformSku?: string;
  price: number;
  compareAtPrice?: number;
  isActive: boolean;
  lastSyncAt: Date;
  syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductTransformationRules {
  fieldMappings: Record<string, string>; // local field -> platform field
  valueTransformations: Record<string, (value: any) => any>;
  requiredFields: string[];
  optionalFields: string[];
  platformSpecificFields: Record<string, any>;
}

export interface ProductSyncConflict {
  id: string;
  storeId: string;
  productId: string;
  variantId?: string;
  field: string;
  localValue: any;
  platformValue: any;
  conflictType: 'field_mismatch' | 'missing_local' | 'missing_platform' | 'validation_error';
  status: 'pending' | 'resolved' | 'ignored';
  resolution?: 'use_local' | 'use_platform' | 'merge' | 'custom';
  resolvedValue?: any;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export class ProductSyncService {
  private storeService: StoreService;
  private productService: ProductService;
  private mappingService: ProductMappingService;
  private conflictService: ProductConflictService;

  constructor() {
    this.storeService = new StoreService();
    this.productService = new ProductService();
    this.mappingService = new ProductMappingService();
    this.conflictService = new ProductConflictService();
  }

  /**
   * Synchronize products for a store
   */
  async syncProducts(
    storeId: string,
    organizationId: string,
    options: ProductSyncOptions = { direction: 'bidirectional' }
  ): Promise<ProductSyncResult> {
    const result: ProductSyncResult = {
      totalProcessed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      conflicts: [],
      errors: [],
    };

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

      // Sync based on direction
      switch (options.direction) {
        case 'push':
          return await this.pushProductsToPlatform(store, adapter, options, result);
        case 'pull':
          return await this.pullProductsFromPlatform(store, adapter, options, result);
        case 'bidirectional':
          // First pull, then push to handle conflicts
          const pullResult = await this.pullProductsFromPlatform(store, adapter, options, result);
          const pushResult = await this.pushProductsToPlatform(store, adapter, options, pullResult);
          return pushResult;
        default:
          throw new Error(`Invalid sync direction: ${options.direction}`);
      }

    } catch (error) {
      result.errors.push({
        productId: 'general',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return result;
    }
  }

  /**
   * Push local products to platform
   */
  private async pushProductsToPlatform(
    store: any,
    adapter: any,
    options: ProductSyncOptions,
    result: ProductSyncResult
  ): Promise<ProductSyncResult> {
    // Get local products to sync
    const localProducts = await this.getLocalProductsToSync(
      store.organizationId,
      options.productIds
    );

    const batchSize = options.batchSize || 10;
    
    for (let i = 0; i < localProducts.length; i += batchSize) {
      const batch = localProducts.slice(i, i + batchSize);
      
      for (const localProduct of batch) {
        try {
          result.totalProcessed++;
          
          // Check if product already exists on platform
          const mapping = await this.getProductMapping(store.id, localProduct.id);
          
          if (mapping) {
            // Update existing product
            await this.updatePlatformProduct(
              adapter,
              mapping.platformProductId,
              localProduct,
              options,
              result,
              store
            );
          } else {
            // Create new product on platform
            await this.createPlatformProduct(
              adapter,
              store.id,
              localProduct,
              options,
              result,
              store
            );
          }

        } catch (error) {
          result.failed++;
          result.errors.push({
            productId: localProduct.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return result;
  }

  /**
   * Pull products from platform to local
   */
  private async pullProductsFromPlatform(
    store: any,
    adapter: any,
    options: ProductSyncOptions,
    result: ProductSyncResult
  ): Promise<ProductSyncResult> {
    try {
      // Get platform products
      const platformResponse = await adapter.getProducts({
        limit: options.batchSize || 50,
      });

      if (!platformResponse.success) {
        throw new Error(`Failed to fetch platform products: ${platformResponse.error?.message}`);
      }

      const platformProducts = platformResponse.data.items;

      for (const platformProduct of platformProducts) {
        try {
          result.totalProcessed++;

          // Check if product already exists locally
          const mapping = await this.getPlatformProductMapping(store.id, platformProduct.platformProductId);
          
          if (mapping) {
            // Update existing local product
            await this.updateLocalProduct(
              mapping.localProductId,
              platformProduct,
              store.organizationId,
              options,
              result,
              store
            );
          } else {
            // Create new local product
            await this.createLocalProduct(
              platformProduct,
              store,
              options,
              result
            );
          }

        } catch (error) {
          result.failed++;
          result.errors.push({
            productId: platformProduct.platformProductId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

    } catch (error) {
      result.errors.push({
        productId: 'platform_fetch',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return result;
  }

  /**
   * Create product on platform
   */
  private async createPlatformProduct(
    adapter: any,
    storeId: string,
    localProduct: ProductWithVariants,
    options: ProductSyncOptions,
    result: ProductSyncResult,
    store?: any
  ): Promise<void> {
    if (options.dryRun) {
      result.created++;
      return;
    }

    try {
      // Get platform name for transformation
      const platformName = store?.platform?.name || 'generic';

      // Transform local product to platform format
      const platformProduct = this.transformLocalToPlatform(
        localProduct, 
        platformName, 
        options.transformationRules
      );

      // Validate product data for platform
      const validation = this.validateProductForPlatform(platformProduct, platformName, options.transformationRules);
      if (!validation.isValid) {
        throw new Error(`Product validation failed: ${validation.errors.join(', ')}`);
      }

      const response = await adapter.createProduct(platformProduct);
      
      if (!response.success) {
        throw new Error(`Failed to create platform product: ${response.error?.message}`);
      }

      // Create product mappings for each variant
      if (response.data.variants && localProduct.variants) {
        for (let i = 0; i < Math.min(response.data.variants.length, localProduct.variants.length); i++) {
          const platformVariant = response.data.variants[i];
          const localVariant = localProduct.variants[i];

          await this.createProductMapping(
            storeId,
            localProduct.id,
            response.data.platformProductId,
            localVariant.id,
            platformVariant.platformVariantId,
            platformVariant.price || parseFloat(localVariant.costPrice || '0')
          );
        }
      } else if (localProduct.variants.length > 0) {
        // Create mapping for first variant if no platform variants returned
        await this.createProductMapping(
          storeId,
          localProduct.id,
          response.data.platformProductId,
          localProduct.variants[0].id,
          undefined,
          parseFloat(localProduct.variants[0].costPrice || '0')
        );
      }

      result.created++;
    } catch (error) {
      // Log detailed error for debugging
      console.error('Failed to create platform product:', {
        productId: localProduct.id,
        productName: localProduct.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update product on platform
   */
  private async updatePlatformProduct(
    adapter: any,
    platformProductId: string,
    localProduct: ProductWithVariants,
    options: ProductSyncOptions,
    result: ProductSyncResult,
    store?: any
  ): Promise<void> {
    if (options.dryRun) {
      result.updated++;
      return;
    }

    try {
      // Get current platform product
      const platformResponse = await adapter.getProduct(platformProductId);
      if (!platformResponse.success) {
        throw new Error(`Failed to fetch platform product: ${platformResponse.error?.message}`);
      }

      const platformProduct = platformResponse.data;
      const platformName = store?.platform?.name || 'generic';

      // Detect conflicts
      const conflicts = this.detectProductConflicts(localProduct, platformProduct);
      
      if (conflicts.length > 0) {
        const resolvedConflicts = await this.resolveProductConflicts(
          conflicts,
          options.conflictResolution || 'manual_review'
        );

        // Add conflicts to result
        result.conflicts.push(...resolvedConflicts.map(conflict => ({
          productId: localProduct.id,
          field: conflict.field,
          localValue: conflict.localValue,
          platformValue: conflict.platformValue,
          resolution: conflict.strategy,
        })));

        // Create conflict records for manual review if needed
        for (const conflict of resolvedConflicts) {
          if (conflict.requiresManualReview) {
            await this.createConflictRecord(
              store.id,
              localProduct.id,
              localProduct.variants[0]?.id,
              conflict.field,
              conflict.localValue,
              conflict.platformValue,
              'field_mismatch'
            );
          }
        }

        // Apply resolved values only if auto-resolved
        const autoResolvedConflicts = resolvedConflicts.filter(c => !c.requiresManualReview);
        if (autoResolvedConflicts.length > 0) {
          const updatedProduct = this.applyConflictResolutions(localProduct, autoResolvedConflicts);
          const platformUpdateData = this.transformLocalToPlatform(
            updatedProduct, 
            platformName, 
            options.transformationRules
          );

          // Validate before updating
          const validation = this.validateProductForPlatform(platformUpdateData, platformName, options.transformationRules);
          if (!validation.isValid) {
            throw new Error(`Product validation failed: ${validation.errors.join(', ')}`);
          }

          const updateResponse = await adapter.updateProduct(platformProductId, platformUpdateData);
          if (!updateResponse.success) {
            throw new Error(`Failed to update platform product: ${updateResponse.error?.message}`);
          }
        }
      } else {
        // No conflicts, proceed with normal update
        const platformUpdateData = this.transformLocalToPlatform(
          localProduct, 
          platformName, 
          options.transformationRules
        );

        // Validate before updating
        const validation = this.validateProductForPlatform(platformUpdateData, platformName, options.transformationRules);
        if (!validation.isValid) {
          throw new Error(`Product validation failed: ${validation.errors.join(', ')}`);
        }

        const updateResponse = await adapter.updateProduct(platformProductId, platformUpdateData);
        if (!updateResponse.success) {
          throw new Error(`Failed to update platform product: ${updateResponse.error?.message}`);
        }
      }

      result.updated++;
    } catch (error) {
      console.error('Failed to update platform product:', {
        productId: localProduct.id,
        platformProductId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create local product from platform data
   */
  private async createLocalProduct(
    platformProduct: PlatformProduct,
    store: any,
    options: ProductSyncOptions,
    result: ProductSyncResult
  ): Promise<void> {
    if (options.dryRun) {
      result.created++;
      return;
    }

    try {
      const platformName = store?.platform?.name || 'generic';

      // Transform platform product to local format
      const localProductData = this.transformPlatformToLocal(
        platformProduct, 
        platformName, 
        options.transformationRules
      );

      const localProduct = await this.productService.createProduct({
        organizationId: store.organizationId,
        ...localProductData,
      });

      // Create product mappings for each variant
      if (platformProduct.variants && localProduct.variants) {
        for (let i = 0; i < Math.min(platformProduct.variants.length, localProduct.variants.length); i++) {
          const platformVariant = platformProduct.variants[i];
          const localVariant = localProduct.variants[i];

          await this.createProductMapping(
            store.id,
            localProduct.id,
            platformProduct.platformProductId,
            localVariant.id,
            platformVariant.platformVariantId,
            platformVariant.price,
            platformVariant.compareAtPrice
          );
        }
      } else if (localProduct.variants.length > 0) {
        // Create mapping for first variant if no platform variants
        await this.createProductMapping(
          store.id,
          localProduct.id,
          platformProduct.platformProductId,
          localProduct.variants[0].id,
          undefined,
          platformProduct.variants[0]?.price || 0
        );
      }

      result.created++;
    } catch (error) {
      console.error('Failed to create local product:', {
        platformProductId: platformProduct.platformProductId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update local product with platform data
   */
  private async updateLocalProduct(
    localProductId: string,
    platformProduct: PlatformProduct,
    organizationId: string,
    options: ProductSyncOptions,
    result: ProductSyncResult,
    store?: any
  ): Promise<void> {
    if (options.dryRun) {
      result.updated++;
      return;
    }

    try {
      // Get current local product
      const localProduct = await this.productService.getProductWithVariants(localProductId, organizationId);
      if (!localProduct) {
        throw new Error('Local product not found');
      }

      // Detect conflicts
      const conflicts = this.detectProductConflicts(localProduct, platformProduct);
      
      if (conflicts.length > 0) {
        const resolvedConflicts = await this.resolveProductConflicts(
          conflicts,
          options.conflictResolution || 'manual_review'
        );

        // Add conflicts to result
        result.conflicts.push(...resolvedConflicts.map(conflict => ({
          productId: localProductId,
          field: conflict.field,
          localValue: conflict.localValue,
          platformValue: conflict.platformValue,
          resolution: conflict.strategy,
        })));

        // Create conflict records for manual review if needed
        for (const conflict of resolvedConflicts) {
          if (conflict.requiresManualReview) {
            await this.createConflictRecord(
              store?.id || '',
              localProductId,
              localProduct.variants[0]?.id,
              conflict.field,
              conflict.localValue,
              conflict.platformValue,
              'field_mismatch'
            );
          }
        }

        // Apply resolved values to local product (only auto-resolved)
        const autoResolvedConflicts = resolvedConflicts.filter(c => !c.requiresManualReview);
        if (autoResolvedConflicts.length > 0) {
          const resolvedData = this.extractResolvedValues(autoResolvedConflicts);
          
          await this.productService.updateProduct(
            localProductId,
            organizationId,
            resolvedData
          );
        }
      } else {
        // No conflicts, apply platform data directly
        const platformName = store?.platform?.name || 'generic';
        const localProductData = this.transformPlatformToLocal(
          platformProduct, 
          platformName, 
          options.transformationRules
        );

        await this.productService.updateProduct(
          localProductId,
          organizationId,
          localProductData
        );
      }

      result.updated++;
    } catch (error) {
      console.error('Failed to update local product:', {
        localProductId,
        platformProductId: platformProduct.platformProductId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get local products to sync
   */
  private async getLocalProductsToSync(
    organizationId: string,
    productIds?: string[]
  ): Promise<ProductWithVariants[]> {
    const searchOptions: any = {
      page: 1,
      limit: 1000, // Large limit for sync
    };

    const result = await this.productService.searchProducts(organizationId, searchOptions);
    
    if (productIds) {
      return result.data.filter(product => productIds.includes(product.id));
    }

    return result.data;
  }

  /**
   * Transform local product to platform format
   */
  private transformLocalToPlatform(
    localProduct: ProductWithVariants, 
    platform?: string,
    customRules?: ProductTransformationRules
  ): Partial<PlatformProduct> {
    // Use enhanced transformation if platform is specified
    if (platform) {
      const transformed = this.transformProductForPlatform(localProduct, platform, customRules);
      
      return {
        name: transformed.name || localProduct.name,
        description: transformed.description || localProduct.description || '',
        // category: transformed.category || localProduct.category || '', // Removed - not in PlatformProduct type
        brand: transformed.brand || transformed.brand_name || localProduct.brand || '',
        images: transformed.images || (Array.isArray(localProduct.images) ? localProduct.images as string[] : []),
        variants: transformed.variants || localProduct.variants.map(variant => ({
          name: variant.name,
          sku: variant.variantSku,
          price: parseFloat(String(variant.costPrice || '0')),
          attributes: variant.attributes as Record<string, any> || {},
          images: Array.isArray(variant.images) ? variant.images as string[] : [],
          status: variant.isActive ? 'active' : 'inactive',
          inventory: {
            quantity: 0, // Will be handled by inventory sync
            tracked: true,
          },
        } as PlatformProductVariant)),
        status: localProduct.isActive ? 'active' : 'inactive',
        platformData: transformed,
      };
    }

    // Fallback to basic transformation
    return {
      name: localProduct.name,
      description: localProduct.description || '',
      category: localProduct.category || '',
      brand: localProduct.brand || '',
      images: Array.isArray(localProduct.images) ? localProduct.images as string[] : [],
      variants: localProduct.variants.map(variant => ({
        name: variant.name,
        sku: variant.variantSku,
        price: parseFloat(String(variant.costPrice || '0')),
        attributes: variant.attributes as Record<string, any> || {},
        images: Array.isArray(variant.images) ? variant.images as string[] : [],
        status: variant.isActive ? 'active' : 'inactive',
        inventory: {
          quantity: 0, // Will be handled by inventory sync
          tracked: true,
        },
      } as PlatformProductVariant)),
      status: localProduct.isActive ? 'active' : 'inactive',
      platformData: {},
    };
  }

  /**
   * Transform platform product to local format
   */
  private transformPlatformToLocal(
    platformProduct: PlatformProduct, 
    platform?: string,
    customRules?: ProductTransformationRules
  ): any {
    // Use enhanced transformation if platform is specified
    if (platform) {
      return this.transformPlatformProductToLocal(platformProduct, platform, customRules);
    }

    // Fallback to basic transformation
    return {
      name: platformProduct.name,
      description: platformProduct.description,
      category: platformProduct.category,
      // brand: platformProduct.brand, // Removed - not in PlatformProduct type
      images: platformProduct.images,
      variants: platformProduct.variants?.map(variant => ({
        name: variant.name,
        variantSku: variant.sku,
        costPrice: variant.price,
        attributes: variant.attributes,
        // images: variant.images, // Removed - not in PlatformProductVariant type
      })),
    };
  }

  /**
   * Detect conflicts between local and platform products
   */
  private detectProductConflicts(
    localProduct: ProductWithVariants,
    platformProduct: PlatformProduct
  ): ConflictData[] {
    const conflicts: ConflictData[] = [];
    const now = new Date();

    // Compare basic fields
    if (localProduct.name !== platformProduct.name) {
      conflicts.push({
        field: 'name',
        localValue: localProduct.name,
        platformValue: platformProduct.name,
        lastModified: {
          local: localProduct.updatedAt,
          platform: now, // Platform doesn't provide last modified
        },
      });
    }

    if (localProduct.description !== platformProduct.description) {
      conflicts.push({
        field: 'description',
        localValue: localProduct.description,
        platformValue: platformProduct.description,
        lastModified: {
          local: localProduct.updatedAt,
          platform: now,
        },
      });
    }

    // Compare images
    const localImages = Array.isArray(localProduct.images) ? localProduct.images as string[] : [];
    if (JSON.stringify(localImages.sort()) !== JSON.stringify(platformProduct.images.sort())) {
      conflicts.push({
        field: 'images',
        localValue: localImages,
        platformValue: platformProduct.images,
        lastModified: {
          local: localProduct.updatedAt,
          platform: now,
        },
      });
    }

    return conflicts;
  }

  /**
   * Resolve product conflicts using conflict resolver
   */
  private async resolveProductConflicts(
    conflicts: ConflictData[],
    strategy: string
  ): Promise<Array<ConflictData & { resolvedValue: any; strategy: string }>> {
    const resolver = defaultConflictResolver;
    
    // Update resolver strategy if needed
    if (strategy !== 'manual_review') {
      resolver.updateConfig({
        defaultStrategy: strategy as any,
      });
    }

    const { resolved } = resolver.resolveConflicts(conflicts);
    return resolved;
  }

  /**
   * Apply conflict resolutions to product data
   */
  private applyConflictResolutions(
    product: ProductWithVariants,
    resolutions: Array<ConflictData & { resolvedValue: any }>
  ): ProductWithVariants {
    const updatedProduct = { ...product };

    for (const resolution of resolutions) {
      switch (resolution.field) {
        case 'name':
          updatedProduct.name = resolution.resolvedValue;
          break;
        case 'description':
          updatedProduct.description = resolution.resolvedValue;
          break;
        case 'images':
          updatedProduct.images = resolution.resolvedValue;
          break;
      }
    }

    return updatedProduct;
  }

  /**
   * Extract resolved values for database update
   */
  private extractResolvedValues(
    resolutions: Array<ConflictData & { resolvedValue: any }>
  ): Record<string, any> {
    const updates: Record<string, any> = {};

    for (const resolution of resolutions) {
      updates[resolution.field] = resolution.resolvedValue;
    }

    return updates;
  }

  /**
   * Create product mapping
   */
  private async createProductMapping(
    storeId: string,
    localProductId: string,
    platformProductId: string,
    localVariantId?: string,
    platformVariantId?: string,
    price?: number,
    compareAtPrice?: number
  ): Promise<void> {
    await db.insert(storeProductMappings).values({
      storeId,
      productVariantId: localVariantId || localProductId, // Use product ID if no variant
      platformProductId,
      platformVariantId,
      price: (price || 0).toString(),
      compareAtPrice: compareAtPrice?.toString(),
      isActive: true,
      lastSyncAt: new Date(),
      syncStatus: 'synced',
    });
  }
}
