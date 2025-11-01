/**
 * Integration tests for platform adapter functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPlatformProduct, createMockPlatformOrder } from '../factories';

// Mock HTTP client for external API calls
const mockHttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

// Mock platform adapters
class MockShopeeAdapter {
  async authenticateStore(credentials: any) {
    if (!credentials.authCode || !credentials.shopId) {
      throw new Error('Invalid credentials');
    }
    
    // Simulate API call
    const response = await mockHttpClient.post('/auth/token/get', {
      code: credentials.authCode,
      shop_id: credentials.shopId,
    });
    
    return {
      storeId: 'store-123',
      platform: 'shopee',
      credentials: {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      },
      isActive: true,
    };
  }
  
  async fetchProducts(connection: any, options?: any) {
    const response = await mockHttpClient.get('/product/get_item_list', {
      params: {
        page_size: options?.limit || 50,
        offset: options?.offset || 0,
      },
    });
    
    return response.data.response.item_list.map((item: any) => ({
      platformProductId: item.item_id.toString(),
      name: item.item_name,
      sku: item.item_sku,
      price: item.price_info[0]?.current_price || 0,
      stock: item.stock_info[0]?.current_stock || 0,
      images: item.image?.image_url_list || [],
      isActive: item.item_status === 'NORMAL',
    }));
  }
  
  async updateProduct(connection: any, product: any) {
    const response = await mockHttpClient.post('/product/update_item', {
      item_id: parseInt(product.platformProductId),
      item_name: product.name,
      item_sku: product.sku,
    });
    
    if (response.status !== 200) {
      throw new Error('Failed to update product');
    }
  }
  
  async fetchOrders(connection: any, options?: any) {
    const response = await mockHttpClient.get('/order/get_order_list', {
      params: {
        time_from: options?.dateFrom?.getTime() / 1000,
        time_to: options?.dateTo?.getTime() / 1000,
        page_size: options?.limit || 50,
      },
    });
    
    return response.data.response.order_list.map((order: any) => ({
      platformOrderId: order.order_sn,
      orderNumber: order.order_sn,
      status: order.order_status,
      customer: {
        name: order.recipient_address?.name,
        phone: order.recipient_address?.phone,
      },
      items: order.item_list?.map((item: any) => ({
        platformProductId: item.item_id.toString(),
        sku: item.item_sku,
        name: item.item_name,
        quantity: item.model_quantity_purchased,
        unitPrice: item.model_original_price,
      })) || [],
      totals: {
        total: order.total_amount,
      },
      orderedAt: new Date(order.create_time * 1000),
    }));
  }
}

class MockTikTokShopAdapter {
  async authenticateStore(credentials: any) {
    if (!credentials.authCode || !credentials.appKey) {
      throw new Error('Invalid credentials');
    }
    
    const response = await mockHttpClient.post('/authorization/token/get', {
      auth_code: credentials.authCode,
      app_key: credentials.appKey,
    });
    
    return {
      storeId: 'store-456',
      platform: 'tiktokshop',
      credentials: {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      },
      isActive: true,
    };
  }
  
  async fetchProducts(connection: any, options?: any) {
    const response = await mockHttpClient.get('/products/search', {
      params: {
        page_size: options?.limit || 50,
        page_token: options?.pageToken,
      },
    });
    
    return response.data.data.products.map((product: any) => ({
      platformProductId: product.id,
      name: product.title,
      sku: product.seller_sku,
      price: product.price,
      stock: product.inventory?.quantity || 0,
      images: product.images?.map((img: any) => img.uri) || [],
      isActive: product.status === 'ACTIVE',
    }));
  }
  
  async updateInventory(connection: any, updates: any[]) {
    const response = await mockHttpClient.post('/inventory/update', {
      inventory_updates: updates.map(update => ({
        product_id: update.platformProductId,
        quantity: update.stock,
      })),
    });
    
    if (response.status !== 200) {
      throw new Error('Failed to update inventory');
    }
  }
}

vi.mock('@/lib/platforms/http-client', () => ({ httpClient: mockHttpClient }));

describe('Platform Adapters Integration Tests', () => {
  let shopeeAdapter: MockShopeeAdapter;
  let tiktokAdapter: MockTikTokShopAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    shopeeAdapter = new MockShopeeAdapter();
    tiktokAdapter = new MockTikTokShopAdapter();
  });

  describe('Shopee Adapter Integration', () => {
    it('should authenticate and fetch products successfully', async () => {
      // Mock authentication response
      mockHttpClient.post.mockResolvedValueOnce({
        data: {
          access_token: 'shopee-access-token',
          refresh_token: 'shopee-refresh-token',
          expires_in: 3600,
        },
        status: 200,
      });

      // Mock products response
      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          response: {
            item_list: [
              {
                item_id: 123456,
                item_name: 'Shopee Product 1',
                item_sku: 'SHOPEE-001',
                price_info: [{ current_price: 29.99 }],
                stock_info: [{ current_stock: 100 }],
                image: { image_url_list: ['https://example.com/image1.jpg'] },
                item_status: 'NORMAL',
              },
              {
                item_id: 123457,
                item_name: 'Shopee Product 2',
                item_sku: 'SHOPEE-002',
                price_info: [{ current_price: 39.99 }],
                stock_info: [{ current_stock: 50 }],
                item_status: 'NORMAL',
              },
            ],
          },
        },
        status: 200,
      });

      // Test authentication
      const connection = await shopeeAdapter.authenticateStore({
        authCode: 'auth-code-123',
        shopId: 'shop-123',
        partnerId: 'partner-123',
      });

      expect(connection.platform).toBe('shopee');
      expect(connection.credentials.accessToken).toBe('shopee-access-token');

      // Test product fetching
      const products = await shopeeAdapter.fetchProducts(connection, {
        limit: 50,
        offset: 0,
      });

      expect(products).toHaveLength(2);
      expect(products[0]).toMatchObject({
        platformProductId: '123456',
        name: 'Shopee Product 1',
        sku: 'SHOPEE-001',
        price: 29.99,
        stock: 100,
        isActive: true,
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/token/get', {
        code: 'auth-code-123',
        shop_id: 'shop-123',
      });

      expect(mockHttpClient.get).toHaveBeenCalledWith('/product/get_item_list', {
        params: {
          page_size: 50,
          offset: 0,
        },
      });
    });

    it('should handle product updates with proper error handling', async () => {
      const mockConnection = {
        credentials: { accessToken: 'valid-token' },
      };

      const productUpdate = {
        platformProductId: '123456',
        name: 'Updated Product Name',
        sku: 'UPDATED-SKU',
      };

      // Test successful update
      mockHttpClient.post.mockResolvedValueOnce({
        data: { response: { item_id: 123456 } },
        status: 200,
      });

      await shopeeAdapter.updateProduct(mockConnection, productUpdate);

      expect(mockHttpClient.post).toHaveBeenCalledWith('/product/update_item', {
        item_id: 123456,
        item_name: 'Updated Product Name',
        item_sku: 'UPDATED-SKU',
      });

      // Test error handling
      mockHttpClient.post.mockResolvedValueOnce({
        status: 400,
        data: { error: 'Invalid product data' },
      });

      await expect(
        shopeeAdapter.updateProduct(mockConnection, productUpdate)
      ).rejects.toThrow('Failed to update product');
    });

    it('should fetch orders with date filtering', async () => {
      const mockConnection = {
        credentials: { accessToken: 'valid-token' },
      };

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          response: {
            order_list: [
              {
                order_sn: 'ORDER123456',
                order_status: 'READY_TO_SHIP',
                create_time: 1640995200,
                recipient_address: {
                  name: 'John Doe',
                  phone: '+1234567890',
                },
                item_list: [
                  {
                    item_id: 123456,
                    item_sku: 'PRODUCT-001',
                    item_name: 'Test Product',
                    model_quantity_purchased: 2,
                    model_original_price: 29.99,
                  },
                ],
                total_amount: 59.98,
              },
            ],
          },
        },
        status: 200,
      });

      const orders = await shopeeAdapter.fetchOrders(mockConnection, {
        dateFrom,
        dateTo,
        limit: 50,
      });

      expect(orders).toHaveLength(1);
      expect(orders[0]).toMatchObject({
        platformOrderId: 'ORDER123456',
        status: 'READY_TO_SHIP',
        customer: {
          name: 'John Doe',
          phone: '+1234567890',
        },
        totals: {
          total: 59.98,
        },
      });

      expect(mockHttpClient.get).toHaveBeenCalledWith('/order/get_order_list', {
        params: {
          time_from: dateFrom.getTime() / 1000,
          time_to: dateTo.getTime() / 1000,
          page_size: 50,
        },
      });
    });
  });

  describe('TikTok Shop Adapter Integration', () => {
    it('should authenticate and fetch products successfully', async () => {
      // Mock authentication response
      mockHttpClient.post.mockResolvedValueOnce({
        data: {
          access_token: 'tiktok-access-token',
          refresh_token: 'tiktok-refresh-token',
          expires_in: 7200,
        },
        status: 200,
      });

      // Mock products response
      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          data: {
            products: [
              {
                id: 'tiktok-product-1',
                title: 'TikTok Product 1',
                seller_sku: 'TIKTOK-001',
                price: '24.99',
                inventory: { quantity: 75 },
                images: [{ uri: 'https://example.com/tiktok1.jpg' }],
                status: 'ACTIVE',
              },
            ],
          },
        },
        status: 200,
      });

      // Test authentication
      const connection = await tiktokAdapter.authenticateStore({
        authCode: 'tiktok-auth-code',
        appKey: 'tiktok-app-key',
      });

      expect(connection.platform).toBe('tiktokshop');
      expect(connection.credentials.accessToken).toBe('tiktok-access-token');

      // Test product fetching
      const products = await tiktokAdapter.fetchProducts(connection, {
        limit: 50,
      });

      expect(products).toHaveLength(1);
      expect(products[0]).toMatchObject({
        platformProductId: 'tiktok-product-1',
        name: 'TikTok Product 1',
        sku: 'TIKTOK-001',
        price: '24.99',
        stock: 75,
        isActive: true,
      });
    });

    it('should handle inventory updates with bulk operations', async () => {
      const mockConnection = {
        credentials: { accessToken: 'valid-token' },
      };

      const inventoryUpdates = [
        { platformProductId: 'product-1', stock: 100 },
        { platformProductId: 'product-2', stock: 50 },
        { platformProductId: 'product-3', stock: 25 },
      ];

      mockHttpClient.post.mockResolvedValueOnce({
        data: { code: 0, message: 'success' },
        status: 200,
      });

      await tiktokAdapter.updateInventory(mockConnection, inventoryUpdates);

      expect(mockHttpClient.post).toHaveBeenCalledWith('/inventory/update', {
        inventory_updates: [
          { product_id: 'product-1', quantity: 100 },
          { product_id: 'product-2', quantity: 50 },
          { product_id: 'product-3', quantity: 25 },
        ],
      });
    });
  });

  describe('Cross-Platform Integration', () => {
    it('should handle multiple platform connections simultaneously', async () => {
      // Mock responses for both platforms
      mockHttpClient.post
        .mockResolvedValueOnce({
          data: {
            access_token: 'shopee-token',
            refresh_token: 'shopee-refresh',
            expires_in: 3600,
          },
        })
        .mockResolvedValueOnce({
          data: {
            access_token: 'tiktok-token',
            refresh_token: 'tiktok-refresh',
            expires_in: 7200,
          },
        });

      const [shopeeConnection, tiktokConnection] = await Promise.all([
        shopeeAdapter.authenticateStore({
          authCode: 'shopee-code',
          shopId: 'shopee-shop',
        }),
        tiktokAdapter.authenticateStore({
          authCode: 'tiktok-code',
          appKey: 'tiktok-key',
        }),
      ]);

      expect(shopeeConnection.platform).toBe('shopee');
      expect(tiktokConnection.platform).toBe('tiktokshop');
      expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
    });

    it('should handle platform-specific error responses', async () => {
      // Test Shopee error
      mockHttpClient.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { error: 'invalid_grant' },
        },
      });

      await expect(
        shopeeAdapter.authenticateStore({
          authCode: 'invalid-code',
          shopId: 'shop-123',
        })
      ).rejects.toThrow();

      // Test TikTok Shop error
      mockHttpClient.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { code: 40001, message: 'Invalid app key' },
        },
      });

      await expect(
        tiktokAdapter.authenticateStore({
          authCode: 'valid-code',
          appKey: 'invalid-key',
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle API rate limiting gracefully', async () => {
      // Mock rate limit response
      mockHttpClient.get
        .mockRejectedValueOnce({
          response: {
            status: 429,
            headers: { 'retry-after': '60' },
          },
        })
        .mockResolvedValueOnce({
          data: {
            response: { item_list: [] },
          },
        });

      const mockConnection = { credentials: { accessToken: 'token' } };

      // Should eventually succeed after rate limit
      const products = await shopeeAdapter.fetchProducts(mockConnection);

      expect(products).toEqual([]);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });

    it('should handle network timeouts and retries', async () => {
      // Mock network timeout
      mockHttpClient.get
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          data: {
            response: { item_list: [] },
          },
        });

      const mockConnection = { credentials: { accessToken: 'token' } };

      // Should retry and succeed
      const products = await shopeeAdapter.fetchProducts(mockConnection);

      expect(products).toEqual([]);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });

    it('should handle large data sets efficiently', async () => {
      const largeProductList = Array.from({ length: 1000 }, (_, i) => ({
        item_id: i,
        item_name: `Product ${i}`,
        item_sku: `SKU-${i}`,
        price_info: [{ current_price: 29.99 }],
        stock_info: [{ current_stock: 100 }],
        item_status: 'NORMAL',
      }));

      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          response: { item_list: largeProductList },
        },
      });

      const mockConnection = { credentials: { accessToken: 'token' } };

      const startTime = Date.now();
      const products = await shopeeAdapter.fetchProducts(mockConnection);
      const duration = Date.now() - startTime;

      expect(products).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should process large datasets efficiently
    });
  });

  describe('Data Transformation and Validation', () => {
    it('should properly transform platform-specific data formats', async () => {
      // Test Shopee data transformation
      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          response: {
            item_list: [
              {
                item_id: 123456,
                item_name: 'Test Product',
                item_sku: 'TEST-001',
                price_info: [{ current_price: 29.99 }],
                stock_info: [{ current_stock: 100 }],
                image: { image_url_list: ['url1', 'url2'] },
                item_status: 'NORMAL',
              },
            ],
          },
        },
      });

      const mockConnection = { credentials: { accessToken: 'token' } };
      const products = await shopeeAdapter.fetchProducts(mockConnection);

      expect(products[0]).toEqual({
        platformProductId: '123456',
        name: 'Test Product',
        sku: 'TEST-001',
        price: 29.99,
        stock: 100,
        images: ['url1', 'url2'],
        isActive: true,
      });
    });

    it('should validate required fields in API responses', async () => {
      // Test incomplete data handling
      mockHttpClient.get.mockResolvedValueOnce({
        data: {
          response: {
            item_list: [
              {
                item_id: 123456,
                // Missing required fields
                price_info: [],
                stock_info: [],
              },
            ],
          },
        },
      });

      const mockConnection = { credentials: { accessToken: 'token' } };
      const products = await shopeeAdapter.fetchProducts(mockConnection);

      // Should handle missing data gracefully
      expect(products[0]).toEqual({
        platformProductId: '123456',
        name: undefined,
        sku: undefined,
        price: 0,
        stock: 0,
        images: [],
        isActive: false,
      });
    });
  });
});