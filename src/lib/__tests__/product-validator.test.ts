import { describe, it, expect, beforeEach } from 'vitest';
import { ProductValidator, productValidator } from '../validators/product-validator';
import shopeeData from '../mock-data/shopee-sample.json';
import tiktokData from '../mock-data/tiktokshop-sample.json';

describe('Product Validator Tests', () => {
  let validator: ProductValidator;

  beforeEach(() => {
    validator = new ProductValidator();
  });

  describe('Shopee Product Validation', () => {
    it('should validate valid Shopee product', () => {
      const product = shopeeData.shopee_product_detail_response.response;
      const result = validator.validateShopeeProduct(product);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toBeDefined();
    });

    it('should detect missing required fields', () => {
      const invalidProduct = {
        // Missing item_id, item_name, etc.
        category_id: 123,
        item_status: 'NORMAL',
      };
      
      const result = validator.validateShopeeProduct(invalidProduct);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('item_id'))).toBe(true);
      expect(result.errors.some(error => error.includes('item_name'))).toBe(true);
    });

    it('should validate product with warnings', () => {
      const productWithIssues = {
        ...shopeeData.shopee_product_detail_response.response,
        description: 'Short', // Too short description
        weight: 0, // Zero weight
      };
      
      const result = validator.validateShopeeProduct(productWithIssues);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(warning => warning.includes('description'))).toBe(true);
      expect(result.warnings.some(warning => warning.includes('weight'))).toBe(true);
    });

    it('should validate image requirements', () => {
      const productWithoutImages = {
        ...shopeeData.shopee_product_detail_response.response,
        image: {
          image_url_list: [], // No images
          image_id_list: [],
        },
      };
      
      const result = validator.validateShopeeProduct(productWithoutImages);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('image'))).toBe(true);
    });

    it('should validate price values', () => {
      const productWithInvalidPrice = {
        ...shopeeData.shopee_product_detail_response.response,
        // Will test with variant that has invalid price
      };
      
      const result = validator.validateShopeeProduct(productWithInvalidPrice);
      expect(result.isValid).toBe(true); // Product itself is valid
    });
  });

  describe('Shopee Variant Validation', () => {
    it('should validate valid Shopee variant', () => {
      const variant = shopeeData.shopee_variant_list_response.response.model[0];
      const result = validator.validateShopeeVariant(variant);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toBeDefined();
    });

    it('should detect invalid variant data', () => {
      const invalidVariant = {
        model_id: 'invalid', // Should be number
        price: -100, // Negative price
        model_sku: '', // Empty SKU
      };
      
      const result = validator.validateShopeeVariant(invalidVariant);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about zero stock', () => {
      const zeroStockVariant = {
        ...shopeeData.shopee_variant_list_response.response.model[0],
        normal_stock: 0,
      };
      
      const result = validator.validateShopeeVariant(zeroStockVariant);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(warning => warning.includes('zero stock'))).toBe(true);
    });

    it('should warn about low prices', () => {
      const lowPriceVariant = {
        ...shopeeData.shopee_variant_list_response.response.model[0],
        price: 500, // Very low price
      };
      
      const result = validator.validateShopeeVariant(lowPriceVariant);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(warning => warning.includes('very low'))).toBe(true);
    });
  });

  describe('TikTok Shop Product Validation', () => {
    it('should validate valid TikTok Shop product', () => {
      const product = tiktokData.tiktokshop_product_detail_response.data;
      const result = validator.validateTikTokProduct(product);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toBeDefined();
    });

    it('should detect missing required fields', () => {
      const invalidProduct = {
        // Missing product_id, product_name, etc.
        category_id: 'test',
        product_status: 'ACTIVE',
      };
      
      const result = validator.validateTikTokProduct(invalidProduct);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('product_id'))).toBe(true);
      expect(result.errors.some(error => error.includes('product_name'))).toBe(true);
    });

    it('should validate image structure', () => {
      const productWithInvalidImages = {
        ...tiktokData.tiktokshop_product_detail_response.data,
        images: [
          {
            id: 'test',
            url: 'invalid-url', // Invalid URL
          },
        ],
      };
      
      const result = validator.validateTikTokProduct(productWithInvalidImages);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('url'))).toBe(true);
    });
  });

  describe('TikTok Shop Variant Validation', () => {
    it('should validate valid TikTok Shop variant', () => {
      const variant = tiktokData.tiktokshop_variant_list_response.data.skus[0];
      const result = validator.validateTikTokVariant(variant);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toBeDefined();
    });

    it('should validate price structure', () => {
      const variantWithInvalidPrice = {
        ...tiktokData.tiktokshop_variant_list_response.data.skus[0],
        price: {
          amount: 'invalid-amount', // Should be numeric string
          currency: 'INVALID', // Invalid currency code
        },
      };
      
      const result = validator.validateTikTokVariant(variantWithInvalidPrice);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('amount'))).toBe(true);
    });

    it('should validate stock structure', () => {
      const variantWithInvalidStock = {
        ...tiktokData.tiktokshop_variant_list_response.data.skus[0],
        stock_infos: [], // Empty stock info
      };
      
      const result = validator.validateTikTokVariant(variantWithInvalidStock);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('stock_infos'))).toBe(true);
    });

    it('should warn about non-IDR currency', () => {
      const usdVariant = {
        ...tiktokData.tiktokshop_variant_list_response.data.skus[0],
        price: {
          amount: '100.00',
          currency: 'USD',
        },
      };
      
      const result = validator.validateTikTokVariant(usdVariant);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(warning => warning.includes('USD'))).toBe(true);
    });
  });

  describe('Validation Statistics', () => {
    it('should track validation statistics', () => {
      const product = shopeeData.shopee_product_detail_response.response;
      
      // Reset stats first
      validator.resetStats();
      
      // Validate some products
      validator.validateShopeeProduct(product);
      validator.validateShopeeProduct({ ...product, item_id: 999 });
      validator.validateShopeeProduct({ invalid: 'data' }); // This should fail
      
      const stats = validator.getStats();
      
      expect(stats.totalValidated).toBe(3);
      expect(stats.validCount).toBe(2);
      expect(stats.invalidCount).toBe(1);
    });

    it('should track field errors', () => {
      validator.resetStats();
      
      // Validate invalid products to generate field errors
      validator.validateShopeeProduct({ category_id: 123 }); // Missing required fields
      validator.validateShopeeProduct({ item_name: 'test' }); // Missing other required fields
      
      const stats = validator.getStats();
      
      expect(Object.keys(stats.errorsByField).length).toBeGreaterThan(0);
      expect(stats.commonErrors.length).toBeGreaterThan(0);
    });

    it('should generate validation report', () => {
      validator.resetStats();
      
      const product = shopeeData.shopee_product_detail_response.response;
      validator.validateShopeeProduct(product);
      validator.validateShopeeProduct({ invalid: 'data' });
      
      const report = validator.generateReport();
      
      expect(typeof report).toBe('string');
      expect(report).toContain('Validation Report');
      expect(report).toContain('Total Validated');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values', () => {
      const result1 = validator.validateShopeeProduct(null);
      const result2 = validator.validateShopeeProduct(undefined);
      const result3 = validator.validateShopeeProduct({});
      
      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
      expect(result3.isValid).toBe(false);
    });

    it('should handle empty arrays and objects', () => {
      const productWithEmptyArrays = {
        ...shopeeData.shopee_product_detail_response.response,
        attribute_list: [],
        logistic_info: [],
      };
      
      const result = validator.validateShopeeProduct(productWithEmptyArrays);
      
      expect(result.isValid).toBe(true); // Empty arrays are allowed for optional fields
    });

    it('should handle very large numbers', () => {
      const productWithLargeNumbers = {
        ...shopeeData.shopee_product_detail_response.response,
        item_id: Number.MAX_SAFE_INTEGER,
        create_time: Date.now() * 1000, // Very large timestamp
      };
      
      const result = validator.validateShopeeProduct(productWithLargeNumbers);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Singleton Validator', () => {
    it('should use singleton instance correctly', () => {
      const product = shopeeData.shopee_product_detail_response.response;
      
      productValidator.resetStats();
      const result = productValidator.validateShopeeProduct(product);
      
      expect(result.isValid).toBe(true);
      
      const stats = productValidator.getStats();
      expect(stats.totalValidated).toBe(1);
    });
  });
});