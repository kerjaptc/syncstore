/**
 * Shopee Data Transformer
 * Handles data transformation between Shopee API format and platform-agnostic format
 */

import {
  PlatformProduct,
  PlatformProductVariant,
  PlatformOrder,
  PlatformOrderItem,
} from '../types';
import type {
  ShopeeProduct,
  ShopeeProductVariant,
  ShopeeOrder,
  ShopeeOrderItem,
  ShopeeProductRequest,
} from './shopee-types';

export class ShopeeDataTransformer {
  /**
   * Transform Shopee product to platform-agnostic format
   */
  transformProduct(shopeeProduct: ShopeeProduct): PlatformProduct {
    const variants: PlatformProductVariant[] = [];

    // Handle products with variants
    if (shopeeProduct.has_model && shopeeProduct.model) {
      variants.push(...shopeeProduct.model.map(variant => this.transformProductVariant(variant, shopeeProduct)));
    } else {
      // Handle products without variants (single variant)
      variants.push({
        platformVariantId: shopeeProduct.item_id.toString(),
        name: shopeeProduct.item_name,
        sku: shopeeProduct.item_sku || '',
        price: shopeeProduct.price_info?.current_price || 0,
        compareAtPrice: shopeeProduct.price_info?.original_price || undefined,
        inventory: {
          quantity: shopeeProduct.stock_info?.current_stock || 0,
          tracked: true,
        },
        attributes: {},
        images: shopeeProduct.image?.image_url_list || [],
        status: shopeeProduct.item_status === 'NORMAL' ? 'active' : 'inactive',
      });
    }

    return {
      platformProductId: shopeeProduct.item_id.toString(),
      name: shopeeProduct.item_name,
      description: this.extractDescription(shopeeProduct.description),
      category: '', // Shopee doesn't return category name in product details
      brand: shopeeProduct.brand?.original_brand_name || '',
      images: shopeeProduct.image?.image_url_list || [],
      variants,
      status: shopeeProduct.item_status === 'NORMAL' ? 'active' : 'inactive',
      platformData: {
        shopeeData: shopeeProduct,
        weight: shopeeProduct.weight,
        dimensions: shopeeProduct.dimension,
        condition: shopeeProduct.condition,
        preOrder: shopeeProduct.pre_order,
        logistics: shopeeProduct.logistic_info,
        wholesales: shopeeProduct.wholesales,
        complaintPolicy: shopeeProduct.complaint_policy,
        taxInfo: shopeeProduct.tax_info,
      },
    };
  }

  /**
   * Transform Shopee product variant to platform-agnostic format
   */
  private transformProductVariant(shopeeVariant: ShopeeProductVariant, parentProduct: ShopeeProduct): PlatformProductVariant {
    return {
      platformVariantId: shopeeVariant.model_id.toString(),
      name: shopeeVariant.model_name || `${parentProduct.item_name} - Variant ${shopeeVariant.model_id}`,
      sku: shopeeVariant.model_sku || '',
      price: shopeeVariant.price_info?.current_price || parentProduct.price_info?.current_price || 0,
      compareAtPrice: shopeeVariant.price_info?.original_price || parentProduct.price_info?.original_price || undefined,
      inventory: {
        quantity: shopeeVariant.stock_info?.current_stock || 0,
        tracked: true,
      },
      attributes: {
        tierIndex: shopeeVariant.tier_index,
        promotionId: shopeeVariant.promotion_id,
      },
      images: [], // Variant-specific images would need separate API call
      status: 'active', // Shopee variants don't have individual status
    };
  }

  /**
   * Transform Shopee order to platform-agnostic format
   */
  transformOrder(shopeeOrder: ShopeeOrder): PlatformOrder {
    return {
      platformOrderId: shopeeOrder.order_sn,
      orderNumber: shopeeOrder.order_sn,
      status: this.mapOrderStatus(shopeeOrder.order_status),
      financialStatus: this.mapFinancialStatus(shopeeOrder.order_status),
      fulfillmentStatus: this.mapFulfillmentStatus(shopeeOrder.order_status),
      customer: {
        name: shopeeOrder.recipient_address?.name || shopeeOrder.buyer_username,
        email: '', // Shopee doesn't provide customer email
        phone: shopeeOrder.recipient_address?.phone || '',
        address: {
          street: shopeeOrder.recipient_address?.full_address || '',
          city: shopeeOrder.recipient_address?.city || '',
          state: shopeeOrder.recipient_address?.state || '',
          country: shopeeOrder.recipient_address?.region || shopeeOrder.region,
          postalCode: shopeeOrder.recipient_address?.zipcode || '',
        },
      },
      items: shopeeOrder.item_list?.map(item => this.transformOrderItem(item)) || [],
      totals: {
        subtotal: shopeeOrder.total_amount - (shopeeOrder.actual_shipping_fee || shopeeOrder.estimated_shipping_fee || 0),
        tax: 0, // Shopee doesn't separate tax in order totals
        shipping: shopeeOrder.actual_shipping_fee || shopeeOrder.estimated_shipping_fee || 0,
        discount: 0, // Would need to calculate from item prices
        total: shopeeOrder.total_amount,
      },
      currency: shopeeOrder.currency,
      orderedAt: new Date(shopeeOrder.create_time * 1000),
      platformData: {
        shopeeData: shopeeOrder,
        cod: shopeeOrder.cod,
        paymentMethod: shopeeOrder.payment_method,
        shippingCarrier: shopeeOrder.shipping_carrier,
        messageToSeller: shopeeOrder.message_to_seller,
        daysToShip: shopeeOrder.days_to_ship,
        shipByDate: new Date(shopeeOrder.ship_by_date * 1000),
        buyerUserId: shopeeOrder.buyer_user_id,
        dropshipper: shopeeOrder.dropshipper,
        dropshipperPhone: shopeeOrder.dropshipper_phone,
        packageList: shopeeOrder.package_list,
        invoiceData: shopeeOrder.invoice_data,
      },
    };
  }

  /**
   * Transform Shopee order item to platform-agnostic format
   */
  private transformOrderItem(shopeeItem: ShopeeOrderItem): PlatformOrderItem {
    return {
      platformProductId: shopeeItem.item_id.toString(),
      platformVariantId: shopeeItem.model_id?.toString(),
      name: shopeeItem.item_name,
      sku: shopeeItem.model_sku || shopeeItem.item_sku || '',
      quantity: shopeeItem.model_quantity_purchased,
      price: shopeeItem.model_discounted_price,
      totalAmount: shopeeItem.model_discounted_price * shopeeItem.model_quantity_purchased,
    };
  }

  /**
   * Transform platform-agnostic product to Shopee format for creation
   */
  transformToShopeeProduct(product: Partial<PlatformProduct>): Partial<ShopeeProductRequest> {
    const shopeeProduct: Partial<ShopeeProductRequest> = {
      item_name: product.name || '',
      item_sku: product.variants?.[0]?.sku,
      category_id: 0, // Would need category mapping
      image: {
        image_id_list: [], // Would need to upload images first
      },
      logistic_info: [
        {
          logistic_id: 0, // Would need logistics mapping
          enabled: true,
        },
      ],
      price_info: {
        currency: 'USD', // Default currency
        original_price: product.variants?.[0]?.price || 0,
      },
    };

    // Add description if provided
    if (product.description) {
      shopeeProduct.description = {
        field_list: [
          {
            field_type: 'text',
            text: product.description,
          },
        ],
      };
    }

    // Add stock info if provided
    if (product.variants?.[0]?.inventory?.quantity !== undefined) {
      shopeeProduct.stock_info = {
        stock_type: 1, // Normal stock
        normal_stock: product.variants[0].inventory.quantity,
      };
    }

    // Handle multiple variants
    if (product.variants && product.variants.length > 1) {
      shopeeProduct.model = product.variants.map((variant, index) => ({
        tier_index: [index],
        stock_info: {
          stock_type: 1,
          normal_stock: variant.inventory?.quantity || 0,
        },
        price_info: {
          currency: 'USD',
          original_price: variant.price,
        },
        model_sku: variant.sku,
      }));
    }

    return shopeeProduct;
  }

  /**
   * Transform platform-agnostic product updates to Shopee format
   */
  transformToShopeeProductUpdate(updates: Partial<PlatformProduct>): Record<string, any> {
    const shopeeUpdates: Record<string, any> = {};

    if (updates.name) {
      shopeeUpdates.item_name = updates.name;
    }

    if (updates.description) {
      shopeeUpdates.description = {
        field_list: [
          {
            field_type: 'text',
            text: updates.description,
          },
        ],
      };
    }

    if (updates.variants?.[0]?.price !== undefined) {
      shopeeUpdates.price_info = {
        currency: 'USD',
        original_price: updates.variants[0].price,
      };
    }

    if (updates.variants?.[0]?.inventory?.quantity !== undefined) {
      shopeeUpdates.stock_info = {
        stock_type: 1,
        normal_stock: updates.variants[0].inventory.quantity,
      };
    }

    return shopeeUpdates;
  }

  /**
   * Extract description from Shopee description format
   */
  private extractDescription(description?: { field_list: Array<{ field_type: string; text?: string }> }): string {
    if (!description?.field_list) {
      return '';
    }

    return description.field_list
      .filter(field => field.field_type === 'text' && field.text)
      .map(field => field.text)
      .join('\n');
  }

  /**
   * Map Shopee order status to platform-agnostic status
   */
  private mapOrderStatus(shopeeStatus: string): string {
    const statusMap: Record<string, string> = {
      'UNPAID': 'pending',
      'READY_TO_SHIP': 'confirmed',
      'PROCESSED': 'processing',
      'SHIPPED': 'shipped',
      'COMPLETED': 'delivered',
      'IN_CANCEL': 'cancelling',
      'CANCELLED': 'cancelled',
      'INVOICE_PENDING': 'pending',
    };

    return statusMap[shopeeStatus] || 'unknown';
  }

  /**
   * Map Shopee order status to financial status
   */
  private mapFinancialStatus(shopeeStatus: string): string {
    const statusMap: Record<string, string> = {
      'UNPAID': 'pending',
      'READY_TO_SHIP': 'paid',
      'PROCESSED': 'paid',
      'SHIPPED': 'paid',
      'COMPLETED': 'paid',
      'IN_CANCEL': 'pending',
      'CANCELLED': 'voided',
      'INVOICE_PENDING': 'pending',
    };

    return statusMap[shopeeStatus] || 'unknown';
  }

  /**
   * Map Shopee order status to fulfillment status
   */
  private mapFulfillmentStatus(shopeeStatus: string): string {
    const statusMap: Record<string, string> = {
      'UNPAID': 'unfulfilled',
      'READY_TO_SHIP': 'unfulfilled',
      'PROCESSED': 'processing',
      'SHIPPED': 'shipped',
      'COMPLETED': 'delivered',
      'IN_CANCEL': 'unfulfilled',
      'CANCELLED': 'cancelled',
      'INVOICE_PENDING': 'unfulfilled',
    };

    return statusMap[shopeeStatus] || 'unfulfilled';
  }

  /**
   * Get Shopee-specific error message
   */
  getErrorMessage(error: string): string {
    const errorMessages: Record<string, string> = {
      'error_auth': 'Authentication failed. Please check your credentials.',
      'error_permission': 'Permission denied. Please check your API permissions.',
      'error_param': 'Invalid parameters provided.',
      'error_item_not_exist': 'Product not found.',
      'error_exceed_max_limit': 'Request exceeds maximum limit.',
      'error_shop_not_exist': 'Shop not found.',
      'error_order_not_exist': 'Order not found.',
    };

    return errorMessages[error] || `Shopee API error: ${error}`;
  }
}