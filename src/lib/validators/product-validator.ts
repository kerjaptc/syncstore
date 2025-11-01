/**
 * Product Data Validator for Phase 1
 * Validates imported product data from various platforms
 */

import { z } from 'zod';

// Shopee validation schemas
export const ShopeeProductSchema = z.object({
  item_id: z.number().positive(),
  category_id: z.number().positive(),
  item_name: z.string().min(1).max(500),
  description: z.string().optional(),
  item_sku: z.string().optional(),
  create_time: z.number().positive(),
  update_time: z.number().positive(),
  attribute_list: z.array(z.object({
    attribute_id: z.number(),
    attribute_name: z.string(),
    attribute_value: z.string(),
  })).optional().default([]),
  image: z.object({
    image_url_list: z.array(z.string().url()).min(1),
    image_id_list: z.array(z.string()).optional().default([]),
  }),
  weight: z.number().min(0).optional(),
  dimension: z.object({
    package_length: z.number().min(0).optional(),
    package_width: z.number().min(0).optional(),
    package_height: z.number().min(0).optional(),
  }).optional(),
  logistic_info: z.array(z.object({
    logistic_id: z.number(),
    logistic_name: z.string(),
    enabled: z.boolean(),
  })).optional().default([]),
  pre_order: z.object({
    is_pre_order: z.boolean(),
    days_to_ship: z.number().min(0),
  }).optional(),
  item_status: z.enum(['NORMAL', 'DELETED', 'BANNED']),
  has_model: z.boolean().optional().default(false),
  promotion_id: z.number().optional(),
  brand: z.object({
    brand_id: z.number().optional(),
    original_brand_name: z.string().optional(),
  }).optional(),
  item_dangerous: z.number().optional(),
  complaint_policy: z.object({
    warranty_time: z.number().optional(),
    exclude_entrepreneur_warranty: z.boolean().optional(),
  }).optional(),
});

export const ShopeeVariantSchema = z.object({
  model_id: z.number().positive(),
  promotion_id: z.number().optional(),
  tier_index: z.array(z.number()).optional().default([]),
  normal_stock: z.number().min(0),
  reserved_stock: z.number().min(0).optional().default(0),
  price: z.number().positive(),
  model_sku: z.string().min(1),
  create_time: z.number().positive(),
  update_time: z.number().positive(),
});

// TikTok Shop validation schemas
export const TikTokProductSchema = z.object({
  product_id: z.string().min(1),
  product_name: z.string().min(1).max(500),
  description: z.string().optional(),
  brand_name: z.string().optional(),
  category_id: z.string().min(1),
  product_status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']),
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
});

export const TikTokVariantSchema = z.object({
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

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: any;
}

export interface ValidationStats {
  totalValidated: number;
  validCount: number;
  invalidCount: number;
  warningCount: number;
  errorsByField: Record<string, number>;
  commonErrors: Array<{ error: string; count: number }>;
}

export class ProductValidator {
  private stats: ValidationStats = {
    totalValidated: 0,
    validCount: 0,
    invalidCount: 0,
    warningCount: 0,
    errorsByField: {},
    commonErrors: [],
  };

  /**
   * Validate Shopee product data
   */
  validateShopeeProduct(data: any): ValidationResult {
    this.stats.totalValidated++;

    try {
      const validatedData = ShopeeProductSchema.parse(data);
      
      const warnings = this.checkShopeeWarnings(validatedData);
      
      if (warnings.length > 0) {
        this.stats.warningCount++;
      } else {
        this.stats.validCount++;
      }

      return {
        isValid: true,
        errors: [],
        warnings,
        data: validatedData,
      };
    } catch (error) {
      this.stats.invalidCount++;
      
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
   * Validate Shopee variant data
   */
  validateShopeeVariant(data: any): ValidationResult {
    this.stats.totalValidated++;

    try {
      const validatedData = ShopeeVariantSchema.parse(data);
      
      const warnings = this.checkShopeeVariantWarnings(validatedData);
      
      if (warnings.length > 0) {
        this.stats.warningCount++;
      } else {
        this.stats.validCount++;
      }

      return {
        isValid: true,
        errors: [],
        warnings,
        data: validatedData,
      };
    } catch (error) {
      this.stats.invalidCount++;
      
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
   * Validate TikTok Shop product data
   */
  validateTikTokProduct(data: any): ValidationResult {
    this.stats.totalValidated++;

    try {
      const validatedData = TikTokProductSchema.parse(data);
      
      const warnings = this.checkTikTokWarnings(validatedData);
      
      if (warnings.length > 0) {
        this.stats.warningCount++;
      } else {
        this.stats.validCount++;
      }

      return {
        isValid: true,
        errors: [],
        warnings,
        data: validatedData,
      };
    } catch (error) {
      this.stats.invalidCount++;
      
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
   * Validate TikTok Shop variant data
   */
  validateTikTokVariant(data: any): ValidationResult {
    this.stats.totalValidated++;

    try {
      const validatedData = TikTokVariantSchema.parse(data);
      
      const warnings = this.checkTikTokVariantWarnings(validatedData);
      
      if (warnings.length > 0) {
        this.stats.warningCount++;
      } else {
        this.stats.validCount++;
      }

      return {
        isValid: true,
        errors: [],
        warnings,
        data: validatedData,
      };
    } catch (error) {
      this.stats.invalidCount++;
      
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
   * Check for Shopee-specific warnings
   */
  private checkShopeeWarnings(data: z.infer<typeof ShopeeProductSchema>): string[] {
    const warnings: string[] = [];

    // Check for missing optional but important fields
    if (!data.description || data.description.length < 50) {
      warnings.push('Product description is missing or too short (recommended: 50+ characters)');
    }

    if (!data.weight || data.weight === 0) {
      warnings.push('Product weight is missing or zero (may affect shipping calculations)');
    }

    if (!data.dimension || !data.dimension.package_length) {
      warnings.push('Product dimensions are missing (may affect shipping calculations)');
    }

    if (!data.brand?.original_brand_name) {
      warnings.push('Brand information is missing');
    }

    if (data.image.image_url_list.length < 3) {
      warnings.push('Less than 3 product images (recommended: 3+ images for better conversion)');
    }

    // Check for suspicious data
    if (data.item_name.length > 120) {
      warnings.push('Product name exceeds Shopee limit (120 characters)');
    }

    return warnings;
  }

  /**
   * Check for Shopee variant warnings
   */
  private checkShopeeVariantWarnings(data: z.infer<typeof ShopeeVariantSchema>): string[] {
    const warnings: string[] = [];

    if (data.normal_stock === 0) {
      warnings.push('Variant has zero stock');
    }

    if (data.price < 1000) {
      warnings.push('Variant price is very low (< Rp 1,000)');
    }

    if (!data.model_sku || data.model_sku.length < 3) {
      warnings.push('Variant SKU is missing or too short');
    }

    return warnings;
  }

  /**
   * Check for TikTok Shop warnings
   */
  private checkTikTokWarnings(data: z.infer<typeof TikTokProductSchema>): string[] {
    const warnings: string[] = [];

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

    if (data.product_name.length > 255) {
      warnings.push('Product name exceeds TikTok Shop limit (255 characters)');
    }

    return warnings;
  }

  /**
   * Check for TikTok Shop variant warnings
   */
  private checkTikTokVariantWarnings(data: z.infer<typeof TikTokVariantSchema>): string[] {
    const warnings: string[] = [];

    const totalStock = data.stock_infos.reduce((sum, stock) => sum + stock.available_stock, 0);
    if (totalStock === 0) {
      warnings.push('Variant has zero stock across all warehouses');
    }

    const price = parseFloat(data.price.amount);
    if (price < 1000) {
      warnings.push('Variant price is very low (< Rp 1,000)');
    }

    if (data.price.currency !== 'IDR') {
      warnings.push(`Variant currency is ${data.price.currency}, expected IDR`);
    }

    if (!data.seller_sku || data.seller_sku.length < 3) {
      warnings.push('Variant SKU is missing or too short');
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
  getStats(): ValidationStats {
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
      errorsByField: {},
      commonErrors: [],
    };
  }

  /**
   * Generate validation report
   */
  generateReport(): string {
    const successRate = this.stats.totalValidated > 0 
      ? Math.round((this.stats.validCount / this.stats.totalValidated) * 100)
      : 0;

    let report = `📊 Validation Report\n`;
    report += `==================\n\n`;
    report += `Total Validated: ${this.stats.totalValidated}\n`;
    report += `Valid: ${this.stats.validCount} (${successRate}%)\n`;
    report += `Invalid: ${this.stats.invalidCount}\n`;
    report += `With Warnings: ${this.stats.warningCount}\n\n`;

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
}

// Export singleton instance
export const productValidator = new ProductValidator();