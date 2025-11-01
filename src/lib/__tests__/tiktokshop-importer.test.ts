import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TikTokShopImporter, createTikTokShopImporter, quickTikTokShopImport } from '../importers/tiktokshop-importer';
import { MockTikTokShopImporter } from '../importers/mock-tiktokshop-import';
import { tiktokShopValidator } from '../validators/tiktokshop-validator';
import { tiktokShopDataStore } from '../storage/tiktokshop-data-store';
import type { TikTokShopCredentials } from '../platforms/tiktokshop/tiktokshop-types';

// Mock the TikTok Shop Auth module
const mockAuth = {
  authenticate: vi.fn(),
  signRequest: vi.fn(),
};

vi.mock('../platforms/tiktokshop/tiktokshop-auth', () => ({
  TikTokShopAuth: vi.fn(() => mockAuth),
}));

// Mock the validator and data store
vi.mock('../validators/tiktokshop-validator', () => ({
  tiktokShopValidator: {
    validateProduct: vi.fn(),
    validateVariant: vi.fn(),
  },
}));

vi.mock('../storage/tiktokshop-data-store', () => ({
  tiktokShopDataStore: {
    initialize: vi.fn(),
    storeProduct: vi.fn(),
    storeVariant: vi.fn(),
    storeBatch: vi.fn(),
    storeImportSession: vi.fn(),
    saveProgressLogs: vi.fn(),
    logProgress: vi.fn(),
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('TikTok Shop Importer Tests', () => {
  let importer: TikTokShopImporter;
  let mockCredentials: TikTokShopCredentials;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCredentials = {
      platform: 'tiktokshop',
      appKey: 'test-app-key',
      appSecret: 'test-app-secret',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      shopId: 'test-shop-123',
    };
    
    importer = new TikTokShopImporter(mockCredentials, {
      batchSize: 5,
      maxRetries: 2,
      rateLimitDelay: 10, // Fast for testing
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TikTok Shop Importer Configuration', () => {
    it('should create importer with default options', () => {
      const defaultImporter = new TikTokShopImporter(mockCredentials);
      expect(defaultImporter).toBeDefined();
    });

    it('should create importer with custom options including Tokopedia flag', () => {
      const options = {
        batchSize: 10,
        maxRetries: 5,
        rateLimitDelay: 200,
        includeTokopedia: true,
      };
      
      const customImporter = new TikTokShopImporter(mockCredentials, options);
      expect(customImporter).toBeDefined();
    });
  });

  describe('API Integration Tests - TikTok Shop Specific', () => {
    it('should handle authentication before import', async () => {
      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'new-token', refreshToken: 'new-refresh', expiresAt: new Date() },
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          code: 0,
          message: 'success',
          data: { products: [], total: 0, more: false },
        }),
      });

      const result = await importer.importProducts();

      expect(mockAuth.authenticate).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.totalProducts).toBe(0);
    });

    it('should handle Tokopedia integration flag', async () => {
      const tokopediaImporter = new TikTokShopImporter(mockCredentials, {
        includeTokopedia: true,
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      mockAuth.signRequest.mockReturnValue({
        app_key: 'test-app-key',
        timestamp: '1234567890',
        access_token: 'test-token',
        page: '1',
        page_size: '100',
        include_tokopedia: 'true',
        sign: 'test-signature',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          code: 0,
          message: 'success',
          data: { products: [], total: 0, more: false },
        }),
      });

      const result = await tokopediaImporter.importProducts();

      expect(result.tokopediaIncluded).toBe(true);
      expect(mockAuth.signRequest).toHaveBeenCalledWith('/api/products/search', expect.objectContaining({
        include_tokopedia: 'true',
      }));
    });

    it('should fetch product details with TikTok Shop API format', async () => {
      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      mockAuth.signRequest.mockReturnValue({
        app_key: 'test-app-key',
        timestamp: '1234567890',
        access_token: 'test-token',
        sign: 'test-signature',
      });

      // Mock validator to return valid result
      (tiktokShopValidator.validateProduct as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        data: { id: 'TTS-123', validated: true },
        tokopediaFlag: false,
      });

      // Mock product list response
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{ product_id: 'TTS-123', product_name: 'Test Product' }],
              total: 1,
              more: false,
            },
          }),
        })
        // Mock product details response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-123',
                title: 'Test TikTok Product',
                description: 'Test Description',
                skus: [],
              }],
            },
          }),
        });

      const result = await importer.importProducts();

      expect(result.success).toBe(true);
      expect(result.totalProducts).toBe(1);
      expect(result.importedProducts).toBe(1);
    });
  });

  describe('Error Handling and Retry Logic - TikTok Shop Specific', () => {
    it('should handle authentication failures', async () => {
      mockAuth.authenticate.mockResolvedValueOnce({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Invalid credentials' },
      });

      const result = await importer.importProducts();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('Authentication failed');
    });

    it('should handle TikTok Shop API errors', async () => {
      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          code: 1001,
          message: 'Invalid request parameters',
          data: null,
        }),
      });

      const result = await importer.importProducts();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should retry failed API calls with exponential backoff', async () => {
      const retryImporter = new TikTokShopImporter(mockCredentials, {
        maxRetries: 3,
        retryDelay: 10, // Fast for testing
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      // Mock validator to return valid result
      (tiktokShopValidator.validateProduct as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        data: { id: 'TTS-123', validated: true },
        tokopediaFlag: false,
      });

      // Mock product list call to succeed
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{ product_id: 'TTS-123', product_name: 'Test Product' }],
              total: 1,
              more: false,
            },
          }),
        })
        // Mock product details to fail twice, then succeed
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-123',
                title: 'Test Product',
                skus: [],
              }],
            },
          }),
        });

      const result = await retryImporter.importProducts();

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(4); // 1 for list + 3 for details (2 failures + 1 success)
    });

    it('should fail after maximum retry attempts', async () => {
      const retryImporter = new TikTokShopImporter(mockCredentials, {
        maxRetries: 2,
        retryDelay: 10,
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      // Mock product list call to succeed
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{ product_id: 'TTS-123', product_name: 'Test Product' }],
              total: 1,
              more: false,
            },
          }),
        })
        // Mock product details to always fail
        .mockRejectedValue(new Error('Persistent network error'));

      const result = await retryImporter.importProducts();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 for list + 2 retry attempts
    });

    it('should handle rate limiting gracefully', async () => {
      const rateLimitImporter = new TikTokShopImporter(mockCredentials, {
        rateLimitDelay: 50, // Longer delay for rate limiting test
        batchSize: 2,
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      // Mock validator to return valid result
      (tiktokShopValidator.validateProduct as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        data: { validated: true },
        tokopediaFlag: false,
      });

      // Mock multiple products
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [
                { product_id: 'TTS-1', product_name: 'Product 1' },
                { product_id: 'TTS-2', product_name: 'Product 2' },
                { product_id: 'TTS-3', product_name: 'Product 3' },
              ],
              total: 3,
              more: false,
            },
          }),
        })
        // Mock product details for each product
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-1',
                title: 'Test Product',
                skus: [],
              }],
            },
          }),
        });

      const startTime = Date.now();
      const result = await rateLimitImporter.importProducts();
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeGreaterThan(100); // Should take some time due to rate limiting
    });

    it('should handle HTTP errors with proper error messages', async () => {
      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const result = await importer.importProducts();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('HTTP 429');
    });

    it('should handle malformed JSON responses', async () => {
      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await importer.importProducts();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Connection Validation', () => {
    it('should validate TikTok Shop API credentials', async () => {
      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      mockAuth.signRequest.mockReturnValue({
        app_key: 'test-app-key',
        timestamp: '1234567890',
        access_token: 'test-token',
        sign: 'test-signature',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 0, message: 'success' }),
      });

      const result = await importer.validateConnection();

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle invalid TikTok Shop credentials', async () => {
      mockAuth.authenticate.mockResolvedValueOnce({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid app key or secret' },
      });

      const result = await importer.validateConnection();

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid app key or secret');
    });
  });

  describe('Tokopedia Integration Tests', () => {
    it('should handle Tokopedia flag in product import', async () => {
      const tokopediaImporter = new TikTokShopImporter(mockCredentials, {
        includeTokopedia: true,
        batchSize: 2,
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      // Mock validator to return Tokopedia flag
      (tiktokShopValidator.validateProduct as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        data: { id: 'TTS-1', include_tokopedia: true },
        tokopediaFlag: true,
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{ product_id: 'TTS-1', product_name: 'Tokopedia Product' }],
              total: 1,
              more: false,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-1',
                title: 'Tokopedia Product',
                include_tokopedia: true,
                skus: [],
              }],
            },
          }),
        });

      const result = await tokopediaImporter.importProducts();

      expect(result.success).toBe(true);
      expect(result.tokopediaIncluded).toBe(true);
      expect(result.tokopediaEnabledProducts).toBe(1);
      expect(mockAuth.signRequest).toHaveBeenCalledWith('/api/products/search', expect.objectContaining({
        include_tokopedia: 'true',
      }));
    });

    it('should track Tokopedia products separately', async () => {
      const tokopediaImporter = new TikTokShopImporter(mockCredentials, {
        includeTokopedia: true,
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      // Mock mixed products - some with Tokopedia, some without
      (tiktokShopValidator.validateProduct as any)
        .mockReturnValueOnce({
          isValid: true,
          errors: [],
          warnings: [],
          data: { id: 'TTS-1', include_tokopedia: true },
          tokopediaFlag: true,
        })
        .mockReturnValueOnce({
          isValid: true,
          errors: [],
          warnings: [],
          data: { id: 'TTS-2', include_tokopedia: false },
          tokopediaFlag: false,
        });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [
                { product_id: 'TTS-1', product_name: 'Tokopedia Product' },
                { product_id: 'TTS-2', product_name: 'Regular Product' },
              ],
              total: 2,
              more: false,
            },
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-1',
                title: 'Test Product',
                skus: [],
              }],
            },
          }),
        });

      const result = await tokopediaImporter.importProducts();

      expect(result.success).toBe(true);
      expect(result.tokopediaEnabledProducts).toBe(1);
      expect(result.validatedProducts).toBe(2);
    });

    it('should disable Tokopedia integration when flag is false', async () => {
      const noTokopediaImporter = new TikTokShopImporter(mockCredentials, {
        includeTokopedia: false,
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          code: 0,
          message: 'success',
          data: { products: [], total: 0, more: false },
        }),
      });

      const result = await noTokopediaImporter.importProducts();

      expect(result.tokopediaIncluded).toBe(false);
      expect(mockAuth.signRequest).toHaveBeenCalledWith('/api/products/search', expect.not.objectContaining({
        include_tokopedia: 'true',
      }));
    });

    it('should handle Tokopedia validation errors gracefully', async () => {
      const tokopediaImporter = new TikTokShopImporter(mockCredentials, {
        includeTokopedia: true,
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      // Mock validator to return validation error for Tokopedia product
      (tiktokShopValidator.validateProduct as any).mockReturnValue({
        isValid: false,
        errors: ['Tokopedia product validation failed'],
        warnings: [],
        tokopediaFlag: true,
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{ product_id: 'TTS-1', product_name: 'Invalid Tokopedia Product' }],
              total: 1,
              more: false,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-1',
                title: 'Invalid Product',
                include_tokopedia: true,
                skus: [],
              }],
            },
          }),
        });

      const result = await tokopediaImporter.importProducts();

      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors[0].errors).toContain('Tokopedia product validation failed');
    });
  });

  describe('Integration Tests with Validator and Data Store', () => {
    it('should integrate with validator for product validation', async () => {
      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (tiktokShopValidator.validateProduct as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: ['Test warning'],
        data: { id: 'TTS-1', validated: true },
        tokopediaFlag: false,
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{ product_id: 'TTS-1', product_name: 'Test Product' }],
              total: 1,
              more: false,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-1',
                title: 'Test Product',
                skus: [],
              }],
            },
          }),
        });

      const result = await importer.importProducts();

      expect(tiktokShopValidator.validateProduct).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.validatedProducts).toBe(1);
    });

    it('should integrate with data store for product storage', async () => {
      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (tiktokShopValidator.validateProduct as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        data: { id: 'TTS-1', validated: true },
        tokopediaFlag: false,
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{ product_id: 'TTS-1', product_name: 'Test Product' }],
              total: 1,
              more: false,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-1',
                title: 'Test Product',
                skus: [],
              }],
            },
          }),
        });

      const result = await importer.importProducts();

      expect(tiktokShopDataStore.initialize).toHaveBeenCalled();
      expect(tiktokShopDataStore.storeProduct).toHaveBeenCalledWith(
        'TTS-1',
        { id: 'TTS-1', validated: true },
        expect.any(Object)
      );
      expect(tiktokShopDataStore.storeBatch).toHaveBeenCalled();
      expect(tiktokShopDataStore.storeImportSession).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle variant storage integration', async () => {
      const variantImporter = new TikTokShopImporter(mockCredentials, {
        includeVariants: true,
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (tiktokShopValidator.validateProduct as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        data: { id: 'TTS-1', validated: true },
        tokopediaFlag: false,
      });

      (tiktokShopValidator.validateVariant as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        data: { id: 'VAR-1', validated: true },
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{ product_id: 'TTS-1', product_name: 'Product with Variants' }],
              total: 1,
              more: false,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-1',
                title: 'Product with Variants',
                skus: [{ id: 'VAR-1' }],
              }],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              skus: [{ id: 'VAR-1', seller_sku: 'TEST-VAR-1' }],
            },
          }),
        });

      const result = await variantImporter.importProducts();

      expect(tiktokShopValidator.validateVariant).toHaveBeenCalled();
      expect(tiktokShopDataStore.storeVariant).toHaveBeenCalledWith(
        'TTS-1',
        'VAR-1',
        { id: 'VAR-1', validated: true },
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Import Statistics', () => {
    it('should calculate import statistics with Tokopedia flag', async () => {
      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          code: 0,
          message: 'success',
          data: {
            products: [
              { product_id: 'TTS-1', product_name: 'Product 1' },
              { product_id: 'TTS-2', product_name: 'Product 2' },
            ],
            total: 2,
            more: false,
          },
        }),
      });

      const stats = await importer.getImportStats();

      expect(stats.totalProducts).toBe(2);
      expect(stats.estimatedImportTime).toBeGreaterThan(0);
      expect(stats).toHaveProperty('tokopediaEnabled');
    });
  });

  describe('Factory Functions', () => {
    it('should create importer using factory function', () => {
      const factoryImporter = createTikTokShopImporter(mockCredentials, { batchSize: 10 });
      
      expect(factoryImporter).toBeDefined();
      expect(factoryImporter).toBeInstanceOf(TikTokShopImporter);
    });

    it('should perform quick import', async () => {
      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{ product_id: 'TTS-1', product_name: 'Quick Product' }],
              total: 1,
              more: false,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-1',
                title: 'Quick Import Product',
                skus: [],
              }],
            },
          }),
        });

      const result = await quickTikTokShopImport(mockCredentials, 5);
      
      expect(result.success).toBe(true);
      expect(result.totalProducts).toBe(1);
    });
  });
});

describe('Mock TikTok Shop Importer Tests', () => {
  describe('MockTikTokShopImporter', () => {
    let mockImporter: MockTikTokShopImporter;

    beforeEach(() => {
      mockImporter = new MockTikTokShopImporter({
        batchSize: 5,
        rateLimitDelay: 10, // Fast for testing
        tokopediaProducts: 5, // Include 5 Tokopedia products
      });
    });

    it('should simulate import with Tokopedia products', async () => {
      const result = await mockImporter.simulateImport(20);
      
      expect(result.success).toBe(true);
      expect(result.totalProducts).toBe(20);
      expect(result.importedProducts).toBeGreaterThan(0);
      expect(result.tokopediaIncluded).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
    });

    it('should handle batch processing correctly', async () => {
      const result = await mockImporter.simulateImport(25);
      
      expect(result.totalProducts).toBe(25);
      expect(result.importedProducts).toBeGreaterThan(0);
      expect(result.importedProducts).toBeLessThanOrEqual(25);
    });

    it('should track progress during import', async () => {
      const progressUpdates: any[] = [];
      
      const importer = new MockTikTokShopImporter({
        batchSize: 3,
        rateLimitDelay: 5,
        tokopediaProducts: 2,
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      });

      await importer.simulateImport(10);
      
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0]).toHaveProperty('current');
      expect(progressUpdates[0]).toHaveProperty('total');
      expect(progressUpdates[0]).toHaveProperty('percentage');
    });

    it('should generate realistic TikTok Shop product data', async () => {
      const result = await mockImporter.simulateImport(5);
      
      expect(result.success).toBe(true);
      expect(result.importedProducts).toBeGreaterThan(0);
    });

    it('should simulate connection validation', async () => {
      const result = await mockImporter.validateConnection();
      
      expect(result).toHaveProperty('valid');
      expect(typeof result.valid).toBe('boolean');
    });

    it('should provide mock import statistics', async () => {
      const stats = await mockImporter.getImportStats();
      
      expect(stats).toHaveProperty('totalProducts');
      expect(stats).toHaveProperty('productsWithVariants');
      expect(stats).toHaveProperty('estimatedImportTime');
      expect(stats).toHaveProperty('tokopediaEnabled');
      expect(typeof stats.totalProducts).toBe('number');
    });
  });

  describe('Import Result Validation', () => {
    it('should return proper result structure with Tokopedia flag', async () => {
      const mockImporter = new MockTikTokShopImporter({
        tokopediaProducts: 3,
      });
      const result = await mockImporter.simulateImport(10);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('totalProducts');
      expect(result).toHaveProperty('importedProducts');
      expect(result).toHaveProperty('failedProducts');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('startTime');
      expect(result).toHaveProperty('endTime');
      expect(result).toHaveProperty('tokopediaIncluded');
      
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.totalProducts).toBe('number');
      expect(typeof result.importedProducts).toBe('number');
      expect(typeof result.failedProducts).toBe('number');
      expect(typeof result.duration).toBe('number');
      expect(typeof result.tokopediaIncluded).toBe('boolean');
      expect(result.tokopediaIncluded).toBe(true);
    });

    it('should calculate success rate correctly', async () => {
      const mockImporter = new MockTikTokShopImporter({
        successRate: 90,
      });
      const result = await mockImporter.simulateImport(100);
      
      const expectedTotal = result.importedProducts + result.failedProducts;
      expect(expectedTotal).toBe(result.totalProducts);
      
      if (result.importedProducts > 0) {
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle import errors gracefully', async () => {
      const mockImporter = new MockTikTokShopImporter({
        batchSize: 1,
        rateLimitDelay: 1,
        simulateErrors: true,
      });
      
      const result = await mockImporter.simulateImport(10);
      
      // Even with potential errors, should not throw
      expect(result).toBeDefined();
      expect(result.totalProducts).toBe(10);
      expect(result.importedProducts + result.failedProducts).toBe(10);
    });

    it('should track error details when enabled', async () => {
      const mockImporter = new MockTikTokShopImporter({
        simulateErrors: true,
        successRate: 80, // Lower success rate to generate some errors
      });
      const result = await mockImporter.simulateImport(50);
      
      // Errors might occur at batch level
      if (result.errors.length > 0) {
        result.errors.forEach(error => {
          expect(error).toHaveProperty('error');
          expect(error).toHaveProperty('timestamp');
          expect(typeof error.error).toBe('string');
          expect(error.timestamp).toBeInstanceOf(Date);
        });
      }
    });
  });

  describe('Performance Testing', () => {
    it('should complete small import quickly', async () => {
      const mockImporter = new MockTikTokShopImporter({
        rateLimitDelay: 1,
        simulateErrors: false, // Disable errors for this test
        successRate: 100, // Ensure 100% success rate
      });
      
      const startTime = Date.now();
      const result = await mockImporter.simulateImport(10);
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should handle larger datasets efficiently', async () => {
      const mockImporter = new MockTikTokShopImporter({
        batchSize: 50,
        rateLimitDelay: 1,
        tokopediaProducts: 20,
      });
      
      const result = await mockImporter.simulateImport(200);
      
      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(10000); // Should complete in under 10 seconds
      expect(result.tokopediaIncluded).toBe(true);
    });
  });
});

describe('Unit Tests - TikTokShopImporter Class', () => {
  let unitTestCredentials: TikTokShopCredentials;

  beforeEach(() => {
    unitTestCredentials = {
      platform: 'tiktokshop',
      appKey: 'test-app-key',
      appSecret: 'test-app-secret',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      shopId: 'test-shop-123',
    };
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default options', () => {
      const defaultImporter = new TikTokShopImporter(unitTestCredentials);
      expect(defaultImporter).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const customOptions = {
        batchSize: 25,
        maxRetries: 5,
        retryDelay: 2000,
        rateLimitDelay: 200,
        includeVariants: false,
        includeTokopedia: true,
      };
      
      const customImporter = new TikTokShopImporter(unitTestCredentials, customOptions);
      expect(customImporter).toBeDefined();
    });

    it('should handle missing optional credentials', () => {
      const minimalCredentials = {
        platform: 'tiktokshop' as const,
        appKey: 'test-key',
        appSecret: 'test-secret',
      };
      
      const importer = new TikTokShopImporter(minimalCredentials);
      expect(importer).toBeDefined();
    });
  });

  describe('Pagination Handling', () => {
    it('should handle multiple pages of products', async () => {
      const paginationImporter = new TikTokShopImporter(unitTestCredentials);

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (tiktokShopValidator.validateProduct as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        data: { validated: true },
        tokopediaFlag: false,
      });

      // Mock paginated responses
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [
                { product_id: 'TTS-1', product_name: 'Product 1' },
                { product_id: 'TTS-2', product_name: 'Product 2' },
              ],
              total: 4,
              more: true,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [
                { product_id: 'TTS-3', product_name: 'Product 3' },
                { product_id: 'TTS-4', product_name: 'Product 4' },
              ],
              total: 4,
              more: false,
            },
          }),
        })
        // Mock product details for each product
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-1',
                title: 'Test Product',
                skus: [],
              }],
            },
          }),
        });

      const result = await paginationImporter.importProducts();

      expect(result.totalProducts).toBe(4);
      expect(global.fetch).toHaveBeenCalledTimes(6); // 2 for pagination + 4 for product details
    });

    it('should handle empty product list', async () => {
      const emptyImporter = new TikTokShopImporter(unitTestCredentials);

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          code: 0,
          message: 'success',
          data: {
            products: [],
            total: 0,
            more: false,
          },
        }),
      });

      const result = await emptyImporter.importProducts();

      expect(result.success).toBe(true);
      expect(result.totalProducts).toBe(0);
      expect(result.importedProducts).toBe(0);
    });
  });

  describe('Batch Processing', () => {
    it('should process products in configured batch sizes', async () => {
      const batchImporter = new TikTokShopImporter(unitTestCredentials, {
        batchSize: 2,
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (tiktokShopValidator.validateProduct as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        data: { validated: true },
        tokopediaFlag: false,
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [
                { product_id: 'TTS-1', product_name: 'Product 1' },
                { product_id: 'TTS-2', product_name: 'Product 2' },
                { product_id: 'TTS-3', product_name: 'Product 3' },
              ],
              total: 3,
              more: false,
            },
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-1',
                title: 'Test Product',
                skus: [],
              }],
            },
          }),
        });

      const result = await batchImporter.importProducts();

      expect(result.success).toBe(true);
      expect(tiktokShopDataStore.storeBatch).toHaveBeenCalled(); // Should be called for batches
    });

    it('should handle batch processing errors', async () => {
      const errorImporter = new TikTokShopImporter(unitTestCredentials, {
        maxRetries: 1, // Reduce retries to fail faster
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{ product_id: 'TTS-1', product_name: 'Product 1' }],
              total: 1,
              more: false,
            },
          }),
        })
        .mockRejectedValue(new Error('Batch processing error')); // Always reject product details

      const result = await errorImporter.importProducts();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('Batch import failed');
    });
  });

  describe('Progress Tracking', () => {
    it('should call progress callback during import', async () => {
      const progressCallback = vi.fn();
      const progressImporter = new TikTokShopImporter(unitTestCredentials, {
        batchSize: 1,
        onProgress: progressCallback,
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (tiktokShopValidator.validateProduct as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        data: { validated: true },
        tokopediaFlag: false,
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [
                { product_id: 'TTS-1', product_name: 'Product 1' },
                { product_id: 'TTS-2', product_name: 'Product 2' },
              ],
              total: 2,
              more: false,
            },
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-1',
                title: 'Test Product',
                skus: [],
              }],
            },
          }),
        });

      await progressImporter.importProducts();

      expect(progressCallback).toHaveBeenCalledTimes(2); // Once per batch
      expect(progressCallback).toHaveBeenCalledWith(expect.objectContaining({
        current: expect.any(Number),
        total: 2,
        percentage: expect.any(Number),
        currentProduct: expect.any(String),
      }));
    });
  });

  describe('Variant Handling', () => {
    it('should fetch and store product variants when enabled', async () => {
      const variantImporter = new TikTokShopImporter(unitTestCredentials, {
        includeVariants: true,
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (tiktokShopValidator.validateProduct as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        data: { validated: true },
        tokopediaFlag: false,
      });

      (tiktokShopValidator.validateVariant as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        data: { variantValidated: true },
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{ product_id: 'TTS-1', product_name: 'Product with Variants' }],
              total: 1,
              more: false,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-1',
                title: 'Product with Variants',
                skus: [{ id: 'VAR-1' }, { id: 'VAR-2' }],
              }],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              skus: [
                { id: 'VAR-1', seller_sku: 'TEST-VAR-1' },
                { id: 'VAR-2', seller_sku: 'TEST-VAR-2' },
              ],
            },
          }),
        });

      const result = await variantImporter.importProducts();

      expect(result.success).toBe(true);
      expect(tiktokShopDataStore.storeVariant).toHaveBeenCalledTimes(2);
    });

    it('should skip variants when disabled', async () => {
      const noVariantImporter = new TikTokShopImporter(unitTestCredentials, {
        includeVariants: false,
      });

      mockAuth.authenticate.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 'token', refreshToken: 'refresh', expiresAt: new Date() },
      });

      (tiktokShopValidator.validateProduct as any).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        data: { validated: true },
        tokopediaFlag: false,
      });

      // Clear any previous calls to storeVariant
      (tiktokShopDataStore.storeVariant as any).mockClear();

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{ product_id: 'TTS-1', product_name: 'Product with Variants' }],
              total: 1,
              more: false,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            code: 0,
            message: 'success',
            data: {
              products: [{
                id: 'TTS-1',
                title: 'Product with Variants',
                skus: [], // Empty SKUs since variants are disabled
              }],
            },
          }),
        });

      const result = await noVariantImporter.importProducts();

      expect(result.success).toBe(true);
      expect(tiktokShopDataStore.storeVariant).not.toHaveBeenCalled();
    });
  });
});

describe('Integration Tests', () => {
  it('should work with different batch sizes and Tokopedia integration', async () => {
    const batchSizes = [1, 5, 10, 25];
    
    for (const batchSize of batchSizes) {
      const mockImporter = new MockTikTokShopImporter({
        batchSize,
        rateLimitDelay: 1,
        tokopediaProducts: 5,
      });
      
      const result = await mockImporter.simulateImport(20);
      
      expect(result.success).toBe(true);
      expect(result.totalProducts).toBe(20);
      expect(result.tokopediaIncluded).toBe(true);
    }
  });
});