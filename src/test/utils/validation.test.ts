/**
 * Unit tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateSKU,
  validateEmail,
  validatePrice,
  validateQuantity,
  validateProductData,
  validateOrderData,
  sanitizeInput,
  validatePlatformCredentials,
} from '@/lib/utils/validation';
import { AppError } from '@/lib/error-handling/app-error';

describe('Validation Utils', () => {
  describe('validateSKU', () => {
    it('should validate correct SKU formats', () => {
      const validSKUs = [
        'ABC-123',
        'PRODUCT-001',
        'SKU123456',
        'A1B2C3',
        'TEST_PRODUCT_001',
      ];

      validSKUs.forEach(sku => {
        expect(() => validateSKU(sku)).not.toThrow();
      });
    });

    it('should reject invalid SKU formats', () => {
      const invalidSKUs = [
        '', // Empty
        'a', // Too short
        'abc-123', // Lowercase
        'SKU WITH SPACES',
        'SKU@123', // Special characters
        'A'.repeat(51), // Too long
        '123-ABC-!@#',
      ];

      invalidSKUs.forEach(sku => {
        expect(() => validateSKU(sku)).toThrow(AppError);
      });
    });

    it('should handle null and undefined inputs', () => {
      expect(() => validateSKU(null as any)).toThrow(AppError);
      expect(() => validateSKU(undefined as any)).toThrow(AppError);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'firstname.lastname@company.com',
        'test123@test-domain.com',
      ];

      validEmails.forEach(email => {
        expect(() => validateEmail(email)).not.toThrow();
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        '', // Empty
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user..name@domain.com',
        'user@domain..com',
        'user name@domain.com', // Space
      ];

      invalidEmails.forEach(email => {
        expect(() => validateEmail(email)).toThrow(AppError);
      });
    });
  });

  describe('validatePrice', () => {
    it('should validate correct price values', () => {
      const validPrices = [0.01, 1.00, 99.99, 1000.50, 9999.99];

      validPrices.forEach(price => {
        expect(() => validatePrice(price)).not.toThrow();
      });
    });

    it('should reject invalid price values', () => {
      const invalidPrices = [
        -1, // Negative
        0, // Zero
        -0.01, // Negative decimal
        NaN, // Not a number
        Infinity, // Infinity
        10000000, // Too large
      ];

      invalidPrices.forEach(price => {
        expect(() => validatePrice(price)).toThrow(AppError);
      });
    });

    it('should validate price precision', () => {
      expect(() => validatePrice(1.234)).toThrow(AppError); // Too many decimals
      expect(() => validatePrice(1.99)).not.toThrow(); // Valid precision
    });
  });

  describe('validateQuantity', () => {
    it('should validate correct quantity values', () => {
      const validQuantities = [0, 1, 100, 9999];

      validQuantities.forEach(quantity => {
        expect(() => validateQuantity(quantity)).not.toThrow();
      });
    });

    it('should reject invalid quantity values', () => {
      const invalidQuantities = [
        -1, // Negative
        1.5, // Decimal
        NaN, // Not a number
        Infinity, // Infinity
        100000, // Too large
      ];

      invalidQuantities.forEach(quantity => {
        expect(() => validateQuantity(quantity)).toThrow(AppError);
      });
    });
  });

  describe('validateProductData', () => {
    it('should validate complete product data', () => {
      const validProduct = {
        name: 'Test Product',
        sku: 'TEST-001',
        description: 'A test product',
        category: 'Electronics',
        costPrice: 29.99,
        weight: 1.5,
        dimensions: {
          length: 10,
          width: 5,
          height: 3,
        },
      };

      expect(() => validateProductData(validProduct)).not.toThrow();
    });

    it('should reject incomplete product data', () => {
      const incompleteProduct = {
        sku: 'TEST-001',
        // Missing required name
      };

      expect(() => validateProductData(incompleteProduct)).toThrow(AppError);
    });

    it('should validate nested product properties', () => {
      const productWithInvalidDimensions = {
        name: 'Test Product',
        sku: 'TEST-001',
        dimensions: {
          length: -1, // Invalid negative dimension
          width: 5,
          height: 3,
        },
      };

      expect(() => validateProductData(productWithInvalidDimensions)).toThrow(AppError);
    });

    it('should validate product attributes', () => {
      const productWithInvalidAttributes = {
        name: 'Test Product',
        sku: 'TEST-001',
        attributes: {
          color: '', // Invalid empty attribute
          size: 'M',
        },
      };

      expect(() => validateProductData(productWithInvalidAttributes)).toThrow(AppError);
    });
  });

  describe('validateOrderData', () => {
    it('should validate complete order data', () => {
      const validOrder = {
        orderNumber: 'ORD-001',
        customer: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
        },
        items: [
          {
            sku: 'PROD-001',
            name: 'Product 1',
            quantity: 2,
            unitPrice: 29.99,
          },
        ],
        totals: {
          subtotal: 59.98,
          tax: 6.00,
          shipping: 5.00,
          total: 70.98,
        },
      };

      expect(() => validateOrderData(validOrder)).not.toThrow();
    });

    it('should validate order items', () => {
      const orderWithInvalidItems = {
        orderNumber: 'ORD-001',
        customer: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        items: [
          {
            sku: 'PROD-001',
            name: 'Product 1',
            quantity: 0, // Invalid zero quantity
            unitPrice: 29.99,
          },
        ],
      };

      expect(() => validateOrderData(orderWithInvalidItems)).toThrow(AppError);
    });

    it('should validate order totals consistency', () => {
      const orderWithInconsistentTotals = {
        orderNumber: 'ORD-001',
        customer: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        items: [
          {
            sku: 'PROD-001',
            name: 'Product 1',
            quantity: 2,
            unitPrice: 29.99,
          },
        ],
        totals: {
          subtotal: 59.98,
          tax: 6.00,
          shipping: 5.00,
          total: 100.00, // Incorrect total
        },
      };

      expect(() => validateOrderData(orderWithInconsistentTotals)).toThrow(AppError);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = sanitizeInput(input);
      expect(result).toBe('Hello World');
    });

    it('should handle multiple HTML tags', () => {
      const input = '<div><p>Hello</p><span>World</span></div>';
      const result = sanitizeInput(input);
      expect(result).toBe('HelloWorld');
    });

    it('should preserve safe content', () => {
      const input = 'Hello & World - Test 123';
      const result = sanitizeInput(input);
      expect(result).toBe('Hello & World - Test 123');
    });

    it('should handle empty and null inputs', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeInput(input);
      expect(result).toBe('Hello World');
    });

    it('should handle SQL injection attempts', () => {
      const input = "'; DROP TABLE users; --";
      const result = sanitizeInput(input);
      expect(result).not.toContain('DROP TABLE');
    });
  });

  describe('validatePlatformCredentials', () => {
    it('should validate Shopee credentials', () => {
      const validShopeeCredentials = {
        platform: 'shopee',
        credentials: {
          accessToken: 'valid-token',
          refreshToken: 'valid-refresh',
          shopId: '123456',
          partnerId: '789',
        },
      };

      expect(() => validatePlatformCredentials(validShopeeCredentials)).not.toThrow();
    });

    it('should validate TikTok Shop credentials', () => {
      const validTikTokCredentials = {
        platform: 'tiktokshop',
        credentials: {
          accessToken: 'valid-token',
          refreshToken: 'valid-refresh',
          shopId: '123456',
          appKey: 'app-key',
        },
      };

      expect(() => validatePlatformCredentials(validTikTokCredentials)).not.toThrow();
    });

    it('should reject incomplete credentials', () => {
      const incompleteCredentials = {
        platform: 'shopee',
        credentials: {
          accessToken: 'valid-token',
          // Missing required fields
        },
      };

      expect(() => validatePlatformCredentials(incompleteCredentials)).toThrow(AppError);
    });

    it('should reject unknown platforms', () => {
      const unknownPlatform = {
        platform: 'unknown-platform',
        credentials: {
          accessToken: 'token',
        },
      };

      expect(() => validatePlatformCredentials(unknownPlatform)).toThrow(AppError);
    });
  });

  describe('performance tests', () => {
    it('should validate large datasets efficiently', () => {
      const largeProductList = Array.from({ length: 1000 }, (_, i) => ({
        name: `Product ${i}`,
        sku: `PROD-${i.toString().padStart(4, '0')}`,
        costPrice: 29.99,
      }));

      const startTime = Date.now();
      
      largeProductList.forEach(product => {
        validateProductData(product);
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should sanitize large text efficiently', () => {
      const largeText = '<div>'.repeat(1000) + 'Content' + '</div>'.repeat(1000);
      
      const startTime = Date.now();
      const result = sanitizeInput(largeText);
      const duration = Date.now() - startTime;

      expect(result).toBe('Content');
      expect(duration).toBeLessThan(50); // Should complete within 50ms
    });
  });

  describe('security tests', () => {
    it('should prevent XSS attacks', () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert("xss")',
        '<iframe src="javascript:alert(1)"></iframe>',
      ];

      xssAttempts.forEach(attempt => {
        const result = sanitizeInput(attempt);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('onload');
      });
    });

    it('should prevent SQL injection', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users VALUES ('hacker'); --",
        "' UNION SELECT * FROM passwords --",
      ];

      sqlInjectionAttempts.forEach(attempt => {
        const result = sanitizeInput(attempt);
        expect(result).not.toContain('DROP TABLE');
        expect(result).not.toContain('INSERT INTO');
        expect(result).not.toContain('UNION SELECT');
      });
    });

    it('should validate input lengths to prevent DoS', () => {
      const veryLongInput = 'A'.repeat(100000);
      
      expect(() => validateSKU(veryLongInput)).toThrow(AppError);
      expect(() => validateEmail(veryLongInput + '@example.com')).toThrow(AppError);
    });

    it('should handle malformed Unicode', () => {
      const malformedInputs = [
        '\uFFFE\uFFFF', // Invalid Unicode
        '\u0000', // Null character
        '\uD800', // Unpaired surrogate
      ];

      malformedInputs.forEach(input => {
        expect(() => sanitizeInput(input)).not.toThrow();
      });
    });
  });
});