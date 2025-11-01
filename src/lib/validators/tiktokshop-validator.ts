/**
 * TikTok Shop Data Validator for Phase 1
 * Validates imported TikTok Shop product data with Tokopedia flag tracking
 */

import { z } from 'zod';

// TikTok Shop specific validation schemas
export const TikTokShopProductSchema = z.object({
  product_id: z.string().min(1),
  product_name: z.string().min(1).max(500),
  description: z.string().optional(),
  brand_name: z.string().optional(),
  category_id: z.string().min(1),
  product_status: z.enum(['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'ACTIVE', 'SELLER_DEACTIVATED', 'PLATFORM_DEACTIVATED', 'FREEZE']),
  create_time: z.number().positive(),
  update_time: z.number().positive(),
  images: z.array(z.object({
    id: z.string(),
    url: z.string().url(),
    thumb_urls: z.array(z.string().url()).optional().default([]),
    uri: z.string().optional(),
  })).min(1),
  video: z.object({
    id: z.string(),
    url: z.string().url(),
    cover: z.string().url().optional(),
    duration: z.number().positive().optional(),
  }).optional(),
  attributes: z.array(z.object({
    attribute_id: z.string(),
    attribute_name: z.string(),
    attribute_values: z.array(z.object({
      value_id: z.string(),
      value_name: z.string(),
    })),
  })).optional().default([]),
  category_chains: z.array(z.object({
    id: z.string(),
    parent_id: z.string().optional(),
    local_name: z.string(),
    is_leaf: z.boolean(),
  })).optional().default([]),
  brand: z.object({
    id: z.string(),
    name: z.string(),
  }).optional(),
  manufacturer: z.object({
    name: z.string(),
    address: z.string().optional(),
  }).optional(),
  package_weight: z.number().min(0).optional(),
  package_dimensions: z.object({
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
  }).optional(),
  delivery_options: z.array(z.object({
    delivery_option_id: z.string(),
    delivery_option_name: z.string(),
    is_available: z.boolean(),
  })).optional().default([]),
  is_cod_allowed: z.boolean().optional(),
  size_chart: z.object({
    image: z.string().url().optional(),
    template: z.string().optional(),
  }).optional(),
  // Tokopedia integration flag
  include_tokopedia: z.boolean().optional().default(false),
});

export const TikTokShopVariantSchema = z.object({
  id: z.string().min(1),
  seller_sku: z.string().min(1),
  outer_sku_id: z.string().optional(),
  price: z.object({
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
    currency: z.string().length(3),
  }),
  stock_infos: z.array(z.object({
    available_stock: z.number().min(0),
    reserved_stock: z.number().min(0).optional().default(0),
    warehouse_id: z.string(),
  })).min(1),
  identifier_code: z.object({
    ean: z.string().optional(),
    upc: z.string().optional(),
  }).optional(),
  sales_attributes: z.array(z.object({
    attribute_id: z.string(),
    attribute_name: z.string(),
    value_id: z.string(),
    value_name: z.string(),
  })).optional().default([]),
  package_weight: z.number().min(0).optional(),
  package_dimensions: z.object({
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
  }).optional(),
});

export interface TikTokValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: any;
  tokopediaFlag?: boolean;
}

export interface TikTokValidationStats {
  totalValidated: number;
  validCount: number;
  invalidCount: number;
  warningCount: number;
  tokopediaEnabledCount: number;
  errorsByField: Record<string, number>;
  commonErrors: Array<{ error: string; count: number }>;
  validationDuration: number;
}

export class TikTokShopValidator {
  private stats: TikTokValidationStats = {
    totalValidated: 0,
    validCount: 0,
    invalidCount: 0,
    warningCount: 0,
    tokopediaEnabledCount: 0,
    errorsByField: {},
    commonErrors: [],
    validationDuration: 0,
  };

  /**
   * Validate TikTok Shop product data with Tokopedia flag tracking
   */
  validateProduct(data: any): TikTokValidationResult {
    const startTime = Date.now();
    this.stats.totalValidated++;

    try {
      const validatedData = TikTokShopProductSchema.parse(data);
      
      // Track Tokopedia flag
      const tokopediaFlag = validatedData.include_tokopedia || false;
      if (tokopediaFlag) {
        this.stats.tokopediaEnabledCount++;
      }
      
      const warnings = this.checkProductWarnings(validatedData);
      
      if (warnings.length > 0) {
        this.stats.warningCount++;
      }
      
      this.stats.validCount++;

      this.stats.validationDuration += Date.now() - startTime;

      return {
        isValid: true,
        errors: [],
        warnings,
        data: validatedData,
        tokopediaFlag,
      };
    } catch (error) {
      this.stats.invalidCount++;
      this.stats.validationDuration += Date.now() - startTime;
      
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => {
          const field = err.path.join('.');
          this.updateFieldError(field);
          return `${field}: ${err.message}`;
        });
        
        this.updateCommonErrors(errors);
        
        return {
          isValid: false,
          errors,
          warnings: [],
          tokopediaFlag: false,
        };
      }

      return {
        isValid: false,
        errors: ['Unknown validation error'],
        warnings: [],
        tokopediaFlag: false,
      };
    }
  }

  /**
   * Validate TikTok Shop variant data
   */
  validateVariant(data: any): TikTokValidationResult {
    const startTime = Date.now();
    this.stats.totalValidated++;

    try {
      const validatedData = TikTokShopVariantSchema.parse(data);
      
      const warnings = this.checkVariantWarnings(validatedData);
      
      if (warnings.length > 0) {
        this.stats.warningCount++;
      }
      
      this.stats.validCount++;

      this.stats.validationDuration += Date.now() - startTime;

      return {
        isValid: true,
        errors: [],
        warnings,
        data: validatedData,
      };
    } catch (error) {
      this.stats.invalidCount++;
      this.stats.validationDuration += Date.now() - startTime;
      
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => {
          const field = err.path.join('.');
          this.updateFieldError(field);
          return `${field}: ${err.message}`;
        });
        
        this.updateCommonErrors(errors);
        
        return {
          isValid: false,
          errors,
          warnings: [],
        };
      }

      return {
        isValid: false,
        errors: ['Unknown validation error'],
        warnings: [],
      };
    }
  }

  /**
   * Batch validate products with progress tracking
   */
  async validateBatch(
    products: any[],
    onProgress?: (progress: { current: number; total: number; percentage: number }) => void
  ): Promise<{
    results: TikTokValidationResult[];
    summary: {
      total: number;
      valid: number;
      invalid: number;
      warnings: number;
      tokopediaEnabled: number;
    };
  }> {
    const results: TikTokValidationResult[] = [];
    const total = products.length;
    let tokopediaCount = 0;

    for (let i = 0; i < products.length; i++) {
      const result = this.validateProduct(products[i]);
      results.push(result);

      if (result.tokopediaFlag) {
        tokopediaCount++;
      }

      // Report progress
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          percentage: Math.round(((i + 1) / total) * 100),
        });
      }

      // Small delay to prevent blocking
      if (i % 100 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    return {
      results,
      summary: {
        total,
        valid: results.filter(r => r.isValid).length,
        invalid: results.filter(r => !r.isValid).length,
        warnings: results.filter(r => r.warnings.length > 0).length,
        tokopediaEnabled: tokopediaCount,
      },
    };
  }

  /**
   * Check for TikTok Shop product warnings
   */
  private checkProductWarnings(data: z.infer<typeof TikTokShopProductSchema>): string[] {
    const warnings: string[] = [];

    // Check for missing optional but important fields
    if (!data.description || data.description.length < 50) {
      warnings.push('Product description is missing or too short (recommended: 50+ characters)');
    }

    if (!data.package_weight || data.package_weight === 0) {
      warnings.push('Product weight is missing or zero (may affect shipping calculations)');
    }

    if (!data.package_dimensions) {
      warnings.push('Product dimensions are missing (may affect shipping calculations)');
    }

    if (!data.brand_name && !data.brand?.name) {
      warnings.push('Brand information is missing');
    }

    if (data.images.length < 3) {
      warnings.push('Less than 3 product images (recommended: 3+ images for better conversion)');
    }

    // Check for TikTok Shop specific limits
    if (data.product_name.length > 255) {
      warnings.push('Product name exceeds TikTok Shop limit (255 characters)');
    }

    if (data.description && data.description.length > 5000) {
      warnings.push('Product description exceeds TikTok Shop limit (5000 characters)');
    }

    // Check product status
    if (data.product_status !== 'ACTIVE') {
      warnings.push(`Product status is ${data.product_status}, not ACTIVE`);
    }

    // Check delivery options
    if (!data.delivery_options || data.delivery_options.length === 0) {
      warnings.push('No delivery options configured');
    }

    // Check COD availability for Indonesian market
    if (data.is_cod_allowed === false) {
      warnings.push('COD is disabled (may reduce conversion in Indonesian market)');
    }

    // Tokopedia integration warning
    if (data.include_tokopedia) {
      warnings.push('Tokopedia integration is enabled for this product');
    }

    return warnings;
  }

  /**
   * Check for TikTok Shop variant warnings
   */
  private checkVariantWarnings(data: z.infer<typeof TikTokShopVariantSchema>): string[] {
    const warnings: string[] = [];

    const totalStock = data.stock_infos.reduce((sum, stock) => sum + stock.available_stock, 0);
    if (totalStock === 0) {
      warnings.push('Variant has zero stock across all warehouses');
    }

    const price = parseFloat(data.price.amount);
    if (price < 1000) {
      warnings.push('Variant price is very low (< Rp 1,000)');
    }

    if (price > 10000000) {
      warnings.push('Variant price is very high (> Rp 10,000,000)');
    }

    if (data.price.currency !== 'IDR') {
      warnings.push(`Variant currency is ${data.price.currency}, expected IDR for Indonesian market`);
    }

    if (!data.seller_sku || data.seller_sku.length < 3) {
      warnings.push('Variant SKU is missing or too short');
    }

    // Check for reserved stock ratio
    const reservedRatio = data.stock_infos.reduce((sum, stock) => {
      return sum + (stock.reserved_stock || 0);
    }, 0) / Math.max(totalStock, 1);

    if (reservedRatio > 0.5) {
      warnings.push('High reserved stock ratio (>50%) may indicate inventory issues');
    }

    // Check for missing identifier codes
    if (!data.identifier_code?.ean && !data.identifier_code?.upc) {
      warnings.push('Missing product identifier codes (EAN/UPC)');
    }

    return warnings;
  }

  /**
   * Update field error statistics
   */
  private updateFieldError(field: string): void {
    this.stats.errorsByField[field] = (this.stats.errorsByField[field] || 0) + 1;
  }

  /**
   * Update common error statistics
   */
  private updateCommonErrors(errors: string[]): void {
    errors.forEach(error => {
      const existing = this.stats.commonErrors.find(e => e.error === error);
      if (existing) {
        existing.count++;
      } else {
        this.stats.commonErrors.push({ error, count: 1 });
      }
    });

    // Keep only top 10 most common errors
    this.stats.commonErrors.sort((a, b) => b.count - a.count);
    this.stats.commonErrors = this.stats.commonErrors.slice(0, 10);
  }

  /**
   * Get validation statistics
   */
  getStats(): TikTokValidationStats {
    return { ...this.stats };
  }

  /**
   * Reset validation statistics
   */
  resetStats(): void {
    this.stats = {
      totalValidated: 0,
      validCount: 0,
      invalidCount: 0,
      warningCount: 0,
      tokopediaEnabledCount: 0,
      errorsByField: {},
      commonErrors: [],
      validationDuration: 0,
    };
  }

  /**
   * Generate TikTok Shop specific validation report
   */
  generateReport(): string {
    const successRate = this.stats.totalValidated > 0 
      ? Math.round((this.stats.validCount / this.stats.totalValidated) * 100)
      : 0;

    const tokopediaRate = this.stats.totalValidated > 0
      ? Math.round((this.stats.tokopediaEnabledCount / this.stats.totalValidated) * 100)
      : 0;

    const avgValidationTime = this.stats.totalValidated > 0
      ? Math.round(this.stats.validationDuration / this.stats.totalValidated)
      : 0;

    let report = `📊 TikTok Shop Validation Report\n`;
    report += `=================================\n\n`;
    report += `Total Validated: ${this.stats.totalValidated}\n`;
    report += `Valid: ${this.stats.validCount} (${successRate}%)\n`;
    report += `Invalid: ${this.stats.invalidCount}\n`;
    report += `With Warnings: ${this.stats.warningCount}\n`;
    report += `Tokopedia Enabled: ${this.stats.tokopediaEnabledCount} (${tokopediaRate}%)\n`;
    report += `Avg Validation Time: ${avgValidationTime}ms\n\n`;

    if (Object.keys(this.stats.errorsByField).length > 0) {
      report += `Most Common Field Errors:\n`;
      Object.entries(this.stats.errorsByField)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([field, count]) => {
          report += `  ${field}: ${count} errors\n`;
        });
      report += `\n`;
    }

    if (this.stats.commonErrors.length > 0) {
      report += `Most Common Errors:\n`;
      this.stats.commonErrors.slice(0, 5).forEach(({ error, count }) => {
        report += `  ${error} (${count} times)\n`;
      });
    }

    return report;
  }

  /**
   * Validate image URLs accessibility
   */
  async validateImageUrls(imageUrls: string[]): Promise<{
    valid: string[];
    invalid: Array<{ url: string; error: string }>;
  }> {
    const valid: string[] = [];
    const invalid: Array<{ url: string; error: string }> = [];

    for (const url of imageUrls) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          valid.push(url);
        } else {
          invalid.push({ url, error: `HTTP ${response.status}` });
        }
      } catch (error) {
        invalid.push({ 
          url, 
          error: error instanceof Error ? error.message : 'Network error' 
        });
      }
    }

    return { valid, invalid };
  }
}

// Export singleton instance
export const tiktokShopValidator = new TikTokShopValidator();