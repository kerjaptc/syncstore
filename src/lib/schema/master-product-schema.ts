/**
 * Master Product Schema for SyncStore Phase 1
 * Unified schema design based on data overlap validation findings
 * 
 * Design Principles:
 * - Universal fields for common data (4 fields identified: name, description, weight, dimensions)
 * - Platform mappings for platform-specific data (44 platform-specific fields)
 * - Flexible structure to accommodate future platforms
 * - Type safety with comprehensive TypeScript interfaces
 */

import { z } from 'zod';

// ============================================================================
// UNIVERSAL FIELD SCHEMAS (Common across platforms)
// ============================================================================

/**
 * Universal product dimensions schema
 * Common field identified in validation: dimensions/dimension
 */
export const DimensionsSchema = z.object({
  length: z.number().positive('Length must be positive'),
  width: z.number().positive('Width must be positive'),
  height: z.number().positive('Height must be positive'),
  unit: z.enum(['cm', 'mm', 'inch']).default('cm'),
});

/**
 * Universal product image schema
 * Normalized from platform-specific image structures
 */
export const ProductImageSchema = z.object({
  url: z.string().url('Must be valid URL'),
  alt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  isPrimary: z.boolean().default(false),
});

/**
 * Universal product category schema
 * Normalized from platform-specific category systems
 */
export const ProductCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.array(z.string()), // Category breadcrumb path
  level: z.number().int().min(0),
});

/**
 * Universal product variant schema
 * Handles variants across different platform structures
 */
export const ProductVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  attributes: z.record(z.string(), z.string()), // e.g., { "Color": "Red", "Size": "5 Inch" }
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  reservedStock: z.number().int().min(0, 'Reserved stock cannot be negative').default(0),
  isActive: z.boolean().default(true),
});

// ============================================================================
// PLATFORM-SPECIFIC SCHEMAS
// ============================================================================

/**
 * Shopee platform-specific data schema
 * Stores 22 Shopee-only fields identified in validation
 */
export const ShopeePlatformDataSchema = z.object({
  // Core Shopee identifiers
  item_id: z.number(),
  item_sku: z.string().optional(),
  category_id: z.number(),
  
  // Shopee-specific status and settings
  item_status: z.enum(['NORMAL', 'DELETED', 'BANNED', 'UNLIST']),
  has_model: z.boolean(),
  promotion_id: z.number().optional(),
  item_dangerous: z.number().default(0),
  
  // Shopee logistics and shipping
  logistic_info: z.array(z.object({
    logistic_id: z.number(),
    logistic_name: z.string(),
    enabled: z.boolean(),
  })).optional(),
  
  // Shopee pre-order settings
  pre_order: z.object({
    is_pre_order: z.boolean(),
    days_to_ship: z.number().int().min(1).max(30),
  }).optional(),
  
  // Shopee brand information
  brand: z.object({
    brand_id: z.number(),
    original_brand_name: z.string(),
  }).optional(),
  
  // Shopee complaint/warranty policy
  complaint_policy: z.object({
    warranty_time: z.number().int().min(0),
    exclude_entrepreneur_warranty: z.boolean(),
  }).optional(),
  
  // Shopee image structure
  image: z.object({
    image_url_list: z.array(z.string().url()),
    image_id_list: z.array(z.string()),
  }).optional(),
  
  // Shopee variant structure
  tier_variation: z.array(z.object({
    name: z.string(),
    option_list: z.array(z.object({
      option: z.string(),
      image: z.object({
        image_id: z.string(),
        image_url: z.string().url(),
      }).optional(),
    })),
  })).optional(),
  
  // Shopee attributes
  attribute_list: z.array(z.object({
    attribute_id: z.number(),
    attribute_name: z.string(),
    attribute_value: z.string(),
  })).optional(),
  
  // Timestamps
  create_time: z.number(),
  update_time: z.number(),
});

/**
 * TikTok Shop platform-specific data schema
 * Stores 22 TikTok Shop-only fields identified in validation
 */
export const TikTokPlatformDataSchema = z.object({
  // Core TikTok identifiers
  product_id: z.string(),
  
  // TikTok-specific features
  include_tokopedia: z.boolean().default(false),
  is_cod_allowed: z.boolean().default(false),
  manufacturer: z.string().optional(),
  
  // TikTok delivery options
  delivery_options: z.array(z.object({
    delivery_option_id: z.string(),
    delivery_option_name: z.string(),
    is_available: z.boolean(),
  })).optional(),
  
  // TikTok category structure
  category_chains: z.array(z.object({
    id: z.string(),
    name: z.string(),
    parent_id: z.string().nullable(),
  })).optional(),
  
  // TikTok image structure
  images: z.array(z.object({
    url: z.string().url(),
    thumb_urls: z.array(z.string().url()),
  })).optional(),
  
  // TikTok SKU/variant structure
  skus: z.array(z.object({
    id: z.string(),
    seller_sku: z.string(),
    price: z.object({
      amount: z.number().positive(),
      currency: z.string().default('IDR'),
    }),
    inventory: z.array(z.object({
      warehouse_id: z.string(),
      available_stock: z.number().int().min(0),
      reserved_stock: z.number().int().min(0),
    })),
    sales_attributes: z.array(z.object({
      attribute_name: z.string(),
      attribute_value: z.string(),
    })),
  })).optional(),
  
  // TikTok attributes
  sales_attributes: z.array(z.object({
    attribute_name: z.string(),
    attribute_value: z.string(),
  })).optional(),
  
  // TikTok status
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']),
  
  // Timestamps
  created_time: z.number(),
  updated_time: z.number(),
});

// ============================================================================
// MASTER PRODUCT SCHEMA
// ============================================================================

/**
 * Platform mapping schema
 * Links master product to platform-specific data
 */
export const PlatformMappingSchema = z.object({
  platform: z.enum(['shopee', 'tiktokshop', 'website']),
  platformProductId: z.string(),
  isActive: z.boolean().default(true),
  lastSyncAt: z.date().optional(),
  syncStatus: z.enum(['synced', 'pending', 'error', 'disabled']).default('pending'),
  syncErrors: z.array(z.string()).default([]),
  
  // Platform-specific data (stored as JSONB in database)
  platformData: z.union([
    ShopeePlatformDataSchema,
    TikTokPlatformDataSchema,
    z.record(z.unknown()), // For future platforms
  ]).optional(),
});

/**
 * Master product pricing schema
 * Handles base price and platform-specific calculations
 */
export const ProductPricingSchema = z.object({
  basePrice: z.number().positive('Base price must be positive'),
  currency: z.string().default('IDR'),
  
  // Platform-specific pricing (calculated from base price + fees)
  platformPrices: z.record(z.string(), z.object({
    price: z.number().positive(),
    feePercentage: z.number().min(0).max(100),
    calculatedAt: z.date(),
  })).default({}),
  
  // Cost information
  costPrice: z.number().positive().optional(),
  profitMargin: z.number().min(0).max(100).optional(),
});

/**
 * SEO and marketing schema
 * Handles platform-specific title and description variations
 */
export const ProductSEOSchema = z.object({
  // Base SEO data
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  keywords: z.array(z.string()).default([]),
  
  // Platform-specific variations (70-80% similar, 20-30% unique)
  platformTitles: z.record(z.string(), z.object({
    title: z.string().min(1).max(120),
    similarity: z.number().min(0).max(100), // Similarity percentage to base title
    optimizedFor: z.array(z.string()).default([]), // Platform-specific keywords
    generatedAt: z.date(),
  })).default({}),
  
  platformDescriptions: z.record(z.string(), z.object({
    description: z.string().min(1).max(3000),
    optimizedFor: z.array(z.string()).default([]),
    generatedAt: z.date(),
  })).default({}),
});

/**
 * Master Product Schema
 * Central schema that unifies all product data
 */
export const MasterProductSchema = z.object({
  // Universal identifiers
  id: z.string().uuid('Must be valid UUID'),
  masterSku: z.string().min(1, 'Master SKU is required'),
  
  // Universal fields (identified in validation as common)
  name: z.string().min(1, 'Product name is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  weight: z.number().positive('Weight must be positive'),
  dimensions: DimensionsSchema,
  
  // Normalized universal data
  images: z.array(ProductImageSchema).min(1, 'At least one image is required'),
  category: ProductCategorySchema,
  brand: z.string().min(1, 'Brand is required'),
  
  // Pricing and business logic
  pricing: ProductPricingSchema,
  
  // Variants and options
  variants: z.array(ProductVariantSchema).default([]),
  hasVariants: z.boolean().default(false),
  
  // SEO and marketing
  seo: ProductSEOSchema.optional(),
  
  // Platform mappings
  platformMappings: z.array(PlatformMappingSchema).default([]),
  
  // Product status and metadata
  status: z.enum(['active', 'inactive', 'draft', 'archived']).default('draft'),
  tags: z.array(z.string()).default([]),
  
  // Inventory tracking
  totalStock: z.number().int().min(0).default(0),
  reservedStock: z.number().int().min(0).default(0),
  availableStock: z.number().int().min(0).default(0),
  
  // Quality and validation
  dataQualityScore: z.number().min(0).max(100).optional(),
  validationErrors: z.array(z.string()).default([]),
  validationWarnings: z.array(z.string()).default([]),
  
  // Timestamps and audit
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  
  // Import metadata
  importSource: z.enum(['shopee', 'tiktokshop', 'manual', 'bulk_import']).optional(),
  importedAt: z.date().optional(),
  importBatchId: z.string().optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Dimensions = z.infer<typeof DimensionsSchema>;
export type ProductImage = z.infer<typeof ProductImageSchema>;
export type ProductCategory = z.infer<typeof ProductCategorySchema>;
export type ProductVariant = z.infer<typeof ProductVariantSchema>;
export type ShopeePlatformData = z.infer<typeof ShopeePlatformDataSchema>;
export type TikTokPlatformData = z.infer<typeof TikTokPlatformDataSchema>;
export type PlatformMapping = z.infer<typeof PlatformMappingSchema>;
export type ProductPricing = z.infer<typeof ProductPricingSchema>;
export type ProductSEO = z.infer<typeof ProductSEOSchema>;
export type MasterProduct = z.infer<typeof MasterProductSchema>;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a new master product with default values
 */
export function createMasterProduct(
  baseData: Partial<MasterProduct>
): MasterProduct {
  const defaultProduct: Partial<MasterProduct> = {
    id: crypto.randomUUID(),
    status: 'draft',
    hasVariants: false,
    variants: [],
    platformMappings: [],
    tags: [],
    totalStock: 0,
    reservedStock: 0,
    availableStock: 0,
    validationErrors: [],
    validationWarnings: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return MasterProductSchema.parse({
    ...defaultProduct,
    ...baseData,
  });
}

/**
 * Add platform mapping to master product
 */
export function addPlatformMapping(
  product: MasterProduct,
  mapping: PlatformMapping
): MasterProduct {
  const updatedMappings = [...product.platformMappings, mapping];
  
  return {
    ...product,
    platformMappings: updatedMappings,
    updatedAt: new Date(),
  };
}

/**
 * Update platform-specific pricing
 */
export function updatePlatformPricing(
  product: MasterProduct,
  platform: string,
  feePercentage: number
): MasterProduct {
  const platformPrice = product.pricing.basePrice * (1 + feePercentage / 100);
  
  const updatedPlatformPrices = {
    ...product.pricing.platformPrices,
    [platform]: {
      price: Math.round(platformPrice),
      feePercentage,
      calculatedAt: new Date(),
    },
  };

  return {
    ...product,
    pricing: {
      ...product.pricing,
      platformPrices: updatedPlatformPrices,
    },
    updatedAt: new Date(),
  };
}

/**
 * Calculate total available stock from variants
 */
export function calculateTotalStock(product: MasterProduct): MasterProduct {
  if (!product.hasVariants || product.variants.length === 0) {
    return product;
  }

  const totalStock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  const reservedStock = product.variants.reduce((sum, variant) => sum + variant.reservedStock, 0);
  const availableStock = totalStock - reservedStock;

  return {
    ...product,
    totalStock,
    reservedStock,
    availableStock,
    updatedAt: new Date(),
  };
}

/**
 * Validate master product data quality
 */
export function validateProductQuality(product: MasterProduct): {
  score: number;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // Required field validation
  if (!product.name || product.name.trim().length === 0) {
    errors.push('Product name is required');
    score -= 20;
  }

  if (!product.description || product.description.trim().length < 10) {
    errors.push('Product description must be at least 10 characters');
    score -= 15;
  }

  if (product.images.length === 0) {
    errors.push('At least one product image is required');
    score -= 20;
  }

  if (product.pricing.basePrice <= 0) {
    errors.push('Base price must be greater than zero');
    score -= 25;
  }

  // Quality warnings
  if (product.description.length < 50) {
    warnings.push('Description is quite short, consider adding more details');
    score -= 5;
  }

  if (product.images.length < 3) {
    warnings.push('Consider adding more product images for better presentation');
    score -= 5;
  }

  if (!product.seo || Object.keys(product.seo.platformTitles).length === 0) {
    warnings.push('No platform-specific SEO titles generated');
    score -= 5;
  }

  if (product.platformMappings.length === 0) {
    warnings.push('No platform mappings configured');
    score -= 10;
  }

  return {
    score: Math.max(0, score),
    errors,
    warnings,
  };
}

// ============================================================================
// SCHEMA VALIDATION HELPERS
// ============================================================================

/**
 * Validate and parse master product data
 */
export function parseMasterProduct(data: unknown): MasterProduct {
  return MasterProductSchema.parse(data);
}

/**
 * Safely validate master product data
 */
export function safeParseMasterProduct(data: unknown): {
  success: boolean;
  data?: MasterProduct;
  error?: z.ZodError;
} {
  const result = MasterProductSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Get schema validation errors in human-readable format
 */
export function getValidationErrors(error: z.ZodError): string[] {
  return error.errors.map(err => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}