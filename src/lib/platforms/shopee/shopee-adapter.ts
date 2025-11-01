/**
 * Shopee Platform Adapter
 * Implementation of Shopee marketplace integration
 */

import { BasePlatformAdapter } from '../base-adapter';
import {
  PlatformCredentials,
  PlatformConfig,
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  PlatformProduct,
  PlatformOrder,
  WebhookPayload,
  PlatformErrorType,
} from '../types';
import { ShopeeAuth } from './shopee-auth';
import { ShopeeDataTransformer } from './shopee-transformer';
import { ShopeeWebhookHandler } from './shopee-webhook';
import type {
  ShopeeCredentials,
  ShopeeProduct,
  ShopeeOrder,
  ShopeeApiResponse,
  ShopeeProductRequest,
  ShopeeInventoryUpdateRequest,
} from './shopee-types';

export class ShopeeAdapter extends BasePlatformAdapter {
  private auth: ShopeeAuth;
  private transformer: ShopeeDataTransformer;
  private webhookHandler: ShopeeWebhookHandler;

  constructor(credentials: PlatformCredentials, config: PlatformConfig) {
    super(credentials, config);
    this.auth = new ShopeeAuth(credentials as ShopeeCredentials, config);
    this.transformer = new ShopeeDataTransformer();
    this.webhookHandler = new ShopeeWebhookHandler(credentials as ShopeeCredentials);
  }

  getPlatformName(): string {
    return 'shopee';
  }

  async authenticate(): Promise<ApiResponse<{ accessToken: string; expiresAt: Date }>> {
    try {
      const result = await this.auth.authenticate();
      
      if (result.success && result.data) {
        // Update credentials with new token
        this.credentials.accessToken = result.data.accessToken;
        
        return {
          success: true,
          data: {
            accessToken: result.data.accessToken,
            expiresAt: result.data.expiresAt,
          },
        };
      }

      return {
        success: false,
        error: result.error || {
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: error instanceof Error ? error.message : 'Authentication error',
        },
      };
    }
  }

  async refreshToken(): Promise<ApiResponse<{ accessToken: string; expiresAt: Date }>> {
    try {
      const result = await this.auth.refreshToken();
      
      if (result.success && result.data) {
        // Update credentials with new token
        this.credentials.accessToken = result.data.accessToken;
        this.credentials.refreshToken = result.data.refreshToken;
        
        return {
          success: true,
          data: {
            accessToken: result.data.accessToken,
            expiresAt: result.data.expiresAt,
          },
        };
      }

      return {
        success: false,
        error: result.error || {
          code: 'REFRESH_FAILED',
          message: 'Token refresh failed',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REFRESH_ERROR',
          message: error instanceof Error ? error.message : 'Token refresh error',
        },
      };
    }
  }

  async validateCredentials(): Promise<ApiResponse<boolean>> {
    try {
      const response = await this.makeRequest<ShopeeApiResponse<any>>('/api/v2/shop/get_shop_info', {
        method: 'GET',
      });

      return {
        success: response.success,
        data: response.success,
      };
    } catch (error) {
      return {
        success: false,
        data: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Credential validation failed',
        },
      };
    }
  }

  // Product operations
  async getProducts(params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<PlatformProduct>>> {
    try {
      const shopeeParams = {
        offset: params?.offset || 0,
        page_size: params?.limit || 50,
      };

      const response = await this.makeRequest<ShopeeApiResponse<{
        item: ShopeeProduct[];
        total_count: number;
        has_next_page: boolean;
      }>>('/api/v2/product/get_item_list', {
        method: 'GET',
      });

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || {
            code: 'FETCH_FAILED',
            message: 'Failed to fetch products',
          },
        };
      }

      const shopeeData = response.data.response;
      const products = shopeeData.item.map((item: ShopeeProduct) => this.transformer.transformProduct(item));

      return {
        success: true,
        data: {
          items: products,
          pagination: {
            offset: shopeeParams.offset,
            limit: shopeeParams.page_size,
            total: shopeeData.total_count,
            hasNext: shopeeData.has_next_page,
            hasPrevious: shopeeParams.offset > 0,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PRODUCTS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get products',
        },
      };
    }
  }

  async getProduct(productId: string): Promise<ApiResponse<PlatformProduct>> {
    try {
      const response = await this.makeRequest<ShopeeApiResponse<{
        item: ShopeeProduct;
      }>>(`/api/v2/product/get_item_base_info?item_id_list=${productId}`, {
        method: 'GET',
      });

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found',
          },
        };
      }

      const product = this.transformer.transformProduct(response.data.response.item);

      return {
        success: true,
        data: product,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PRODUCT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get product',
        },
      };
    }
  }

  async createProduct(product: Partial<PlatformProduct>): Promise<ApiResponse<PlatformProduct>> {
    try {
      const shopeeProduct = this.transformer.transformToShopeeProduct(product);
      
      const response = await this.makeRequest<ShopeeApiResponse<{
        item_id: number;
      }>>('/api/v2/product/add_item', {
        method: 'POST',
        data: shopeeProduct,
      });

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || {
            code: 'CREATE_FAILED',
            message: 'Failed to create product',
          },
        };
      }

      // Fetch the created product to return complete data
      const createdProduct = await this.getProduct(response.data.response.item_id.toString());
      
      return createdProduct;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create product',
        },
      };
    }
  }

  async updateProduct(productId: string, updates: Partial<PlatformProduct>): Promise<ApiResponse<PlatformProduct>> {
    try {
      const shopeeUpdates = this.transformer.transformToShopeeProductUpdate(updates);
      
      const response = await this.makeRequest<ShopeeApiResponse<any>>('/api/v2/product/update_item', {
        method: 'POST',
        data: {
          item_id: parseInt(productId),
          ...shopeeUpdates,
        },
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error || {
            code: 'UPDATE_FAILED',
            message: 'Failed to update product',
          },
        };
      }

      // Fetch the updated product to return complete data
      const updatedProduct = await this.getProduct(productId);
      
      return updatedProduct;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update product',
        },
      };
    }
  }

  async deleteProduct(productId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.makeRequest<ShopeeApiResponse<any>>('/api/v2/product/delete_item', {
        method: 'POST',
        data: {
          item_id: parseInt(productId),
        },
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error || {
            code: 'DELETE_FAILED',
            message: 'Failed to delete product',
          },
        };
      }

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete product',
        },
      };
    }
  }

  async updateInventory(productId: string, variantId: string, quantity: number): Promise<ApiResponse<void>> {
    try {
      const updateData: ShopeeInventoryUpdateRequest = {
        item_id: parseInt(productId),
        model_id: parseInt(variantId),
        normal_stock: quantity,
      };

      const response = await this.makeRequest<ShopeeApiResponse<any>>('/api/v2/product/update_stock', {
        method: 'POST',
        data: updateData,
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error || {
            code: 'INVENTORY_UPDATE_FAILED',
            message: 'Failed to update inventory',
          },
        };
      }

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INVENTORY_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update inventory',
        },
      };
    }
  }

  // Order operations
  async getOrders(params?: PaginationParams & { status?: string; startDate?: Date; endDate?: Date }): Promise<ApiResponse<PaginatedResponse<PlatformOrder>>> {
    try {
      const shopeeParams = {
        page_size: params?.limit || 50,
        cursor: params?.cursor || '',
        order_status: params?.status || 'READY_TO_SHIP',
        time_range_field: 'create_time',
        time_from: params?.startDate ? Math.floor(params.startDate.getTime() / 1000) : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000),
        time_to: params?.endDate ? Math.floor(params.endDate.getTime() / 1000) : Math.floor(Date.now() / 1000),
      };

      const response = await this.makeRequest<ShopeeApiResponse<{
        order_list: ShopeeOrder[];
        more: boolean;
        next_cursor: string;
      }>>('/api/v2/order/get_order_list', {
        method: 'GET',
      });

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || {
            code: 'ORDERS_FETCH_FAILED',
            message: 'Failed to fetch orders',
          },
        };
      }

      const shopeeData = response.data.response;
      const orders = shopeeData.order_list.map((order: ShopeeOrder) => this.transformer.transformOrder(order));

      return {
        success: true,
        data: {
          items: orders,
          pagination: {
            cursor: params?.cursor,
            limit: shopeeParams.page_size,
            hasNext: shopeeData.more,
            nextCursor: shopeeData.next_cursor,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ORDERS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get orders',
        },
      };
    }
  }

  async getOrder(orderId: string): Promise<ApiResponse<PlatformOrder>> {
    try {
      const response = await this.makeRequest<ShopeeApiResponse<{
        order_list: ShopeeOrder[];
      }>>(`/api/v2/order/get_order_detail?order_sn_list=${orderId}`, {
        method: 'GET',
      });

      if (!response.success || !response.data || response.data.response.order_list.length === 0) {
        return {
          success: false,
          error: response.error || {
            code: 'ORDER_NOT_FOUND',
            message: 'Order not found',
          },
        };
      }

      const order = this.transformer.transformOrder(response.data.response.order_list[0]);

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ORDER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get order',
        },
      };
    }
  }

  async updateOrderStatus(orderId: string, status: string, trackingInfo?: { carrier?: string; trackingNumber?: string }): Promise<ApiResponse<void>> {
    try {
      let endpoint = '';
      let data: any = { order_sn: orderId };

      switch (status.toLowerCase()) {
        case 'shipped':
          endpoint = '/api/v2/logistics/ship_order';
          if (trackingInfo) {
            data.tracking_number = trackingInfo.trackingNumber;
          }
          break;
        case 'cancelled':
          endpoint = '/api/v2/order/cancel_order';
          data.cancel_reason = 'OUT_OF_STOCK';
          break;
        default:
          return {
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: `Unsupported order status: ${status}`,
            },
          };
      }

      const response = await this.makeRequest<ShopeeApiResponse<any>>(endpoint, {
        method: 'POST',
        data,
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error || {
            code: 'STATUS_UPDATE_FAILED',
            message: 'Failed to update order status',
          },
        };
      }

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'STATUS_UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update order status',
        },
      };
    }
  }

  async cancelOrder(orderId: string, reason?: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.makeRequest<ShopeeApiResponse<any>>('/api/v2/order/cancel_order', {
        method: 'POST',
        data: {
          order_sn: orderId,
          cancel_reason: reason || 'OUT_OF_STOCK',
        },
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error || {
            code: 'CANCEL_FAILED',
            message: 'Failed to cancel order',
          },
        };
      }

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CANCEL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to cancel order',
        },
      };
    }
  }

  // Webhook operations
  validateWebhook(payload: string, signature: string): boolean {
    return this.webhookHandler.validateSignature(payload, signature);
  }

  async processWebhook(payload: WebhookPayload): Promise<ApiResponse<void>> {
    try {
      await this.webhookHandler.processWebhook(payload);
      
      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'WEBHOOK_ERROR',
          message: error instanceof Error ? error.message : 'Failed to process webhook',
        },
      };
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (this.credentials.accessToken) {
      headers['Authorization'] = `Bearer ${this.credentials.accessToken}`;
    }
    
    // Add Shopee-specific headers
    headers['Content-Type'] = 'application/json';
    
    return headers;
  }

  protected classifyError(statusCode: number, errorData: any): PlatformErrorType {
    // Shopee-specific error classification
    if (errorData?.error) {
      switch (errorData.error) {
        case 'error_auth':
          return PlatformErrorType.AUTHENTICATION;
        case 'error_permission':
          return PlatformErrorType.AUTHORIZATION;
        case 'error_param':
          return PlatformErrorType.VALIDATION;
        case 'error_item_not_exist':
          return PlatformErrorType.NOT_FOUND;
        default:
          break;
      }
    }

    return super.classifyError(statusCode, errorData);
  }
}