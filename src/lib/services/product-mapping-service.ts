/**
 * Product Mapping Service
 * Manages mappings between local products and platform-specific product IDs
 */

import { db } from '@/lib/db';
import {
    storeProductMappings,
    products,
    productVariants,
    stores,
    platforms
} from '@/lib/db/schema';
import { eq, and, desc, count, isNull, or, like } from 'drizzle-orm';
import type {
    SelectStoreProductMapping,
    ProductWithVariants,
    PaginatedResponse
} from '@/lib/types-patch';

export interface ProductMappingWithDetails extends SelectStoreProductMapping {
    product?: {
        id: string;
        name: string | null;
        sku: string;
        isActive: boolean;
    };
    variant?: {
        id: string;
        name: string | null;
        variantSku: string;
        isActive: boolean;
    };
    store?: {
        id: string;
        name: string;
        platformName: string;
    };
}

export interface CreateMappingInput {
    storeId: string;
    productVariantId: string;
    platformProductId: string;
    platformVariantId?: string;
    platformSku?: string;
    price: number;
    compareAtPrice?: number;
}

export interface UpdateMappingInput {
    platformProductId?: string;
    platformVariantId?: string;
    platformSku?: string;
    price?: number;
    compareAtPrice?: number;
    isActive?: boolean;
    syncStatus?: 'pending' | 'synced' | 'error';
}

export interface MappingFilters {
    storeId?: string;
    syncStatus?: string;
    isActive?: boolean;
    platformProductId?: string;
    search?: string; // Search by product name, SKU, or platform ID
}

export class ProductMappingService {
    /**
     * Create a new product mapping
     */
    async createMapping(data: CreateMappingInput): Promise<SelectStoreProductMapping> {
        // Check if mapping already exists
        const existing = await db
            .select()
            .from(storeProductMappings)
            .where(and(
                eq(storeProductMappings.storeId, data.storeId),
                eq(storeProductMappings.productVariantId, data.productVariantId),
                eq(storeProductMappings.platformProductId, data.platformProductId)
            ))
            .limit(1);

        if (existing.length > 0) {
            throw new Error('Product mapping already exists');
        }

        const [mapping] = await db
            .insert(storeProductMappings)
            .values({
                storeId: data.storeId,
                productVariantId: data.productVariantId,
                platformProductId: data.platformProductId,
                platformVariantId: data.platformVariantId,
                platformSku: data.platformSku,
                price: data.price.toString(),
                compareAtPrice: data.compareAtPrice?.toString(),
                isActive: true,
                syncStatus: 'pending',
                lastSyncAt: null,
            })
            .returning();

        return mapping;
    }

    /**
     * Get mapping by ID
     */
    async getMappingById(mappingId: string): Promise<ProductMappingWithDetails | null> {
        const result = await db
            .select({
                mapping: storeProductMappings,
                product: {
                    id: products.id,
                    name: products.name,
                    sku: products.sku,
                    isActive: products.isActive,
                },
                variant: {
                    id: productVariants.id,
                    name: productVariants.name,
                    variantSku: productVariants.variantSku,
                    isActive: productVariants.isActive,
                },
                store: {
                    id: stores.id,
                    name: stores.name,
                    platformName: platforms.name,
                },
            })
            .from(storeProductMappings)
            .innerJoin(productVariants, eq(storeProductMappings.productVariantId, productVariants.id))
            .innerJoin(products, eq(productVariants.productId, products.id))
            .innerJoin(stores, eq(storeProductMappings.storeId, stores.id))
            .innerJoin(platforms, eq(stores.platformId, platforms.id))
            .where(eq(storeProductMappings.id, mappingId))
            .limit(1);

        if (result.length === 0) return null;

        const row = result[0];
        return {
            id: row.mapping.id,
            storeId: row.mapping.storeId,
            productVariantId: row.mapping.productVariantId,
            platformProductId: row.mapping.platformProductId,
            platformVariantId: row.mapping.platformVariantId,
            platformSku: row.mapping.platformSku,
            price: row.mapping.price,
            compareAtPrice: row.mapping.compareAtPrice,
            isActive: row.mapping.isActive,
            syncStatus: row.mapping.syncStatus,
            lastSyncAt: row.mapping.lastSyncAt,
            createdAt: row.mapping.createdAt,
            updatedAt: row.mapping.updatedAt,
            product: row.product,
            variant: row.variant,
            store: row.store,
        };
    }

    /**
     * Get mappings with filters and pagination
     */
    async getMappings(
        organizationId: string,
        filters: MappingFilters = {},
        pagination: { page?: number; limit?: number } = {}
    ): Promise<PaginatedResponse<ProductMappingWithDetails>> {
        const { page = 1, limit = 20 } = pagination;
        const offset = (page - 1) * limit;

        // Build where conditions
        const conditions = [eq(products.organizationId, organizationId)];

        if (filters.storeId) {
            conditions.push(eq(storeProductMappings.storeId, filters.storeId));
        }

        if (filters.syncStatus) {
            conditions.push(eq(storeProductMappings.syncStatus, filters.syncStatus));
        }

        if (filters.isActive !== undefined) {
            conditions.push(eq(storeProductMappings.isActive, filters.isActive));
        }

        if (filters.platformProductId) {
            conditions.push(eq(storeProductMappings.platformProductId, filters.platformProductId));
        }

        if (filters.search) {
            conditions.push(
                or(
                    like(products.name, `%${filters.search}%`),
                    like(products.sku, `%${filters.search}%`),
                    like(productVariants.variantSku, `%${filters.search}%`),
                    like(storeProductMappings.platformProductId, `%${filters.search}%`),
                    like(storeProductMappings.platformSku, `%${filters.search}%`)
                )!
            );
        }

        // Get total count
        const [{ total }] = await db
            .select({ total: count() })
            .from(storeProductMappings)
            .innerJoin(productVariants, eq(storeProductMappings.productVariantId, productVariants.id))
            .innerJoin(products, eq(productVariants.productId, products.id))
            .where(and(...conditions));

        // Get mappings
        const results = await db
            .select({
                mapping: storeProductMappings,
                product: {
                    id: products.id,
                    name: products.name,
                    sku: products.sku,
                    isActive: products.isActive,
                },
                variant: {
                    id: productVariants.id,
                    name: productVariants.name,
                    variantSku: productVariants.variantSku,
                    isActive: productVariants.isActive,
                },
                store: {
                    id: stores.id,
                    name: stores.name,
                    platformName: platforms.name,
                },
            })
            .from(storeProductMappings)
            .innerJoin(productVariants, eq(storeProductMappings.productVariantId, productVariants.id))
            .innerJoin(products, eq(productVariants.productId, products.id))
            .innerJoin(stores, eq(storeProductMappings.storeId, stores.id))
            .innerJoin(platforms, eq(stores.platformId, platforms.id))
            .where(and(...conditions))
            .orderBy(desc(storeProductMappings.updatedAt))
            .limit(limit)
            .offset(offset);

        const mappings = results.map(row => ({
            id: row.mapping.id,
            storeId: row.mapping.storeId,
            productVariantId: row.mapping.productVariantId,
            platformProductId: row.mapping.platformProductId,
            platformVariantId: row.mapping.platformVariantId,
            platformSku: row.mapping.platformSku,
            price: row.mapping.price,
            compareAtPrice: row.mapping.compareAtPrice,
            isActive: row.mapping.isActive,
            syncStatus: row.mapping.syncStatus,
            lastSyncAt: row.mapping.lastSyncAt,
            createdAt: row.mapping.createdAt,
            updatedAt: row.mapping.updatedAt,
            product: row.product,
            variant: row.variant,
            store: row.store,
        }));

        return {
            data: mappings,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1,
                hasPrevious: page > 1,
            },
        };
    }

    /**
     * Update mapping
     */
    async updateMapping(
        mappingId: string,
        updates: UpdateMappingInput
    ): Promise<SelectStoreProductMapping | null> {
        const updateData: any = {
            ...updates,
            updatedAt: new Date(),
        };

        // Convert numbers to strings for decimal fields
        if (updates.price !== undefined) {
            updateData.price = updates.price.toString();
        }
        if (updates.compareAtPrice !== undefined) {
            updateData.compareAtPrice = updates.compareAtPrice.toString();
        }

        // Update sync time if status is being set to synced
        if (updates.syncStatus === 'synced') {
            updateData.lastSyncAt = new Date();
        }

        const [mapping] = await db
            .update(storeProductMappings)
            .set(updateData)
            .where(eq(storeProductMappings.id, mappingId))
            .returning();

        return mapping || null;
    }

    /**
     * Delete mapping
     */
    async deleteMapping(mappingId: string): Promise<void> {
        await db
            .delete(storeProductMappings)
            .where(eq(storeProductMappings.id, mappingId));
    }

    /**
     * Get mapping by store and platform product ID
     */
    async getMappingByPlatformId(
        storeId: string,
        platformProductId: string,
        platformVariantId?: string
    ): Promise<SelectStoreProductMapping | null> {
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
     * Get mapping by local product variant
     */
    async getMappingByVariant(
        storeId: string,
        productVariantId: string
    ): Promise<SelectStoreProductMapping | null> {
        const result = await db
            .select()
            .from(storeProductMappings)
            .where(and(
                eq(storeProductMappings.storeId, storeId),
                eq(storeProductMappings.productVariantId, productVariantId)
            ))
            .limit(1);

        return result[0] || null;
    }

    /**
     * Get unmapped products for a store
     */
    async getUnmappedProducts(
        storeId: string,
        organizationId: string,
        pagination: { page?: number; limit?: number } = {}
    ): Promise<PaginatedResponse<ProductWithVariants>> {
        const { page = 1, limit = 20 } = pagination;
        const offset = (page - 1) * limit;

        // Get product variants that don't have mappings for this store
        const unmappedVariantIds = await db
            .select({ variantId: productVariants.id })
            .from(productVariants)
            .innerJoin(products, eq(productVariants.productId, products.id))
            .leftJoin(
                storeProductMappings,
                and(
                    eq(storeProductMappings.productVariantId, productVariants.id),
                    eq(storeProductMappings.storeId, storeId)
                )
            )
            .where(and(
                eq(products.organizationId, organizationId),
                eq(products.isActive, true),
                eq(productVariants.isActive, true),
                isNull(storeProductMappings.id)
            ));

        // Get unique product IDs from unmapped variants
        const productIds = [...new Set(
            unmappedVariantIds.map(v => v.variantId)
        )];

        const total = productIds.length;

        // This is a simplified implementation. In a real scenario, you'd want to
        // optimize this by fetching products directly with the unmapped condition
        const unmappedProducts: ProductWithVariants[] = [];

        // For now, return empty result with proper pagination structure
        return {
            data: unmappedProducts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1,
                hasPrevious: page > 1,
            },
        };
    }

    /**
     * Bulk create mappings
     */
    async bulkCreateMappings(
        mappings: CreateMappingInput[]
    ): Promise<{
        success: number;
        failed: number;
        errors: Array<{ index: number; error: string }>;
    }> {
        const results = {
            success: 0,
            failed: 0,
            errors: [] as Array<{ index: number; error: string }>,
        };

        for (let i = 0; i < mappings.length; i++) {
            try {
                await this.createMapping(mappings[i]);
                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    index: i,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return results;
    }

    /**
     * Bulk update mapping sync status
     */
    async bulkUpdateSyncStatus(
        mappingIds: string[],
        syncStatus: 'pending' | 'synced' | 'error'
    ): Promise<number> {
        const updateData: any = {
            syncStatus,
            updatedAt: new Date(),
        };

        if (syncStatus === 'synced') {
            updateData.lastSyncAt = new Date();
        }

        // For now, update each mapping individually
        // In a real implementation, you'd want to use a proper bulk update
        let updatedCount = 0;
        for (const mappingId of mappingIds) {
            try {
                await db
                    .update(storeProductMappings)
                    .set(updateData)
                    .where(eq(storeProductMappings.id, mappingId));
                updatedCount++;
            } catch (error) {
                // Continue with other mappings even if one fails
                console.error(`Failed to update mapping ${mappingId}:`, error);
            }
        }

        return updatedCount;
    }

    /**
     * Get mapping statistics for a store
     */
    async getMappingStatistics(storeId: string): Promise<{
        totalMappings: number;
        activeMappings: number;
        syncedMappings: number;
        pendingMappings: number;
        errorMappings: number;
        lastSyncAt?: Date;
    }> {
        const mappings = await db
            .select({
                isActive: storeProductMappings.isActive,
                syncStatus: storeProductMappings.syncStatus,
                lastSyncAt: storeProductMappings.lastSyncAt,
            })
            .from(storeProductMappings)
            .where(eq(storeProductMappings.storeId, storeId));

        const stats = {
            totalMappings: mappings.length,
            activeMappings: 0,
            syncedMappings: 0,
            pendingMappings: 0,
            errorMappings: 0,
            lastSyncAt: undefined as Date | undefined,
        };

        let latestSync: Date | undefined;

        for (const mapping of mappings) {
            if (mapping.isActive) {
                stats.activeMappings++;
            }

            switch (mapping.syncStatus) {
                case 'synced':
                    stats.syncedMappings++;
                    break;
                case 'pending':
                    stats.pendingMappings++;
                    break;
                case 'error':
                    stats.errorMappings++;
                    break;
            }

            if (mapping.lastSyncAt && (!latestSync || mapping.lastSyncAt > latestSync)) {
                latestSync = mapping.lastSyncAt;
            }
        }

        stats.lastSyncAt = latestSync;

        return stats;
    }

    /**
     * Sync mapping prices from platform
     */
    async syncMappingPrices(
        storeId: string,
        platformPrices: Array<{
            platformProductId: string;
            platformVariantId?: string;
            price: number;
            compareAtPrice?: number;
        }>
    ): Promise<{
        updated: number;
        notFound: number;
        errors: string[];
    }> {
        const results = {
            updated: 0,
            notFound: 0,
            errors: [] as string[],
        };

        for (const priceUpdate of platformPrices) {
            try {
                const mapping = await this.getMappingByPlatformId(
                    storeId,
                    priceUpdate.platformProductId,
                    priceUpdate.platformVariantId
                );

                if (!mapping) {
                    results.notFound++;
                    continue;
                }

                await this.updateMapping(mapping.id, {
                    price: priceUpdate.price,
                    compareAtPrice: priceUpdate.compareAtPrice,
                    syncStatus: 'synced',
                });

                results.updated++;
            } catch (error) {
                results.errors.push(
                    `Failed to update price for ${priceUpdate.platformProductId}: ${error instanceof Error ? error.message : 'Unknown error'
                    }`
                );
            }
        }

        return results;
    }
}