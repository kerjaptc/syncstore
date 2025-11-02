/**
 * SyncStore MVP Product Fetching Service
 * 
 * This service handles fetching products from Shopee API, data transformation,
 * validation, and sanitization with proper error handling and pagination support.
 */

import {
  Product,
  ShopeeProduct,
  FetchOptions,
  ValidationError,
  ShopeeApiError,
  createErrorContext,
  retryWithBackoff,
  validateData,
  ShopeeProductSchema,
  ProductSchema,
} from '../index';
import { ShopeeApiClient, ApiResponse } from './shopee-api-client';
import { z } from 'zod';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ProductFetchResult {
  products: Product[];
  totalCount: number;
  hasMore: boolean;
  nextOffset?: number;
  fetchedAt: Date;
  errors: string[];
}

export interface ProductFetchOptions extends FetchOptions {
  includeInactive?: boolean;
  validateData?: boolean;
  transformData?: boolean;
}

export interface ShopeeProductListResponse {
  item_list: ShopeeProduct[];
  total_count: number;
  has_next_page: boolean;
  next_offset?: number;
}

export interface ProductTransformationResult {
  product: Product;
  warnings: string[];
}

// Validation schemas
const ProductFetchOptionsSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  lastSyncAt: z.date().optional(),
  includeInactive: z.boolean().optional(),
  validateData: z.boolean().optional(),
  transformData: z.boolean().optional(),
});

const ShopeeProductListResponseSchema = z.object({
  item_list: z.array(ShopeeProductSchema),
  total_count: z.number().min(0),
  has_next_page: z.boolean(),
  next_offset: z.number().min(0).optional(),
});

// ============================================================================
// Product Data Transformer
// ============================================================================

class ProductDataTransformer {
  /**
   * Transforms Shopee product to internal Product format
   */
  transformShopeeProduct(shopeeProduct: ShopeeProduct, storeId: string): ProductTransformationResult {
    const warnings: string[] = [];
    
    try {
      // Validate input
      const validatedShopeeProduct = validateData(
        ShopeeProductSchema,
        shopeeProduct,
        'ShopeeProduct'
      );

      // Transform basic fields
      const product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
        storeId,
        platformProductId: validatedShopeeProduct.item_id.toString(),
        name: this.sanitizeProductName(validatedShopeeProduct.item_name),
        description: this.sanitizeDescription(validatedShopeeProduct.description),
        sku: this.sanitizeSku(validatedShopeeProduct.item_sku),
        price: this.transformPrice(validatedShopeeProduct.price),
        stock: Math.max(0, validatedShopeeProduct.stock), // Ensure non-negative
        images: this.transformImages(validatedShopeeProduct.images),
        status: this.transformStatus(validatedShopeeProduct.item_status),
        lastSyncAt: new Date(),
      };

      // Add warnings for data quality issues
      if (product.name.length > 200) {
        warnings.push('Product name is very long and may be truncated in some displays');
      }
      
      if (product.images.length === 0) {
        warnings.push('Product has no images');
      }
      
      if (product.price === 0) {
        warnings.push('Product price is zero');
      }
      
      if (!product.sku || product.sku.trim() === '') {
        warnings.push('Product has no SKU');
      }

      // Generate ID and timestamps
      const transformedProduct: Product = {
        ...product,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate final product
      validateData(ProductSchema, transformedProduct, 'TransformedProduct');

      return {
        product: transformedProduct,
        warnings,
      };

    } catch (error) {
      const context = createErrorContext('transformShopeeProduct', {
        shopeeProductId: shopeeProduct?.item_id,
        storeId,
      });
      
      throw new ValidationError(
        `Product transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'shopeeProduct',
        shopeeProduct,
        context
      );
    }
  }

  /**
   * Sanitizes product name
   */
  private sanitizeProductName(name: string): string {
    if (!name || typeof name !== 'string') {
      return 'Untitled Product';
    }
    
    return name
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .substring(0, 500); // Limit length
  }

  /**
   * Sanitizes product description
   */
  private sanitizeDescription(description?: string): string | undefined {
    if (!description || typeof description !== 'string') {
      return undefined;
    }
    
    return description
      .trim()
      .substring(0, 5000); // Limit length
  }

  /**
   * Sanitizes SKU
   */
  private sanitizeSku(sku: string): string {
    if (!sku || typeof sku !== 'string') {
      return '';
    }
    
    return sku
      .trim()
      .replace(/[^a-zA-Z0-9\-_]/g, '') // Remove special characters
      .substring(0, 255); // Limit length
  }

  /**
   * Transforms price to ensure it's a valid number
   */
  private transformPrice(price: number): number {
    if (typeof price !== 'number' || isNaN(price) || price < 0) {
      return 0;
    }
    
    // Round to 2 decimal places
    return Math.round(price * 100) / 100;
  }

  /**
   * Transforms and validates image URLs
   */
  private transformImages(images: string[]): string[] {
    if (!Array.isArray(images)) {
      return [];
    }
    
    return images
      .filter(url => typeof url === 'string' && url.trim() !== '')
      .map(url => url.trim())
      .filter(url => this.isValidImageUrl(url))
      .slice(0, 10); // Limit to 10 images
  }

  /**
   * Validates image URL
   */
  private isValidImageUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Transforms Shopee item status to internal status
   */
  private transformStatus(itemStatus: string): 'active' | 'inactive' {
    return itemStatus === 'NORMAL' ? 'active' : 'inactive';
  }
}

// ============================================================================
// Product Fetcher Service
// ============================================================================

export class ProductFetcherService {
  private apiClient: ShopeeApiClient;
  private transformer: ProductDataTransformer;

  constructor(apiClient: ShopeeApiClient) {
    this.apiClient = apiClient;
    this.transformer = new ProductDataTransformer();
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Fetches all products from a store with pagination
   */
  async fetchAllProducts(
    storeId: string,
    accessToken: string,
    shopId: string,
    options: ProductFetchOptions = {}
  ): Promise<ProductFetchResult> {
    try {
      if (!storeId) {
        throw new ValidationError('Store ID is required', 'storeId');
      }
      if (!accessToken) {
        throw new ValidationError('Access token is required', 'accessToken');
      }
      if (!shopId) {
        throw new ValidationError('Shop ID is required', 'shopId');
      }

      // Validate options
      const validatedOptions = validateData(
        ProductFetchOptionsSchema,
        options,
        'ProductFetchOptions'
      );

      const allProducts: Product[] = [];
      const allErrors: string[] = [];
      let offset = validatedOptions.offset || 0;
      let hasMore = true;
      let totalCount = 0;

      while (hasMore) {
        try {
          const batchResult = await this.fetchProductBatch(
            storeId,
            accessToken,
            shopId,
            {
              ...validatedOptions,
              offset,
            }
          );

          allProducts.push(...batchResult.products);
          allErrors.push(...batchResult.errors);
          
          if (batchResult.totalCount > totalCount) {
            totalCount = batchResult.totalCount;
          }

          hasMore = batchResult.hasMore;
          offset = batchResult.nextOffset || offset + batchResult.products.length;

          // Respect limit if specified
          if (validatedOptions.limit && allProducts.length >= validatedOptions.limit) {
            break;
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          allErrors.push(`Batch fetch error at offset ${offset}: ${errorMessage}`);
          
          // Continue with next batch if this one fails
          offset += validatedOptions.limit || 50;
          
          // Stop if too many consecutive errors
          if (allErrors.length > 5) {
            break;
          }
        }
      }

      return {
        products: allProducts,
        totalCount,
        hasMore: hasMore && (!validatedOptions.limit || allProducts.length < validatedOptions.limit),
        nextOffset: hasMore ? offset : undefined,
        fetchedAt: new Date(),
        errors: allErrors,
      };

    } catch (error) {
      const context = createErrorContext('fetchAllProducts', {
        storeId,
        shopId,
        options,
      });
      
      throw new ShopeeApiError(
        `Failed to fetch products: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PRODUCT_FETCH_FAILED',
        undefined,
        undefined,
        context
      );
    }
  }

  /**
   * Fetches a single product by ID
   */
  async fetchProduct(
    storeId: string,
    accessToken: string,
    shopId: string,
    productId: string
  ): Promise<Product> {
    try {
      if (!storeId) {
        throw new ValidationError('Store ID is required', 'storeId');
      }
      if (!accessToken) {
        throw new ValidationError('Access token is required', 'accessToken');
      }
      if (!shopId) {
        throw new ValidationError('Shop ID is required', 'shopId');
      }
      if (!productId) {
        throw new ValidationError('Product ID is required', 'productId');
      }

      // Fetch product details from Shopee API
      const response = await retryWithBackoff(
        async () => {
          return await this.apiClient.get<ShopeeProduct>(
            `/api/v2/product/get_item_base_info`,
            accessToken,
            shopId
          );
        },
        3,
        1000
      );

      // Transform the product
      const transformResult = this.transformer.transformShopeeProduct(
        response.data,
        storeId
      );

      return transformResult.product;

    } catch (error) {
      const context = createErrorContext('fetchProduct', {
        storeId,
        shopId,
        productId,
      });
      
      if (error instanceof ValidationError || error instanceof ShopeeApiError) {
        throw error;
      }
      
      throw new ShopeeApiError(
        `Failed to fetch product: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SINGLE_PRODUCT_FETCH_FAILED',
        undefined,
        undefined,
        context
      );
    }
  }

  /**
   * Validates product data without transformation
   */
  async validateProductData(productData: any): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate as Shopee product
      validateData(ShopeeProductSchema, productData, 'ShopeeProduct');
      
      // Additional business logic validation
      if (productData.price <= 0) {
        warnings.push('Product price is zero or negative');
      }
      
      if (!productData.item_sku || productData.item_sku.trim() === '') {
        warnings.push('Product has no SKU');
      }
      
      if (!productData.images || productData.images.length === 0) {
        warnings.push('Product has no images');
      }
      
      if (productData.item_name && productData.item_name.length > 200) {
        warnings.push('Product name is very long');
      }

      return {
        isValid: true,
        errors,
        warnings,
      };

    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      } else {
        errors.push('Unknown validation error');
      }

      return {
        isValid: false,
        errors,
        warnings,
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Fetches a batch of products with pagination
   */
  private async fetchProductBatch(
    storeId: string,
    accessToken: string,
    shopId: string,
    options: ProductFetchOptions
  ): Promise<ProductFetchResult> {
    const limit = Math.min(options.limit || 50, 100); // Shopee API limit
    const offset = options.offset || 0;

    // Build API path with parameters
    const path = `/api/v2/product/get_item_list`;
    
    // Make API call
    const response = await this.apiClient.post<ShopeeProductListResponse>(
      path,
      {
        offset,
        page_size: limit,
        item_status: options.includeInactive ? ['NORMAL', 'DELETED', 'BANNED'] : ['NORMAL'],
        update_time_from: options.lastSyncAt ? Math.floor(options.lastSyncAt.getTime() / 1000) : undefined,
      },
      accessToken,
      shopId
    );

    // Validate response
    const validatedResponse = validateData(
      ShopeeProductListResponseSchema,
      response.data,
      'ShopeeProductListResponse'
    );

    // Transform products
    const products: Product[] = [];
    const errors: string[] = [];

    for (const shopeeProduct of validatedResponse.item_list) {
      try {
        const transformResult = this.transformer.transformShopeeProduct(
          shopeeProduct,
          storeId
        );
        
        products.push(transformResult.product);
        
        // Log warnings
        if (transformResult.warnings.length > 0) {
          errors.push(
            `Product ${shopeeProduct.item_id} warnings: ${transformResult.warnings.join(', ')}`
          );
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to transform product ${shopeeProduct.item_id}: ${errorMessage}`);
      }
    }

    return {
      products,
      totalCount: validatedResponse.total_count,
      hasMore: validatedResponse.has_next_page,
      nextOffset: validatedResponse.next_offset,
      fetchedAt: new Date(),
      errors,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates ProductFetcherService with API client
 */
export function createProductFetcherService(apiClient: ShopeeApiClient): ProductFetcherService {
  return new ProductFetcherService(apiClient);
}

/**
 * Utility function to sanitize product data for safe storage
 */
export function sanitizeProductForStorage(product: Product): Product {
  return {
    ...product,
    name: product.name.trim().substring(0, 500),
    description: product.description?.trim().substring(0, 5000),
    sku: product.sku.trim().substring(0, 255),
    price: Math.max(0, Math.round(product.price * 100) / 100),
    stock: Math.max(0, Math.floor(product.stock)),
    images: product.images.slice(0, 10), // Limit to 10 images
  };
}