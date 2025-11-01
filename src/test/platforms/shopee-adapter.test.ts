/**
 * Unit tests for Shopee Platform Adapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShopeeAdapter } from '@/lib/platforms/shopee/shopee-adapter';
import { AppError } from '@/lib/error-handling/app-error';
import { createMockPlatformProduct, createMockPlatformOrder } from '../factories';
import type { StoreConnection, PlatformProduct, PlatformOrder } from '@/lib/types';

// Mock HTTP client
const mockHttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

// Mock rate limiter
const mockRateLimiter = {
  checkLimit: vi.fn(),
  waitForSlot: vi.fn(),
};

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('@/lib/platforms/http-client', () => ({ httpClient: mockHttpClient }));
vi.mock('@/lib/platforms/rate-limiter', () => ({ rateLimiter: mockRateLimiter }));
vi.mock('@/lib/error-handling/logger', () => ({ logger: mockLogger }));

describe('ShopeeAdapter', () => {
  let shopeeAdapter: ShopeeAdapter;
  let mockConnection: StoreConnection;

  beforeEach(() => {
    vi.clearAllMocks();
    shopeeAdapter = new ShopeeAdapter();
    mockConnection = {
      storeId: 'store-123',
      platform: 'shopee',
      credentials: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        shopId: 'shop-123',
        partnerId: 'partner-123',
      },
      isActive: true,
    };

    // Default rate limiter behavior
    mockRateLimiter.checkLimit.mockResolvedValue(true);
    mockRateLimiter.waitForSlot.mockResolvedValue(undefined);
  });

  describe('authenticateStore', () => {
    it('should authenticate store with valid credentials', async () => {
      const credentials = {
        authCode: 'auth-code-123',
        shopId: 'shop-123',
        partnerId: 'partner-123',
        partnerKey: 'partner-key-123',
      };

      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      };

      mockHttpClient.post.mockResolvedValue({
        data: mockTokenResponse,
        status: 200,
      });

      const result = await shopeeAdapter.authenticateStore(credentials);

      expect(result).toEqual({
        storeId: expect.any(String),
        platform: 'shopee',
        credentials: {
          accessToken: mockTokenResponse.access_token,
          refreshToken: mockTokenResponse.refresh_token,
          shopId: credentials.shopId,
          partnerId: credentials.partnerId,
          expiresAt: expect.any(Date),
        },
        isActive: true,
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/token/get'),
        expect.objectContaining({
          code: credentials.authCode,
          shop_id: parseInt(credentials.shopId),
          partner_id: parseInt(credentials.partnerId),
        })
      );
    });

    it('should throw error for invalid credentials', async () => {
      const invalidCredentials = {
        authCode: 'invalid-code',
        shopId: 'shop-123',
        partnerId: 'partner-123',
        partnerKey: 'invalid-key',
      };

      mockHttpClient.post.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'invalid_grant' },
        },
      });

      await expect(
        shopeeAdapter.authenticateStore(invalidCredentials)
      ).rejects.toThrow(AppError);
    });

    it('should handle network errors during authentication', async () => {
      const credentials = {
        authCode: 'auth-code-123',
        shopId: 'shop-123',
        partnerId: 'partner-123',
        partnerKey: 'partner-key-123',
      };

      mockHttpClient.post.mockRejectedValue(new Error('Network error'));

      await expect(
        shopeeAdapter.authenticateStore(credentials)
      ).rejects.toThrow(AppError);
    });
  });

  describe('refreshToken', () => {
    it('should refresh expired token successfully', async () => {
      const mockRefreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      };

      mockHttpClient.post.mockResolvedValue({
        data: mockRefreshResponse,
        status: 200,
      });

      const result = await shopeeAdapter.refreshToken(mockConnection);

      expect(result.credentials.accessToken).toBe(mockRefreshResponse.access_token);
      expect(result.credentials.refreshToken).toBe(mockRefreshResponse.refresh_token);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/access_token/get'),
        expect.objectContaining({
          refresh_token: mockConnection.credentials.refreshToken,
          partner_id: parseInt(mockConnection.credentials.partnerId),
          shop_id: parseInt(mockConnection.credentials.shopId),
        })
      );
    });

    it('should handle refresh token expiration', async () => {
      mockHttpClient.post.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'invalid_refresh_token' },
        },
      });

      await expect(
        shopeeAdapter.refreshToken(mockConnection)
      ).rejects.toThrow(AppError);
    });
  });

  describe('fetchProducts', () => {
    it('should fetch products with pagination', async () => {
      const mockProductsResponse = {
        response: {
          item_list: [
            {
              item_id: 123456,
              item_name: 'Test Product 1',
              item_sku: 'TEST-001',
              price_info: [{ current_price: 29.99 }],
              stock_info: [{ current_stock: 100 }],
              image: { image_url_list: ['https://example.com/image1.jpg'] },
              category_id: 1001,
              item_status: 'NORMAL',
            },
            {
              item_id: 123457,
              item_name: 'Test Product 2',
              item_sku: 'TEST-002',
              price_info: [{ current_price: 39.99 }],
              stock_info: [{ current_stock: 50 }],
              image: { image_url_list: ['https://example.com/image2.jpg'] },
              category_id: 1002,
              item_status: 'NORMAL',
            },
          ],
          total_count: 2,
          has_next_page: false,
        },
      };

      mockHttpClient.get.mockResolvedValue({
        data: mockProductsResponse,
        status: 200,
      });

      const result = await shopeeAdapter.fetchProducts(mockConnection, {
        limit: 50,
        offset: 0,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        platformProductId: '123456',
        name: 'Test Product 1',
        sku: 'TEST-001',
        price: 29.99,
        stock: 100,
        isActive: true,
      });

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/product/get_item_list'),
        expect.objectContaining({
          params: expect.objectContaining({
            page_size: 50,
            offset: 0,
          }),
        })
      );
    });

    it('should handle empty product list', async () => {
      const mockEmptyResponse = {
        response: {
          item_list: [],
          total_count: 0,
          has_next_page: false,
        },
      };

      mockHttpClient.get.mockResolvedValue({
        data: mockEmptyResponse,
        status: 200,
      });

      const result = await shopeeAdapter.fetchProducts(mockConnection);

      expect(result).toHaveLength(0);
    });

    it('should handle API rate limiting', async () => {
      mockRateLimiter.checkLimit.mockResolvedValue(false);
      mockRateLimiter.waitForSlot.mockResolvedValue(undefined);

      const mockResponse = {
        response: {
          item_list: [createMockPlatformProduct()],
          total_count: 1,
          has_next_page: false,
        },
      };

      mockHttpClient.get.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      await shopeeAdapter.fetchProducts(mockConnection);

      expect(mockRateLimiter.waitForSlot).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockHttpClient.get.mockRejectedValue({
        response: {
          status: 500,
          data: { error: 'Internal server error' },
        },
      });

      await expect(
        shopeeAdapter.fetchProducts(mockConnection)
      ).rejects.toThrow(AppError);
    });
  });

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const productUpdate: PlatformProduct = {
        platformProductId: '123456',
        name: 'Updated Product Name',
        sku: 'UPDATED-001',
        price: 49.99,
        stock: 75,
        images: ['https://example.com/updated-image.jpg'],
        category: 'Electronics',
        attributes: { brand: 'Test Brand' },
        isActive: true,
      };

      mockHttpClient.post.mockResolvedValue({
        data: { response: { item_id: 123456 } },
        status: 200,
      });

      await shopeeAdapter.updateProduct(mockConnection, productUpdate);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/product/update_item'),
        expect.objectContaining({
          item_id: 123456,
          item_name: productUpdate.name,
          item_sku: productUpdate.sku,
        })
      );
    });

    it('should handle product update validation errors', async () => {
      const invalidProduct: PlatformProduct = {
        platformProductId: '123456',
        name: '', // Invalid empty name
        sku: 'TEST-001',
        price: -10, // Invalid negative price
        stock: 50,
        images: [],
        isActive: true,
      };

      await expect(
        shopeeAdapter.updateProduct(mockConnection, invalidProduct)
      ).rejects.toThrow(AppError);
    });
  });

  describe('updateInventory', () => {
    it('should update inventory levels successfully', async () => {
      const inventoryUpdates = [
        {
          platformProductId: '123456',
          stock: 100,
          locationId: 'location-1',
        },
        {
          platformProductId: '123457',
          stock: 50,
          locationId: 'location-1',
        },
      ];

      mockHttpClient.post.mockResolvedValue({
        data: { response: { success: true } },
        status: 200,
      });

      await shopeeAdapter.updateInventory(mockConnection, inventoryUpdates);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/product/update_stock'),
        expect.objectContaining({
          stock_list: expect.arrayContaining([
            expect.objectContaining({
              item_id: 123456,
              stock: 100,
            }),
            expect.objectContaining({
              item_id: 123457,
              stock: 50,
            }),
          ]),
        })
      );
    });

    it('should handle bulk inventory update errors', async () => {
      const inventoryUpdates = [
        {
          platformProductId: '123456',
          stock: -10, // Invalid negative stock
          locationId: 'location-1',
        },
      ];

      await expect(
        shopeeAdapter.updateInventory(mockConnection, inventoryUpdates)
      ).rejects.toThrow(AppError);
    });
  });

  describe('fetchOrders', () => {
    it('should fetch orders with date range', async () => {
      const mockOrdersResponse = {
        response: {
          order_list: [
            {
              order_sn: 'ORDER123456',
              order_status: 'READY_TO_SHIP',
              create_time: 1640995200, // Unix timestamp
              recipient_address: {
                name: 'John Doe',
                phone: '+1234567890',
              },
              item_list: [
                {
                  item_id: 123456,
                  item_name: 'Test Product',
                  item_sku: 'TEST-001',
                  model_quantity_purchased: 2,
                  model_original_price: 29.99,
                },
              ],
              total_amount: 59.98,
            },
          ],
          total_count: 1,
          has_next_page: false,
        },
      };

      mockHttpClient.get.mockResolvedValue({
        data: mockOrdersResponse,
        status: 200,
      });

      const result = await shopeeAdapter.fetchOrders(mockConnection, {
        dateFrom: new Date('2022-01-01'),
        dateTo: new Date('2022-01-31'),
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
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
    });

    it('should handle order fetch with pagination', async () => {
      const mockResponse = {
        response: {
          order_list: Array.from({ length: 50 }, (_, i) => ({
            order_sn: `ORDER${i}`,
            order_status: 'COMPLETED',
            create_time: 1640995200,
            total_amount: 29.99,
          })),
          total_count: 150,
          has_next_page: true,
        },
      };

      mockHttpClient.get.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await shopeeAdapter.fetchOrders(mockConnection, {
        limit: 50,
        offset: 0,
      });

      expect(result).toHaveLength(50);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status successfully', async () => {
      const orderId = 'ORDER123456';
      const newStatus = 'SHIPPED';

      mockHttpClient.post.mockResolvedValue({
        data: { response: { success: true } },
        status: 200,
      });

      await shopeeAdapter.updateOrderStatus(mockConnection, orderId, newStatus);

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/logistics/ship_order'),
        expect.objectContaining({
          order_sn: orderId,
        })
      );
    });

    it('should handle invalid order status updates', async () => {
      const orderId = 'ORDER123456';
      const invalidStatus = 'INVALID_STATUS';

      await expect(
        shopeeAdapter.updateOrderStatus(mockConnection, orderId, invalidStatus)
      ).rejects.toThrow(AppError);
    });
  });

  describe('performance tests', () => {
    it('should handle large product fetches efficiently', async () => {
      const largeProductList = Array.from({ length: 1000 }, (_, i) => ({
        item_id: i,
        item_name: `Product ${i}`,
        item_sku: `SKU-${i}`,
        price_info: [{ current_price: 29.99 }],
        stock_info: [{ current_stock: 100 }],
        item_status: 'NORMAL',
      }));

      mockHttpClient.get.mockResolvedValue({
        data: {
          response: {
            item_list: largeProductList,
            total_count: 1000,
            has_next_page: false,
          },
        },
        status: 200,
      });

      const startTime = Date.now();
      const result = await shopeeAdapter.fetchProducts(mockConnection);
      const duration = Date.now() - startTime;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent API calls efficiently', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: {
          response: {
            item_list: [createMockPlatformProduct()],
            total_count: 1,
            has_next_page: false,
          },
        },
        status: 200,
      });

      const startTime = Date.now();
      const concurrentCalls = Array.from({ length: 10 }, () =>
        shopeeAdapter.fetchProducts(mockConnection)
      );

      await Promise.all(concurrentCalls);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('security tests', () => {
    it('should sign API requests properly', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: { response: { item_list: [] } },
        status: 200,
      });

      await shopeeAdapter.fetchProducts(mockConnection);

      const callArgs = mockHttpClient.get.mock.calls[0];
      const headers = callArgs[1]?.headers;

      expect(headers).toHaveProperty('Authorization');
      expect(headers).toHaveProperty('Content-Type');
      expect(headers).toHaveProperty('timestamp');
      expect(headers).toHaveProperty('sign');
    });

    it('should handle authentication errors securely', async () => {
      mockHttpClient.get.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'access_token_invalid' },
        },
      });

      await expect(
        shopeeAdapter.fetchProducts(mockConnection)
      ).rejects.toThrow(AppError);

      // Should not expose sensitive credential information in error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/authentication/i),
        expect.not.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        })
      );
    });

    it('should validate input parameters', async () => {
      const invalidConnection = {
        ...mockConnection,
        credentials: {
          ...mockConnection.credentials,
          accessToken: '', // Invalid empty token
        },
      };

      await expect(
        shopeeAdapter.fetchProducts(invalidConnection)
      ).rejects.toThrow(AppError);
    });

    it('should sanitize API responses', async () => {
      const maliciousResponse = {
        response: {
          item_list: [
            {
              item_id: 123456,
              item_name: '<script>alert("xss")</script>Malicious Product',
              item_sku: 'TEST-001',
              price_info: [{ current_price: 29.99 }],
              stock_info: [{ current_stock: 100 }],
              item_status: 'NORMAL',
            },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue({
        data: maliciousResponse,
        status: 200,
      });

      const result = await shopeeAdapter.fetchProducts(mockConnection);

      expect(result[0].name).not.toContain('<script>');
      expect(result[0].name).toBe('Malicious Product'); // Should be sanitized
    });
  });
});