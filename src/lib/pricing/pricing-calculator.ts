/**
 * Pricing Calculator for SyncStore Phase 1
 * Implements configurable platform fee percentage system
 * Supports automatic price calculation with platform-specific fees
 * 
 * Requirements: 3.3 - Platform pricing calculations
 */

import { z } from 'zod';

// ============================================================================
// PRICING CONFIGURATION SCHEMAS
// ============================================================================

/**
 * Platform fee configuration schema
 */
export const PlatformFeeConfigSchema = z.object({
  platform: z.enum(['shopee', 'tiktokshop', 'website', 'tokopedia']),
  feePercentage: z.number().min(0).max(100, 'Fee percentage cannot exceed 100%'),
  paymentFeePercentage: z.number().min(0).max(100, 'Payment fee cannot exceed 100%'),
  fixedFee: z.number().min(0).default(0), // Fixed fee in IDR
  minimumPrice: z.number().min(0).default(0), // Minimum price in IDR
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});

/**
 * Pricing calculation result schema
 */
export const PricingResultSchema = z.object({
  platform: z.string(),
  basePrice: z.number().positive(),
  platformFee: z.number().min(0),
  paymentFee: z.number().min(0),
  fixedFee: z.number().min(0),
  totalFees: z.number().min(0),
  finalPrice: z.number().positive(),
  profitMargin: z.number().optional(),
  calculatedAt: z.date(),
});

/**
 * Bulk pricing calculation result schema
 */
export const BulkPricingResultSchema = z.object({
  basePrice: z.number().positive(),
  platformResults: z.array(PricingResultSchema),
  totalPlatforms: z.number().int().min(0),
  calculatedAt: z.date(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PlatformFeeConfig = z.infer<typeof PlatformFeeConfigSchema>;
export type PricingResult = z.infer<typeof PricingResultSchema>;
export type BulkPricingResult = z.infer<typeof BulkPricingResultSchema>;

// ============================================================================
// DEFAULT PLATFORM CONFIGURATIONS
// ============================================================================

/**
 * Default platform fee configurations based on requirements
 * Shopee: +15%, TikTokShop: +20%
 */
export const DEFAULT_PLATFORM_CONFIGS: PlatformFeeConfig[] = [
  {
    platform: 'shopee',
    feePercentage: 15, // +15% as specified in requirements
    paymentFeePercentage: 2.9, // Shopee payment gateway fee
    fixedFee: 0,
    minimumPrice: 1000, // Minimum 1000 IDR
    isActive: true,
    description: 'Shopee marketplace fees including platform and payment processing',
  },
  {
    platform: 'tiktokshop',
    feePercentage: 20, // +20% as specified in requirements
    paymentFeePercentage: 2.5, // TikTok Shop payment gateway fee
    fixedFee: 0,
    minimumPrice: 1000, // Minimum 1000 IDR
    isActive: true,
    description: 'TikTok Shop marketplace fees including platform and payment processing',
  },
  {
    platform: 'tokopedia',
    feePercentage: 20, // Same as TikTok Shop (auto-sync feature)
    paymentFeePercentage: 2.5,
    fixedFee: 0,
    minimumPrice: 1000,
    isActive: true,
    description: 'Tokopedia fees (auto-synced from TikTok Shop)',
  },
  {
    platform: 'website',
    feePercentage: 0, // No platform fees for own website
    paymentFeePercentage: 2.9, // Payment gateway only
    fixedFee: 0,
    minimumPrice: 0,
    isActive: true,
    description: 'Own website - no platform fees, payment gateway only',
  },
];

// ============================================================================
// PRICING CALCULATOR CLASS
// ============================================================================

/**
 * Main pricing calculator class
 * Handles all pricing calculations with configurable platform fees
 */
export class PricingCalculator {
  private platformConfigs: Map<string, PlatformFeeConfig>;

  constructor(configs?: PlatformFeeConfig[]) {
    this.platformConfigs = new Map();
    
    // Load default configurations
    const configsToLoad = configs || DEFAULT_PLATFORM_CONFIGS;
    configsToLoad.forEach(config => {
      this.addPlatformConfig(config);
    });
  }

  /**
   * Add or update platform fee configuration
   */
  addPlatformConfig(config: PlatformFeeConfig): void {
    const validatedConfig = PlatformFeeConfigSchema.parse(config);
    this.platformConfigs.set(validatedConfig.platform, validatedConfig);
  }

  /**
   * Get platform fee configuration
   */
  getPlatformConfig(platform: string): PlatformFeeConfig | undefined {
    return this.platformConfigs.get(platform);
  }

  /**
   * Get all platform configurations
   */
  getAllPlatformConfigs(): PlatformFeeConfig[] {
    return Array.from(this.platformConfigs.values());
  }

  /**
   * Update platform fee percentage
   */
  updatePlatformFee(platform: string, feePercentage: number): boolean {
    const config = this.platformConfigs.get(platform);
    if (!config) {
      return false;
    }

    const updatedConfig = {
      ...config,
      feePercentage: Math.max(0, Math.min(100, feePercentage)),
    };

    this.addPlatformConfig(updatedConfig);
    return true;
  }

  /**
   * Calculate price for a specific platform
   */
  calculatePlatformPrice(
    basePrice: number,
    platform: string,
    costPrice?: number
  ): PricingResult {
    if (basePrice <= 0) {
      throw new Error('Base price must be greater than zero');
    }

    const config = this.platformConfigs.get(platform);
    if (!config) {
      throw new Error(`Platform configuration not found for: ${platform}`);
    }

    if (!config.isActive) {
      throw new Error(`Platform ${platform} is not active`);
    }

    // Calculate platform fee
    const platformFee = (basePrice * config.feePercentage) / 100;
    
    // Calculate payment fee (applied to base price + platform fee)
    const priceWithPlatformFee = basePrice + platformFee;
    const paymentFee = (priceWithPlatformFee * config.paymentFeePercentage) / 100;
    
    // Add fixed fee
    const fixedFee = config.fixedFee;
    
    // Calculate total fees and final price
    const totalFees = platformFee + paymentFee + fixedFee;
    let finalPrice = basePrice + totalFees;
    
    // Apply minimum price constraint
    if (finalPrice < config.minimumPrice) {
      finalPrice = config.minimumPrice;
    }

    // Round to nearest IDR (no decimals for Indonesian Rupiah)
    finalPrice = Math.round(finalPrice);

    // Calculate profit margin if cost price is provided
    let profitMargin: number | undefined;
    if (costPrice && costPrice > 0) {
      profitMargin = ((finalPrice - costPrice) / finalPrice) * 100;
    }

    return PricingResultSchema.parse({
      platform,
      basePrice,
      platformFee: Math.round(platformFee),
      paymentFee: Math.round(paymentFee),
      fixedFee,
      totalFees: Math.round(totalFees),
      finalPrice,
      profitMargin,
      calculatedAt: new Date(),
    });
  }

  /**
   * Calculate prices for all active platforms
   */
  calculateAllPlatformPrices(
    basePrice: number,
    costPrice?: number
  ): BulkPricingResult {
    if (basePrice <= 0) {
      throw new Error('Base price must be greater than zero');
    }

    const activePlatforms = Array.from(this.platformConfigs.values())
      .filter(config => config.isActive);

    const platformResults: PricingResult[] = [];

    for (const config of activePlatforms) {
      try {
        const result = this.calculatePlatformPrice(basePrice, config.platform, costPrice);
        platformResults.push(result);
      } catch (error) {
        console.warn(`Failed to calculate price for platform ${config.platform}:`, error);
      }
    }

    return BulkPricingResultSchema.parse({
      basePrice,
      platformResults,
      totalPlatforms: platformResults.length,
      calculatedAt: new Date(),
    });
  }

  /**
   * Calculate optimal base price to achieve target profit margin
   */
  calculateOptimalBasePrice(
    costPrice: number,
    targetProfitMargin: number,
    platform: string
  ): number {
    if (costPrice <= 0) {
      throw new Error('Cost price must be greater than zero');
    }

    if (targetProfitMargin < 0 || targetProfitMargin >= 100) {
      throw new Error('Target profit margin must be between 0 and 100');
    }

    const config = this.platformConfigs.get(platform);
    if (!config) {
      throw new Error(`Platform configuration not found for: ${platform}`);
    }

    // Calculate required final price for target margin
    const requiredFinalPrice = costPrice / (1 - targetProfitMargin / 100);

    // Work backwards to find base price
    // finalPrice = basePrice + (basePrice * platformFee%) + ((basePrice + platformFee) * paymentFee%) + fixedFee
    // Solve for basePrice
    const platformFeeMultiplier = 1 + config.feePercentage / 100;
    const paymentFeeMultiplier = 1 + config.paymentFeePercentage / 100;
    
    const basePrice = (requiredFinalPrice - config.fixedFee) / 
                     (platformFeeMultiplier * paymentFeeMultiplier);

    return Math.max(0, Math.round(basePrice));
  }

  /**
   * Compare pricing across all platforms
   */
  comparePlatformPricing(basePrice: number, costPrice?: number): {
    basePrice: number;
    costPrice?: number;
    platforms: Array<{
      platform: string;
      finalPrice: number;
      totalFees: number;
      profitMargin?: number;
      competitiveAdvantage: number; // Percentage difference from highest price
    }>;
    lowestPrice: { platform: string; price: number };
    highestPrice: { platform: string; price: number };
    averagePrice: number;
  } {
    const bulkResult = this.calculateAllPlatformPrices(basePrice, costPrice);
    
    if (bulkResult.platformResults.length === 0) {
      throw new Error('No active platforms found for comparison');
    }

    // Find lowest and highest prices
    const prices = bulkResult.platformResults.map(r => r.finalPrice);
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;

    const lowestPlatform = bulkResult.platformResults.find(r => r.finalPrice === lowestPrice)!;
    const highestPlatform = bulkResult.platformResults.find(r => r.finalPrice === highestPrice)!;

    const platforms = bulkResult.platformResults.map(result => ({
      platform: result.platform,
      finalPrice: result.finalPrice,
      totalFees: result.totalFees,
      profitMargin: result.profitMargin,
      competitiveAdvantage: highestPrice > 0 
        ? ((highestPrice - result.finalPrice) / highestPrice) * 100 
        : 0,
    }));

    return {
      basePrice,
      costPrice,
      platforms,
      lowestPrice: { platform: lowestPlatform.platform, price: lowestPrice },
      highestPrice: { platform: highestPlatform.platform, price: highestPrice },
      averagePrice: Math.round(averagePrice),
    };
  }

  /**
   * Validate pricing configuration
   */
  validateConfiguration(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (this.platformConfigs.size === 0) {
      errors.push('No platform configurations found');
    }

    const activePlatforms = Array.from(this.platformConfigs.values())
      .filter(config => config.isActive);

    if (activePlatforms.length === 0) {
      warnings.push('No active platforms configured');
    }

    // Check for reasonable fee percentages
    for (const config of this.platformConfigs.values()) {
      if (config.feePercentage > 50) {
        warnings.push(`High platform fee for ${config.platform}: ${config.feePercentage}%`);
      }

      if (config.paymentFeePercentage > 10) {
        warnings.push(`High payment fee for ${config.platform}: ${config.paymentFeePercentage}%`);
      }

      if (config.minimumPrice > 100000) {
        warnings.push(`High minimum price for ${config.platform}: ${config.minimumPrice} IDR`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Export configuration for backup/sharing
   */
  exportConfiguration(): PlatformFeeConfig[] {
    return Array.from(this.platformConfigs.values());
  }

  /**
   * Import configuration from backup
   */
  importConfiguration(configs: PlatformFeeConfig[]): void {
    this.platformConfigs.clear();
    configs.forEach(config => {
      this.addPlatformConfig(config);
    });
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create default pricing calculator instance
 */
export function createDefaultPricingCalculator(): PricingCalculator {
  return new PricingCalculator();
}

/**
 * Quick price calculation for a single platform
 */
export function quickCalculatePrice(
  basePrice: number,
  platform: string,
  feePercentage?: number
): number {
  const calculator = createDefaultPricingCalculator();
  
  if (feePercentage !== undefined) {
    calculator.updatePlatformFee(platform, feePercentage);
  }

  const result = calculator.calculatePlatformPrice(basePrice, platform);
  return result.finalPrice;
}

/**
 * Format price for Indonesian Rupiah display
 */
export function formatIDR(price: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Parse IDR string back to number
 */
export function parseIDR(priceString: string): number {
  // Remove currency symbols and separators
  const cleanString = priceString.replace(/[^\d]/g, '');
  return parseInt(cleanString, 10) || 0;
}

/**
 * Calculate percentage difference between two prices
 */
export function calculatePriceDifference(price1: number, price2: number): number {
  if (price2 === 0) return 0;
  return ((price1 - price2) / price2) * 100;
}

/**
 * Find best platform for maximum profit
 */
export function findBestPlatformForProfit(
  basePrice: number,
  costPrice: number
): { platform: string; profit: number; margin: number } {
  const calculator = createDefaultPricingCalculator();
  const comparison = calculator.comparePlatformPricing(basePrice, costPrice);
  
  let bestPlatform = comparison.platforms[0];
  
  for (const platform of comparison.platforms) {
    if (platform.profitMargin && platform.profitMargin > (bestPlatform.profitMargin || 0)) {
      bestPlatform = platform;
    }
  }

  const profit = bestPlatform.finalPrice - costPrice;
  
  return {
    platform: bestPlatform.platform,
    profit,
    margin: bestPlatform.profitMargin || 0,
  };
}