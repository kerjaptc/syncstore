import { db } from '@/lib/db';
import { 
  orders, 
  orderItems, 
  inventoryItems,
  inventoryTransactions,
  productVariants,
  products
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { InventoryService } from './inventory-service';
import type { CartItem } from '@/hooks/use-cart';

/**
 * Customer information for checkout
 */
export interface CustomerInfo {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address: {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
}

/**
 * Shipping information
 */
export interface ShippingInfo {
  method: 'standard' | 'express';
  cost: number;
  estimatedDays: number;
}

/**
 * Payment information
 */
export interface PaymentInfo {
  method: 'stripe' | 'paypal';
  paymentIntentId?: string;
  sessionId?: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
}

/**
 * Order creation input
 */
export interface CreateOrderInput {
  items: CartItem[];
  customer: CustomerInfo;
  shipping: ShippingInfo;
  payment: PaymentInfo;
  organizationId: string; // For custom website orders
  notes?: string;
}

/**
 * Order totals calculation
 */
export interface OrderTotals {
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
}

/**
 * Checkout service for processing orders and payments
 */
export class CheckoutService {
  private inventoryService = new InventoryService();

  /**
   * Calculate order totals
   */
  calculateTotals(items: CartItem[], shippingCost: number = 0): OrderTotals {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.11; // 11% tax rate
    const discount = 0; // TODO: Implement discount logic
    const total = subtotal + shippingCost + tax - discount;

    return {
      subtotal,
      shipping: shippingCost,
      tax,
      discount,
      total
    };
  }

  /**
   * Validate cart items and check inventory
   */
  async validateCartItems(items: CartItem[]): Promise<{
    valid: boolean;
    errors: string[];
    updatedItems: CartItem[];
  }> {
    const errors: string[] = [];
    const updatedItems: CartItem[] = [];

    for (const item of items) {
      try {
        // Get current inventory for the variant
        const inventory = await this.inventoryService.getInventoryByVariant(item.id);
        const availableQuantity = inventory.reduce(
          (sum, inv) => sum + (inv.quantityOnHand - inv.quantityReserved), 
          0
        );

        if (availableQuantity === 0) {
          errors.push(`${item.productName} is out of stock`);
          continue;
        }

        if (item.quantity > availableQuantity) {
          errors.push(
            `Only ${availableQuantity} units of ${item.productName} are available`
          );
          // Update quantity to available amount
          updatedItems.push({
            ...item,
            quantity: availableQuantity,
            maxQuantity: availableQuantity
          });
        } else {
          updatedItems.push({
            ...item,
            maxQuantity: availableQuantity
          });
        }
      } catch (error) {
        console.error(`Error validating item ${item.id}:`, error);
        errors.push(`Unable to validate ${item.productName}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      updatedItems
    };
  }

  /**
   * Reserve inventory for order items
   */
  async reserveInventory(items: CartItem[], orderId: string): Promise<void> {
    for (const item of items) {
      try {
        await this.inventoryService.reserveStock(
          item.id, // variant ID
          item.quantity,
          orderId
        );
      } catch (error) {
        console.error(`Error reserving inventory for item ${item.id}:`, error);
        // Rollback previous reservations
        await this.releaseInventoryReservations(orderId);
        throw new Error(`Failed to reserve inventory for ${item.productName}`);
      }
    }
  }

  /**
   * Release inventory reservations
   */
  async releaseInventoryReservations(orderId: string): Promise<void> {
    try {
      await this.inventoryService.releaseReservation(orderId);
    } catch (error) {
      console.error(`Error releasing reservations for order ${orderId}:`, error);
    }
  }

  /**
   * Create order in database
   */
  async createOrder(input: CreateOrderInput): Promise<string> {
    const totals = this.calculateTotals(input.items, input.shipping.cost);
    
    return await db.transaction(async (tx) => {
      // Create order
      const [order] = await tx.insert(orders).values({
        organizationId: input.organizationId,
        storeId: null, // Custom website orders don't have a store ID
        platformOrderId: `WEB-${Date.now()}`, // Generate unique platform order ID
        orderNumber: `ORD-${Date.now()}`,
        customerInfo: {
          name: `${input.customer.firstName} ${input.customer.lastName}`,
          email: input.customer.email,
          phone: input.customer.phone,
          address: input.customer.address
        },
        status: input.payment.status === 'succeeded' ? 'paid' : 'pending',
        financialStatus: input.payment.status === 'succeeded' ? 'paid' : 'pending',
        fulfillmentStatus: 'unfulfilled',
        subtotal: totals.subtotal.toString(),
        taxAmount: totals.tax.toString(),
        shippingAmount: totals.shipping.toString(),
        discountAmount: totals.discount.toString(),
        totalAmount: totals.total.toString(),
        currency: 'IDR',
        platformData: {
          paymentMethod: input.payment.method,
          paymentIntentId: input.payment.paymentIntentId,
          sessionId: input.payment.sessionId,
          shippingMethod: input.shipping.method
        },
        notes: input.notes,
        orderedAt: new Date()
      }).returning({ id: orders.id });

      // Create order items
      for (const item of input.items) {
        await tx.insert(orderItems).values({
          orderId: order.id,
          productVariantId: item.id,
          name: item.productName + (item.variantName ? ` - ${item.variantName}` : ''),
          sku: item.sku,
          quantity: item.quantity,
          price: item.price.toString(),
          totalAmount: (item.price * item.quantity).toString()
        });
      }

      return order.id;
    });
  }

  /**
   * Process order after successful payment
   */
  async processOrder(orderId: string, paymentInfo: PaymentInfo): Promise<void> {
    await db.transaction(async (tx) => {
      // Update order status
      await tx.update(orders)
        .set({
          status: 'paid',
          financialStatus: 'paid',
          platformData: sql`${orders.platformData} || ${JSON.stringify({
            paymentIntentId: paymentInfo.paymentIntentId,
            sessionId: paymentInfo.sessionId,
            paymentStatus: paymentInfo.status,
            processedAt: new Date().toISOString()
          })}`
        })
        .where(eq(orders.id, orderId));

      // Convert inventory reservations to actual sales
      const orderItemsData = await tx.select({
        productVariantId: orderItems.productVariantId,
        quantity: orderItems.quantity
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

      for (const item of orderItemsData) {
        if (item.productVariantId) {
          // Remove from inventory (convert reservation to sale)
          await this.inventoryService.processOrderFulfillment(
            item.productVariantId,
            item.quantity,
            orderId
          );
        }
      }
    });
  }

  /**
   * Cancel order and release reservations
   */
  async cancelOrder(orderId: string, reason?: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Update order status
      await tx.update(orders)
        .set({
          status: 'cancelled',
          notes: sql`COALESCE(${orders.notes}, '') || ${`\nCancelled: ${reason || 'No reason provided'}`}`
        })
        .where(eq(orders.id, orderId));

      // Release inventory reservations
      await this.releaseInventoryReservations(orderId);
    });
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string) {
    const [order] = await db.select()
      .from(orders)
      .where(eq(orders.id, orderId));

    if (!order) {
      return null;
    }

    const items = await db.select({
      id: orderItems.id,
      productVariantId: orderItems.productVariantId,
      name: orderItems.name,
      sku: orderItems.sku,
      quantity: orderItems.quantity,
      price: orderItems.price,
      totalAmount: orderItems.totalAmount,
      productName: products.name,
      variantName: productVariants.name
    })
    .from(orderItems)
    .leftJoin(productVariants, eq(orderItems.productVariantId, productVariants.id))
    .leftJoin(products, eq(productVariants.productId, products.id))
    .where(eq(orderItems.orderId, orderId));

    return {
      ...order,
      items
    };
  }

  /**
   * Calculate shipping cost based on items and address
   */
  calculateShippingCost(
    items: CartItem[], 
    shippingMethod: 'standard' | 'express',
    address: CustomerInfo['address']
  ): number {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Free shipping for orders over 500,000 IDR
    if (subtotal >= 500000) {
      return 0;
    }

    // Base shipping rates
    const rates = {
      standard: 25000,
      express: 50000
    };

    // TODO: Implement location-based shipping calculation
    return rates[shippingMethod];
  }

  /**
   * Get available shipping methods
   */
  getShippingMethods(items: CartItem[], address: CustomerInfo['address']): ShippingInfo[] {
    return [
      {
        method: 'standard',
        cost: this.calculateShippingCost(items, 'standard', address),
        estimatedDays: 5
      },
      {
        method: 'express',
        cost: this.calculateShippingCost(items, 'express', address),
        estimatedDays: 2
      }
    ];
  }
}