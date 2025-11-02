/**
 * TikTok Shop Platform Adapter
 * Implementation of TikTok Shop marketplace integration
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
import { TikTokShopAuth } from './tiktokshop-auth';
import { TikTokShopDataTransformer } from './tiktokshop-transformer';
import { TikTokShopWebhookHandler } from './tiktokshop-webhook';
import type {
  TikTokShopCredentials,
  TikTokShopProduct,
  TikTokShopOrder,
  TikTokShopApiResponse,
  TikTokShopProductRequest,
  TikTokShopInventoryUpdateRequest,
} from './tiktokshop-types';

export class TikTokShopAdapter extends BasePlatformAdapter {
  private auth: TikTokShopAuth;
  private transformer: TikTokShopDataTransformer;
  private webhookHandler: TikTokShopWebhookHandler;

  constructor(credentials: PlatformCredentials, config: PlatformConfig) {
    super(credentials, config);
    this.auth = new TikTokShopAuth(credentials as TikTokShopCredentials, config);
    this.transformer = new TikTokShopDataTransformer();
    this.webhookHandler = new TikTokShopWebhookHandler(credentials as TikTokShopCredentials);
  }

  getPlatformName(): string {
    return 'tiktokshop';
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
      const response = await this.makeRequest<TikTokShopApiResponse<any>>('/api/shop/get_authorized_shop', {
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
      const tiktokParams = {
        page_number: params?.page || 1,
        page_size: params?.limit || 50,
      };

      const response = await this.makeRequest<TikTokShopApiResponse<{
        products: TikTokShopProduct[];
        total: number;
        more: boolean;
      }>>('/api/products/search', {
        method: 'POST',
        data: tiktokParams,
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

      const tiktokData = response.data.data;
      const products = tiktokData.products.map((product: TikTokShopProduct) => this.transformer.transformProduct(product));

      return {
        success: true,
        data: {
          items: products,
          pagination: {
            page: tiktokParams.page_number,
            limit: tiktokParams.page_size,
            total: tiktokData.total,
            hasNext: tiktokData.more,
            hasPrevious: tiktokParams.page_number > 1,
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
      const response = await this.makeRequest<TikTokShopApiResponse<{
        product: TikTokShopProduct;
      }>>(`/api/products/details?product_id=${productId}`, {
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

      const product = this.transformer.transformProduct(response.data.data.product);

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
      const tiktokProduct = this.transformer.transformToTikTokShopProduct(product);
      
      const response = await this.makeRequest<TikTokShopApiResponse<{
        product_id: string;
      }>>('/api/products', {
        method: 'POST',
        data: tiktokProduct,
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
      const createdProduct = await this.getProduct(response.data.data.product_id);
      
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
      const tiktokUpdates = this.transformer.transformToTikTokShopProductUpdate(updates);
      
      const response = await this.makeRequest<TikTokShopApiResponse<any>>(`/api/products/${productId}`, {
        method: 'PUT',
        data: tiktokUpdates,
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
      const response = await this.makeRequest<TikTokShopApiResponse<any>>(`/api/products/${productId}`, {
        method: 'DELETE',
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
      const updateData: TikTokShopInventoryUpdateRequest = {
        product_id: productId,
        skus: [
          {
            id: variantId,
            inventory: [
              {
                warehouse_id: 'default',
                quantity,
              },
            ],
          },
        ],
      };

      const response = await this.makeRequest<TikTokShopApiResponse<any>>('/api/products/stocks', {
        method: 'PUT',
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
      const tiktokParams = {
        page_size: params?.limit || 50,
        cursor: params?.cursor || '',
        order_status: params?.status,
        create_time_from: params?.startDate ? Math.floor(params.startDate.getTime() / 1000) : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000),
        create_time_to: params?.endDate ? Math.floor(params.endDate.getTime() / 1000) : Math.floor(Date.now() / 1000),
      };

      const response = await this.makeRequest<TikTokShopApiResponse<{
        orders: TikTokShopOrder[];
        more: boolean;
        next_cursor: string;
        total: number;
      }>>('/api/orders/search', {
        method: 'POST',
        data: tiktokParams,
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

      const tiktokData = response.data.data;
      const orders = tiktokData.orders.map((order: TikTokShopOrder) => this.transformer.transformOrder(order));

      return {
        success: true,
        data: {
          items: orders,
          pagination: {
            cursor: params?.cursor,
            limit: tiktokParams.page_size,
            total: tiktokData.total,
            hasNext: tiktokData.more,
            nextCursor: tiktokData.next_cursor,
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
      const response = await this.makeRequest<TikTokShopApiResponse<{
        order: TikTokShopOrder;
      }>>(`/api/orders/detail?order_id=${orderId}`, {
        method: 'GET',
      });

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || {
            code: 'ORDER_NOT_FOUND',
            message: 'Order not found',
          },
        };
      }

      const order = this.transformer.transformOrder(response.data.data.order);

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
      const data: any = { order_id: orderId };

      switch (status.toLowerCase()) {
        case 'shipped':
          endpoint = '/api/fulfillment/ship';
          if (trackingInfo) {
            data.tracking_number = trackingInfo.trackingNumber;
            data.provider_id = trackingInfo.carrier;
          }
          break;
        case 'cancelled':
          endpoint = '/api/orders/cancel';
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

      const response = await this.makeRequest<TikTokShopApiResponse<any>>(endpoint, {
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
      const response = await this.makeRequest<TikTokShopApiResponse<any>>('/api/orders/cancel', {
        method: 'POST',
        data: {
          order_id: orderId,
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
    
    // Add TikTok Shop-specific headers
    headers['Content-Type'] = 'application/json';
    
    return headers;
  }

  protected classifyError(statusCode: number, errorData: any): PlatformErrorType {
    // TikTok Shop-specific error classification
    if (errorData?.code) {
      switch (errorData.code) {
        case 10001:
        case 10002:
          return PlatformErrorType.AUTHENTICATION;
        case 10003:
          return PlatformErrorType.AUTHORIZATION;
        case 10004:
        case 10005:
          return PlatformErrorType.VALIDATION;
        case 10006:
          return PlatformErrorType.NOT_FOUND;
        case 10007:
          return PlatformErrorType.RATE_LIMIT;
        default:
          break;
      }
    }

    return super.classifyError(statusCode, errorData);
  }
}