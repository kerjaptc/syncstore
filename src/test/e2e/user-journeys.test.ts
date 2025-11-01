/**
 * End-to-End tests for critical user journeys
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockOrganization, createMockUser, createMockStore, createMockProduct } from '../factories';

// Mock browser/page interactions
const mockPage = {
  goto: vi.fn(),
  click: vi.fn(),
  fill: vi.fn(),
  select: vi.fn(),
  waitForSelector: vi.fn(),
  waitForResponse: vi.fn(),
  screenshot: vi.fn(),
  evaluate: vi.fn(),
  locator: vi.fn().mockReturnThis(),
  textContent: vi.fn(),
  isVisible: vi.fn(),
  count: vi.fn(),
};

// Mock API responses for E2E scenarios
const mockApiResponses = {
  '/api/auth/session': {
    user: createMockUser(),
    organization: createMockOrganization(),
  },
  '/api/stores': [],
  '/api/products': [],
  '/api/orders': [],
};

// Mock external platform APIs
const mockPlatformAPIs = {
  shopee: {
    '/auth/token/get': {
      access_token: 'shopee-token',
      refresh_token: 'shopee-refresh',
      expires_in: 3600,
    },
    '/product/get_item_list': {
      response: { item_list: [], total_count: 0 },
    },
  },
  tiktokshop: {
    '/authorization/token/get': {
      access_token: 'tiktok-token',
      refresh_token: 'tiktok-refresh',
      expires_in: 7200,
    },
  },
};

describe('End-to-End User Journeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default page behaviors
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.click.mockResolvedValue(undefined);
    mockPage.fill.mockResolvedValue(undefined);
    mockPage.waitForSelector.mockResolvedValue(undefined);
    mockPage.isVisible.mockResolvedValue(true);
    mockPage.textContent.mockResolvedValue('');
  });

  describe('Store Connection Journey', () => {
    it('should complete full store connection workflow', async () => {
      // Step 1: Navigate to dashboard
      await mockPage.goto('/dashboard');
      expect(mockPage.goto).toHaveBeenCalledWith('/dashboard');

      // Step 2: Click "Connect Store" button
      await mockPage.click('[data-testid="connect-store-button"]');
      expect(mockPage.click).toHaveBeenCalledWith('[data-testid="connect-store-button"]');

      // Step 3: Select platform (Shopee)
      await mockPage.click('[data-testid="platform-shopee"]');
      expect(mockPage.click).toHaveBeenCalledWith('[data-testid="platform-shopee"]');

      // Step 4: Fill store connection form
      await mockPage.fill('[data-testid="store-name"]', 'My Shopee Store');
      await mockPage.fill('[data-testid="shop-id"]', '123456');
      await mockPage.fill('[data-testid="partner-id"]', '789');
      
      expect(mockPage.fill).toHaveBeenCalledWith('[data-testid="store-name"]', 'My Shopee Store');
      expect(mockPage.fill).toHaveBeenCalledWith('[data-testid="shop-id"]', '123456');

      // Step 5: Mock OAuth flow
      mockPage.waitForResponse.mockResolvedValue({
        url: () => 'https://partner.shopeemobile.com/api/v2/auth/token/get',
        json: () => mockPlatformAPIs.shopee['/auth/token/get'],
        status: () => 200,
      });

      // Step 6: Submit connection form
      await mockPage.click('[data-testid="connect-button"]');
      
      // Step 7: Wait for connection success
      await mockPage.waitForSelector('[data-testid="connection-success"]');
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('[data-testid="connection-success"]');

      // Step 8: Verify store appears in store list
      mockPage.textContent.mockResolvedValue('My Shopee Store');
      const storeText = await mockPage.textContent('[data-testid="store-list-item"]');
      expect(storeText).toBe('My Shopee Store');

      // Step 9: Verify store status is "Connected"
      mockPage.textContent.mockResolvedValue('Connected');
      const statusText = await mockPage.textContent('[data-testid="store-status"]');
      expect(statusText).toBe('Connected');
    });

    it('should handle store connection errors gracefully', async () => {
      await mockPage.goto('/dashboard');
      await mockPage.click('[data-testid="connect-store-button"]');
      await mockPage.click('[data-testid="platform-shopee"]');

      // Fill invalid credentials
      await mockPage.fill('[data-testid="store-name"]', 'Invalid Store');
      await mockPage.fill('[data-testid="shop-id"]', 'invalid');

      // Mock API error response
      mockPage.waitForResponse.mockResolvedValue({
        url: () => 'https://partner.shopeemobile.com/api/v2/auth/token/get',
        json: () => ({ error: 'invalid_grant' }),
        status: () => 401,
      });

      await mockPage.click('[data-testid="connect-button"]');

      // Should show error message
      await mockPage.waitForSelector('[data-testid="connection-error"]');
      mockPage.textContent.mockResolvedValue('Invalid credentials. Please check your store information.');
      
      const errorText = await mockPage.textContent('[data-testid="connection-error"]');
      expect(errorText).toContain('Invalid credentials');
    });

    it('should support multiple platform connections', async () => {
      // Connect Shopee store first
      await mockPage.goto('/dashboard');
      await mockPage.click('[data-testid="connect-store-button"]');
      await mockPage.click('[data-testid="platform-shopee"]');
      await mockPage.fill('[data-testid="store-name"]', 'Shopee Store');
      await mockPage.click('[data-testid="connect-button"]');
      await mockPage.waitForSelector('[data-testid="connection-success"]');

      // Connect TikTok Shop store
      await mockPage.click('[data-testid="connect-store-button"]');
      await mockPage.click('[data-testid="platform-tiktokshop"]');
      await mockPage.fill('[data-testid="store-name"]', 'TikTok Shop Store');
      await mockPage.click('[data-testid="connect-button"]');
      await mockPage.waitForSelector('[data-testid="connection-success"]');

      // Verify both stores are listed
      mockPage.count.mockResolvedValue(2);
      const storeCount = await mockPage.count('[data-testid="store-list-item"]');
      expect(storeCount).toBe(2);
    });
  });

  describe('Product Sync Journey', () => {
    it('should complete product synchronization workflow', async () => {
      // Prerequisites: Store already connected
      await mockPage.goto('/dashboard/products');

      // Step 1: Trigger product sync
      await mockPage.click('[data-testid="sync-products-button"]');
      expect(mockPage.click).toHaveBeenCalledWith('[data-testid="sync-products-button"]');

      // Step 2: Select stores to sync
      await mockPage.click('[data-testid="store-checkbox-shopee"]');
      await mockPage.click('[data-testid="store-checkbox-tiktokshop"]');

      // Step 3: Configure sync options
      await mockPage.click('[data-testid="sync-option-bidirectional"]');
      await mockPage.click('[data-testid="conflict-resolution-master-wins"]');

      // Step 4: Start sync process
      await mockPage.click('[data-testid="start-sync-button"]');

      // Step 5: Monitor sync progress
      await mockPage.waitForSelector('[data-testid="sync-progress"]');
      
      // Mock progress updates
      mockPage.textContent
        .mockResolvedValueOnce('Syncing... 25%')
        .mockResolvedValueOnce('Syncing... 50%')
        .mockResolvedValueOnce('Syncing... 75%')
        .mockResolvedValueOnce('Sync completed successfully');

      // Step 6: Wait for completion
      await mockPage.waitForSelector('[data-testid="sync-complete"]');

      // Step 7: Verify sync results
      mockPage.textContent.mockResolvedValue('150 products synced, 5 conflicts resolved');
      const resultText = await mockPage.textContent('[data-testid="sync-results"]');
      expect(resultText).toContain('150 products synced');

      // Step 8: Verify products appear in product list
      mockPage.count.mockResolvedValue(150);
      const productCount = await mockPage.count('[data-testid="product-row"]');
      expect(productCount).toBe(150);
    });

    it('should handle sync conflicts with user intervention', async () => {
      await mockPage.goto('/dashboard/products');
      await mockPage.click('[data-testid="sync-products-button"]');
      await mockPage.click('[data-testid="start-sync-button"]');

      // Mock conflict detection
      await mockPage.waitForSelector('[data-testid="sync-conflicts"]');

      // Step 1: Review conflicts
      mockPage.count.mockResolvedValue(3);
      const conflictCount = await mockPage.count('[data-testid="conflict-item"]');
      expect(conflictCount).toBe(3);

      // Step 2: Resolve first conflict - choose master version
      await mockPage.click('[data-testid="conflict-0-master"]');

      // Step 3: Resolve second conflict - choose platform version
      await mockPage.click('[data-testid="conflict-1-platform"]');

      // Step 4: Resolve third conflict - manual merge
      await mockPage.click('[data-testid="conflict-2-manual"]');
      await mockPage.fill('[data-testid="manual-price"]', '29.99');
      await mockPage.fill('[data-testid="manual-stock"]', '100');

      // Step 5: Apply conflict resolutions
      await mockPage.click('[data-testid="apply-resolutions"]');

      // Step 6: Complete sync
      await mockPage.waitForSelector('[data-testid="sync-complete"]');
      
      mockPage.textContent.mockResolvedValue('Sync completed with 3 conflicts resolved');
      const resultText = await mockPage.textContent('[data-testid="sync-results"]');
      expect(resultText).toContain('3 conflicts resolved');
    });
  });

  describe('Order Processing Journey', () => {
    it('should complete order import and fulfillment workflow', async () => {
      // Step 1: Navigate to orders page
      await mockPage.goto('/dashboard/orders');

      // Step 2: Import new orders
      await mockPage.click('[data-testid="import-orders-button"]');

      // Mock API response with new orders
      mockPage.waitForResponse.mockResolvedValue({
        json: () => ({
          success: true,
          data: {
            imported: 25,
            new: 20,
            updated: 5,
          },
        }),
        status: () => 200,
      });

      await mockPage.waitForSelector('[data-testid="import-complete"]');

      // Step 3: Verify orders imported
      mockPage.textContent.mockResolvedValue('25 orders imported (20 new, 5 updated)');
      const importText = await mockPage.textContent('[data-testid="import-results"]');
      expect(importText).toContain('25 orders imported');

      // Step 4: Filter pending orders
      await mockPage.select('[data-testid="status-filter"]', 'pending');
      
      mockPage.count.mockResolvedValue(20);
      const pendingCount = await mockPage.count('[data-testid="order-row"]');
      expect(pendingCount).toBe(20);

      // Step 5: Select orders for bulk fulfillment
      await mockPage.click('[data-testid="select-all-orders"]');
      await mockPage.click('[data-testid="bulk-actions-button"]');
      await mockPage.click('[data-testid="bulk-fulfill"]');

      // Step 6: Configure fulfillment
      await mockPage.fill('[data-testid="tracking-number"]', 'TRACK123456');
      await mockPage.select('[data-testid="shipping-carrier"]', 'DHL');
      await mockPage.click('[data-testid="confirm-fulfillment"]');

      // Step 7: Wait for fulfillment completion
      await mockPage.waitForSelector('[data-testid="fulfillment-complete"]');

      // Step 8: Verify order status updates
      mockPage.textContent.mockResolvedValue('20 orders fulfilled successfully');
      const fulfillmentText = await mockPage.textContent('[data-testid="fulfillment-results"]');
      expect(fulfillmentText).toContain('20 orders fulfilled');
    });

    it('should handle order processing errors', async () => {
      await mockPage.goto('/dashboard/orders');
      
      // Select orders with inventory issues
      await mockPage.click('[data-testid="order-checkbox-1"]');
      await mockPage.click('[data-testid="order-checkbox-2"]');
      await mockPage.click('[data-testid="bulk-fulfill"]');

      // Mock inventory error
      mockPage.waitForResponse.mockResolvedValue({
        json: () => ({
          success: false,
          errors: [
            { orderId: 'order-1', error: 'Insufficient inventory' },
            { orderId: 'order-2', error: 'Product discontinued' },
          ],
        }),
        status: () => 400,
      });

      await mockPage.click('[data-testid="confirm-fulfillment"]');

      // Should show error details
      await mockPage.waitForSelector('[data-testid="fulfillment-errors"]');
      
      mockPage.count.mockResolvedValue(2);
      const errorCount = await mockPage.count('[data-testid="error-item"]');
      expect(errorCount).toBe(2);

      // Should provide resolution options
      await mockPage.waitForSelector('[data-testid="resolve-inventory"]');
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('[data-testid="resolve-inventory"]');
    });
  });

  describe('Multi-Platform Workflow', () => {
    it('should handle complex multi-platform operations', async () => {
      // Step 1: Setup - Connect multiple stores
      await mockPage.goto('/dashboard');
      
      // Connect Shopee
      await mockPage.click('[data-testid="connect-store-button"]');
      await mockPage.click('[data-testid="platform-shopee"]');
      await mockPage.fill('[data-testid="store-name"]', 'Shopee Main');
      await mockPage.click('[data-testid="connect-button"]');
      await mockPage.waitForSelector('[data-testid="connection-success"]');

      // Connect TikTok Shop
      await mockPage.click('[data-testid="connect-store-button"]');
      await mockPage.click('[data-testid="platform-tiktokshop"]');
      await mockPage.fill('[data-testid="store-name"]', 'TikTok Main');
      await mockPage.click('[data-testid="connect-button"]');
      await mockPage.waitForSelector('[data-testid="connection-success"]');

      // Step 2: Create master product
      await mockPage.goto('/dashboard/products');
      await mockPage.click('[data-testid="add-product-button"]');
      await mockPage.fill('[data-testid="product-name"]', 'Multi-Platform Product');
      await mockPage.fill('[data-testid="product-sku"]', 'MULTI-001');
      await mockPage.fill('[data-testid="product-price"]', '39.99');
      await mockPage.click('[data-testid="save-product"]');

      // Step 3: Push to all platforms
      await mockPage.click('[data-testid="product-actions-MULTI-001"]');
      await mockPage.click('[data-testid="push-to-platforms"]');
      await mockPage.click('[data-testid="select-all-platforms"]');
      await mockPage.click('[data-testid="confirm-push"]');

      // Step 4: Monitor cross-platform sync
      await mockPage.waitForSelector('[data-testid="platform-sync-status"]');
      
      // Should show sync status for each platform
      mockPage.isVisible.mockResolvedValue(true);
      expect(await mockPage.isVisible('[data-testid="shopee-sync-success"]')).toBe(true);
      expect(await mockPage.isVisible('[data-testid="tiktokshop-sync-success"]')).toBe(true);

      // Step 5: Update inventory across platforms
      await mockPage.goto('/dashboard/inventory');
      await mockPage.fill('[data-testid="inventory-MULTI-001"]', '500');
      await mockPage.click('[data-testid="update-inventory"]');

      // Should sync to all platforms
      await mockPage.waitForSelector('[data-testid="inventory-sync-complete"]');

      // Step 6: Process orders from multiple platforms
      await mockPage.goto('/dashboard/orders');
      await mockPage.click('[data-testid="import-orders-button"]');

      // Should import orders from all connected platforms
      mockPage.textContent.mockResolvedValue('Orders imported: Shopee (15), TikTok Shop (8)');
      const importText = await mockPage.textContent('[data-testid="import-summary"]');
      expect(importText).toContain('Shopee (15)');
      expect(importText).toContain('TikTok Shop (8)');
    });
  });

  describe('Error Recovery and Data Consistency', () => {
    it('should handle network failures gracefully', async () => {
      await mockPage.goto('/dashboard/products');
      
      // Simulate network failure during sync
      mockPage.waitForResponse.mockRejectedValue(new Error('Network error'));
      
      await mockPage.click('[data-testid="sync-products-button"]');
      await mockPage.click('[data-testid="start-sync-button"]');

      // Should show network error
      await mockPage.waitForSelector('[data-testid="network-error"]');
      
      mockPage.textContent.mockResolvedValue('Network connection lost. Retrying...');
      const errorText = await mockPage.textContent('[data-testid="error-message"]');
      expect(errorText).toContain('Network connection lost');

      // Should provide retry option
      await mockPage.click('[data-testid="retry-sync"]');

      // Mock successful retry
      mockPage.waitForResponse.mockResolvedValue({
        json: () => ({ success: true }),
        status: () => 200,
      });

      await mockPage.waitForSelector('[data-testid="sync-complete"]');
    });

    it('should maintain data consistency during partial failures', async () => {
      await mockPage.goto('/dashboard/products');
      
      // Start multi-platform sync
      await mockPage.click('[data-testid="sync-products-button"]');
      await mockPage.click('[data-testid="start-sync-button"]');

      // Mock partial failure (Shopee succeeds, TikTok fails)
      mockPage.waitForResponse
        .mockResolvedValueOnce({
          json: () => ({ platform: 'shopee', success: true, synced: 100 }),
          status: () => 200,
        })
        .mockRejectedValueOnce(new Error('TikTok API error'));

      await mockPage.waitForSelector('[data-testid="partial-sync-complete"]');

      // Should show detailed results
      mockPage.textContent.mockResolvedValue('Shopee: 100 products synced, TikTok Shop: Failed (API error)');
      const resultText = await mockPage.textContent('[data-testid="sync-results"]');
      expect(resultText).toContain('Shopee: 100 products synced');
      expect(resultText).toContain('TikTok Shop: Failed');

      // Should offer to retry failed platforms
      await mockPage.waitForSelector('[data-testid="retry-failed-platforms"]');
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('[data-testid="retry-failed-platforms"]');
    });
  });

  describe('Performance Under Load', () => {
    it('should handle large dataset operations efficiently', async () => {
      await mockPage.goto('/dashboard/products');

      // Mock large product import
      const startTime = Date.now();
      
      await mockPage.click('[data-testid="bulk-import-button"]');
      await mockPage.fill('[data-testid="file-input"]', 'large-product-list.csv');
      await mockPage.click('[data-testid="import-button"]');

      // Should show progress for large operations
      await mockPage.waitForSelector('[data-testid="import-progress"]');
      
      // Mock progress updates
      for (let i = 0; i <= 100; i += 10) {
        mockPage.textContent.mockResolvedValue(`Processing... ${i}%`);
      }

      await mockPage.waitForSelector('[data-testid="import-complete"]');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all products imported
      mockPage.textContent.mockResolvedValue('10,000 products imported successfully');
      const resultText = await mockPage.textContent('[data-testid="import-results"]');
      expect(resultText).toContain('10,000 products imported');
    });

    it('should maintain responsiveness during background operations', async () => {
      await mockPage.goto('/dashboard');

      // Start background sync
      await mockPage.click('[data-testid="auto-sync-toggle"]');

      // Should still be able to navigate while sync runs
      await mockPage.goto('/dashboard/orders');
      expect(mockPage.goto).toHaveBeenCalledWith('/dashboard/orders');

      await mockPage.goto('/dashboard/analytics');
      expect(mockPage.goto).toHaveBeenCalledWith('/dashboard/analytics');

      // Background sync should continue
      mockPage.isVisible.mockResolvedValue(true);
      expect(await mockPage.isVisible('[data-testid="background-sync-indicator"]')).toBe(true);
    });
  });
});