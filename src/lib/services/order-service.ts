/**
 * Order Service
 * Handles unified order management across all platforms
 */

import { db } from '@/lib/db';
import {
  orders,
  orderItems,
  stores,
  platforms,
  organizations,
  productVariants,
  products
} from '@/lib/db/schema';
import { eq, and, desc, count, sum, sql, gte, lte, inArray } from 'drizzle-orm';
import { InventoryService } from './inventory-service';
import {
  InventoryTransactionType,
  OrderStatus,
  FinancialStatus,
  FulfillmentStatus
} from '@/types';
import { createPaginatedResponse } from '@/lib/db/utils';
import type {
  SelectOrder,
  SelectOrderItem,
  OrderWithItems,
  OrderItemWithProduct,
  StoreWithRelations,
  PaginatedResponse
} from '@/types';

export class OrderService {
  private inventoryService: InventoryService;

  constructor() {
    this.inventoryService = new InventoryService();
  }

  /**
   * Helper method to safely cast order data
   */
  private castOrderData(order: any): any {
    return {
      ...order,
      customerInfo: typeof order.customerInfo === 'object' && order.customerInfo !== null ? order.customerInfo : {},
      platformData: typeof order.platformData === 'object' && order.platformData !== null ? order.platformData : {},
      tags: Array.isArray(order.tags) ? order.tags : [],
    };
  }

  /**
   * Helper method to safely cast product variant data
   */
  private castProductVariantData(variant: any, product: any): any {
    return {
      ...variant,
      images: Array.isArray(variant.images) ? variant.images : [],
      attributes: typeof variant.attributes === 'object' && variant.attributes !== null ? variant.attributes : {},
      product: {
        ...product,
        images: Array.isArray(product.images) ? product.images : [],
        attributes: typeof product.attributes === 'object' && product.attributes !== null ? product.attributes : {},
        dimensions: typeof product.dimensions === 'object' && product.dimensions !== null ? product.dimensions : {},
      },
    };
  }

  /**
   * Create a new order from platform data
   */
  async createOrder(data: {
    organizationId: string;
    storeId: string;
    platformOrderId: string;
    orderNumber?: string;
    customerInfo: {
      name: string;
      email?: string;
      phone?: string;
      address: {
        street: string;
        city: string;
        state?: string;
        country: string;
        postalCode: string;
      };
    };
    status: OrderStatus;
    financialStatus?: FinancialStatus;
    fulfillmentStatus?: FulfillmentStatus;
    items: Array<{
      productVariantId?: string;
      platformProductId: string;
      platformVariantId?: string;
      name: string;
      sku?: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    taxAmount?: number;
    shippingAmount?: number;
    discountAmount?: number;
    totalAmount: number;
    currency?: string;
    platformData?: Record<string, any>;
    notes?: string;
    tags?: string[];
    orderedAt: Date;
  }): Promise<OrderWithItems> {
    return await db.transaction(async (tx) => {
      // Check if order already exists
      const existingOrder = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(and(
          eq(orders.storeId, data.storeId),
          eq(orders.platformOrderId, data.platformOrderId)
        ))
        .limit(1);

      if (existingOrder.length > 0) {
        throw new Error(`Order with platform ID "${data.platformOrderId}" already exists`);
      }

      // Create order
      const [order] = await tx
        .insert(orders)
        .values({
          organizationId: data.organizationId,
          storeId: data.storeId,
          platformOrderId: data.platformOrderId,
          orderNumber: data.orderNumber,
          customerInfo: data.customerInfo,
          status: data.status,
          financialStatus: data.financialStatus || 'pending',
          fulfillmentStatus: data.fulfillmentStatus || 'unfulfilled',
          subtotal: data.subtotal.toString(),
          taxAmount: (data.taxAmount || 0).toString(),
          shippingAmount: (data.shippingAmount || 0).toString(),
          discountAmount: (data.discountAmount || 0).toString(),
          totalAmount: data.totalAmount.toString(),
          currency: data.currency || 'IDR',
          platformData: data.platformData || {},
          notes: data.notes,
          tags: data.tags || [],
          orderedAt: data.orderedAt,
        })
        .returning();

      // Create order items
      const createdItems: SelectOrderItem[] = [];
      for (const itemData of data.items) {
        const [item] = await tx
          .insert(orderItems)
          .values({
            orderId: order.id,
            productVariantId: itemData.productVariantId,
            platformProductId: itemData.platformProductId,
            platformVariantId: itemData.platformVariantId,
            name: itemData.name,
            sku: itemData.sku,
            quantity: itemData.quantity,
            price: itemData.price.toString(),
            totalAmount: (itemData.quantity * itemData.price).toString(),
          })
          .returning();

        createdItems.push({
          ...item,
          updatedAt: item.createdAt, // Use createdAt as fallback for updatedAt
          productVariantId: item.productVariantId || undefined,
          platformProductId: item.platformProductId || undefined,
          platformVariantId: item.platformVariantId || undefined,
          sku: item.sku || undefined,
          price: parseFloat(item.price), // Convert string to number
          totalAmount: parseFloat(item.totalAmount), // Convert string to number
        });

        // Reserve inventory if product variant is mapped
        if (itemData.productVariantId && data.status === 'paid') {
          try {
            // Get default location for the organization
            const defaultLocation = await tx
              .select({ id: stores.id })
              .from(stores)
              .where(eq(stores.organizationId, data.organizationId))
              .limit(1);

            if (defaultLocation.length > 0) {
              await this.inventoryService.reserveStock(
                itemData.productVariantId,
                defaultLocation[0].id,
                itemData.quantity,
                order.id
              );
            }
          } catch (error) {
            console.warn(`Failed to reserve stock for order ${order.id}:`, error);
            // Don't fail the order creation if inventory reservation fails
          }
        }
      }

      // Get store and platform data
      const storeData = await tx
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
        .where(eq(stores.id, data.storeId))
        .limit(1);

      const store: StoreWithRelations = {
        ...storeData[0],
        credentials: (storeData[0].credentials as Record<string, any>) || {},
        settings: (storeData[0].settings as Record<string, any>) || {},
        syncStatus: (storeData[0].syncStatus as 'active' | 'paused' | 'error') || 'active',
        lastSyncAt: storeData[0].lastSyncAt || undefined,
        platform: {
          ...storeData[0].platform,
          updatedAt: storeData[0].platform.createdAt, // Use createdAt as fallback for updatedAt
          apiConfig: (storeData[0].platform.apiConfig as Record<string, any>) || {},
        },
        _count: { products: 0, orders: 0 }
      };

      // Get items with product data
      const itemsWithProducts: OrderItemWithProduct[] = [];
      for (const item of createdItems) {
        let productData = undefined;

        if (item.productVariantId) {
          const productResult = await tx
            .select({
              variant: productVariants,
              product: products,
            })
            .from(productVariants)
            .innerJoin(products, eq(productVariants.productId, products.id))
            .where(eq(productVariants.id, item.productVariantId))
            .limit(1);

          if (productResult.length > 0) {
            productData = this.castProductVariantData(
              productResult[0].variant,
              productResult[0].product
            );
          }
        }

        itemsWithProducts.push({
          ...item,
          productVariant: productData,
        });
      }

      return {
        ...this.castOrderData(order),
        store,
        items: itemsWithProducts,
        _count: {
          items: createdItems.length,
        },
      } as OrderWithItems;
    });
  }

  /**
   * Get order with items and store data
   */
  async getOrderWithItems(orderId: string, organizationId: string): Promise<OrderWithItems | null> {
    // Get order
    const orderResult = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.id, orderId),
        eq(orders.organizationId, organizationId)
      ))
      .limit(1);

    if (orderResult.length === 0) return null;

    const order = orderResult[0];

    // Get store data
    const storeData = await db
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
      .where(eq(stores.id, order.storeId))
      .limit(1);

    const store: StoreWithRelations = {
      ...storeData[0],
      credentials: (storeData[0].credentials as Record<string, any>) || {},
      settings: (storeData[0].settings as Record<string, any>) || {},
      syncStatus: (storeData[0].syncStatus as 'active' | 'paused' | 'error') || 'active',
      lastSyncAt: storeData[0].lastSyncAt || undefined,
      platform: {
        ...storeData[0].platform,
        updatedAt: storeData[0].platform.createdAt, // Use createdAt as fallback for updatedAt
        apiConfig: (storeData[0].platform.apiConfig as Record<string, any>) || {},
      },
      _count: { products: 0, orders: 0 }
    };

    // Get order items with product data
    const items = await db
      .select({
        item: orderItems,
        productVariant: productVariants,
        product: products,
      })
      .from(orderItems)
      .leftJoin(productVariants, eq(orderItems.productVariantId, productVariants.id))
      .leftJoin(products, eq(productVariants.productId, products.id))
      .where(eq(orderItems.orderId, orderId))
      .orderBy(orderItems.createdAt);

    const itemsWithProducts: OrderItemWithProduct[] = items.map(row => ({
      ...row.item,
      updatedAt: row.item.createdAt, // Use createdAt as updatedAt
      productVariantId: row.item.productVariantId || undefined, // Convert null to undefined
      platformProductId: row.item.platformProductId || undefined,
      platformVariantId: row.item.platformVariantId || undefined,
      sku: row.item.sku || undefined,
      price: parseFloat(row.item.price), // Convert string to number
      totalAmount: parseFloat(row.item.totalAmount), // Convert string to number
      productVariant: row.productVariant && row.product ?
        this.castProductVariantData(row.productVariant, row.product) :
        undefined,
    }));

    return {
      ...this.castOrderData(order),
      store,
      items: itemsWithProducts,
      _count: {
        items: items.length,
      },
    } as OrderWithItems;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    organizationId: string,
    status: OrderStatus,
    financialStatus?: FinancialStatus,
    fulfillmentStatus?: FulfillmentStatus
  ): Promise<SelectOrder | null> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (financialStatus) {
      updateData.financialStatus = financialStatus;
    }

    if (fulfillmentStatus) {
      updateData.fulfillmentStatus = fulfillmentStatus;
    }

    const [order] = await db
      .update(orders)
      .set(updateData)
      .where(and(
        eq(orders.id, orderId),
        eq(orders.organizationId, organizationId)
      ))
      .returning();

    return order ? this.castOrderData(order) : null;
  }

  /**
   * Fulfill order (mark as shipped/delivered)
   */
  async fulfillOrder(
    orderId: string,
    organizationId: string,
    fulfillmentData: {
      trackingNumber?: string;
      carrier?: string;
      notes?: string;
    }
  ): Promise<SelectOrder | null> {
    return await db.transaction(async (tx) => {
      // Get order with items
      const order = await this.getOrderWithItems(orderId, organizationId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Update order status
      const [updatedOrder] = await tx
        .update(orders)
        .set({
          fulfillmentStatus: 'fulfilled',
          status: 'shipped',
          notes: fulfillmentData.notes ?
            `${order.notes || ''}\nFulfillment: ${fulfillmentData.notes}`.trim() :
            order.notes,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      // Process inventory for fulfilled items
      for (const item of order.items) {
        if (item.productVariantId) {
          try {
            // Convert reserved stock to sold
            // This would typically involve releasing reservation and recording sale
            // For now, we'll just record the sale transaction
            const defaultLocation = await tx
              .select({ id: stores.id })
              .from(stores)
              .where(eq(stores.organizationId, organizationId))
              .limit(1);

            if (defaultLocation.length > 0) {
              await this.inventoryService.updateStock(
                item.productVariantId,
                defaultLocation[0].id,
                -item.quantity,
                'sale',
                undefined,
                'order',
                orderId,
                `Sale from order ${order.orderNumber || orderId}`
              );
            }
          } catch (error) {
            console.warn(`Failed to process inventory for fulfilled order ${orderId}:`, error);
          }
        }
      }

      return this.castOrderData(updatedOrder);
    });
  }

  /**
   * Cancel order and release reservations
   */
  async cancelOrder(
    orderId: string,
    organizationId: string,
    reason?: string
  ): Promise<SelectOrder | null> {
    return await db.transaction(async (tx) => {
      // Get order with items
      const order = await this.getOrderWithItems(orderId, organizationId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Update order status
      const [updatedOrder] = await tx
        .update(orders)
        .set({
          status: 'cancelled',
          fulfillmentStatus: 'unfulfilled',
          notes: reason ?
            `${order.notes || ''}\nCancellation reason: ${reason}`.trim() :
            order.notes,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      // Release inventory reservations
      for (const item of order.items) {
        if (item.productVariantId) {
          try {
            const defaultLocation = await tx
              .select({ id: stores.id })
              .from(stores)
              .where(eq(stores.organizationId, organizationId))
              .limit(1);

            if (defaultLocation.length > 0) {
              await this.inventoryService.releaseReservation(
                item.productVariantId,
                defaultLocation[0].id,
                item.quantity,
                orderId
              );
            }
          } catch (error) {
            console.warn(`Failed to release reservation for cancelled order ${orderId}:`, error);
          }
        }
      }

      return this.castOrderData(updatedOrder);
    });
  }

  /**
   * Search orders with pagination and filters
   */
  async searchOrders(
    organizationId: string,
    options: {
      search?: string;
      storeId?: string;
      status?: OrderStatus;
      financialStatus?: FinancialStatus;
      fulfillmentStatus?: FulfillmentStatus;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
      sortBy?: 'orderedAt' | 'totalAmount' | 'createdAt' | 'updatedAt';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<PaginatedResponse<OrderWithItems>> {
    const {
      search,
      storeId,
      status,
      financialStatus,
      fulfillmentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'orderedAt',
      sortOrder = 'desc',
    } = options;

    // Build where conditions
    const conditions = [eq(orders.organizationId, organizationId)];

    if (search) {
      conditions.push(
        sql`(${orders.orderNumber} ILIKE ${`%${search}%`} OR ${orders.platformOrderId} ILIKE ${`%${search}%`} OR ${orders.customerInfo}->>'name' ILIKE ${`%${search}%`})`
      );
    }

    if (storeId) {
      conditions.push(eq(orders.storeId, storeId));
    }

    if (status) {
      conditions.push(eq(orders.status, status));
    }

    if (financialStatus) {
      conditions.push(eq(orders.financialStatus, financialStatus));
    }

    if (fulfillmentStatus) {
      conditions.push(eq(orders.fulfillmentStatus, fulfillmentStatus));
    }

    if (startDate) {
      conditions.push(gte(orders.orderedAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(orders.orderedAt, endDate));
    }

    // Build order by
    let orderByClause;
    switch (sortBy) {
      case 'orderedAt':
        orderByClause = sortOrder === 'asc' ? orders.orderedAt : desc(orders.orderedAt);
        break;
      case 'totalAmount':
        orderByClause = sortOrder === 'asc' ? orders.totalAmount : desc(orders.totalAmount);
        break;
      case 'updatedAt':
        orderByClause = sortOrder === 'asc' ? orders.updatedAt : desc(orders.updatedAt);
        break;
      case 'createdAt':
      default:
        orderByClause = sortOrder === 'asc' ? orders.createdAt : desc(orders.createdAt);
        break;
    }

    // Get orders
    const offset = (page - 1) * limit;
    const orderResults = await db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(orders)
      .where(and(...conditions));

    // Get full order data with items and store info
    const ordersWithItems: OrderWithItems[] = [];
    for (const order of orderResults) {
      const fullOrder = await this.getOrderWithItems(order.id, organizationId);
      if (fullOrder) {
        ordersWithItems.push(fullOrder);
      }
    }

    return createPaginatedResponse(ordersWithItems, total, { page, limit });
  }

  /**
   * Get order statistics for organization
   */
  async getOrderStats(
    organizationId: string,
    options: {
      storeId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    ordersByStatus: Record<string, number>;
    ordersByPlatform: Record<string, number>;
    recentOrders: number;
    pendingOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
  }> {
    const { storeId, startDate, endDate } = options;

    // Build base conditions
    const conditions = [eq(orders.organizationId, organizationId)];

    if (storeId) {
      conditions.push(eq(orders.storeId, storeId));
    }

    if (startDate) {
      conditions.push(gte(orders.orderedAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(orders.orderedAt, endDate));
    }

    // Get basic stats
    const [basicStats] = await db
      .select({
        totalOrders: count(),
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
        averageOrderValue: sql<number>`COALESCE(AVG(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
      })
      .from(orders)
      .where(and(...conditions));

    // Get orders by status
    const statusStats = await db
      .select({
        status: orders.status,
        count: count(),
      })
      .from(orders)
      .where(and(...conditions))
      .groupBy(orders.status);

    const ordersByStatus: Record<string, number> = {};
    statusStats.forEach(stat => {
      ordersByStatus[stat.status] = stat.count;
    });

    // Get orders by platform
    const platformStats = await db
      .select({
        platformName: platforms.displayName,
        count: count(),
      })
      .from(orders)
      .innerJoin(stores, eq(orders.storeId, stores.id))
      .innerJoin(platforms, eq(stores.platformId, platforms.id))
      .where(and(...conditions))
      .groupBy(platforms.displayName);

    const ordersByPlatform: Record<string, number> = {};
    platformStats.forEach(stat => {
      ordersByPlatform[stat.platformName] = stat.count;
    });

    // Get recent orders (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [recentStats] = await db
      .select({ count: count() })
      .from(orders)
      .where(and(
        ...conditions,
        gte(orders.orderedAt, sevenDaysAgo)
      ));

    return {
      totalOrders: basicStats.totalOrders || 0,
      totalRevenue: Number(basicStats.totalRevenue) || 0,
      averageOrderValue: Number(basicStats.averageOrderValue) || 0,
      ordersByStatus,
      ordersByPlatform,
      recentOrders: recentStats.count || 0,
      pendingOrders: ordersByStatus['pending'] || 0,
      shippedOrders: ordersByStatus['shipped'] || 0,
      deliveredOrders: ordersByStatus['delivered'] || 0,
    };
  }

  /**
   * Bulk update order statuses
   */
  async bulkUpdateOrders(
    orderIds: string[],
    organizationId: string,
    updates: {
      status?: OrderStatus;
      financialStatus?: FinancialStatus;
      fulfillmentStatus?: FulfillmentStatus;
      notes?: string;
    }
  ): Promise<{ updated: number; errors: Array<{ orderId: string; error: string }> }> {
    const results = {
      updated: 0,
      errors: [] as Array<{ orderId: string; error: string }>,
    };

    for (const orderId of orderIds) {
      try {
        await this.updateOrderStatus(
          orderId,
          organizationId,
          updates.status!,
          updates.financialStatus,
          updates.fulfillmentStatus
        );
        results.updated++;
      } catch (error) {
        results.errors.push({
          orderId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Import orders from external platform API
   */
  async importOrdersFromPlatform(
    storeId: string,
    organizationId: string,
    platformOrders: Array<{
      platformOrderId: string;
      orderNumber?: string;
      customerInfo: {
        name: string;
        email?: string;
        phone?: string;
        address: {
          street: string;
          city: string;
          state?: string;
          country: string;
          postalCode: string;
        };
      };
      status: OrderStatus;
      financialStatus?: FinancialStatus;
      fulfillmentStatus?: FulfillmentStatus;
      items: Array<{
        productVariantId?: string;
        platformProductId: string;
        platformVariantId?: string;
        name: string;
        sku?: string;
        quantity: number;
        price: number;
      }>;
      subtotal: number;
      taxAmount?: number;
      shippingAmount?: number;
      discountAmount?: number;
      totalAmount: number;
      currency?: string;
      platformData?: Record<string, any>;
      notes?: string;
      tags?: string[];
      orderedAt: Date;
    }>
  ): Promise<{
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{ platformOrderId: string; error: string }>;
  }> {
    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ platformOrderId: string; error: string }>,
    };

    for (const platformOrder of platformOrders) {
      try {
        // Check if order already exists
        const existingOrder = await db
          .select({ id: orders.id, updatedAt: orders.updatedAt })
          .from(orders)
          .where(and(
            eq(orders.storeId, storeId),
            eq(orders.platformOrderId, platformOrder.platformOrderId)
          ))
          .limit(1);

        if (existingOrder.length > 0) {
          // Update existing order if platform data is newer
          const platformOrderDate = new Date(platformOrder.orderedAt);
          if (platformOrderDate > existingOrder[0].updatedAt) {
            await this.updateOrderStatus(
              existingOrder[0].id,
              organizationId,
              platformOrder.status,
              platformOrder.financialStatus,
              platformOrder.fulfillmentStatus
            );
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          // Create new order
          await this.createOrder({
            organizationId,
            storeId,
            ...platformOrder,
          });
          results.imported++;
        }
      } catch (error) {
        results.errors.push({
          platformOrderId: platformOrder.platformOrderId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Sync order status back to platform
   */
  async syncOrderStatusToPlatform(
    orderId: string,
    organizationId: string,
    platformSyncData: {
      trackingNumber?: string;
      carrier?: string;
      fulfillmentStatus: FulfillmentStatus;
      notes?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get order details
      const order = await this.getOrderWithItems(orderId, organizationId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      // Update local order status
      await this.updateOrderStatus(
        orderId,
        organizationId,
        order.status as OrderStatus,
        order.financialStatus as FinancialStatus,
        platformSyncData.fulfillmentStatus
      );

      // Get store data for platform info
      const storeData = await db
        .select({
          id: stores.id,
          name: stores.name,
          platform: {
            id: platforms.id,
            name: platforms.name,
            displayName: platforms.displayName,
          }
        })
        .from(stores)
        .innerJoin(platforms, eq(stores.platformId, platforms.id))
        .where(eq(stores.id, order.storeId))
        .limit(1);

      // TODO: Implement actual platform API sync when platform adapters are available
      // This would call the appropriate platform adapter to sync the status
      console.log(`Syncing order ${order.platformOrderId} to platform ${storeData[0]?.platform.name || 'unknown'}`);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send customer notification
   */
  async sendCustomerNotification(
    orderId: string,
    organizationId: string,
    notificationType: 'order_confirmed' | 'order_shipped' | 'order_delivered' | 'order_cancelled',
    customMessage?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get order details
      const order = await this.getOrderWithItems(orderId, organizationId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      // TODO: Implement actual email/SMS notification service
      // This would integrate with email service (SendGrid, AWS SES, etc.)
      const customerEmail = (order.customerInfo as any)?.email;
      const customerName = (order.customerInfo as any)?.name;

      if (!customerEmail) {
        return { success: false, error: 'Customer email not available' };
      }

      // Log notification for now (replace with actual email service)
      console.log(`Sending ${notificationType} notification to ${customerEmail} for order ${order.orderNumber || orderId}`);
      console.log(`Customer: ${customerName}`);
      console.log(`Message: ${customMessage || 'Default notification message'}`);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get order analytics for dashboard
   */
  async getOrderAnalytics(
    organizationId: string,
    options: {
      storeId?: string;
      startDate?: Date;
      endDate?: Date;
      groupBy?: 'day' | 'week' | 'month';
    } = {}
  ): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    conversionRate: number;
    topProducts: Array<{
      productName: string;
      sku: string;
      quantity: number;
      revenue: number;
    }>;
    revenueByPeriod: Array<{
      period: string;
      revenue: number;
      orders: number;
    }>;
    ordersByStatus: Record<string, number>;
  }> {
    const { storeId, startDate, endDate, groupBy = 'day' } = options;

    // Build base conditions
    const conditions = [eq(orders.organizationId, organizationId)];

    if (storeId) {
      conditions.push(eq(orders.storeId, storeId));
    }

    if (startDate) {
      conditions.push(gte(orders.orderedAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(orders.orderedAt, endDate));
    }

    // Get basic stats
    const [basicStats] = await db
      .select({
        totalOrders: count(),
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
        averageOrderValue: sql<number>`COALESCE(AVG(CAST(${orders.totalAmount} AS DECIMAL)), 0)`,
      })
      .from(orders)
      .where(and(...conditions));

    // Get orders by status
    const statusStats = await db
      .select({
        status: orders.status,
        count: count(),
      })
      .from(orders)
      .where(and(...conditions))
      .groupBy(orders.status);

    const ordersByStatus: Record<string, number> = {};
    statusStats.forEach(stat => {
      ordersByStatus[stat.status] = stat.count;
    });

    // Get top products
    const topProducts = await db
      .select({
        productName: orderItems.name,
        sku: orderItems.sku,
        quantity: sql<number>`SUM(${orderItems.quantity})`,
        revenue: sql<number>`SUM(CAST(${orderItems.totalAmount} AS DECIMAL))`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(...conditions))
      .groupBy(orderItems.name, orderItems.sku)
      .orderBy(desc(sql`SUM(CAST(${orderItems.totalAmount} AS DECIMAL))`))
      .limit(10);

    // TODO: Implement revenue by period grouping based on groupBy parameter
    const revenueByPeriod: Array<{ period: string; revenue: number; orders: number }> = [];

    return {
      totalOrders: basicStats.totalOrders || 0,
      totalRevenue: Number(basicStats.totalRevenue) || 0,
      averageOrderValue: Number(basicStats.averageOrderValue) || 0,
      conversionRate: 0, // TODO: Calculate based on visitor data when available
      topProducts: topProducts.map(product => ({
        productName: product.productName,
        sku: product.sku || '',
        quantity: Number(product.quantity) || 0,
        revenue: Number(product.revenue) || 0,
      })),
      revenueByPeriod,
      ordersByStatus,
    };
  }

  /**
   * Get orders requiring attention (pending, failed, etc.)
   */
  async getOrdersRequiringAttention(organizationId: string): Promise<{
    pendingPayment: OrderWithItems[];
    failedOrders: OrderWithItems[];
    lowStockOrders: OrderWithItems[];
    oldUnfulfilled: OrderWithItems[];
  }> {
    // Get orders pending payment
    const pendingPayment = await this.searchOrders(organizationId, {
      financialStatus: 'pending',
      limit: 10,
    });

    // Get failed orders (cancelled or error status)
    const failedOrders = await this.searchOrders(organizationId, {
      status: 'cancelled',
      limit: 10,
    });

    // Get old unfulfilled orders (more than 3 days old)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const oldUnfulfilled = await this.searchOrders(organizationId, {
      fulfillmentStatus: 'unfulfilled',
      endDate: threeDaysAgo,
      limit: 10,
    });

    return {
      pendingPayment: pendingPayment.data,
      failedOrders: failedOrders.data,
      lowStockOrders: [], // TODO: Implement when inventory integration is complete
      oldUnfulfilled: oldUnfulfilled.data,
    };
  }
}