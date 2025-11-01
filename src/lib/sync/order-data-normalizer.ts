/**
 * Order Data Normalizer
 * Handles platform-specific order data transformation and normalization
 */

import { OrderStatus, FinancialStatus, FulfillmentStatus } from '@/types';
import type { PlatformOrder } from '@/types';

export interface NormalizedOrder {
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
  financialStatus: FinancialStatus;
  fulfillmentStatus: FulfillmentStatus;
  items: Array<{
    platformProductId: string;
    platformVariantId?: string;
    name: string;
    sku?: string;
    quantity: number;
    price: number;
    totalAmount: number;
  }>;
  totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
  };
  currency: string;
  orderedAt: Date;
  platformData: Record<string, any>;
  notes?: string;
  tags?: string[];
}

export interface OrderStatusMapping {
  platform: string;
  mappings: Array<{
    platformStatus: string;
    localStatus: OrderStatus;
    financialStatus: FinancialStatus;
    fulfillmentStatus: FulfillmentStatus;
    description?: string;
  }>;
}

export interface PlatformOrderTransformer {
  platform: string;
  transformOrder(platformOrder: any): NormalizedOrder;
  transformOrderStatus(platformStatus: string): {
    status: OrderStatus;
    financialStatus: FinancialStatus;
    fulfillmentStatus: FulfillmentStatus;
  };
  reverseTransformStatus(localStatus: OrderStatus): string;
}

export class OrderDataNormalizer {
  private statusMappings: Map<string, OrderStatusMapping['mappings']> = new Map();
  private transformers: Map<string, PlatformOrderTransformer> = new Map();

  constructor() {
    this.initializeStatusMappings();
    this.initializeTransformers();
  }

  /**
   * Initialize platform-specific status mappings
   */
  private initializeStatusMappings(): void {
    // Shopee status mappings
    this.statusMappings.set('shopee', [
      {
        platformStatus: 'UNPAID',
        localStatus: 'pending',
        financialStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        description: 'Order created but payment not received',
      },
      {
        platformStatus: 'TO_CONFIRM',
        localStatus: 'pending',
        financialStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        description: 'Payment received, awaiting confirmation',
      },
      {
        platformStatus: 'TO_SHIP',
        localStatus: 'paid',
        financialStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        description: 'Order confirmed and ready to ship',
      },
      {
        platformStatus: 'SHIPPED',
        localStatus: 'shipped',
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        description: 'Order has been shipped',
      },
      {
        platformStatus: 'COMPLETED',
        localStatus: 'delivered',
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        description: 'Order delivered and completed',
      },
      {
        platformStatus: 'CANCELLED',
        localStatus: 'cancelled',
        financialStatus: 'refunded',
        fulfillmentStatus: 'unfulfilled',
        description: 'Order cancelled',
      },
      {
        platformStatus: 'IN_CANCEL',
        localStatus: 'cancelled',
        financialStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        description: 'Order cancellation in progress',
      },
      {
        platformStatus: 'INVOICE_PENDING',
        localStatus: 'pending',
        financialStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        description: 'Invoice pending',
      },
    ]);

    // TikTok Shop status mappings
    this.statusMappings.set('tiktok_shop', [
      {
        platformStatus: 'AWAITING_PAYMENT',
        localStatus: 'pending',
        financialStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        description: 'Awaiting payment from customer',
      },
      {
        platformStatus: 'AWAITING_SHIPMENT',
        localStatus: 'paid',
        financialStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        description: 'Payment received, awaiting shipment',
      },
      {
        platformStatus: 'AWAITING_COLLECTION',
        localStatus: 'paid',
        financialStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        description: 'Ready for collection',
      },
      {
        platformStatus: 'IN_TRANSIT',
        localStatus: 'shipped',
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        description: 'Package in transit',
      },
      {
        platformStatus: 'DELIVERED',
        localStatus: 'delivered',
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        description: 'Package delivered',
      },
      {
        platformStatus: 'COMPLETED',
        localStatus: 'delivered',
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        description: 'Order completed',
      },
      {
        platformStatus: 'CANCELLED',
        localStatus: 'cancelled',
        financialStatus: 'refunded',
        fulfillmentStatus: 'unfulfilled',
        description: 'Order cancelled',
      },
    ]);

    // Custom website status mappings
    this.statusMappings.set('custom_website', [
      {
        platformStatus: 'pending',
        localStatus: 'pending',
        financialStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        description: 'Order pending payment',
      },
      {
        platformStatus: 'paid',
        localStatus: 'paid',
        financialStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        description: 'Payment received',
      },
      {
        platformStatus: 'processing',
        localStatus: 'paid',
        financialStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        description: 'Order being processed',
      },
      {
        platformStatus: 'shipped',
        localStatus: 'shipped',
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        description: 'Order shipped',
      },
      {
        platformStatus: 'delivered',
        localStatus: 'delivered',
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        description: 'Order delivered',
      },
      {
        platformStatus: 'cancelled',
        localStatus: 'cancelled',
        financialStatus: 'refunded',
        fulfillmentStatus: 'unfulfilled',
        description: 'Order cancelled',
      },
      {
        platformStatus: 'refunded',
        localStatus: 'cancelled',
        financialStatus: 'refunded',
        fulfillmentStatus: 'unfulfilled',
        description: 'Order refunded',
      },
    ]);
  }

  /**
   * Initialize platform-specific transformers
   */
  private initializeTransformers(): void {
    // Shopee transformer
    this.transformers.set('shopee', {
      platform: 'shopee',
      transformOrder: (platformOrder: any): NormalizedOrder => {
        return {
          platformOrderId: platformOrder.order_sn,
          orderNumber: platformOrder.order_sn,
          customerInfo: {
            name: platformOrder.recipient_address?.name || 'Unknown',
            email: platformOrder.buyer_user_id ? `user_${platformOrder.buyer_user_id}@shopee.local` : undefined,
            phone: platformOrder.recipient_address?.phone || undefined,
            address: {
              street: `${platformOrder.recipient_address?.full_address || ''} ${platformOrder.recipient_address?.town || ''}`.trim(),
              city: platformOrder.recipient_address?.city || '',
              state: platformOrder.recipient_address?.state || undefined,
              country: platformOrder.recipient_address?.country || 'ID',
              postalCode: platformOrder.recipient_address?.zipcode || '',
            },
          },
          status: this.transformOrderStatus('shopee', platformOrder.order_status).status,
          financialStatus: this.transformOrderStatus('shopee', platformOrder.order_status).financialStatus,
          fulfillmentStatus: this.transformOrderStatus('shopee', platformOrder.order_status).fulfillmentStatus,
          items: (platformOrder.item_list || []).map((item: any) => ({
            platformProductId: item.item_id?.toString() || '',
            platformVariantId: item.variation_id?.toString() || undefined,
            name: item.item_name || '',
            sku: item.item_sku || undefined,
            quantity: item.variation_quantity_purchased || 1,
            price: parseFloat(item.variation_original_price || '0'),
            totalAmount: parseFloat(item.variation_original_price || '0') * (item.variation_quantity_purchased || 1),
          })),
          totals: {
            subtotal: parseFloat(platformOrder.total_amount || '0'),
            tax: 0, // Shopee doesn't separate tax
            shipping: parseFloat(platformOrder.shipping_fee || '0'),
            discount: parseFloat(platformOrder.voucher_absorbed_by_seller || '0') + parseFloat(platformOrder.coin_offset || '0'),
            total: parseFloat(platformOrder.total_amount || '0'),
          },
          currency: platformOrder.currency || 'IDR',
          orderedAt: new Date(platformOrder.create_time * 1000),
          platformData: platformOrder,
          notes: platformOrder.note || undefined,
          tags: platformOrder.order_flag ? [platformOrder.order_flag] : undefined,
        };
      },
      transformOrderStatus: (platformStatus: string) => {
        return this.transformOrderStatus('shopee', platformStatus);
      },
      reverseTransformStatus: (localStatus: OrderStatus): string => {
        return this.reverseTransformStatus('shopee', localStatus);
      },
    });

    // TikTok Shop transformer
    this.transformers.set('tiktok_shop', {
      platform: 'tiktok_shop',
      transformOrder: (platformOrder: any): NormalizedOrder => {
        return {
          platformOrderId: platformOrder.order_id,
          orderNumber: platformOrder.order_id,
          customerInfo: {
            name: platformOrder.recipient_info?.name || 'Unknown',
            email: platformOrder.buyer_email || undefined,
            phone: platformOrder.recipient_info?.phone || undefined,
            address: {
              street: `${platformOrder.recipient_info?.address_line_1 || ''} ${platformOrder.recipient_info?.address_line_2 || ''}`.trim(),
              city: platformOrder.recipient_info?.city || '',
              state: platformOrder.recipient_info?.state || undefined,
              country: platformOrder.recipient_info?.region_code || 'ID',
              postalCode: platformOrder.recipient_info?.postal_code || '',
            },
          },
          status: this.transformOrderStatus('tiktok_shop', platformOrder.order_status).status,
          financialStatus: this.transformOrderStatus('tiktok_shop', platformOrder.order_status).financialStatus,
          fulfillmentStatus: this.transformOrderStatus('tiktok_shop', platformOrder.order_status).fulfillmentStatus,
          items: (platformOrder.order_lines || []).map((item: any) => ({
            platformProductId: item.product_id?.toString() || '',
            platformVariantId: item.sku_id?.toString() || undefined,
            name: item.product_name || '',
            sku: item.seller_sku || undefined,
            quantity: item.quantity || 1,
            price: parseFloat(item.sale_price || '0'),
            totalAmount: parseFloat(item.sale_price || '0') * (item.quantity || 1),
          })),
          totals: {
            subtotal: parseFloat(platformOrder.payment_info?.subtotal_after_seller_discounts || '0'),
            tax: parseFloat(platformOrder.payment_info?.taxes || '0'),
            shipping: parseFloat(platformOrder.payment_info?.shipping_fee || '0'),
            discount: parseFloat(platformOrder.payment_info?.seller_discount || '0') + parseFloat(platformOrder.payment_info?.platform_discount || '0'),
            total: parseFloat(platformOrder.payment_info?.total_amount || '0'),
          },
          currency: platformOrder.payment_info?.currency || 'IDR',
          orderedAt: new Date(platformOrder.create_time * 1000),
          platformData: platformOrder,
          notes: platformOrder.buyer_message || undefined,
          tags: platformOrder.fulfillment_type ? [platformOrder.fulfillment_type] : undefined,
        };
      },
      transformOrderStatus: (platformStatus: string) => {
        return this.transformOrderStatus('tiktok_shop', platformStatus);
      },
      reverseTransformStatus: (localStatus: OrderStatus): string => {
        return this.reverseTransformStatus('tiktok_shop', localStatus);
      },
    });

    // Custom website transformer
    this.transformers.set('custom_website', {
      platform: 'custom_website',
      transformOrder: (platformOrder: any): NormalizedOrder => {
        return {
          platformOrderId: platformOrder.id,
          orderNumber: platformOrder.order_number || platformOrder.id,
          customerInfo: platformOrder.customer_info || {
            name: 'Unknown',
            address: {
              street: '',
              city: '',
              country: 'ID',
              postalCode: '',
            },
          },
          status: this.transformOrderStatus('custom_website', platformOrder.status).status,
          financialStatus: this.transformOrderStatus('custom_website', platformOrder.status).financialStatus,
          fulfillmentStatus: this.transformOrderStatus('custom_website', platformOrder.status).fulfillmentStatus,
          items: platformOrder.items || [],
          totals: platformOrder.totals || {
            subtotal: 0,
            tax: 0,
            shipping: 0,
            discount: 0,
            total: 0,
          },
          currency: platformOrder.currency || 'IDR',
          orderedAt: new Date(platformOrder.created_at || Date.now()),
          platformData: platformOrder,
          notes: platformOrder.notes,
          tags: platformOrder.tags,
        };
      },
      transformOrderStatus: (platformStatus: string) => {
        return this.transformOrderStatus('custom_website', platformStatus);
      },
      reverseTransformStatus: (localStatus: OrderStatus): string => {
        return this.reverseTransformStatus('custom_website', localStatus);
      },
    });
  }

  /**
   * Normalize order data from any platform
   */
  normalizeOrder(platformName: string, platformOrder: any): NormalizedOrder {
    const transformer = this.transformers.get(platformName);
    if (!transformer) {
      throw new Error(`No transformer found for platform: ${platformName}`);
    }

    try {
      const normalizedOrder = transformer.transformOrder(platformOrder);
      
      // Validate normalized order
      this.validateNormalizedOrder(normalizedOrder);
      
      return normalizedOrder;
    } catch (error) {
      throw new Error(`Failed to normalize order from ${platformName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transform platform status to local status
   */
  transformOrderStatus(
    platformName: string,
    platformStatus: string
  ): {
    status: OrderStatus;
    financialStatus: FinancialStatus;
    fulfillmentStatus: FulfillmentStatus;
  } {
    const mappings = this.statusMappings.get(platformName);
    if (!mappings) {
      // Default mapping for unknown platforms
      return {
        status: 'pending',
        financialStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
      };
    }

    const mapping = mappings.find(m => m.platformStatus === platformStatus);
    if (!mapping) {
      console.warn(`Unknown status "${platformStatus}" for platform "${platformName}"`);
      return {
        status: 'pending',
        financialStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
      };
    }

    return {
      status: mapping.localStatus,
      financialStatus: mapping.financialStatus,
      fulfillmentStatus: mapping.fulfillmentStatus,
    };
  }

  /**
   * Reverse transform local status to platform status
   */
  reverseTransformStatus(platformName: string, localStatus: OrderStatus): string {
    const mappings = this.statusMappings.get(platformName);
    if (!mappings) {
      return localStatus; // Return as-is if no mapping
    }

    const mapping = mappings.find(m => m.localStatus === localStatus);
    return mapping?.platformStatus || localStatus;
  }

  /**
   * Get all supported platforms
   */
  getSupportedPlatforms(): string[] {
    return Array.from(this.transformers.keys());
  }

  /**
   * Get status mappings for a platform
   */
  getStatusMappings(platformName: string): OrderStatusMapping['mappings'] | undefined {
    return this.statusMappings.get(platformName);
  }

  /**
   * Add custom platform transformer
   */
  addPlatformTransformer(transformer: PlatformOrderTransformer): void {
    this.transformers.set(transformer.platform, transformer);
  }

  /**
   * Add custom status mappings
   */
  addStatusMappings(platformName: string, mappings: OrderStatusMapping['mappings']): void {
    this.statusMappings.set(platformName, mappings);
  }

  /**
   * Validate normalized order data
   */
  private validateNormalizedOrder(order: NormalizedOrder): void {
    if (!order.platformOrderId) {
      throw new Error('Platform order ID is required');
    }

    if (!order.customerInfo?.name) {
      throw new Error('Customer name is required');
    }

    if (!order.customerInfo?.address?.city) {
      throw new Error('Customer city is required');
    }

    if (!order.items || order.items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    for (const item of order.items) {
      if (!item.platformProductId) {
        throw new Error('Item platform product ID is required');
      }
      if (!item.name) {
        throw new Error('Item name is required');
      }
      if (item.quantity <= 0) {
        throw new Error('Item quantity must be greater than 0');
      }
      if (item.price < 0) {
        throw new Error('Item price cannot be negative');
      }
    }

    if (!order.currency) {
      throw new Error('Currency is required');
    }

    if (!order.orderedAt) {
      throw new Error('Order date is required');
    }
  }

  /**
   * Normalize order batch
   */
  normalizeOrderBatch(
    platformName: string,
    platformOrders: any[]
  ): {
    normalized: NormalizedOrder[];
    errors: Array<{ index: number; error: string; originalOrder: any }>;
  } {
    const normalized: NormalizedOrder[] = [];
    const errors: Array<{ index: number; error: string; originalOrder: any }> = [];

    for (let i = 0; i < platformOrders.length; i++) {
      try {
        const normalizedOrder = this.normalizeOrder(platformName, platformOrders[i]);
        normalized.push(normalizedOrder);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error',
          originalOrder: platformOrders[i],
        });
      }
    }

    return { normalized, errors };
  }

  /**
   * Get order normalization statistics
   */
  getNormalizationStats(
    platformName: string,
    results: { normalized: NormalizedOrder[]; errors: any[] }
  ): {
    totalOrders: number;
    successfullyNormalized: number;
    failed: number;
    successRate: number;
    errorsByType: Record<string, number>;
  } {
    const totalOrders = results.normalized.length + results.errors.length;
    const successfullyNormalized = results.normalized.length;
    const failed = results.errors.length;
    const successRate = totalOrders > 0 ? (successfullyNormalized / totalOrders) * 100 : 0;

    // Categorize errors
    const errorsByType: Record<string, number> = {};
    for (const error of results.errors) {
      const errorType = this.categorizeError(error.error);
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    }

    return {
      totalOrders,
      successfullyNormalized,
      failed,
      successRate,
      errorsByType,
    };
  }

  /**
   * Categorize error types for analytics
   */
  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('Platform order ID')) return 'missing_order_id';
    if (errorMessage.includes('Customer name')) return 'missing_customer_name';
    if (errorMessage.includes('Customer city')) return 'missing_customer_address';
    if (errorMessage.includes('at least one item')) return 'no_items';
    if (errorMessage.includes('platform product ID')) return 'missing_product_id';
    if (errorMessage.includes('quantity')) return 'invalid_quantity';
    if (errorMessage.includes('price')) return 'invalid_price';
    if (errorMessage.includes('Currency')) return 'missing_currency';
    if (errorMessage.includes('Order date')) return 'missing_date';
    return 'unknown_error';
  }
}

// Export singleton instance
export const orderDataNormalizer = new OrderDataNormalizer();