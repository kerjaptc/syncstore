/**
 * Shopee Product Importer for Phase 1
 * Handles product data import from Shopee API with pagination and rate limiting
 */

import { createShopeeOAuth } from '@/lib/shopee/oauth';
import type { ShopeeOAuth } from '@/lib/shopee/oauth';

export interface ShopeeProduct {
  item_id: number;
  category_id: number;
  item_name: string;
  description: string;
  item_sku?: string;
  create_time: number;
  update_time: number;
  attribute_list: Array<{
    attribute_id: number;
    attribute_name: string;
    attribute_value: string;
  }>;
  image: {
    image_url_list: string[];
    image_id_list: string[];
  };
  weight: number;
  dimension: {
    package_length: number;
    package_width: number;
    package_height: number;
  };
  logistic_info: Array<{
    logistic_id: number;
    logistic_name: string;
    enabled: boolean;
  }>;
  pre_order: {
    is_pre_order: boolean;
    days_to_ship: number;
  };
  item_status: string;
  has_model: boolean;
  promotion_id: number;
  brand: {
    brand_id: number;
    original_brand_name: string;
  };
  item_dangerous: number;
  complaint_policy: {
    warranty_time: number;
    exclude_entrepreneur_warranty: boolean;
  };
}

export interface ShopeeVariant {
  model_id: number;
  promotion_id: number;
  tier_index: number[];
  normal_stock: number;
  reserved_stock: number;
  price: number;
  model_sku: string;
  create_time: number;
  update_time: number;
}

export interface ShopeeImportResult {
  success: boolean;
  totalProducts: number;
  importedProducts: number;
  failedProducts: number;
  errors: Array<{
    itemId?: number;
    error: string;
    timestamp: Date;
  }>;
  duration: number;
  startTime: Date;
  endTime: Date;
}

export interface ShopeeImportOptions {
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  rateLimitDelay?: number;
  includeVariants?: boolean;
  onProgress?: (progress: {
    current: number;
    total: number;
    percentage: number;
    currentProduct?: string;
  }) => void;
}

export class ShopeeImporter {
  private oauth: ShopeeOAuth;
  private accessToken: string;
  private shopId: string;
  private options: Required<ShopeeImportOptions>;

  constructor(
    accessToken: string,
    shopId: string,
    options: ShopeeImportOptions = {}
  ) {
    this.oauth = createShopeeOAuth();
    this.accessToken = accessToken;
    this.shopId = shopId;
    this.options = {
      batchSize: options.batchSize || 50,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      rateLimitDelay: options.rateLimitDelay || 100,
      includeVariants: options.includeVariants ?? true,
      onProgress: options.onProgress || (() => {}),
    };
  }

  /**
   * Import all products from Shopee
   */
  async importProducts(): Promise<ShopeeImportResult> {
    const startTime = new Date();
    const result: ShopeeImportResult = {
      success: false,
      totalProducts: 0,
      importedProducts: 0,
      failedProducts: 0,
      errors: [],
      duration: 0,
      startTime,
      endTime: new Date(),
    };

    try {
      console.log('🔄 Starting Shopee product import...');
      
      // Step 1: Get product list with pagination
      const productIds = await this.fetchAllProductIds();
      result.totalProducts = productIds.length;
      
      console.log(`📦 Found ${productIds.length} products to import`);
      
      if (productIds.length === 0) {
        result.success = true;
        result.endTime = new Date();
        result.duration = result.endTime.getTime() - startTime.getTime();
        return result;
      }

      // Step 2: Import products in batches
      const products: (ShopeeProduct & { variants?: ShopeeVariant[] })[] = [];
      
      for (let i = 0; i < productIds.length; i += this.options.batchSize) {
        const batch = productIds.slice(i, i + this.options.batchSize);
        
        try {
          const batchProducts = await this.importProductBatch(batch);
          products.push(...batchProducts);
          result.importedProducts += batchProducts.length;
          
          // Report progress
          this.options.onProgress({
            current: Math.min(i + this.options.batchSize, productIds.length),
            total: productIds.length,
            percentage: Math.round((Math.min(i + this.options.batchSize, productIds.length) / productIds.length) * 100),
            currentProduct: batchProducts[0]?.item_name,
          });
          
          // Rate limiting between batches
          if (i + this.options.batchSize < productIds.length) {
            await this.delay(this.options.rateLimitDelay);
          }
          
        } catch (error) {
          console.error(`❌ Batch import failed for items ${i}-${i + batch.length}:`, error);
          result.failedProducts += batch.length;
          result.errors.push({
            error: `Batch import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
          });
        }
      }

      // Step 3: Store imported data (for now, just log)
      console.log(`✅ Import completed: ${result.importedProducts}/${result.totalProducts} products`);
      
      result.success = result.importedProducts > 0;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();
      
      return result;

    } catch (error) {
      console.error('❌ Shopee import failed:', error);
      result.errors.push({
        error: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();
      return result;
    }
  }

  /**
   * Fetch all product IDs with pagination
   */
  private async fetchAllProductIds(): Promise<number[]> {
    const productIds: number[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.oauth.makeApiCall(
          '/api/v2/product/get_item_list',
          this.accessToken,
          this.shopId,
          'GET'
        );

        if (response.response?.item) {
          const items = response.response.item;
          productIds.push(...items.map((item: any) => item.item_id));
          
          // Check if there are more pages
          hasMore = response.response.has_next_page || false;
          offset += items.length;
          
          console.log(`📄 Fetched page with ${items.length} products (total: ${productIds.length})`);
        } else {
          hasMore = false;
        }

        // Rate limiting between API calls
        await this.delay(this.options.rateLimitDelay);

      } catch (error) {
        console.error('❌ Failed to fetch product list:', error);
        throw error;
      }
    }

    return productIds;
  }

  /**
   * Import a batch of products with details and variants
   */
  private async importProductBatch(itemIds: number[]): Promise<(ShopeeProduct & { variants?: ShopeeVariant[] })[]> {
    const products: (ShopeeProduct & { variants?: ShopeeVariant[] })[] = [];

    for (const itemId of itemIds) {
      try {
        // Get product details
        const product = await this.fetchProductDetails(itemId);
        
        // Get variants if product has models
        if (this.options.includeVariants && product.has_model) {
          const variants = await this.fetchProductVariants(itemId);
          product.variants = variants;
        }

        products.push(product);
        
        // Rate limiting between products
        await this.delay(this.options.rateLimitDelay);

      } catch (error) {
        console.error(`❌ Failed to import product ${itemId}:`, error);
        throw error;
      }
    }

    return products;
  }

  /**
   * Fetch detailed product information
   */
  private async fetchProductDetails(itemId: number): Promise<ShopeeProduct> {
    return this.retryOperation(async () => {
      const response = await this.oauth.makeApiCall(
        '/api/v2/product/get_item_base_info',
        this.accessToken,
        this.shopId,
        'POST',
        { item_id_list: [itemId] }
      );

      if (response.response?.item_list?.[0]) {
        return response.response.item_list[0];
      } else {
        throw new Error(`Product ${itemId} not found in response`);
      }
    });
  }

  /**
   * Fetch product variants/models
   */
  private async fetchProductVariants(itemId: number): Promise<ShopeeVariant[]> {
    return this.retryOperation(async () => {
      const response = await this.oauth.makeApiCall(
        '/api/v2/product/get_model_list',
        this.accessToken,
        this.shopId,
        'POST',
        { item_id: itemId }
      );

      if (response.response?.model) {
        return response.response.model;
      } else {
        return [];
      }
    });
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === this.options.maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
        console.warn(`⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await this.delay(delay);
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate API credentials and connection
   */
  async validateConnection(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await this.oauth.getShopInfo(this.accessToken, this.shopId);
      
      if (response.shop_name) {
        return { valid: true };
      } else {
        return { valid: false, error: 'Invalid shop information received' };
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Connection validation failed'
      };
    }
  }

  /**
   * Get import statistics
   */
  async getImportStats(): Promise<{
    totalProducts: number;
    productsWithVariants: number;
    estimatedImportTime: number;
  }> {
    try {
      const productIds = await this.fetchAllProductIds();
      const totalProducts = productIds.length;
      
      // Estimate import time based on rate limits and batch size
      const estimatedApiCalls = totalProducts * (this.options.includeVariants ? 2 : 1);
      const estimatedTime = (estimatedApiCalls * this.options.rateLimitDelay) / 1000; // seconds
      
      return {
        totalProducts,
        productsWithVariants: 0, // Would need to check each product
        estimatedImportTime: estimatedTime,
      };
    } catch (error) {
      throw new Error(`Failed to get import stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Factory function to create Shopee importer
 */
export function createShopeeImporter(
  accessToken: string,
  shopId: string,
  options?: ShopeeImportOptions
): ShopeeImporter {
  return new ShopeeImporter(accessToken, shopId, options);
}

/**
 * Quick import function for testing
 */
export async function quickShopeeImport(
  accessToken: string,
  shopId: string,
  maxProducts = 10
): Promise<ShopeeImportResult> {
  const importer = createShopeeImporter(accessToken, shopId, {
    batchSize: Math.min(maxProducts, 10),
    onProgress: (progress) => {
      console.log(`📊 Progress: ${progress.percentage}% (${progress.current}/${progress.total})`);
    },
  });

  return importer.importProducts();
}