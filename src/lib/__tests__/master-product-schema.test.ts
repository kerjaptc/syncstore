import { describe, it, expect, beforeEach } from 'vitest';
import {
  MasterProductSchema,
  ProductPricingSchema,
  ProductSEOSchema,
  PlatformMappingSchema,
  createMasterProduct,
  addPlatformMapping,
  updatePlatformPricing,
  calculateTotalStock,
  validateProductQuality,
  parseMasterProduct,
  safeParseMasterProduct,
  getValidationErrors,
  type MasterProduct,
  type PlatformMapping,
} from '../schema/master-product-schema';

describe('Master Product Schema Tests', () => {
  let sampleMasterProduct: Partial<MasterProduct>;
  let samplePlatformMapping: PlatformMapping;

  beforeEach(() => {
    sampleMasterProduct = {
      masterSku: 'FRAME-5IN-001',
      name: 'Frame Racing 5 Inch Carbon Fiber',
      description: 'High-quality carbon fiber racing frame for 5-inch FPV drones. Lightweight and durable construction perfect for racing and freestyle flying.',
      weight: 0.025, // 25 grams
      dimensions: {
        length: 220,
        width: 220,
        height: 30,
        unit: 'mm' as const,
      },
      images: [
        {
          url: 'https://example.com/frame-main.jpg',
          alt: 'Frame Racing 5 Inch Carbon Fiber - Main View',
          isPrimary: true,
        },
        {
          url: 'https://example.com/frame-side.jpg',
          alt: 'Frame Racing 5 Inch Carbon Fiber - Side View',
          isPrimary: false,
        },
      ],
      category: {
        id: 'drone-frames',
        name: 'Drone Frames',
        path: ['Electronics', 'Drones', 'Parts', 'Frames'],
        level: 3,
      },
      brand: 'MotekarFPV',
      pricing: {
        basePrice: 150000, // 150k IDR
        currency: 'IDR',
        platformPrices: {},
      },
    };

    samplePlatformMapping = {
      platform: 'shopee',
      platformProductId: 'shopee-123456',
      isActive: true,
      syncStatus: 'synced',
      syncErrors: [],
      platformData: {
        item_id: 123456,
        item_sku: 'FRAME-5IN-001-SHOPEE',
        category_id: 100001,
        item_status: 'NORMAL' as const,
        has_model: false,
        item_dangerous: 0,
        create_time: Date.now(),
        update_time: Date.now(),
      },
    };
  });

  describe('Schema Validation', () => {
    it('should validate a complete master product', () => {
      const product = createMasterProduct(sampleMasterProduct);
      
      expect(product.id).toBeDefined();
      expect(product.masterSku).toBe('FRAME-5IN-001');
      expect(product.name).toBe('Frame Racing 5 Inch Carbon Fiber');
      expect(product.status).toBe('draft');
      expect(product.createdAt).toBeInstanceOf(Date);
      expect(product.updatedAt).toBeInstanceOf(Date);
    });

    it('should require essential fields', () => {
      const invalidProduct = {
        // Missing required fields
        description: 'Test description',
      };

      const result = safeParseMasterProduct(invalidProduct);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = getValidationErrors(result.error);
        expect(errors.some(error => error.includes('masterSku'))).toBe(true);
        expect(errors.some(error => error.includes('name'))).toBe(true);
        expect(errors.some(error => error.includes('weight'))).toBe(true);
        expect(errors.some(error => error.includes('dimensions'))).toBe(true);
        expect(errors.some(error => error.includes('images'))).toBe(true);
      }
    });

    it('should validate pricing schema', () => {
      const validPricing = {
        basePrice: 150000,
        currency: 'IDR',
        platformPrices: {
          shopee: {
            price: 172500, // +15%
            feePercentage: 15,
            calculatedAt: new Date(),
          },
        },
      };

      const result = ProductPricingSchema.safeParse(validPricing);
      expect(result.success).toBe(true);
    });

    it('should reject negative prices', () => {
      const invalidPricing = {
        basePrice: -100,
        currency: 'IDR',
      };

      const result = ProductPricingSchema.safeParse(invalidPricing);
      expect(result.success).toBe(false);
    });

    it('should validate SEO schema', () => {
      const validSEO = {
        metaTitle: 'Frame Racing 5 Inch Carbon Fiber - Premium Quality',
        metaDescription: 'High-quality carbon fiber racing frame for FPV drones',
        keywords: ['fpv', 'drone', 'frame', 'carbon fiber', 'racing'],
        platformTitles: {
          shopee: {
            title: 'Frame Racing 5 Inch Carbon Fiber Murah Berkualitas',
            similarity: 75,
            optimizedFor: ['murah', 'berkualitas', 'drone'],
            generatedAt: new Date(),
          },
        },
      };

      const result = ProductSEOSchema.safeParse(validSEO);
      expect(result.success).toBe(true);
    });

    it('should validate platform mapping schema', () => {
      const result = PlatformMappingSchema.safeParse(samplePlatformMapping);
      expect(result.success).toBe(true);
    });

    it('should reject invalid platform in mapping', () => {
      const invalidMapping = {
        ...samplePlatformMapping,
        platform: 'invalid-platform',
      };

      const result = PlatformMappingSchema.safeParse(invalidMapping);
      expect(result.success).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    it('should create master product with defaults', () => {
      const product = createMasterProduct({
        masterSku: 'TEST-001',
        name: 'Test Product',
        description: 'Test description',
        weight: 0.1,
        dimensions: { length: 10, width: 10, height: 10, unit: 'cm' },
        images: [{ url: 'https://example.com/test.jpg', isPrimary: true }],
        category: { id: 'test', name: 'Test', path: ['Test'], level: 0 },
        brand: 'Test Brand',
        pricing: { basePrice: 100000, currency: 'IDR' },
      });

      expect(product.id).toBeDefined();
      expect(product.status).toBe('draft');
      expect(product.hasVariants).toBe(false);
      expect(product.variants).toEqual([]);
      expect(product.platformMappings).toEqual([]);
      expect(product.totalStock).toBe(0);
      expect(product.availableStock).toBe(0);
    });

    it('should add platform mapping', () => {
      const product = createMasterProduct(sampleMasterProduct);
      const updatedProduct = addPlatformMapping(product, samplePlatformMapping);

      expect(updatedProduct.platformMappings).toHaveLength(1);
      expect(updatedProduct.platformMappings[0].platform).toBe('shopee');
      expect(updatedProduct.updatedAt.getTime()).toBeGreaterThan(product.updatedAt.getTime());
    });

    it('should update platform pricing', () => {
      const product = createMasterProduct(sampleMasterProduct);
      const updatedProduct = updatePlatformPricing(product, 'shopee', 15);

      expect(updatedProduct.pricing.platformPrices.shopee).toBeDefined();
      expect(updatedProduct.pricing.platformPrices.shopee.price).toBe(172500); // 150000 * 1.15
      expect(updatedProduct.pricing.platformPrices.shopee.feePercentage).toBe(15);
    });

    it('should calculate total stock from variants', () => {
      const productWithVariants = createMasterProduct({
        ...sampleMasterProduct,
        hasVariants: true,
        variants: [
          {
            id: 'var-1',
            sku: 'FRAME-5IN-001-RED',
            name: 'Red Color',
            attributes: { color: 'Red' },
            price: 150000,
            stock: 10,
            reservedStock: 2,
            isActive: true,
          },
          {
            id: 'var-2',
            sku: 'FRAME-5IN-001-BLUE',
            name: 'Blue Color',
            attributes: { color: 'Blue' },
            price: 150000,
            stock: 15,
            reservedStock: 3,
            isActive: true,
          },
        ],
      });

      const updatedProduct = calculateTotalStock(productWithVariants);

      expect(updatedProduct.totalStock).toBe(25); // 10 + 15
      expect(updatedProduct.reservedStock).toBe(5); // 2 + 3
      expect(updatedProduct.availableStock).toBe(20); // 25 - 5
    });

    it('should not calculate stock for products without variants', () => {
      const product = createMasterProduct(sampleMasterProduct);
      const result = calculateTotalStock(product);

      expect(result.totalStock).toBe(0);
      expect(result.reservedStock).toBe(0);
      expect(result.availableStock).toBe(0);
    });
  });

  describe('Product Quality Validation', () => {
    it('should validate high-quality product', () => {
      const product = createMasterProduct(sampleMasterProduct);
      const quality = validateProductQuality(product);

      expect(quality.score).toBeGreaterThan(70);
      expect(quality.errors).toHaveLength(0);
      expect(quality.warnings.length).toBeLessThan(3);
    });

    it('should detect missing required fields', () => {
      const poorProduct = createMasterProduct({
        ...sampleMasterProduct,
        name: '', // Empty name
        description: 'Short', // Too short description
        images: [], // No images
        pricing: { basePrice: 0, currency: 'IDR' }, // Zero price
      });

      const quality = validateProductQuality(poorProduct);

      expect(quality.score).toBeLessThan(50);
      expect(quality.errors.length).toBeGreaterThan(2);
      expect(quality.errors.some(error => error.includes('name'))).toBe(true);
      expect(quality.errors.some(error => error.includes('description'))).toBe(true);
      expect(quality.errors.some(error => error.includes('images'))).toBe(true);
      expect(quality.errors.some(error => error.includes('price'))).toBe(true);
    });

    it('should provide quality warnings', () => {
      const productWithWarnings = createMasterProduct({
        ...sampleMasterProduct,
        description: 'Short description', // Too short
        images: [{ url: 'https://example.com/single.jpg', isPrimary: true }], // Only one image
      });

      const quality = validateProductQuality(productWithWarnings);

      expect(quality.warnings.length).toBeGreaterThan(0);
      expect(quality.warnings.some(warning => warning.includes('description'))).toBe(true);
      expect(quality.warnings.some(warning => warning.includes('images'))).toBe(true);
    });

    it('should warn about missing SEO optimization', () => {
      const product = createMasterProduct(sampleMasterProduct);
      const quality = validateProductQuality(product);

      expect(quality.warnings.some(warning => warning.includes('SEO'))).toBe(true);
    });

    it('should warn about missing platform mappings', () => {
      const product = createMasterProduct(sampleMasterProduct);
      const quality = validateProductQuality(product);

      expect(quality.warnings.some(warning => warning.includes('platform mappings'))).toBe(true);
    });
  });

  describe('Schema Parsing', () => {
    it('should parse valid master product', () => {
      const product = createMasterProduct(sampleMasterProduct);
      const parsed = parseMasterProduct(product);

      expect(parsed.id).toBe(product.id);
      expect(parsed.masterSku).toBe(product.masterSku);
      expect(parsed.name).toBe(product.name);
    });

    it('should throw on invalid data', () => {
      const invalidData = {
        masterSku: 'TEST',
        // Missing required fields
      };

      expect(() => parseMasterProduct(invalidData)).toThrow();
    });

    it('should safely parse and return errors', () => {
      const invalidData = {
        masterSku: 'TEST',
        name: 'Test',
        // Missing other required fields
      };

      const result = safeParseMasterProduct(invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        const errors = getValidationErrors(result.error);
        expect(errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long product names', () => {
      const longName = 'A'.repeat(300); // Exceeds max length
      const productData = {
        ...sampleMasterProduct,
        name: longName,
      };

      const result = safeParseMasterProduct(productData);
      expect(result.success).toBe(false);
    });

    it('should handle very long descriptions', () => {
      const longDescription = 'A'.repeat(6000); // Exceeds max length
      const productData = {
        ...sampleMasterProduct,
        description: longDescription,
      };

      const result = safeParseMasterProduct(productData);
      expect(result.success).toBe(false);
    });

    it('should handle invalid image URLs', () => {
      const productData = {
        ...sampleMasterProduct,
        images: [
          {
            url: 'not-a-valid-url',
            isPrimary: true,
          },
        ],
      };

      const result = safeParseMasterProduct(productData);
      expect(result.success).toBe(false);
    });

    it('should handle negative dimensions', () => {
      const productData = {
        ...sampleMasterProduct,
        dimensions: {
          length: -10,
          width: -10,
          height: -10,
          unit: 'cm' as const,
        },
      };

      const result = safeParseMasterProduct(productData);
      expect(result.success).toBe(false);
    });

    it('should handle zero weight', () => {
      const productData = {
        ...sampleMasterProduct,
        weight: 0,
      };

      const result = safeParseMasterProduct(productData);
      expect(result.success).toBe(false);
    });

    it('should handle empty arrays appropriately', () => {
      const product = createMasterProduct({
        ...sampleMasterProduct,
        variants: [],
        platformMappings: [],
        tags: [],
      });

      expect(product.variants).toEqual([]);
      expect(product.platformMappings).toEqual([]);
      expect(product.tags).toEqual([]);
    });

    it('should handle maximum values', () => {
      const productData = {
        ...sampleMasterProduct,
        pricing: {
          basePrice: Number.MAX_SAFE_INTEGER,
          currency: 'IDR',
        },
        weight: Number.MAX_SAFE_INTEGER,
        dimensions: {
          length: Number.MAX_SAFE_INTEGER,
          width: Number.MAX_SAFE_INTEGER,
          height: Number.MAX_SAFE_INTEGER,
          unit: 'cm' as const,
        },
      };

      const result = safeParseMasterProduct(productData);
      expect(result.success).toBe(true);
    });
  });

  describe('Platform-Specific Data', () => {
    it('should validate Shopee platform data', () => {
      const shopeeData = {
        item_id: 123456,
        item_sku: 'TEST-SKU',
        category_id: 100001,
        item_status: 'NORMAL' as const,
        has_model: false,
        item_dangerous: 0,
        create_time: Date.now(),
        update_time: Date.now(),
      };

      const mapping: PlatformMapping = {
        platform: 'shopee',
        platformProductId: '123456',
        isActive: true,
        syncStatus: 'synced',
        syncErrors: [],
        platformData: shopeeData,
      };

      const result = PlatformMappingSchema.safeParse(mapping);
      expect(result.success).toBe(true);
    });

    it('should validate TikTok Shop platform data', () => {
      const tiktokData = {
        product_id: 'tiktok-123456',
        include_tokopedia: true,
        is_cod_allowed: true,
        status: 'ACTIVE' as const,
        created_time: Date.now(),
        updated_time: Date.now(),
      };

      const mapping: PlatformMapping = {
        platform: 'tiktokshop',
        platformProductId: 'tiktok-123456',
        isActive: true,
        syncStatus: 'synced',
        syncErrors: [],
        platformData: tiktokData,
      };

      const result = PlatformMappingSchema.safeParse(mapping);
      expect(result.success).toBe(true);
    });

    it('should handle unknown platform data', () => {
      const unknownData = {
        customField: 'custom value',
        anotherField: 123,
      };

      const mapping: PlatformMapping = {
        platform: 'website',
        platformProductId: 'website-123',
        isActive: true,
        syncStatus: 'pending',
        syncErrors: [],
        platformData: unknownData,
      };

      const result = PlatformMappingSchema.safeParse(mapping);
      expect(result.success).toBe(true);
    });
  });
});