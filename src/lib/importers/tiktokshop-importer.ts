/**
 * TikTok Shop Product Importer for Phase 1
 * Handles product data import from TikTok Shop API with pagination and rate limiting
 */

import { TikTokShopAuth } from '@/lib/platforms/tiktokshop/tiktokshop-auth';
import { tiktokShopValidator } from '@/lib/validators/tiktokshop-validator';
import { tiktokShopDataStore } from '@/lib/storage/tiktokshop-data-store';
import type { 
  TikTokShopCredentials, 
  TikTokShopProduct, 
  TikTokShopSku,
  TikTokShopApiResponse 
} from '@/lib/platforms/tiktokshop/tiktokshop-types';

export interface TikTokShopImportResult {
  success: boolean;
  totalProducts: number;
  importedProducts: number;
  failedProducts: number;
  validatedProducts: number;
  tokopediaEnabledProducts: number;
  errors: Array<{
    productId?: string;
    error: string;
    timestamp: Date;
  }>;
  validationErrors: Array<{
    productId?: string;
    errors: string[];
    warnings: string[];
  }>;
  duration: number;
  startTime: Date;
  endTime: Date;
  tokopediaIncluded?: boolean; // Special flag for Tokopedia integration
  sessionId: string;
}

export interface TikTokShopImportOptions {
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  rateLimitDelay?: number;
  includeVariants?: boolean;
  includeTokopedia?: boolean; // Flag to include Tokopedia products
  onProgress?: (progress: {
    current: number;
    total: number;
    percentage: number;
    currentProduct?: string;
  }) => void;
}

export interface TikTokShopProductWithVariants extends TikTokShopProduct {
  variants?: TikTokShopSku[];
}

export class TikTokShopImporter {
  private auth: TikTokShopAuth;
  private credentials: TikTokShopCredentials;
  private options: Required<TikTokShopImportOptions>;
  private baseUrl: string;

  constructor(
    credentials: TikTokShopCredentials,
    options: TikTokShopImportOptions = {}
  ) {
    this.credentials = credentials;
    this.baseUrl = 'https://open-api.tiktokglobalshop.com';
    this.auth = new TikTokShopAuth(credentials, { baseUrl: this.baseUrl });
    this.options = {
      batchSize: options.batchSize || 50,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      rateLimitDelay: options.rateLimitDelay || 100,
      includeVariants: options.includeVariants ?? true,
      includeTokopedia: options.includeTokopedia ?? true,
      onProgress: options.onProgress || (() => {}),
    };
  }

  /**
   * Import all products from TikTok Shop with validation and storage
   */
  async importProducts(): Promise<TikTokShopImportResult> {
    const startTime = new Date();
    const sessionId = `tiktok_${Date.now()}`;
    
    const result: TikTokShopImportResult = {
      success: false,
      totalProducts: 0,
      importedProducts: 0,
      failedProducts: 0,
      validatedProducts: 0,
      tokopediaEnabledProducts: 0,
      errors: [],
      validationErrors: [],
      duration: 0,
      startTime,
      endTime: new Date(),
      tokopediaIncluded: this.options.includeTokopedia,
      sessionId,
    };

    try {
      // Initialize data store
      await tiktokShopDataStore.initialize();
      tiktokShopDataStore.logProgress('info', 'Starting TikTok Shop product import', {
        sessionId,
        tokopediaFlag: this.options.includeTokopedia,
      });
      
      // Step 1: Authenticate
      const authResult = await this.auth.authenticate();
      if (!authResult.success) {
        throw new Error(`Authentication failed: ${authResult.error?.message}`);
      }

      tiktokShopDataStore.logProgress('info', 'Authentication successful');

      // Step 2: Get product list with pagination
      const productIds = await this.fetchAllProductIds();
      result.totalProducts = productIds.length;
      
      tiktokShopDataStore.logProgress('info', `Found ${productIds.length} products to import`, {
        sessionId,
        progress: {
          current: 0,
          total: productIds.length,
          percentage: 0,
        },
      });
      
      if (productIds.length === 0) {
        result.success = true;
        result.endTime = new Date();
        result.duration = result.endTime.getTime() - startTime.getTime();
        return result;
      }

      // Step 3: Import, validate, and store products in batches
      const products: TikTokShopProductWithVariants[] = [];
      
      for (let i = 0; i < productIds.length; i += this.options.batchSize) {
        const batch = productIds.slice(i, i + this.options.batchSize);
        
        try {
          const batchProducts = await this.importProductBatch(batch);
          
          // Validate and store each product
          for (const product of batchProducts) {
            try {
              // Add Tokopedia flag to product data
              const productWithTokopedia = {
                ...product,
                include_tokopedia: this.options.includeTokopedia,
              };

              // Validate product
              const validationResult = tiktokShopValidator.validateProduct(productWithTokopedia);
              
              if (validationResult.isValid) {
                result.validatedProducts++;
                
                if (validationResult.tokopediaFlag) {
                  result.tokopediaEnabledProducts++;
                }

                // Store validated product
                await tiktokShopDataStore.storeProduct(
                  product.id,
                  validationResult.data,
                  {
                    sessionId,
                    batchId: `batch_${Math.floor(i / this.options.batchSize)}`,
                  }
                );

                // Store variants if available
                if (product.variants && product.variants.length > 0) {
                  for (const variant of product.variants) {
                    const variantValidation = tiktokShopValidator.validateVariant(variant);
                    
                    if (variantValidation.isValid) {
                      await tiktokShopDataStore.storeVariant(
                        product.id,
                        variant.id,
                        variantValidation.data,
                        {
                          sessionId,
                          batchId: `batch_${Math.floor(i / this.options.batchSize)}`,
                        }
                      );
                    } else {
                      result.validationErrors.push({
                        productId: product.id,
                        errors: variantValidation.errors,
                        warnings: variantValidation.warnings,
                      });
                    }
                  }
                }

                if (validationResult.warnings.length > 0) {
                  tiktokShopDataStore.logProgress('warn', `Product ${product.id} has warnings`, {
                    productId: product.id,
                    tokopediaFlag: validationResult.tokopediaFlag,
                  });
                }

              } else {
                result.validationErrors.push({
                  productId: product.id,
                  errors: validationResult.errors,
                  warnings: validationResult.warnings,
                });
                
                tiktokShopDataStore.logProgress('error', `Product ${product.id} validation failed`, {
                  productId: product.id,
                });
              }

            } catch (validationError) {
              tiktokShopDataStore.logProgress('error', `Failed to validate/store product ${product.id}: ${validationError}`, {
                productId: product.id,
              });
              
              result.errors.push({
                productId: product.id,
                error: `Validation/storage failed: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`,
                timestamp: new Date(),
              });
            }
          }

          products.push(...batchProducts);
          result.importedProducts += batchProducts.length;
          
          // Store batch data
          await tiktokShopDataStore.storeBatch(
            `batch_${Math.floor(i / this.options.batchSize)}`,
            batchProducts,
            { sessionId }
          );
          
          // Report progress
          const currentProgress = Math.min(i + this.options.batchSize, productIds.length);
          this.options.onProgress({
            current: currentProgress,
            total: productIds.length,
            percentage: Math.round((currentProgress / productIds.length) * 100),
            currentProduct: batchProducts[0]?.title,
          });

          tiktokShopDataStore.logProgress('info', `Processed batch ${Math.floor(i / this.options.batchSize) + 1}`, {
            sessionId,
            batchId: `batch_${Math.floor(i / this.options.batchSize)}`,
            progress: {
              current: currentProgress,
              total: productIds.length,
              percentage: Math.round((currentProgress / productIds.length) * 100),
            },
          });
          
          // Rate limiting between batches
          if (i + this.options.batchSize < productIds.length) {
            await this.delay(this.options.rateLimitDelay);
          }
          
        } catch (error) {
          tiktokShopDataStore.logProgress('error', `Batch import failed for products ${i}-${i + batch.length}: ${error}`, {
            sessionId,
            batchId: `batch_${Math.floor(i / this.options.batchSize)}`,
          });
          
          result.failedProducts += batch.length;
          result.errors.push({
            error: `Batch import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
          });
        }
      }

      // Step 4: Store session data
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();
      
      await tiktokShopDataStore.storeImportSession(sessionId, {
        startTime: result.startTime,
        endTime: result.endTime,
        totalProducts: result.totalProducts,
        successCount: result.validatedProducts,
        errorCount: result.failedProducts,
        tokopediaEnabledCount: result.tokopediaEnabledProducts,
        errors: result.errors,
        configuration: this.options,
      });

      // Save progress logs
      await tiktokShopDataStore.saveProgressLogs(sessionId);

      tiktokShopDataStore.logProgress('info', `TikTok Shop import completed`, {
        sessionId,
        progress: {
          current: result.importedProducts,
          total: result.totalProducts,
          percentage: 100,
        },
      });

      if (this.options.includeTokopedia) {
        tiktokShopDataStore.logProgress('info', `Tokopedia integration: ${result.tokopediaEnabledProducts} products enabled`, {
          sessionId,
          tokopediaFlag: true,
        });
      }
      
      result.success = result.validatedProducts > 0;
      
      return result;

    } catch (error) {
      tiktokShopDataStore.logProgress('error', `TikTok Shop import failed: ${error}`, {
        sessionId,
      });
      
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
  private async fetchAllProductIds(): Promise<string[]> {
    const productIds: string[] = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 100; // TikTok Shop API page size

    while (hasMore) {
      try {
        const path = '/api/products/search';
        const params = this.auth.signRequest(path, {
          page: page.toString(),
          page_size: pageSize.toString(),
          ...(this.options.includeTokopedia ? { include_tokopedia: 'true' } : {}),
        });

        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`${this.baseUrl}${path}?${queryString}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: TikTokShopApiResponse<{
          products: Array<{ product_id: string; product_name: string }>;
          total: number;
          more: boolean;
        }> = await response.json();

        if (data.code !== 0 || !data.data) {
          throw new Error(`API Error ${data.code}: ${data.message}`);
        }

        const products = data.data.products || [];
        productIds.push(...products.map(p => p.product_id));
        
        hasMore = data.data.more || false;
        page++;
        
        console.log(`📄 Fetched page ${page - 1} with ${products.length} products (total: ${productIds.length})`);

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
  private async importProductBatch(productIds: string[]): Promise<TikTokShopProductWithVariants[]> {
    const products: TikTokShopProductWithVariants[] = [];

    for (const productId of productIds) {
      try {
        // Get product details
        const product = await this.fetchProductDetails(productId);
        
        // Get variants if product has SKUs and variants are enabled
        if (this.options.includeVariants && product.skus && product.skus.length > 0) {
          const variants = await this.fetchProductVariants(productId);
          product.variants = variants;
        }

        products.push(product);
        
        // Rate limiting between products
        await this.delay(this.options.rateLimitDelay);

      } catch (error) {
        console.error(`❌ Failed to import product ${productId}:`, error);
        throw error;
      }
    }

    return products;
  }

  /**
   * Fetch detailed product information
   */
  private async fetchProductDetails(productId: string): Promise<TikTokShopProduct> {
    return this.retryOperation(async () => {
      const path = '/api/products/details';
      const params = this.auth.signRequest(path, {
        product_ids: productId,
      });

      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${this.baseUrl}${path}?${queryString}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: TikTokShopApiResponse<{
        products: TikTokShopProduct[];
      }> = await response.json();

      if (data.code !== 0 || !data.data?.products?.[0]) {
        throw new Error(`Product ${productId} not found in response`);
      }

      return data.data.products[0];
    });
  }

  /**
   * Fetch product variants/SKUs
   */
  private async fetchProductVariants(productId: string): Promise<TikTokShopSku[]> {
    return this.retryOperation(async () => {
      const path = '/api/products/skus';
      const params = this.auth.signRequest(path, {
        product_id: productId,
      });

      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${this.baseUrl}${path}?${queryString}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: TikTokShopApiResponse<{
        skus: TikTokShopSku[];
      }> = await response.json();

      if (data.code !== 0) {
        throw new Error(`Failed to fetch variants for product ${productId}`);
      }

      return data.data?.skus || [];
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
      const authResult = await this.auth.authenticate();
      
      if (authResult.success) {
        // Test with a simple API call
        const path = '/api/shop/get_authorized_shop';
        const params = this.auth.signRequest(path);
        const queryString = new URLSearchParams(params).toString();
        
        const response = await fetch(`${this.baseUrl}${path}?${queryString}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          return { valid: true };
        } else {
          return { valid: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }
      } else {
        return { valid: false, error: authResult.error?.message || 'Authentication failed' };
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
    tokopediaEnabled: boolean;
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
        tokopediaEnabled: this.options.includeTokopedia,
      };
    } catch (error) {
      throw new Error(`Failed to get import stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Factory function to create TikTok Shop importer
 */
export function createTikTokShopImporter(
  credentials: TikTokShopCredentials,
  options?: TikTokShopImportOptions
): TikTokShopImporter {
  return new TikTokShopImporter(credentials, options);
}

/**
 * Quick import function for testing
 */
export async function quickTikTokShopImport(
  credentials: TikTokShopCredentials,
  maxProducts = 10
): Promise<TikTokShopImportResult> {
  const importer = createTikTokShopImporter(credentials, {
    batchSize: Math.min(maxProducts, 10),
    onProgress: (progress) => {
      console.log(`📊 Progress: ${progress.percentage}% (${progress.current}/${progress.total})`);
    },
  });

  return importer.importProducts();
}