import { describe, it, expect, beforeEach } from 'vitest';
import {
  PricingCalculator,
  createDefaultPricingCalculator,
  quickCalculatePrice,
  formatIDR,
  parseIDR,
  calculatePriceDifference,
  findBestPlatformForProfit,
  DEFAULT_PLATFORM_CONFIGS,
  type PlatformFeeConfig,
} from '../pricing/pricing-calculator';

describe('Pricing Calculator Tests', () => {
  let calculator: PricingCalculator;
  const basePrice = 150000; // 150k IDR
  const costPrice = 100000; // 100k IDR

  beforeEach(() => {
    calculator = createDefaultPricingCalculator();
  });

  describe('Default Configuration', () => {
    it('should load default platform configurations', () => {
      const configs = calculator.getAllPlatformConfigs();
      
      expect(configs).toHaveLength(4);
      expect(configs.some(c => c.platform === 'shopee')).toBe(true);
      expect(configs.some(c => c.platform === 'tiktokshop')).toBe(true);
      expect(configs.some(c => c.platform === 'tokopedia')).toBe(true);
      expect(configs.some(c => c.platform === 'website')).toBe(true);
    });

    it('should have correct default fee percentages', () => {
      const shopeeConfig = calculator.getPlatformConfig('shopee');
      const tiktokConfig = calculator.getPlatformConfig('tiktokshop');
      const websiteConfig = calculator.getPlatformConfig('website');

      expect(shopeeConfig?.feePercentage).toBe(15); // +15% as per requirements
      expect(tiktokConfig?.feePercentage).toBe(20); // +20% as per requirements
      expect(websiteConfig?.feePercentage).toBe(0); // No platform fees for own website
    });

    it('should validate default configurations', () => {
      const validation = calculator.validateConfiguration();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Platform Price Calculation', () => {
    it('should calculate Shopee price correctly', () => {
      const result = calculator.calculatePlatformPrice(basePrice, 'shopee');

      expect(result.platform).toBe('shopee');
      expect(result.basePrice).toBe(basePrice);
      expect(result.platformFee).toBe(22500); // 150000 * 0.15
      expect(result.paymentFee).toBe(5003); // (150000 + 22500) * 0.029
      expect(result.finalPrice).toBe(177503); // 150000 + 22500 + 5003
    });

    it('should calculate TikTok Shop price correctly', () => {
      const result = calculator.calculatePlatformPrice(basePrice, 'tiktokshop');

      expect(result.platform).toBe('tiktokshop');
      expect(result.basePrice).toBe(basePrice);
      expect(result.platformFee).toBe(30000); // 150000 * 0.20
      expect(result.paymentFee).toBe(4500); // (150000 + 30000) * 0.025
      expect(result.finalPrice).toBe(184500); // 150000 + 30000 + 4500
    });

    it('should calculate website price correctly', () => {
      const result = calculator.calculatePlatformPrice(basePrice, 'website');

      expect(result.platform).toBe('website');
      expect(result.basePrice).toBe(basePrice);
      expect(result.platformFee).toBe(0); // No platform fees
      expect(result.paymentFee).toBe(4350); // 150000 * 0.029
      expect(result.finalPrice).toBe(154350); // 150000 + 0 + 4350
    });

    it('should round final prices to nearest IDR', () => {
      const result = calculator.calculatePlatformPrice(150001, 'shopee'); // Odd number
      
      expect(result.finalPrice).toBe(Math.round(result.finalPrice));
      expect(result.finalPrice % 1).toBe(0); // Should be whole number
    });

    it('should calculate profit margin when cost price provided', () => {
      const result = calculator.calculatePlatformPrice(basePrice, 'shopee', costPrice);

      expect(result.profitMargin).toBeDefined();
      expect(result.profitMargin).toBeGreaterThan(0);
      expect(result.profitMargin).toBeLessThan(100);
    });

    it('should apply minimum price constraint', () => {
      const lowPrice = 500; // Below minimum
      const result = calculator.calculatePlatformPrice(lowPrice, 'shopee');

      expect(result.finalPrice).toBe(1000); // Should be minimum price
    });

    it('should handle fixed fees', () => {
      const customConfig: PlatformFeeConfig = {
        platform: 'shopee',
        feePercentage: 10,
        paymentFeePercentage: 2,
        fixedFee: 5000, // 5k IDR fixed fee
        minimumPrice: 0,
        isActive: true,
      };

      calculator.addPlatformConfig(customConfig);
      const result = calculator.calculatePlatformPrice(basePrice, 'shopee');

      expect(result.fixedFee).toBe(5000);
      expect(result.totalFees).toBe(result.platformFee + result.paymentFee + result.fixedFee);
    });
  });

  describe('Bulk Price Calculation', () => {
    it('should calculate prices for all active platforms', () => {
      const result = calculator.calculateAllPlatformPrices(basePrice, costPrice);

      expect(result.basePrice).toBe(basePrice);
      expect(result.platformResults).toHaveLength(4); // All default platforms
      expect(result.totalPlatforms).toBe(4);
      expect(result.calculatedAt).toBeInstanceOf(Date);
    });

    it('should skip inactive platforms', () => {
      // Deactivate one platform
      const config = calculator.getPlatformConfig('website');
      if (config) {
        calculator.addPlatformConfig({ ...config, isActive: false });
      }

      const result = calculator.calculateAllPlatformPrices(basePrice);

      expect(result.platformResults).toHaveLength(3); // One less platform
      expect(result.totalPlatforms).toBe(3);
    });

    it('should handle calculation errors gracefully', () => {
      // Remove a platform configuration to cause error
      const calculator2 = new PricingCalculator([]);
      const result = calculator2.calculateAllPlatformPrices(basePrice);

      expect(result.platformResults).toHaveLength(0);
      expect(result.totalPlatforms).toBe(0);
    });
  });

  describe('Configuration Management', () => {
    it('should add new platform configuration', () => {
      const newConfig: PlatformFeeConfig = {
        platform: 'shopee',
        feePercentage: 12,
        paymentFeePercentage: 3,
        fixedFee: 0,
        minimumPrice: 2000,
        isActive: true,
        description: 'Updated Shopee config',
      };

      calculator.addPlatformConfig(newConfig);
      const retrieved = calculator.getPlatformConfig('shopee');

      expect(retrieved?.feePercentage).toBe(12);
      expect(retrieved?.description).toBe('Updated Shopee config');
    });

    it('should update platform fee percentage', () => {
      const success = calculator.updatePlatformFee('shopee', 18);
      const config = calculator.getPlatformConfig('shopee');

      expect(success).toBe(true);
      expect(config?.feePercentage).toBe(18);
    });

    it('should fail to update non-existent platform', () => {
      const success = calculator.updatePlatformFee('nonexistent', 10);
      
      expect(success).toBe(false);
    });

    it('should clamp fee percentage to valid range', () => {
      calculator.updatePlatformFee('shopee', 150); // Above 100%
      const config = calculator.getPlatformConfig('shopee');

      expect(config?.feePercentage).toBe(100);

      calculator.updatePlatformFee('shopee', -10); // Below 0%
      const config2 = calculator.getPlatformConfig('shopee');

      expect(config2?.feePercentage).toBe(0);
    });
  });

  describe('Optimal Pricing', () => {
    it('should calculate optimal base price for target margin', () => {
      const targetMargin = 40; // 40% profit margin
      const optimalPrice = calculator.calculateOptimalBasePrice(costPrice, targetMargin, 'shopee');

      expect(optimalPrice).toBeGreaterThan(costPrice);
      
      // Verify the calculation by checking actual margin
      const result = calculator.calculatePlatformPrice(optimalPrice, 'shopee', costPrice);
      expect(result.profitMargin).toBeCloseTo(targetMargin, 1);
    });

    it('should handle edge cases in optimal pricing', () => {
      expect(() => {
        calculator.calculateOptimalBasePrice(0, 50, 'shopee'); // Zero cost
      }).toThrow('Cost price must be greater than zero');

      expect(() => {
        calculator.calculateOptimalBasePrice(costPrice, 100, 'shopee'); // 100% margin
      }).toThrow('Target profit margin must be between 0 and 100');

      expect(() => {
        calculator.calculateOptimalBasePrice(costPrice, 50, 'nonexistent'); // Invalid platform
      }).toThrow('Platform configuration not found');
    });
  });

  describe('Price Comparison', () => {
    it('should compare pricing across platforms', () => {
      const comparison = calculator.comparePlatformPricing(basePrice, costPrice);

      expect(comparison.basePrice).toBe(basePrice);
      expect(comparison.costPrice).toBe(costPrice);
      expect(comparison.platforms).toHaveLength(4);
      expect(comparison.lowestPrice).toBeDefined();
      expect(comparison.highestPrice).toBeDefined();
      expect(comparison.averagePrice).toBeGreaterThan(0);
    });

    it('should identify competitive advantages', () => {
      const comparison = calculator.comparePlatformPricing(basePrice, costPrice);
      
      // Website should have competitive advantage (lowest fees)
      const websitePlatform = comparison.platforms.find(p => p.platform === 'website');
      expect(websitePlatform?.competitiveAdvantage).toBeGreaterThan(0);

      // TikTok Shop should have least competitive advantage (highest fees)
      const tiktokPlatform = comparison.platforms.find(p => p.platform === 'tiktokshop');
      expect(tiktokPlatform?.competitiveAdvantage).toBe(0); // Highest price = 0% advantage
    });

    it('should find best platform for profit', () => {
      const best = findBestPlatformForProfit(basePrice, costPrice);

      expect(best.platform).toBe('website'); // Should be website (lowest fees)
      expect(best.profit).toBeGreaterThan(0);
      expect(best.margin).toBeGreaterThan(0);
    });
  });

  describe('Validation', () => {
    it('should validate configuration', () => {
      const validation = calculator.validateConfiguration();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect configuration issues', () => {
      const badConfig: PlatformFeeConfig = {
        platform: 'shopee',
        feePercentage: 75, // Very high fee
        paymentFeePercentage: 15, // Very high payment fee
        fixedFee: 0,
        minimumPrice: 200000, // Very high minimum
        isActive: true,
      };

      calculator.addPlatformConfig(badConfig);
      const validation = calculator.validateConfiguration();

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(w => w.includes('High platform fee'))).toBe(true);
      expect(validation.warnings.some(w => w.includes('High payment fee'))).toBe(true);
      expect(validation.warnings.some(w => w.includes('High minimum price'))).toBe(true);
    });

    it('should detect empty configuration', () => {
      const emptyCalculator = new PricingCalculator([]);
      const validation = emptyCalculator.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('No platform configurations'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid base prices', () => {
      expect(() => {
        calculator.calculatePlatformPrice(0, 'shopee');
      }).toThrow('Base price must be greater than zero');

      expect(() => {
        calculator.calculatePlatformPrice(-100, 'shopee');
      }).toThrow('Base price must be greater than zero');
    });

    it('should handle non-existent platforms', () => {
      expect(() => {
        calculator.calculatePlatformPrice(basePrice, 'nonexistent');
      }).toThrow('Platform configuration not found');
    });

    it('should handle inactive platforms', () => {
      const config = calculator.getPlatformConfig('shopee');
      if (config) {
        calculator.addPlatformConfig({ ...config, isActive: false });
      }

      expect(() => {
        calculator.calculatePlatformPrice(basePrice, 'shopee');
      }).toThrow('Platform shopee is not active');
    });
  });

  describe('Import/Export Configuration', () => {
    it('should export configuration', () => {
      const exported = calculator.exportConfiguration();

      expect(exported).toHaveLength(4);
      expect(exported.every(config => config.platform)).toBe(true);
      expect(exported.every(config => typeof config.feePercentage === 'number')).toBe(true);
    });

    it('should import configuration', () => {
      const customConfigs: PlatformFeeConfig[] = [
        {
          platform: 'shopee',
          feePercentage: 10,
          paymentFeePercentage: 2,
          fixedFee: 0,
          minimumPrice: 0,
          isActive: true,
        },
      ];

      calculator.importConfiguration(customConfigs);
      const configs = calculator.getAllPlatformConfigs();

      expect(configs).toHaveLength(1);
      expect(configs[0].feePercentage).toBe(10);
    });
  });

  describe('Utility Functions', () => {
    it('should quick calculate price', () => {
      const price = quickCalculatePrice(basePrice, 'shopee');
      
      expect(price).toBeGreaterThan(basePrice);
      expect(typeof price).toBe('number');
    });

    it('should quick calculate with custom fee', () => {
      const price = quickCalculatePrice(basePrice, 'shopee', 10);
      const normalPrice = quickCalculatePrice(basePrice, 'shopee');
      
      expect(price).not.toBe(normalPrice);
    });

    it('should format IDR correctly', () => {
      const formatted = formatIDR(150000);
      
      expect(formatted).toContain('Rp');
      expect(formatted).toContain('150');
      expect(formatted).not.toContain('.00'); // No decimals for IDR
    });

    it('should parse IDR strings', () => {
      const parsed1 = parseIDR('Rp 150.000');
      const parsed2 = parseIDR('150000');
      const parsed3 = parseIDR('Rp150,000.00');

      expect(parsed1).toBe(150000);
      expect(parsed2).toBe(150000);
      expect(parsed3).toBe(150000);
    });

    it('should calculate price differences', () => {
      const diff1 = calculatePriceDifference(180000, 150000);
      const diff2 = calculatePriceDifference(120000, 150000);

      expect(diff1).toBe(20); // 20% increase
      expect(diff2).toBe(-20); // 20% decrease
    });

    it('should handle zero price in difference calculation', () => {
      const diff = calculatePriceDifference(100000, 0);
      
      expect(diff).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large prices', () => {
      const largePrice = Number.MAX_SAFE_INTEGER / 2;
      const result = calculator.calculatePlatformPrice(largePrice, 'shopee');

      expect(result.finalPrice).toBeGreaterThan(largePrice);
      expect(Number.isFinite(result.finalPrice)).toBe(true);
    });

    it('should handle very small prices', () => {
      const smallPrice = 1;
      const result = calculator.calculatePlatformPrice(smallPrice, 'shopee');

      expect(result.finalPrice).toBe(1000); // Should hit minimum price
    });

    it('should handle zero fees', () => {
      const zeroFeeConfig: PlatformFeeConfig = {
        platform: 'website',
        feePercentage: 0,
        paymentFeePercentage: 0,
        fixedFee: 0,
        minimumPrice: 0,
        isActive: true,
      };

      calculator.addPlatformConfig(zeroFeeConfig);
      const result = calculator.calculatePlatformPrice(basePrice, 'website');

      expect(result.platformFee).toBe(0);
      expect(result.paymentFee).toBe(0);
      expect(result.fixedFee).toBe(0);
      expect(result.finalPrice).toBe(basePrice);
    });
  });
});