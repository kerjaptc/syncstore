/**
 * TikTok Shop Validation and Storage Tests
 * Tests for TikTok-specific validation logic and data storage with Tokopedia flag tracking
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tiktokShopValidator } from '@/lib/validators/tiktokshop-validator';
import { tiktokShopDataStore } from '@/lib/storage/tiktokshop-data-store';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';

describe('TikTok Shop Validation and Storage', () => {
  const testBasePath = './data/test-tiktokshop';

  beforeEach(() => {
    // Reset validator stats
    tiktokShopValidator.resetStats();
    
    // Clear progress logs
    tiktokShopDataStore.clearProgressLogs();
  });

  afterEach(async () => {
    // Clean up test data
    if (existsSync(testBasePath)) {
      await rm(testBasePath, { recursive: true, force: true });
    }
  });

  describe('TikTok Shop Validator', () => {
    const validProduct = {
      product_id: 'TTS-123456',
      product_name: 'Test Racing Frame 5 Inch Carbon',
      description: 'High-quality carbon fiber racing frame for FPV drones. Perfect for racing and freestyle flying.',
      brand_name: 'Test Brand',
      category_id: 'electronics-456',
      product_status: 'ACTIVE',
      create_time: 1698825600,
      update_time: 1699084800,
      images: [
        {
          id: 'img-001',
          url: 'https://example.com/image1.jpg',
          thumb_urls: ['https://example.com/thumb1.jpg'],
        },
        {
          id: 'img-002',
          url: 'https://example.com/image2.jpg',
          thumb_urls: ['https://example.com/thumb2.jpg'],
        },
        {
          id: 'img-003',
          url: 'https://example.com/image3.jpg',
          thumb_urls: ['https://example.com/thumb3.jpg'],
        },
      ],
      package_weight: 0.05,
      package_dimensions: {
        length: 25,
        width: 25,
        height: 5,
      },
      delivery_options: [
        {
          delivery_option_id: 'jnt_express',
          delivery_option_name: 'J&T Express',
          is_available: true,
        },
      ],
      is_cod_allowed: true,
      include_tokopedia: false,
    };

    const validVariant = {
      id: 'VAR-001',
      seller_sku: 'FRAME-5IN-RED-TTS',
      price: {
        amount: '180000',
        currency: 'IDR',
      },
      stock_infos: [
        {
          available_stock: 10,
          reserved_stock: 2,
          warehouse_id: 'warehouse_jakarta',
        },
      ],
      sales_attributes: [
        {
          attribute_id: 'attr_color',
          attribute_name: 'Warna',
          value_id: 'val_red',
          value_name: 'Merah',
        },
      ],
    };

    it('should validate valid TikTok Shop product', () => {
      const result = tiktokShopValidator.validateProduct(validProduct);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.tokopediaFlag).toBe(false);
      expect(result.data).toBeDefined();
    });

    it('should validate product with Tokopedia flag enabled', () => {
      const productWithTokopedia = {
        ...validProduct,
        include_tokopedia: true,
      };

      const result = tiktokShopValidator.validateProduct(productWithTokopedia);
      
      expect(result.isValid).toBe(true);
      expect(result.tokopediaFlag).toBe(true);
      expect(result.warnings).toContain('Tokopedia integration is enabled for this product');
    });

    it('should validate valid TikTok Shop variant', () => {
      const result = tiktokShopValidator.validateVariant(validVariant);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toBeDefined();
    });

    it('should detect validation errors for invalid product', () => {
      const invalidProduct = {
        product_id: '', // Invalid: empty string
        product_name: 'Test',
        // Missing required fields
      };

      const result = tiktokShopValidator.validateProduct(invalidProduct);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.tokopediaFlag).toBe(false);
    });

    it('should generate warnings for products with issues', () => {
      const productWithWarnings = {
        ...validProduct,
        description: 'Short', // Too short description
        package_weight: 0, // Missing weight
        images: [validProduct.images[0]], // Only one image
        product_status: 'DRAFT', // Not active
      };

      const result = tiktokShopValidator.validateProduct(productWithWarnings);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContain('Product description is missing or too short (recommended: 50+ characters)');
      expect(result.warnings).toContain('Product weight is missing or zero (may affect shipping calculations)');
      expect(result.warnings).toContain('Less than 3 product images (recommended: 3+ images for better conversion)');
      expect(result.warnings).toContain('Product status is DRAFT, not ACTIVE');
    });

    it('should track validation statistics', () => {
      // Validate multiple products
      tiktokShopValidator.validateProduct(validProduct);
      tiktokShopValidator.validateProduct({ ...validProduct, include_tokopedia: true });
      tiktokShopValidator.validateProduct({ product_id: '' }); // Invalid

      const stats = tiktokShopValidator.getStats();
      
      expect(stats.totalValidated).toBe(3);
      expect(stats.validCount).toBe(2);
      expect(stats.invalidCount).toBe(1);
      expect(stats.tokopediaEnabledCount).toBe(1);
    });

    it('should validate batch of products with progress tracking', async () => {
      const products = [
        validProduct,
        { ...validProduct, product_id: 'TTS-123457', include_tokopedia: true },
        { ...validProduct, product_id: 'TTS-123458' },
      ];

      let progressCalls = 0;
      const result = await tiktokShopValidator.validateBatch(products, (progress) => {
        progressCalls++;
        expect(progress.current).toBeGreaterThan(0);
        expect(progress.total).toBe(3);
        expect(progress.percentage).toBeGreaterThan(0);
      });

      expect(result.summary.total).toBe(3);
      expect(result.summary.valid).toBe(3);
      expect(result.summary.invalid).toBe(0);
      expect(result.summary.tokopediaEnabled).toBe(1);
      expect(progressCalls).toBe(3);
    });
  });

  describe('TikTok Shop Data Store', () => {
    let dataStore: typeof tiktokShopDataStore;

    beforeEach(async () => {
      // Create test instance with custom path
      dataStore = new (await import('@/lib/storage/tiktokshop-data-store')).TikTokShopDataStore(testBasePath);
      await dataStore.initialize();
    });

    it('should initialize storage directories', async () => {
      expect(existsSync(testBasePath)).toBe(true);
      expect(existsSync(`${testBasePath}/products`)).toBe(true);
      expect(existsSync(`${testBasePath}/variants`)).toBe(true);
      expect(existsSync(`${testBasePath}/tokopedia`)).toBe(true);
      expect(existsSync(`${testBasePath}/logs`)).toBe(true);
    });

    it('should store product with Tokopedia flag tracking', async () => {
      const productData = {
        product_id: 'TTS-123456',
        product_name: 'Test Product',
        include_tokopedia: true,
      };

      const filepath = await dataStore.storeProduct('TTS-123456', productData, {
        sessionId: 'test-session',
      });

      expect(filepath).toContain('products');
      expect(existsSync(filepath)).toBe(true);
      
      // Check if also stored in Tokopedia directory
      const tokopediaFiles = await dataStore.getTokopediaEnabledProducts();
      expect(tokopediaFiles).toHaveLength(1);
      expect(tokopediaFiles[0].metadata.tokopediaEnabled).toBe(true);
    });

    it('should store variant data', async () => {
      const variantData = {
        id: 'VAR-001',
        seller_sku: 'TEST-SKU',
        price: { amount: '100000', currency: 'IDR' },
      };

      const filepath = await dataStore.storeVariant('TTS-123456', 'VAR-001', variantData, {
        sessionId: 'test-session',
      });

      expect(filepath).toContain('variants');
      expect(existsSync(filepath)).toBe(true);
    });

    it('should store batch data with Tokopedia statistics', async () => {
      const products = [
        { product_id: 'TTS-001', include_tokopedia: true },
        { product_id: 'TTS-002', include_tokopedia: false },
        { product_id: 'TTS-003', include_tokopedia: true },
      ];

      const filepath = await dataStore.storeBatch('batch-001', products, {
        sessionId: 'test-session',
      });

      expect(filepath).toContain('batches');
      expect(existsSync(filepath)).toBe(true);
    });

    it('should log progress with context', () => {
      dataStore.logProgress('info', 'Test message', {
        productId: 'TTS-123456',
        tokopediaFlag: true,
        progress: { current: 1, total: 10, percentage: 10 },
      });

      const logs = dataStore.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('Test message');
      expect(logs[0].context?.tokopediaFlag).toBe(true);
    });

    it('should save progress logs to file', async () => {
      dataStore.logProgress('info', 'Test log 1');
      dataStore.logProgress('warn', 'Test log 2');
      dataStore.logProgress('error', 'Test log 3');

      const filepath = await dataStore.saveProgressLogs('test-session');
      
      expect(existsSync(filepath)).toBe(true);
      expect(filepath).toContain('logs');
    });

    it('should generate storage statistics with Tokopedia breakdown', async () => {
      // Store some test data
      await dataStore.storeProduct('TTS-001', { include_tokopedia: true });
      await dataStore.storeProduct('TTS-002', { include_tokopedia: false });
      await dataStore.storeProduct('TTS-003', { include_tokopedia: true });

      const stats = await dataStore.getStats();
      
      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.tokopediaEnabledCount).toBe(2);
      expect(stats.tokopediaDisabledCount).toBe(1);
      expect(stats.entriesByType.products).toBe(3);
    });

    it('should retrieve Tokopedia-enabled products', async () => {
      await dataStore.storeProduct('TTS-001', { include_tokopedia: true });
      await dataStore.storeProduct('TTS-002', { include_tokopedia: false });
      await dataStore.storeProduct('TTS-003', { include_tokopedia: true });

      const tokopediaProducts = await dataStore.getTokopediaEnabledProducts();
      
      expect(tokopediaProducts).toHaveLength(2);
      tokopediaProducts.forEach(product => {
        expect(product.metadata.tokopediaEnabled).toBe(true);
      });
    });

    it('should generate comprehensive report', async () => {
      // Store test data
      await dataStore.storeProduct('TTS-001', { include_tokopedia: true });
      await dataStore.storeProduct('TTS-002', { include_tokopedia: false });
      
      // Add some logs
      dataStore.logProgress('info', 'Test info');
      dataStore.logProgress('warn', 'Test warning');
      dataStore.logProgress('error', 'Test error');

      const report = await dataStore.generateReport();
      
      expect(report).toContain('TikTok Shop Data Storage Report');
      expect(report).toContain('Tokopedia Integration:');
      expect(report).toContain('Progress Logs Summary:');
      expect(report).toContain('Enabled Products: 1');
      expect(report).toContain('Disabled Products: 1');
    });
  });

  describe('Integration Tests', () => {
    it('should validate and store product in integrated workflow', async () => {
      const dataStore = new (await import('@/lib/storage/tiktokshop-data-store')).TikTokShopDataStore(testBasePath);
      await dataStore.initialize();

      const productData = {
        product_id: 'TTS-INTEGRATION-001',
        product_name: 'Integration Test Product',
        description: 'This is a test product for integration testing with sufficient description length.',
        category_id: 'test-category',
        product_status: 'ACTIVE',
        create_time: Date.now(),
        update_time: Date.now(),
        images: [
          { id: 'img1', url: 'https://example.com/img1.jpg' },
          { id: 'img2', url: 'https://example.com/img2.jpg' },
          { id: 'img3', url: 'https://example.com/img3.jpg' },
        ],
        include_tokopedia: true,
      };

      // Validate product
      const validationResult = tiktokShopValidator.validateProduct(productData);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.tokopediaFlag).toBe(true);

      // Store validated product
      const filepath = await dataStore.storeProduct(
        productData.product_id,
        validationResult.data,
        { sessionId: 'integration-test' }
      );

      expect(existsSync(filepath)).toBe(true);

      // Verify Tokopedia tracking
      const tokopediaProducts = await dataStore.getTokopediaEnabledProducts();
      expect(tokopediaProducts).toHaveLength(1);
      expect(tokopediaProducts[0].id).toBe(productData.product_id);

      // Check statistics
      const validatorStats = tiktokShopValidator.getStats();
      expect(validatorStats.tokopediaEnabledCount).toBe(1);

      const storageStats = await dataStore.getStats();
      expect(storageStats.tokopediaEnabledCount).toBe(1);
    });
  });
});