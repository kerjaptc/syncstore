/**
 * TikTok Shop Data Transformer
 * Handles data transformation between TikTok Shop API format and platform-agnostic format
 */

import {
  PlatformProduct,
  PlatformProductVariant,
  PlatformOrder,
  PlatformOrderItem,
} from '../types';
import type {
  TikTokShopProduct,
  TikTokShopSku,
  TikTokShopOrder,
  TikTokShopOrderLine,
  TikTokShopProductRequest,
} from './tiktokshop-types';

export class TikTokShopDataTransformer {
  /**
   * Transform TikTok Shop product to platform-agnostic format
   */
  transformProduct(tiktokProduct: TikTokShopProduct): PlatformProduct {
    const variants: PlatformProductVariant[] = tiktokProduct.skus.map(sku => 
      this.transformProductVariant(sku, tiktokProduct)
    );

    return {
      platformProductId: tiktokProduct.id,
      name: tiktokProduct.title,
      description: tiktokProduct.description,
      category: tiktokProduct.category_id,
      brand: tiktokProduct.brand_id || '',
      images: tiktokProduct.images.map(img => img.url),
      variants,
      status: this.mapProductStatus(tiktokProduct.status),
      platformData: {
        tiktokShopData: tiktokProduct,
        categoryId: tiktokProduct.category_id,
        brandId: tiktokProduct.brand_id,
        video: tiktokProduct.video,
        certifications: tiktokProduct.product_certifications,
        sizeChart: tiktokProduct.size_chart,
        packageWeight: tiktokProduct.package_weight,
        packageDimensions: tiktokProduct.package_dimensions,
        deliveryOptions: tiktokProduct.delivery_options,
        isCodAllowed: tiktokProduct.is_cod_allowed,
      },
    };
  }

  /**
   * Transform TikTok Shop SKU to platform-agnostic variant
   */
  private transformProductVariant(tiktokSku: TikTokShopSku, parentProduct: TikTokShopProduct): PlatformProductVariant {
    const totalInventory = tiktokSku.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
    
    // Build variant name from sales attributes
    const attributeNames = tiktokSku.sales_attributes
      .map(attr => `${attr.attribute_name}: ${attr.value_name}`)
      .join(', ');
    
    const variantName = attributeNames 
      ? `${parentProduct.title} - ${attributeNames}`
      : parentProduct.title;

    return {
      platformVariantId: tiktokSku.id,
      name: variantName,
      sku: tiktokSku.seller_sku || '',
      price: parseFloat(tiktokSku.price.amount),
      compareAtPrice: undefined, // TikTok Shop doesn't have compare at price in SKU
      inventory: {
        quantity: totalInventory,
        tracked: true,
      },
      attributes: {
        salesAttributes: tiktokSku.sales_attributes,
        identifierCode: tiktokSku.identifier_code,
        warehouseInventory: tiktokSku.inventory,
      },
      images: tiktokSku.sales_attributes
        .filter(attr => attr.sku_img)
        .map(attr => attr.sku_img!.url),
      status: 'active', // TikTok Shop SKUs don't have individual status
    };
  }

  /**
   * Transform TikTok Shop order to platform-agnostic format
   */
  transformOrder(tiktokOrder: TikTokShopOrder): PlatformOrder {
    return {
      platformOrderId: tiktokOrder.id,
      orderNumber: tiktokOrder.id,
      status: this.mapOrderStatus(tiktokOrder.status),
      financialStatus: this.mapFinancialStatus(tiktokOrder.status),
      fulfillmentStatus: this.mapFulfillmentStatus(tiktokOrder.status),
      customer: {
        name: tiktokOrder.buyer_info.name || tiktokOrder.recipient_info.name,
        email: tiktokOrder.buyer_info.email || '',
        phone: tiktokOrder.buyer_info.phone || tiktokOrder.recipient_info.phone,
        address: {
          street: tiktokOrder.recipient_info.address.full_address,
          city: tiktokOrder.recipient_info.address.city,
          state: tiktokOrder.recipient_info.address.state,
          country: tiktokOrder.recipient_info.address.region,
          postalCode: tiktokOrder.recipient_info.address.postal_code,
        },
      },
      items: tiktokOrder.order_lines.map(line => this.transformOrderItem(line)),
      totals: {
        subtotal: parseFloat(tiktokOrder.payment_info.sub_total.amount),
        tax: parseFloat(tiktokOrder.payment_info.tax_amount?.amount || '0'),
        shipping: parseFloat(tiktokOrder.payment_info.shipping_fee?.amount || '0'),
        discount: this.calculateTotalDiscount(tiktokOrder),
        total: parseFloat(tiktokOrder.payment_info.total_amount.amount),
      },
      currency: tiktokOrder.payment_info.currency,
      orderedAt: new Date(tiktokOrder.create_time * 1000),
      platformData: {
        tiktokShopData: tiktokOrder,
        buyerMessage: tiktokOrder.buyer_message,
        cancelReason: tiktokOrder.cancel_reason,
        cancelUser: tiktokOrder.cancel_user,
        fulfillmentType: tiktokOrder.fulfillment_type,
        warehouseId: tiktokOrder.warehouse_id,
        collectionDueTime: tiktokOrder.collection_due_time ? new Date(tiktokOrder.collection_due_time * 1000) : undefined,
        deliveryDueTime: tiktokOrder.delivery_due_time ? new Date(tiktokOrder.delivery_due_time * 1000) : undefined,
        deliveryInfo: tiktokOrder.delivery_info,
        promotionInfo: tiktokOrder.promotion_info,
        isSampleOrder: tiktokOrder.is_sample_order,
        isReplacementOrder: tiktokOrder.is_replacement_order,
        cpf: tiktokOrder.cpf,
      },
    };
  }

  /**
   * Transform TikTok Shop order line to platform-agnostic order item
   */
  private transformOrderItem(tiktokLine: TikTokShopOrderLine): PlatformOrderItem {
    return {
      platformProductId: tiktokLine.product_id,
      platformVariantId: tiktokLine.sku_id,
      name: tiktokLine.product_name,
      sku: tiktokLine.seller_sku || '',
      quantity: tiktokLine.quantity,
      price: parseFloat(tiktokLine.sale_price.amount),
      totalAmount: parseFloat(tiktokLine.sale_price.amount) * tiktokLine.quantity,
    };
  }

  /**
   * Transform platform-agnostic product to TikTok Shop format for creation
   */
  transformToTikTokShopProduct(product: Partial<PlatformProduct>): Partial<TikTokShopProductRequest> {
    const tiktokProduct: Partial<TikTokShopProductRequest> = {
      title: product.name || '',
      description: product.description || '',
      category_id: '0', // Would need category mapping
      images: [], // Would need to upload images first
      skus: [],
    };

    // Add brand if provided
    if (product.brand) {
      tiktokProduct.brand_id = '0'; // Would need brand mapping
    }

    // Transform variants to SKUs
    if (product.variants && product.variants.length > 0) {
      tiktokProduct.skus = product.variants.map((variant, index) => ({
        seller_sku: variant.sku,
        price: {
          currency: 'USD', // Default currency
          amount: variant.price.toString(),
        },
        inventory: [
          {
            warehouse_id: 'default',
            quantity: variant.inventory?.quantity || 0,
          },
        ],
      }));
    } else {
      // Create a single SKU if no variants
      tiktokProduct.skus = [
        {
          price: {
            currency: 'USD',
            amount: '0',
          },
          inventory: [
            {
              warehouse_id: 'default',
              quantity: 0,
            },
          ],
        },
      ];
    }

    return tiktokProduct;
  }

  /**
   * Transform platform-agnostic product updates to TikTok Shop format
   */
  transformToTikTokShopProductUpdate(updates: Partial<PlatformProduct>): Record<string, any> {
    const tiktokUpdates: Record<string, any> = {};

    if (updates.name) {
      tiktokUpdates.title = updates.name;
    }

    if (updates.description) {
      tiktokUpdates.description = updates.description;
    }

    if (updates.variants && updates.variants.length > 0) {
      tiktokUpdates.skus = updates.variants.map(variant => ({
        id: variant.platformVariantId,
        seller_sku: variant.sku,
        price: {
          currency: 'USD',
          amount: variant.price.toString(),
        },
        inventory: [
          {
            warehouse_id: 'default',
            quantity: variant.inventory?.quantity || 0,
          },
        ],
      }));
    }

    return tiktokUpdates;
  }

  /**
   * Map TikTok Shop product status to platform-agnostic status
   */
  private mapProductStatus(tiktokStatus: string): 'active' | 'inactive' | 'draft' {
    const statusMap: Record<string, 'active' | 'inactive' | 'draft'> = {
      'DRAFT': 'draft',
      'PENDING_REVIEW': 'draft',
      'REJECTED': 'inactive',
      'LIVE': 'active',
      'SELLER_DEACTIVATED': 'inactive',
      'PLATFORM_DEACTIVATED': 'inactive',
      'FREEZE': 'inactive',
    };

    return statusMap[tiktokStatus] || 'inactive';
  }

  /**
   * Map TikTok Shop order status to platform-agnostic status
   */
  private mapOrderStatus(tiktokStatus: string): string {
    const statusMap: Record<string, string> = {
      'UNPAID': 'pending',
      'AWAITING_SHIPMENT': 'confirmed',
      'AWAITING_COLLECTION': 'processing',
      'IN_TRANSIT': 'shipped',
      'DELIVERED': 'delivered',
      'COMPLETED': 'completed',
      'CANCELLED': 'cancelled',
    };

    return statusMap[tiktokStatus] || 'unknown';
  }

  /**
   * Map TikTok Shop order status to financial status
   */
  private mapFinancialStatus(tiktokStatus: string): string {
    const statusMap: Record<string, string> = {
      'UNPAID': 'pending',
      'AWAITING_SHIPMENT': 'paid',
      'AWAITING_COLLECTION': 'paid',
      'IN_TRANSIT': 'paid',
      'DELIVERED': 'paid',
      'COMPLETED': 'paid',
      'CANCELLED': 'voided',
    };

    return statusMap[tiktokStatus] || 'unknown';
  }

  /**
   * Map TikTok Shop order status to fulfillment status
   */
  private mapFulfillmentStatus(tiktokStatus: string): string {
    const statusMap: Record<string, string> = {
      'UNPAID': 'unfulfilled',
      'AWAITING_SHIPMENT': 'unfulfilled',
      'AWAITING_COLLECTION': 'processing',
      'IN_TRANSIT': 'shipped',
      'DELIVERED': 'delivered',
      'COMPLETED': 'delivered',
      'CANCELLED': 'cancelled',
    };

    return statusMap[tiktokStatus] || 'unfulfilled';
  }

  /**
   * Calculate total discount from TikTok Shop order
   */
  private calculateTotalDiscount(tiktokOrder: TikTokShopOrder): number {
    let totalDiscount = 0;

    // Add platform discounts
    if (tiktokOrder.promotion_info?.platform_promotions) {
      totalDiscount += tiktokOrder.promotion_info.platform_promotions.reduce(
        (sum, promo) => sum + parseFloat(promo.discount_amount.amount),
        0
      );
    }

    // Add seller discounts
    if (tiktokOrder.promotion_info?.seller_promotions) {
      totalDiscount += tiktokOrder.promotion_info.seller_promotions.reduce(
        (sum, promo) => sum + parseFloat(promo.discount_amount.amount),
        0
      );
    }

    // Add shipping fee discounts
    if (tiktokOrder.payment_info.shipping_fee_platform_discount) {
      totalDiscount += parseFloat(tiktokOrder.payment_info.shipping_fee_platform_discount.amount);
    }

    if (tiktokOrder.payment_info.shipping_fee_seller_discount) {
      totalDiscount += parseFloat(tiktokOrder.payment_info.shipping_fee_seller_discount.amount);
    }

    // Add order line discounts
    tiktokOrder.order_lines.forEach(line => {
      if (line.platform_discount) {
        totalDiscount += parseFloat(line.platform_discount.amount);
      }
      if (line.seller_discount) {
        totalDiscount += parseFloat(line.seller_discount.amount);
      }
    });

    return totalDiscount;
  }

  /**
   * Get TikTok Shop-specific error message
   */
  getErrorMessage(code: number): string {
    const errorMessages: Record<number, string> = {
      10001: 'Invalid app key or app secret.',
      10002: 'Access token expired or invalid.',
      10003: 'Insufficient permissions for this operation.',
      10004: 'Invalid request parameters.',
      10005: 'Request parameter validation failed.',
      10006: 'Resource not found.',
      10007: 'Rate limit exceeded.',
      10008: 'Internal server error.',
      10009: 'Service temporarily unavailable.',
      10010: 'Invalid signature.',
    };

    return errorMessages[code] || `TikTok Shop API error: ${code}`;
  }

  /**
   * Transform TikTok Shop webhook data
   */
  transformWebhookData(type: string, data: any): any {
    switch (type) {
      case 'ORDER_STATUS_CHANGE':
        return {
          orderId: data.order_id,
          status: this.mapOrderStatus(data.order_status),
          timestamp: data.update_time,
        };
      
      case 'PRODUCT_STATUS_CHANGE':
        return {
          productId: data.product_id,
          status: this.mapProductStatus(data.product_status),
          timestamp: data.update_time,
        };
      
      case 'INVENTORY_UPDATE':
        return {
          productId: data.product_id,
          skuId: data.sku_id,
          quantity: data.quantity,
          warehouseId: data.warehouse_id,
          timestamp: data.update_time,
        };
      
      default:
        return data;
    }
  }
}