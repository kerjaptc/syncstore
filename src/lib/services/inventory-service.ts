/**
 * Inventory Service
 * Handles inventory tracking, reservations, and stock management
 */

import { db } from '@/lib/db';
import { 
  inventoryItems, 
  inventoryLocations, 
  inventoryTransactions,
  productVariants,
  products,
  users,
  SelectInventoryItem,
  SelectInventoryLocation,
  SelectInventoryTransaction
} from '@/lib/db/schema';
import { eq, and, desc, count, sum, sql, lt, lte, gte } from 'drizzle-orm';
import { 
  computeAvailableQuantity,
  createLowStockCondition,
  createOutOfStockCondition,
  createPaginatedResponse
} from '@/lib/db/utils';
import { InventoryTransactionType } from '@/types';
import type { PaginatedResponse } from '@/types';

export class InventoryService {
  /**
   * Helper method to safely cast location data
   */
  private castLocationData(location: any): SelectInventoryLocation {
    return {
      ...location,
      address: typeof location.address === 'object' && location.address !== null ? location.address : {},
    };
  }

  /**
   * Create a new inventory location
   */
  async createLocation(data: {
    organizationId: string;
    name: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    };
    isDefault?: boolean;
  }): Promise<SelectInventoryLocation> {
    return await db.transaction(async (tx) => {
      // If this is set as default, unset other defaults
      if (data.isDefault) {
        await tx
          .update(inventoryLocations)
          .set({ isDefault: false })
          .where(and(
            eq(inventoryLocations.organizationId, data.organizationId),
            eq(inventoryLocations.isDefault, true)
          ));
      }

      const [location] = await tx
        .insert(inventoryLocations)
        .values({
          organizationId: data.organizationId,
          name: data.name,
          address: data.address || {},
          isDefault: data.isDefault || false,
          isActive: true,
        })
        .returning();

      return this.castLocationData(location);
    });
  }

  /**
   * Get all locations for an organization
   */
  async getLocations(organizationId: string): Promise<SelectInventoryLocation[]> {
    const locations = await db
      .select()
      .from(inventoryLocations)
      .where(and(
        eq(inventoryLocations.organizationId, organizationId),
        eq(inventoryLocations.isActive, true)
      ))
      .orderBy(desc(inventoryLocations.isDefault), inventoryLocations.name);

    return locations.map(location => this.castLocationData(location));
  }

  /**
   * Get default location for an organization
   */
  async getDefaultLocation(organizationId: string): Promise<SelectInventoryLocation | null> {
    const result = await db
      .select()
      .from(inventoryLocations)
      .where(and(
        eq(inventoryLocations.organizationId, organizationId),
        eq(inventoryLocations.isDefault, true),
        eq(inventoryLocations.isActive, true)
      ))
      .limit(1);

    return result[0] ? this.castLocationData(result[0]) : null;
  }

  /**
   * Update inventory location
   */
  async updateLocation(
    locationId: string,
    organizationId: string,
    data: Partial<{
      name: string;
      address: Record<string, any>;
      isDefault: boolean;
      isActive: boolean;
    }>
  ): Promise<SelectInventoryLocation | null> {
    return await db.transaction(async (tx) => {
      // If setting as default, unset other defaults
      if (data.isDefault) {
        await tx
          .update(inventoryLocations)
          .set({ isDefault: false })
          .where(and(
            eq(inventoryLocations.organizationId, organizationId),
            eq(inventoryLocations.isDefault, true)
          ));
      }

      const [location] = await tx
        .update(inventoryLocations)
        .set(data)
        .where(and(
          eq(inventoryLocations.id, locationId),
          eq(inventoryLocations.organizationId, organizationId)
        ))
        .returning();

      return location ? this.castLocationData(location) : null;
    });
  }

  /**
   * Bulk update stock levels
   */
  async bulkUpdateStock(updates: Array<{
    productVariantId: string;
    locationId: string;
    quantityChange: number;
    transactionType: InventoryTransactionType;
    notes?: string;
  }>, userId?: string): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await this.updateStock(
          update.productVariantId,
          update.locationId,
          update.quantityChange,
          update.transactionType,
          userId,
          'bulk_update',
          undefined,
          update.notes
        );
      }
    });
  }

  /**
   * Get inventory alerts (low stock and out of stock)
   */
  async getInventoryAlerts(organizationId: string): Promise<{
    lowStock: Array<{
      inventoryItem: SelectInventoryItem;
      productVariant: any;
      product: any;
      location: SelectInventoryLocation;
      availableQuantity: number;
      alertLevel: 'low' | 'critical';
    }>;
    outOfStock: Array<{
      inventoryItem: SelectInventoryItem;
      productVariant: any;
      product: any;
      location: SelectInventoryLocation;
    }>;
  }> {
    const lowStockItems = await this.getLowStockItems(organizationId);
    const outOfStockItems = await this.getOutOfStockItems(organizationId);

    // Categorize low stock items by severity
    const categorizedLowStock = lowStockItems.map(item => ({
      ...item,
      alertLevel: (item.availableQuantity <= Math.floor(item.inventoryItem.reorderPoint * 0.5)) 
        ? 'critical' as const 
        : 'low' as const,
    }));

    return {
      lowStock: categorizedLowStock,
      outOfStock: outOfStockItems,
    };
  }

  /**
   * Check if sufficient stock is available for reservation
   */
  async checkStockAvailability(
    productVariantId: string,
    locationId: string,
    requiredQuantity: number
  ): Promise<{
    available: boolean;
    availableQuantity: number;
    shortfall: number;
  }> {
    const availableQuantity = await this.getAvailableStock(productVariantId, locationId);
    const shortfall = Math.max(0, requiredQuantity - availableQuantity);

    return {
      available: availableQuantity >= requiredQuantity,
      availableQuantity,
      shortfall,
    };
  }

  /**
   * Get inventory valuation (total stock value)
   */
  async getInventoryValuation(organizationId: string): Promise<{
    totalValue: number;
    totalQuantity: number;
    valueByLocation: Array<{
      locationId: string;
      locationName: string;
      value: number;
      quantity: number;
    }>;
  }> {
    const result = await db
      .select({
        locationId: inventoryItems.locationId,
        locationName: inventoryLocations.name,
        quantity: inventoryItems.quantityOnHand,
        costPrice: productVariants.costPrice,
      })
      .from(inventoryItems)
      .innerJoin(productVariants, eq(inventoryItems.productVariantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .innerJoin(inventoryLocations, eq(inventoryItems.locationId, inventoryLocations.id))
      .where(and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true),
        eq(productVariants.isActive, true)
      ));

    const valueByLocation = new Map<string, { locationName: string; value: number; quantity: number }>();
    let totalValue = 0;
    let totalQuantity = 0;

    for (const row of result) {
      const costPrice = parseFloat(row.costPrice || '0');
      const quantity = row.quantity;
      const value = costPrice * quantity;

      totalValue += value;
      totalQuantity += quantity;

      const existing = valueByLocation.get(row.locationId) || {
        locationName: row.locationName,
        value: 0,
        quantity: 0,
      };

      valueByLocation.set(row.locationId, {
        locationName: row.locationName,
        value: existing.value + value,
        quantity: existing.quantity + quantity,
      });
    }

    return {
      totalValue,
      totalQuantity,
      valueByLocation: Array.from(valueByLocation.entries()).map(([locationId, data]) => ({
        locationId,
        ...data,
      })),
    };
  }
  /**
   * Get or create inventory item for a product variant at a location
   */
  async getOrCreateInventoryItem(
    productVariantId: string,
    locationId: string
  ): Promise<SelectInventoryItem> {
    // Check if inventory item already exists
    const existing = await db
      .select()
      .from(inventoryItems)
      .where(and(
        eq(inventoryItems.productVariantId, productVariantId),
        eq(inventoryItems.locationId, locationId)
      ))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Create new inventory item
    const [inventoryItem] = await db
      .insert(inventoryItems)
      .values({
        productVariantId,
        locationId,
        quantityOnHand: 0,
        quantityReserved: 0,
        reorderPoint: 0,
        reorderQuantity: 0,
      })
      .returning();

    return inventoryItem;
  }

  /**
   * Update stock levels for a product variant at a location
   */
  async updateStock(
    productVariantId: string,
    locationId: string,
    quantityChange: number,
    transactionType: InventoryTransactionType,
    userId?: string,
    referenceType?: string,
    referenceId?: string,
    notes?: string
  ): Promise<SelectInventoryItem> {
    return await db.transaction(async (tx) => {
      // Get or create inventory item
      let inventoryItem = await tx
        .select()
        .from(inventoryItems)
        .where(and(
          eq(inventoryItems.productVariantId, productVariantId),
          eq(inventoryItems.locationId, locationId)
        ))
        .limit(1);

      if (inventoryItem.length === 0) {
        const [newItem] = await tx
          .insert(inventoryItems)
          .values({
            productVariantId,
            locationId,
            quantityOnHand: 0,
            quantityReserved: 0,
            reorderPoint: 0,
            reorderQuantity: 0,
          })
          .returning();
        inventoryItem = [newItem];
      }

      const currentItem = inventoryItem[0];

      // Calculate new quantities based on transaction type
      let newQuantityOnHand = currentItem.quantityOnHand;
      let newQuantityReserved = currentItem.quantityReserved;

      switch (transactionType) {
        case 'adjustment':
        case 'purchase':
          newQuantityOnHand += quantityChange;
          break;
        case 'sale':
          // For sales, reduce from reserved first, then on-hand
          if (currentItem.quantityReserved >= Math.abs(quantityChange)) {
            newQuantityReserved += quantityChange; // quantityChange is negative for sales
          } else {
            const remainingToDeduct = Math.abs(quantityChange) - currentItem.quantityReserved;
            newQuantityReserved = 0;
            newQuantityOnHand -= remainingToDeduct;
          }
          break;
        case 'reservation':
          if (quantityChange > 0) {
            // Reserve stock
            const availableQuantity = currentItem.quantityOnHand - currentItem.quantityReserved;
            if (quantityChange > availableQuantity) {
              throw new Error('Insufficient stock to reserve');
            }
            newQuantityReserved += quantityChange;
          } else {
            // Release reservation
            newQuantityReserved += quantityChange; // quantityChange is negative
            if (newQuantityReserved < 0) {
              newQuantityReserved = 0;
            }
          }
          break;
        case 'transfer':
          // For transfers, this would be handled at a higher level
          // with separate deduction and addition transactions
          newQuantityOnHand += quantityChange;
          break;
      }

      // Validate quantities
      if (newQuantityOnHand < 0) {
        throw new Error('Insufficient stock on hand');
      }
      if (newQuantityReserved < 0) {
        newQuantityReserved = 0;
      }

      // Update inventory item
      const [updatedItem] = await tx
        .update(inventoryItems)
        .set({
          quantityOnHand: newQuantityOnHand,
          quantityReserved: newQuantityReserved,
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, currentItem.id))
        .returning();

      // Create transaction record
      await tx
        .insert(inventoryTransactions)
        .values({
          inventoryItemId: currentItem.id,
          transactionType,
          quantityChange,
          referenceType,
          referenceId,
          notes,
          createdBy: userId,
        });

      return updatedItem;
    });
  }

  /**
   * Reserve stock for an order
   */
  async reserveStock(
    productVariantId: string,
    locationId: string,
    quantity: number,
    orderId: string,
    userId?: string
  ): Promise<void> {
    await this.updateStock(
      productVariantId,
      locationId,
      quantity,
      'reservation',
      userId,
      'order',
      orderId,
      `Reserved ${quantity} units for order ${orderId}`
    );
  }

  /**
   * Release stock reservation
   */
  async releaseReservation(
    productVariantId: string,
    locationId: string,
    quantity: number,
    orderId: string,
    userId?: string
  ): Promise<void> {
    await this.updateStock(
      productVariantId,
      locationId,
      -quantity, // Negative to release
      'reservation',
      userId,
      'order',
      orderId,
      `Released ${quantity} units reservation for order ${orderId}`
    );
  }

  /**
   * Get available stock for a product variant
   */
  async getAvailableStock(
    productVariantId: string,
    locationId?: string
  ): Promise<number> {
    const conditions = [eq(inventoryItems.productVariantId, productVariantId)];
    
    if (locationId) {
      conditions.push(eq(inventoryItems.locationId, locationId));
    }

    const result = await db
      .select({
        totalOnHand: sum(inventoryItems.quantityOnHand),
        totalReserved: sum(inventoryItems.quantityReserved),
      })
      .from(inventoryItems)
      .where(and(...conditions));

    if (result.length === 0 || !result[0].totalOnHand) {
      return 0;
    }

    const totalOnHand = Number(result[0].totalOnHand) || 0;
    const totalReserved = Number(result[0].totalReserved) || 0;
    
    return Math.max(0, totalOnHand - totalReserved);
  }

  /**
   * Get inventory items with low stock alerts
   */
  async getLowStockItems(organizationId: string): Promise<Array<{
    inventoryItem: SelectInventoryItem;
    productVariant: any;
    product: any;
    location: SelectInventoryLocation;
    availableQuantity: number;
  }>> {
    const result = await db
      .select({
        inventoryItem: inventoryItems,
        productVariant: productVariants,
        product: products,
        location: inventoryLocations,
      })
      .from(inventoryItems)
      .innerJoin(productVariants, eq(inventoryItems.productVariantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .innerJoin(inventoryLocations, eq(inventoryItems.locationId, inventoryLocations.id))
      .where(and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true),
        eq(productVariants.isActive, true),
        createLowStockCondition(
          inventoryItems.quantityOnHand,
          inventoryItems.quantityReserved,
          inventoryItems.reorderPoint
        )
      ))
      .orderBy(desc(inventoryItems.updatedAt));

    return result.map(row => ({
      ...row,
      location: {
        ...row.location,
        address: row.location.address as any,
      },
      availableQuantity: Math.max(0, row.inventoryItem.quantityOnHand - row.inventoryItem.quantityReserved),
    }));
  }

  /**
   * Get out of stock items
   */
  async getOutOfStockItems(organizationId: string): Promise<Array<{
    inventoryItem: SelectInventoryItem;
    productVariant: any;
    product: any;
    location: SelectInventoryLocation;
  }>> {
    const result = await db
      .select({
        inventoryItem: inventoryItems,
        productVariant: productVariants,
        product: products,
        location: inventoryLocations,
      })
      .from(inventoryItems)
      .innerJoin(productVariants, eq(inventoryItems.productVariantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .innerJoin(inventoryLocations, eq(inventoryItems.locationId, inventoryLocations.id))
      .where(and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true),
        eq(productVariants.isActive, true),
        createOutOfStockCondition(
          inventoryItems.quantityOnHand,
          inventoryItems.quantityReserved
        )
      ))
      .orderBy(desc(inventoryItems.updatedAt));

    return result.map(row => ({
      ...row,
      location: {
        ...row.location,
        address: row.location.address as any,
      },
    }));
  }

  /**
   * Adjust inventory with manual adjustment
   */
  async adjustInventory(adjustments: Array<{
    productVariantId: string;
    locationId: string;
    quantityChange: number;
    notes?: string;
  }>, userId?: string): Promise<void> {
    await db.transaction(async (tx) => {
      for (const adjustment of adjustments) {
        await this.updateStock(
          adjustment.productVariantId,
          adjustment.locationId,
          adjustment.quantityChange,
          'adjustment',
          userId,
          'manual',
          undefined,
          adjustment.notes
        );
      }
    });
  }

  /**
   * Get stock movement history for a product variant
   */
  async getStockHistory(
    productVariantId: string,
    locationId?: string,
    options: {
      page?: number;
      limit?: number;
      transactionType?: InventoryTransactionType;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<PaginatedResponse<{
    transaction: SelectInventoryTransaction;
    inventoryItem: SelectInventoryItem;
    user?: any;
  }>> {
    const { page = 1, limit = 50, transactionType, startDate, endDate } = options;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(inventoryItems.productVariantId, productVariantId)];
    
    if (locationId) {
      conditions.push(eq(inventoryItems.locationId, locationId));
    }
    
    if (transactionType) {
      conditions.push(eq(inventoryTransactions.transactionType, transactionType));
    }
    
    if (startDate) {
      conditions.push(gte(inventoryTransactions.createdAt, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(inventoryTransactions.createdAt, endDate));
    }

    // Get transactions
    const transactions = await db
      .select({
        transaction: inventoryTransactions,
        inventoryItem: inventoryItems,
        user: users,
      })
      .from(inventoryTransactions)
      .innerJoin(inventoryItems, eq(inventoryTransactions.inventoryItemId, inventoryItems.id))
      .leftJoin(users, eq(inventoryTransactions.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(inventoryTransactions)
      .innerJoin(inventoryItems, eq(inventoryTransactions.inventoryItemId, inventoryItems.id))
      .where(and(...conditions));

    return createPaginatedResponse(transactions, total, { page, limit });
  }

  /**
   * Get inventory summary for organization
   */
  async getInventorySummary(organizationId: string): Promise<{
    totalProducts: number;
    totalVariants: number;
    totalLocations: number;
    totalStockValue: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalQuantityOnHand: number;
    totalQuantityReserved: number;
    totalQuantityAvailable: number;
  }> {
    // Get product and variant counts
    const [productStats] = await db
      .select({
        totalProducts: sql<number>`COUNT(DISTINCT ${products.id})`,
        totalVariants: sql<number>`COUNT(DISTINCT ${productVariants.id})`,
      })
      .from(products)
      .innerJoin(productVariants, eq(products.id, productVariants.productId))
      .where(and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true),
        eq(productVariants.isActive, true)
      ));

    // Get location count
    const [locationStats] = await db
      .select({ totalLocations: count() })
      .from(inventoryLocations)
      .where(and(
        eq(inventoryLocations.organizationId, organizationId),
        eq(inventoryLocations.isActive, true)
      ));

    // Get inventory quantities
    const [quantityStats] = await db
      .select({
        totalQuantityOnHand: sql<number>`COALESCE(SUM(${inventoryItems.quantityOnHand}), 0)`,
        totalQuantityReserved: sql<number>`COALESCE(SUM(${inventoryItems.quantityReserved}), 0)`,
      })
      .from(inventoryItems)
      .innerJoin(productVariants, eq(inventoryItems.productVariantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(products.organizationId, organizationId));

    // Get low stock count
    const [lowStockStats] = await db
      .select({ count: count() })
      .from(inventoryItems)
      .innerJoin(productVariants, eq(inventoryItems.productVariantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true),
        eq(productVariants.isActive, true),
        createLowStockCondition(
          inventoryItems.quantityOnHand,
          inventoryItems.quantityReserved,
          inventoryItems.reorderPoint
        )
      ));

    // Get out of stock count
    const [outOfStockStats] = await db
      .select({ count: count() })
      .from(inventoryItems)
      .innerJoin(productVariants, eq(inventoryItems.productVariantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true),
        eq(productVariants.isActive, true),
        createOutOfStockCondition(
          inventoryItems.quantityOnHand,
          inventoryItems.quantityReserved
        )
      ));

    const totalQuantityOnHand = Number(quantityStats.totalQuantityOnHand) || 0;
    const totalQuantityReserved = Number(quantityStats.totalQuantityReserved) || 0;

    return {
      totalProducts: productStats.totalProducts || 0,
      totalVariants: productStats.totalVariants || 0,
      totalLocations: locationStats.totalLocations || 0,
      totalStockValue: 0, // TODO: Calculate based on cost prices
      lowStockItems: lowStockStats.count || 0,
      outOfStockItems: outOfStockStats.count || 0,
      totalQuantityOnHand,
      totalQuantityReserved,
      totalQuantityAvailable: Math.max(0, totalQuantityOnHand - totalQuantityReserved),
    };
  }

  /**
   * Update reorder points for inventory items
   */
  async updateReorderPoints(updates: Array<{
    inventoryItemId: string;
    reorderPoint: number;
    reorderQuantity: number;
  }>): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(inventoryItems)
          .set({
            reorderPoint: update.reorderPoint,
            reorderQuantity: update.reorderQuantity,
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, update.inventoryItemId));
      }
    });
  }

  /**
   * Transfer stock between locations
   */
  async transferStock(
    productVariantId: string,
    fromLocationId: string,
    toLocationId: string,
    quantity: number,
    userId?: string,
    notes?: string
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Deduct from source location
      await this.updateStock(
        productVariantId,
        fromLocationId,
        -quantity,
        'transfer',
        userId,
        'transfer',
        undefined,
        `Transfer out: ${notes || ''}`
      );

      // Add to destination location
      await this.updateStock(
        productVariantId,
        toLocationId,
        quantity,
        'transfer',
        userId,
        'transfer',
        undefined,
        `Transfer in: ${notes || ''}`
      );
    });
  }

  /**
   * Get inventory items for a specific location
   */
  async getLocationInventory(
    locationId: string,
    organizationId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      lowStockOnly?: boolean;
    } = {}
  ): Promise<PaginatedResponse<{
    inventoryItem: SelectInventoryItem;
    productVariant: any;
    product: any;
    availableQuantity: number;
  }>> {
    const { page = 1, limit = 50, search, lowStockOnly } = options;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [
      eq(inventoryItems.locationId, locationId),
      eq(products.organizationId, organizationId),
      eq(products.isActive, true),
      eq(productVariants.isActive, true),
    ];

    if (search) {
      conditions.push(
        sql`(${products.name} ILIKE ${`%${search}%`} OR ${products.sku} ILIKE ${`%${search}%`} OR ${productVariants.variantSku} ILIKE ${`%${search}%`})`
      );
    }

    if (lowStockOnly) {
      conditions.push(
        createLowStockCondition(
          inventoryItems.quantityOnHand,
          inventoryItems.quantityReserved,
          inventoryItems.reorderPoint
        )
      );
    }

    // Get inventory items
    const items = await db
      .select({
        inventoryItem: inventoryItems,
        productVariant: productVariants,
        product: products,
      })
      .from(inventoryItems)
      .innerJoin(productVariants, eq(inventoryItems.productVariantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryItems.updatedAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(inventoryItems)
      .innerJoin(productVariants, eq(inventoryItems.productVariantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(...conditions));

    const itemsWithAvailable = items.map(item => ({
      ...item,
      availableQuantity: Math.max(0, item.inventoryItem.quantityOnHand - item.inventoryItem.quantityReserved),
    }));

    return createPaginatedResponse(itemsWithAvailable, total, { page, limit });
  }
}