/**
 * Product Conflict Service
 * Manages product synchronization conflicts and manual review processes
 */

import { db } from '@/lib/db';
import { 
  products,
  productVariants,
  stores,
  platforms
} from '@/lib/db/schema';
import { eq, and, desc, count, inArray } from 'drizzle-orm';
import type { PaginatedResponse } from '@/types';

export interface ProductConflict {
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
  updatedAt: Date;
}

export interface ProductConflictWithDetails extends ProductConflict {
  product?: {
    id: string;
    name: string;
    sku: string;
  };
  variant?: {
    id: string;
    name: string;
    variantSku: string;
  };
  store?: {
    id: string;
    name: string;
    platform: {
      name: string;
    };
  };
}

export interface CreateConflictInput {
  storeId: string;
  productId: string;
  variantId?: string;
  field: string;
  localValue: any;
  platformValue: any;
  conflictType: 'field_mismatch' | 'missing_local' | 'missing_platform' | 'validation_error';
  metadata?: Record<string, any>;
}

export interface ResolveConflictInput {
  resolution: 'use_local' | 'use_platform' | 'merge' | 'custom';
  resolvedValue?: any;
  resolvedBy: string;
  applyToSimilar?: boolean; // Apply resolution to similar conflicts
}

export interface ConflictFilters {
  storeId?: string;
  status?: 'pending' | 'resolved' | 'ignored';
  conflictType?: string;
  field?: string;
  productId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export class ProductConflictService {
  // In-memory storage for conflicts (in production, this would be a database table)
  private conflicts: Map<string, ProductConflict> = new Map();
  private conflictCounter = 0;

  /**
   * Create a new conflict record
   */
  async createConflict(data: CreateConflictInput): Promise<ProductConflict> {
    const conflictId = `conflict_${++this.conflictCounter}_${Date.now()}`;
    
    const conflict: ProductConflict = {
      id: conflictId,
      storeId: data.storeId,
      productId: data.productId,
      variantId: data.variantId,
      field: data.field,
      localValue: data.localValue,
      platformValue: data.platformValue,
      conflictType: data.conflictType,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.conflicts.set(conflictId, conflict);

    // Log the conflict for debugging
    console.warn('Product conflict created:', {
      id: conflictId,
      storeId: data.storeId,
      productId: data.productId,
      field: data.field,
      conflictType: data.conflictType,
    });

    return conflict;
  }

  /**
   * Get conflict by ID with details
   */
  async getConflictById(conflictId: string): Promise<ProductConflictWithDetails | null> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return null;

    // Get product details
    const productResult = await db
      .select({
        product: {
          id: products.id,
          name: products.name,
          sku: products.sku,
        },
        variant: conflict.variantId ? {
          id: productVariants.id,
          name: productVariants.name,
          variantSku: productVariants.variantSku,
        } : null,
        store: {
          id: stores.id,
          name: stores.name,
          platform: {
            name: platforms.name,
          },
        },
      })
      .from(products)
      .leftJoin(productVariants, conflict.variantId ? eq(productVariants.id, conflict.variantId) : undefined)
      .innerJoin(stores, eq(stores.id, conflict.storeId))
      .innerJoin(platforms, eq(platforms.id, stores.platformId))
      .where(eq(products.id, conflict.productId))
      .limit(1);

    if (productResult.length === 0) return conflict;

    const details = productResult[0];
    return {
      ...conflict,
      product: details.product,
      variant: details.variant || undefined,
      store: details.store,
    };
  }

  /**
   * Get conflicts with filters and pagination
   */
  async getConflicts(
    organizationId: string,
    filters: ConflictFilters = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<PaginatedResponse<ProductConflictWithDetails>> {
    const { page = 1, limit = 20 } = pagination;

    // Filter conflicts based on criteria
    let filteredConflicts = Array.from(this.conflicts.values());

    if (filters.storeId) {
      filteredConflicts = filteredConflicts.filter(c => c.storeId === filters.storeId);
    }

    if (filters.status) {
      filteredConflicts = filteredConflicts.filter(c => c.status === filters.status);
    }

    if (filters.conflictType) {
      filteredConflicts = filteredConflicts.filter(c => c.conflictType === filters.conflictType);
    }

    if (filters.field) {
      filteredConflicts = filteredConflicts.filter(c => c.field === filters.field);
    }

    if (filters.productId) {
      filteredConflicts = filteredConflicts.filter(c => c.productId === filters.productId);
    }

    if (filters.dateFrom) {
      filteredConflicts = filteredConflicts.filter(c => c.createdAt >= filters.dateFrom!);
    }

    if (filters.dateTo) {
      filteredConflicts = filteredConflicts.filter(c => c.createdAt <= filters.dateTo!);
    }

    // Sort by creation date (newest first)
    filteredConflicts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filteredConflicts.length;
    const offset = (page - 1) * limit;
    const paginatedConflicts = filteredConflicts.slice(offset, offset + limit);

    // Get details for paginated conflicts
    const conflictsWithDetails: ProductConflictWithDetails[] = [];
    for (const conflict of paginatedConflicts) {
      const conflictWithDetails = await this.getConflictById(conflict.id);
      if (conflictWithDetails) {
        conflictsWithDetails.push(conflictWithDetails);
      }
    }

    return {
      data: conflictsWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: ResolveConflictInput
  ): Promise<ProductConflict | null> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return null;

    // Calculate resolved value based on resolution type
    let resolvedValue = resolution.resolvedValue;
    
    if (!resolvedValue) {
      switch (resolution.resolution) {
        case 'use_local':
          resolvedValue = conflict.localValue;
          break;
        case 'use_platform':
          resolvedValue = conflict.platformValue;
          break;
        case 'merge':
          resolvedValue = this.mergeValues(conflict.localValue, conflict.platformValue, conflict.field);
          break;
        case 'custom':
          // Custom resolution requires explicit resolved value
          if (resolution.resolvedValue === undefined) {
            throw new Error('Custom resolution requires a resolved value');
          }
          resolvedValue = resolution.resolvedValue;
          break;
      }
    }

    // Update conflict
    const updatedConflict: ProductConflict = {
      ...conflict,
      status: 'resolved',
      resolution: resolution.resolution,
      resolvedValue,
      resolvedBy: resolution.resolvedBy,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    };

    this.conflicts.set(conflictId, updatedConflict);

    // Apply to similar conflicts if requested
    if (resolution.applyToSimilar) {
      await this.applySimilarResolution(conflict, resolution);
    }

    console.log('Conflict resolved:', {
      id: conflictId,
      resolution: resolution.resolution,
      resolvedValue,
      resolvedBy: resolution.resolvedBy,
    });

    return updatedConflict;
  }

  /**
   * Ignore a conflict (mark as resolved without applying changes)
   */
  async ignoreConflict(conflictId: string, ignoredBy: string): Promise<ProductConflict | null> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return null;

    const updatedConflict: ProductConflict = {
      ...conflict,
      status: 'ignored',
      resolvedBy: ignoredBy,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    };

    this.conflicts.set(conflictId, updatedConflict);

    console.log('Conflict ignored:', {
      id: conflictId,
      ignoredBy,
    });

    return updatedConflict;
  }

  /**
   * Bulk resolve conflicts
   */
  async bulkResolveConflicts(
    conflictIds: string[],
    resolution: ResolveConflictInput
  ): Promise<{
    resolved: number;
    failed: number;
    errors: Array<{ conflictId: string; error: string }>;
  }> {
    const results = {
      resolved: 0,
      failed: 0,
      errors: [] as Array<{ conflictId: string; error: string }>,
    };

    for (const conflictId of conflictIds) {
      try {
        await this.resolveConflict(conflictId, resolution);
        results.resolved++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          conflictId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get conflict statistics
   */
  async getConflictStatistics(storeId?: string): Promise<{
    totalConflicts: number;
    pendingConflicts: number;
    resolvedConflicts: number;
    ignoredConflicts: number;
    conflictsByType: Record<string, number>;
    conflictsByField: Record<string, number>;
    resolutionRate: number;
  }> {
    let conflicts = Array.from(this.conflicts.values());

    if (storeId) {
      conflicts = conflicts.filter(c => c.storeId === storeId);
    }

    const stats = {
      totalConflicts: conflicts.length,
      pendingConflicts: 0,
      resolvedConflicts: 0,
      ignoredConflicts: 0,
      conflictsByType: {} as Record<string, number>,
      conflictsByField: {} as Record<string, number>,
      resolutionRate: 0,
    };

    for (const conflict of conflicts) {
      // Count by status
      switch (conflict.status) {
        case 'pending':
          stats.pendingConflicts++;
          break;
        case 'resolved':
          stats.resolvedConflicts++;
          break;
        case 'ignored':
          stats.ignoredConflicts++;
          break;
      }

      // Count by type
      stats.conflictsByType[conflict.conflictType] = 
        (stats.conflictsByType[conflict.conflictType] || 0) + 1;

      // Count by field
      stats.conflictsByField[conflict.field] = 
        (stats.conflictsByField[conflict.field] || 0) + 1;
    }

    // Calculate resolution rate
    const totalResolved = stats.resolvedConflicts + stats.ignoredConflicts;
    stats.resolutionRate = stats.totalConflicts > 0 
      ? totalResolved / stats.totalConflicts 
      : 0;

    return stats;
  }

  /**
   * Apply similar resolution to conflicts with same field and type
   */
  private async applySimilarResolution(
    originalConflict: ProductConflict,
    resolution: ResolveConflictInput
  ): Promise<void> {
    const similarConflicts = Array.from(this.conflicts.values()).filter(c =>
      c.id !== originalConflict.id &&
      c.storeId === originalConflict.storeId &&
      c.field === originalConflict.field &&
      c.conflictType === originalConflict.conflictType &&
      c.status === 'pending'
    );

    for (const conflict of similarConflicts) {
      try {
        await this.resolveConflict(conflict.id, {
          ...resolution,
          applyToSimilar: false, // Prevent infinite recursion
        });
      } catch (error) {
        console.error(`Failed to apply similar resolution to conflict ${conflict.id}:`, error);
      }
    }
  }

  /**
   * Merge values based on field type
   */
  private mergeValues(localValue: any, platformValue: any, field: string): any {
    // Handle different field types
    switch (field) {
      case 'images':
        if (Array.isArray(localValue) && Array.isArray(platformValue)) {
          return [...new Set([...localValue, ...platformValue])];
        }
        return platformValue || localValue;

      case 'tags':
      case 'categories':
        if (Array.isArray(localValue) && Array.isArray(platformValue)) {
          return [...new Set([...localValue, ...platformValue])];
        }
        return platformValue || localValue;

      case 'attributes':
        if (typeof localValue === 'object' && typeof platformValue === 'object') {
          return { ...localValue, ...platformValue };
        }
        return platformValue || localValue;

      case 'description':
        if (localValue && platformValue && localValue !== platformValue) {
          return `${localValue}\n\n---\n\n${platformValue}`;
        }
        return platformValue || localValue;

      case 'price':
      case 'weight':
        // For numeric fields, prefer platform value (usually more up-to-date)
        return platformValue !== null && platformValue !== undefined ? platformValue : localValue;

      default:
        // For other fields, prefer platform value
        return platformValue !== null && platformValue !== undefined ? platformValue : localValue;
    }
  }

  /**
   * Get pending conflicts count for a store
   */
  async getPendingConflictsCount(storeId: string): Promise<number> {
    const conflicts = Array.from(this.conflicts.values());
    return conflicts.filter(c => c.storeId === storeId && c.status === 'pending').length;
  }

  /**
   * Clear resolved conflicts older than specified days
   */
  async clearOldConflicts(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const conflictsToRemove = Array.from(this.conflicts.entries()).filter(([id, conflict]) =>
      conflict.status !== 'pending' && conflict.createdAt < cutoffDate
    );

    for (const [id] of conflictsToRemove) {
      this.conflicts.delete(id);
    }

    console.log(`Cleared ${conflictsToRemove.length} old conflicts`);
    return conflictsToRemove.length;
  }

  /**
   * Export conflicts to CSV format
   */
  async exportConflicts(
    organizationId: string,
    filters: ConflictFilters = {}
  ): Promise<string> {
    const { data: conflicts } = await this.getConflicts(organizationId, filters, { limit: 10000 });

    const headers = [
      'ID',
      'Store',
      'Platform',
      'Product',
      'Variant',
      'Field',
      'Local Value',
      'Platform Value',
      'Conflict Type',
      'Status',
      'Resolution',
      'Resolved Value',
      'Resolved By',
      'Created At',
      'Resolved At',
    ];

    const rows = conflicts.map(conflict => [
      conflict.id,
      conflict.store?.name || '',
      conflict.store?.platform?.name || '',
      conflict.product?.name || '',
      conflict.variant?.name || '',
      conflict.field,
      JSON.stringify(conflict.localValue),
      JSON.stringify(conflict.platformValue),
      conflict.conflictType,
      conflict.status,
      conflict.resolution || '',
      conflict.resolvedValue ? JSON.stringify(conflict.resolvedValue) : '',
      conflict.resolvedBy || '',
      conflict.createdAt.toISOString(),
      conflict.resolvedAt?.toISOString() || '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csvContent;
  }
}