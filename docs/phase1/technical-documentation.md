# SyncStore Phase 1 - Technical Documentation

**Version:** 1.0.0  
**Date:** November 2, 2025  
**Status:** Complete  

---

## Table of Contents

1. [System Overview](#system-overview)
2. [API Integration Patterns](#api-integration-patterns)
3. [Error Handling](#error-handling)
4. [Data Transformation](#data-transformation)
5. [Database Schema](#database-schema)
6. [Performance Optimization](#performance-optimization)
7. [Testing Framework](#testing-framework)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Deployment Guide](#deployment-guide)
10. [Maintenance Procedures](#maintenance-procedures)

---

## System Overview

### Architecture Components

SyncStore Phase 1 implements a comprehensive data import and master schema system with the following key components:

```mermaid
graph TB
    subgraph "Import Layer"
        SI[Shopee Importer]
        TI[TikTok Importer]
        VL[Validation Layer]
    end
    
    subgraph "Processing Layer"
        DA[Data Analyzer]
        FM[Field Mapper]
        DT[Data Transformer]
    end
    
    subgraph "Storage Layer"
        RDS[Raw Data Store]
        MC[Master Catalog]
        PM[Platform Mappings]
    end
    
    subgraph "Business Logic"
        PC[Pricing Calculator]
        SG[SEO Generator]
        QV[Quality Validator]
    end
    
    SI --> VL
    TI --> VL
    VL --> RDS
    RDS --> DA
    DA --> FM
    FM --> DT
    DT --> MC
    DT --> PM
    PC --> MC
    SG --> MC
    QV --> MC
```

### Core Technologies

- **Runtime:** Node.js 18+
- **Language:** TypeScript 5.0+
- **Database:** PostgreSQL with Prisma ORM
- **Testing:** Vitest
- **Build Tool:** Next.js
- **Package Manager:** npm

---

## API Integration Patterns

### Shopee API Integration

#### Authentication Pattern

```typescript
interface ShopeeAuthConfig {
  partnerId: string;
  partnerKey: string;
  shopId: string;
  accessToken?: string;
  refreshToken?: string;
}

class ShopeeAPIClient {
  private generateSignature(params: Record<string, any>, timestamp: number): string {
    const baseString = `${this.config.partnerId}${this.apiPath}${timestamp}${this.config.accessToken}${this.config.shopId}`;
    return crypto.createHmac('sha256', this.config.partnerKey)
      .update(baseString)
      .digest('hex');
  }

  private async makeRequest<T>(endpoint: string, params: Record<string, any>): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(params, timestamp);
    
    const url = new URL(`${this.baseURL}${endpoint}`);
    url.searchParams.append('partner_id', this.config.partnerId);
    url.searchParams.append('timestamp', timestamp.toString());
    url.searchParams.append('access_token', this.config.accessToken);
    url.searchParams.append('shop_id', this.config.shopId);
    url.searchParams.append('sign', signature);
    
    // Add request parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value.toString());
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new APIError(`Shopee API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}
```

#### Pagination Pattern

```typescript
class ShopeeImporter {
  async importAllProducts(): Promise<ImportResult> {
    const allProducts: ShopeeProduct[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.apiClient.getItemList({
          offset,
          page_size: limit
        });

        if (response.item_list && response.item_list.length > 0) {
          allProducts.push(...response.item_list);
          offset += limit;
          
          // Check if we've reached the end
          hasMore = response.item_list.length === limit && response.has_next_page;
          
          // Rate limiting
          await this.rateLimiter.wait();
          
        } else {
          hasMore = false;
        }

      } catch (error) {
        if (this.isRetryableError(error)) {
          await this.exponentialBackoff(offset / limit);
          continue;
        }
        throw error;
      }
    }

    return {
      success: true,
      totalProducts: allProducts.length,
      products: allProducts
    };
  }
}
```

### TikTok Shop API Integration

#### OAuth Flow Pattern

```typescript
class TikTokShopAuth {
  async getAuthorizationUrl(): Promise<string> {
    const params = new URLSearchParams({
      app_key: this.config.appKey,
      state: this.generateState(),
      redirect_uri: this.config.redirectUri,
      response_type: 'code'
    });

    return `${this.authBaseURL}/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, state: string): Promise<TokenResponse> {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      app_key: this.config.appKey,
      app_secret: this.config.appSecret,
      auth_code: code,
      grant_type: 'authorized_code'
    };

    const signature = this.generateSignature('/api/v2/token/get', params, timestamp);

    const response = await fetch(`${this.apiBaseURL}/api/v2/token/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        timestamp,
        sign: signature
      })
    });

    const result = await response.json();
    
    if (result.code !== 0) {
      throw new AuthError(`TikTok Shop auth error: ${result.message}`);
    }

    return result.data;
  }
}
```

#### Product Import Pattern

```typescript
class TikTokImporter {
  async importProducts(): Promise<ImportResult> {
    const products: TikTokProduct[] = [];
    let pageToken = '';
    const pageSize = 50;

    do {
      try {
        const response = await this.apiClient.searchProducts({
          page_size: pageSize,
          page_token: pageToken,
          include_tokopedia: true // Include Tokopedia integration
        });

        if (response.products) {
          products.push(...response.products);
          pageToken = response.next_page_token || '';
        }

        // Handle rate limiting
        await this.rateLimiter.wait();

      } catch (error) {
        if (this.shouldRetry(error)) {
          await this.backoffDelay();
          continue;
        }
        throw error;
      }
    } while (pageToken);

    return {
      success: true,
      totalProducts: products.length,
      products
    };
  }
}
```

### Rate Limiting Implementation

```typescript
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly timeWindow: number;

  constructor(maxRequests: number = 100, timeWindowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMs;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    
    // Remove old requests outside the time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.timeWindow - (now - oldestRequest);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    this.requests.push(now);
  }
}
```

---

## Error Handling

### Error Classification System

```typescript
enum ErrorType {
  // API Errors
  API_CONNECTION_ERROR = 'api_connection_error',
  API_AUTHENTICATION_ERROR = 'api_authentication_error',
  API_RATE_LIMIT_ERROR = 'api_rate_limit_error',
  API_QUOTA_EXCEEDED = 'api_quota_exceeded',
  
  // Data Errors
  DATA_VALIDATION_ERROR = 'data_validation_error',
  DATA_TRANSFORMATION_ERROR = 'data_transformation_error',
  DATA_PARSING_ERROR = 'data_parsing_error',
  
  // System Errors
  DATABASE_ERROR = 'database_error',
  STORAGE_ERROR = 'storage_error',
  MEMORY_ERROR = 'memory_error',
  
  // Business Logic Errors
  PRICING_CALCULATION_ERROR = 'pricing_calculation_error',
  SEO_GENERATION_ERROR = 'seo_generation_error',
  VALIDATION_ERROR = 'validation_error'
}

interface ErrorContext {
  operation: string;
  platform?: 'shopee' | 'tiktokshop';
  productId?: string;
  batchId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

class SyncStoreError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public context: ErrorContext,
    public retryable: boolean = false,
    public cause?: Error
  ) {
    super(message);
    this.name = 'SyncStoreError';
  }
}
```

### Retry Logic Implementation

```typescript
class RetryHandler {
  private readonly maxRetries: number = 3;
  private readonly baseDelay: number = 1000;
  private readonly maxDelay: number = 30000;
  private readonly backoffMultiplier: number = 2;

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    customRetries?: number
  ): Promise<T> {
    const maxAttempts = customRetries || this.maxRetries;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!this.isRetryable(error) || attempt === maxAttempts) {
          throw new SyncStoreError(
            this.classifyError(error),
            `Operation failed after ${attempt} attempts: ${error.message}`,
            context,
            false,
            error as Error
          );
        }

        // Calculate delay with jitter
        const delay = Math.min(
          this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1),
          this.maxDelay
        );
        const jitter = Math.random() * 0.1 * delay;
        
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
        
        console.warn(`Retry attempt ${attempt}/${maxAttempts} for ${context.operation}`, {
          error: error.message,
          delay: delay + jitter
        });
      }
    }

    throw lastError!;
  }

  private isRetryable(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // HTTP status codes that are retryable
    if (error.response?.status) {
      const status = error.response.status;
      return status === 429 || status >= 500;
    }

    // API-specific retryable errors
    if (error.message?.includes('rate limit') || error.message?.includes('timeout')) {
      return true;
    }

    return false;
  }

  private classifyError(error: any): ErrorType {
    if (error.response?.status === 401 || error.message?.includes('authentication')) {
      return ErrorType.API_AUTHENTICATION_ERROR;
    }
    
    if (error.response?.status === 429 || error.message?.includes('rate limit')) {
      return ErrorType.API_RATE_LIMIT_ERROR;
    }
    
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return ErrorType.API_CONNECTION_ERROR;
    }
    
    return ErrorType.API_CONNECTION_ERROR;
  }
}
```

### Error Recovery Strategies

```typescript
class ErrorRecoveryManager {
  async handleImportError(
    error: SyncStoreError,
    importContext: ImportContext
  ): Promise<RecoveryAction> {
    switch (error.type) {
      case ErrorType.API_RATE_LIMIT_ERROR:
        return this.handleRateLimitError(error, importContext);
        
      case ErrorType.API_AUTHENTICATION_ERROR:
        return this.handleAuthError(error, importContext);
        
      case ErrorType.DATA_VALIDATION_ERROR:
        return this.handleValidationError(error, importContext);
        
      case ErrorType.DATABASE_ERROR:
        return this.handleDatabaseError(error, importContext);
        
      default:
        return this.handleGenericError(error, importContext);
    }
  }

  private async handleRateLimitError(
    error: SyncStoreError,
    context: ImportContext
  ): Promise<RecoveryAction> {
    // Extract retry-after header if available
    const retryAfter = this.extractRetryAfter(error);
    const delay = retryAfter || 60000; // Default 1 minute

    return {
      action: 'retry',
      delay,
      message: `Rate limit exceeded. Retrying after ${delay}ms`,
      continueProcessing: true
    };
  }

  private async handleAuthError(
    error: SyncStoreError,
    context: ImportContext
  ): Promise<RecoveryAction> {
    // Attempt to refresh token
    try {
      await this.refreshAuthToken(context.platform);
      return {
        action: 'retry',
        delay: 1000,
        message: 'Authentication refreshed, retrying operation',
        continueProcessing: true
      };
    } catch (refreshError) {
      return {
        action: 'abort',
        message: 'Authentication failed and cannot be refreshed',
        continueProcessing: false
      };
    }
  }

  private async handleValidationError(
    error: SyncStoreError,
    context: ImportContext
  ): Promise<RecoveryAction> {
    // Log validation error and continue with next item
    await this.logValidationError(error, context);
    
    return {
      action: 'skip',
      message: `Validation failed for ${context.productId}, skipping`,
      continueProcessing: true
    };
  }
}
```

---

## Data Transformation

### Field Mapping System

```typescript
interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: (value: any) => any;
  required: boolean;
  defaultValue?: any;
}

class DataTransformer {
  private shopeeFieldMappings: FieldMapping[] = [
    {
      sourceField: 'item_id',
      targetField: 'platformProductId',
      required: true
    },
    {
      sourceField: 'item_name',
      targetField: 'name',
      required: true
    },
    {
      sourceField: 'price',
      targetField: 'basePrice',
      transform: (value) => parseFloat(value) / 100, // Convert from cents
      required: true
    },
    {
      sourceField: 'images',
      targetField: 'images',
      transform: (images: string[]) => images.map(url => ({
        url,
        alt: '',
        primary: false
      })),
      required: false,
      defaultValue: []
    }
  ];

  private tiktokFieldMappings: FieldMapping[] = [
    {
      sourceField: 'product_id',
      targetField: 'platformProductId',
      required: true
    },
    {
      sourceField: 'product_name',
      targetField: 'name',
      required: true
    },
    {
      sourceField: 'price',
      targetField: 'basePrice',
      transform: (value) => parseFloat(value),
      required: true
    },
    {
      sourceField: 'images',
      targetField: 'images',
      transform: (images: Array<{url: string, alt?: string}>) => 
        images.map((img, index) => ({
          url: img.url,
          alt: img.alt || '',
          primary: index === 0
        })),
      required: false,
      defaultValue: []
    }
  ];

  transformProduct(
    rawProduct: any,
    platform: 'shopee' | 'tiktokshop'
  ): MasterProduct {
    const mappings = platform === 'shopee' 
      ? this.shopeeFieldMappings 
      : this.tiktokFieldMappings;

    const transformed: Partial<MasterProduct> = {
      id: this.generateId(),
      platform,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    for (const mapping of mappings) {
      try {
        let value = this.getNestedValue(rawProduct, mapping.sourceField);
        
        if (value === undefined || value === null) {
          if (mapping.required) {
            throw new SyncStoreError(
              ErrorType.DATA_TRANSFORMATION_ERROR,
              `Required field ${mapping.sourceField} is missing`,
              { operation: 'transform_product', platform }
            );
          }
          value = mapping.defaultValue;
        }

        if (mapping.transform && value !== undefined) {
          value = mapping.transform(value);
        }

        this.setNestedValue(transformed, mapping.targetField, value);
        
      } catch (error) {
        throw new SyncStoreError(
          ErrorType.DATA_TRANSFORMATION_ERROR,
          `Failed to transform field ${mapping.sourceField}: ${error.message}`,
          { operation: 'transform_product', platform },
          false,
          error as Error
        );
      }
    }

    return transformed as MasterProduct;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}
```

### Pricing Calculation System

```typescript
interface PlatformPricingConfig {
  platformFeePercentage: number;
  paymentFeePercentage: number;
  minimumPrice: number;
  maximumPrice: number;
  currency: string;
}

class PricingCalculator {
  private platformConfigs: Record<string, PlatformPricingConfig> = {
    shopee: {
      platformFeePercentage: 15,
      paymentFeePercentage: 2.9,
      minimumPrice: 1000,
      maximumPrice: 100000000,
      currency: 'IDR'
    },
    tiktokshop: {
      platformFeePercentage: 20,
      paymentFeePercentage: 2.5,
      minimumPrice: 1000,
      maximumPrice: 100000000,
      currency: 'IDR'
    }
  };

  calculatePlatformPrice(
    basePrice: number,
    platform: string,
    options: {
      includeShipping?: boolean;
      shippingCost?: number;
      discountPercentage?: number;
    } = {}
  ): PricingResult {
    const config = this.platformConfigs[platform];
    if (!config) {
      throw new SyncStoreError(
        ErrorType.PRICING_CALCULATION_ERROR,
        `Unknown platform: ${platform}`,
        { operation: 'calculate_price', platform }
      );
    }

    try {
      // Apply discount if specified
      let adjustedPrice = basePrice;
      if (options.discountPercentage) {
        adjustedPrice = basePrice * (1 - options.discountPercentage / 100);
      }

      // Add platform fee
      const platformFee = adjustedPrice * (config.platformFeePercentage / 100);
      const priceWithPlatformFee = adjustedPrice + platformFee;

      // Add payment processing fee
      const paymentFee = priceWithPlatformFee * (config.paymentFeePercentage / 100);
      let finalPrice = priceWithPlatformFee + paymentFee;

      // Add shipping if specified
      if (options.includeShipping && options.shippingCost) {
        finalPrice += options.shippingCost;
      }

      // Validate price bounds
      if (finalPrice < config.minimumPrice) {
        finalPrice = config.minimumPrice;
      }
      if (finalPrice > config.maximumPrice) {
        finalPrice = config.maximumPrice;
      }

      // Round to nearest currency unit
      finalPrice = Math.round(finalPrice);

      return {
        basePrice,
        platformFee,
        paymentFee,
        shippingCost: options.shippingCost || 0,
        finalPrice,
        currency: config.currency,
        breakdown: {
          basePricePercentage: (adjustedPrice / finalPrice) * 100,
          platformFeePercentage: (platformFee / finalPrice) * 100,
          paymentFeePercentage: (paymentFee / finalPrice) * 100,
          shippingPercentage: ((options.shippingCost || 0) / finalPrice) * 100
        }
      };

    } catch (error) {
      throw new SyncStoreError(
        ErrorType.PRICING_CALCULATION_ERROR,
        `Pricing calculation failed: ${error.message}`,
        { operation: 'calculate_price', platform },
        false,
        error as Error
      );
    }
  }
}
```

---

## Database Schema

### Master Products Table

```sql
CREATE TABLE master_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(255) NOT NULL,
    sku VARCHAR(255) UNIQUE NOT NULL,
    
    -- Core product information
    name VARCHAR(500) NOT NULL,
    short_description TEXT,
    full_description TEXT,
    
    -- Pricing
    base_price DECIMAL(12,2) NOT NULL,
    cost_price DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'IDR',
    
    -- Physical specifications
    weight DECIMAL(8,3), -- in kg
    length DECIMAL(8,2), -- in cm
    width DECIMAL(8,2),  -- in cm
    height DECIMAL(8,2), -- in cm
    
    -- Categorization
    category VARCHAR(255),
    subcategory VARCHAR(255),
    tags TEXT[], -- PostgreSQL array
    
    -- Media
    images JSONB DEFAULT '[]',
    
    -- Variants
    variants JSONB DEFAULT '[]',
    
    -- Status and metadata
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT master_products_organization_sku_unique UNIQUE (organization_id, sku)
);

-- Indexes for performance
CREATE INDEX idx_master_products_organization_id ON master_products(organization_id);
CREATE INDEX idx_master_products_status ON master_products(status);
CREATE INDEX idx_master_products_category ON master_products(category);
CREATE INDEX idx_master_products_created_at ON master_products(created_at);
CREATE INDEX idx_master_products_name_search ON master_products USING gin(to_tsvector('english', name));
CREATE INDEX idx_master_products_tags ON master_products USING gin(tags);
```

### Platform Mappings Table

```sql
CREATE TABLE platform_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_product_id UUID NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
    
    -- Platform information
    platform VARCHAR(50) NOT NULL,
    platform_product_id VARCHAR(255) NOT NULL,
    platform_shop_id VARCHAR(255),
    
    -- Raw platform data
    platform_data JSONB NOT NULL DEFAULT '{}',
    
    -- Pricing information
    platform_price DECIMAL(12,2),
    fee_percentage DECIMAL(5,2),
    calculated_at TIMESTAMP WITH TIME ZONE,
    
    -- SEO information
    seo_title VARCHAR(500),
    seo_keywords TEXT[],
    seo_quality_score INTEGER,
    
    -- Sync status
    sync_enabled BOOLEAN DEFAULT true,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error', 'disabled')),
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_errors JSONB DEFAULT '[]',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT platform_mappings_unique_platform_product UNIQUE (platform, platform_product_id)
);

-- Indexes for performance
CREATE INDEX idx_platform_mappings_master_product_id ON platform_mappings(master_product_id);
CREATE INDEX idx_platform_mappings_platform ON platform_mappings(platform);
CREATE INDEX idx_platform_mappings_sync_status ON platform_mappings(sync_status);
CREATE INDEX idx_platform_mappings_platform_product_id ON platform_mappings(platform_product_id);
CREATE INDEX idx_platform_mappings_last_synced ON platform_mappings(last_synced_at);
```

### Raw Import Data Table

```sql
CREATE TABLE raw_import_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Import metadata
    import_batch_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    organization_id VARCHAR(255) NOT NULL,
    
    -- Product identification
    platform_product_id VARCHAR(255) NOT NULL,
    
    -- Raw data
    raw_data JSONB NOT NULL,
    
    -- Processing status
    processed BOOLEAN DEFAULT false,
    processing_errors JSONB DEFAULT '[]',
    master_product_id UUID REFERENCES master_products(id),
    
    -- Timestamps
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT raw_import_data_unique_batch_product UNIQUE (import_batch_id, platform_product_id)
);

-- Indexes
CREATE INDEX idx_raw_import_data_batch_id ON raw_import_data(import_batch_id);
CREATE INDEX idx_raw_import_data_platform ON raw_import_data(platform);
CREATE INDEX idx_raw_import_data_processed ON raw_import_data(processed);
CREATE INDEX idx_raw_import_data_imported_at ON raw_import_data(imported_at);
```

---

## Performance Optimization

### Database Optimization

#### Connection Pooling

```typescript
import { Pool } from 'pg';

class DatabaseManager {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      
      // Connection pool settings
      min: 5,           // Minimum connections
      max: 20,          // Maximum connections
      idleTimeoutMillis: 30000,  // Close idle connections after 30s
      connectionTimeoutMillis: 2000,  // Timeout for new connections
      
      // Performance settings
      statement_timeout: 30000,  // 30 second query timeout
      query_timeout: 30000,
      
      // SSL settings for production
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });

    // Handle pool events
    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });

    this.pool.on('connect', () => {
      console.log('New database connection established');
    });
  }

  async query<T>(text: string, params?: any[]): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

#### Batch Processing Optimization

```typescript
class BatchProcessor {
  private readonly batchSize: number = 100;
  private readonly maxConcurrency: number = 5;

  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      batchSize?: number;
      maxConcurrency?: number;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<R[]> {
    const batchSize = options.batchSize || this.batchSize;
    const maxConcurrency = options.maxConcurrency || this.maxConcurrency;
    
    const results: R[] = [];
    const batches = this.createBatches(items, batchSize);
    
    // Process batches with controlled concurrency
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const concurrentBatches = batches.slice(i, i + maxConcurrency);
      
      const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
        const batchResults: R[] = [];
        
        for (const item of batch) {
          try {
            const result = await processor(item);
            batchResults.push(result);
          } catch (error) {
            console.error(`Error processing item in batch ${i + batchIndex}:`, error);
            // Continue processing other items
          }
        }
        
        return batchResults;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
      
      // Report progress
      if (options.onProgress) {
        options.onProgress(results.length, items.length);
      }
    }

    return results;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}
```

### Memory Management

```typescript
class MemoryManager {
  private readonly maxHeapUsage = 0.8; // 80% of available heap
  private readonly gcThreshold = 0.7;   // 70% triggers garbage collection

  async processWithMemoryManagement<T>(
    items: T[],
    processor: (item: T) => Promise<void>
  ): Promise<void> {
    for (let i = 0; i < items.length; i++) {
      await processor(items[i]);
      
      // Check memory usage every 100 items
      if (i % 100 === 0) {
        await this.checkMemoryUsage();
      }
    }
  }

  private async checkMemoryUsage(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const heapUsedRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    if (heapUsedRatio > this.gcThreshold) {
      console.log(`Memory usage high (${(heapUsedRatio * 100).toFixed(1)}%), triggering GC`);
      
      if (global.gc) {
        global.gc();
      }
      
      // Wait a bit for GC to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (heapUsedRatio > this.maxHeapUsage) {
      throw new SyncStoreError(
        ErrorType.MEMORY_ERROR,
        `Memory usage too high: ${(heapUsedRatio * 100).toFixed(1)}%`,
        { operation: 'memory_check' }
      );
    }
  }

  getMemoryStats(): MemoryStats {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapUsagePercentage: (usage.heapUsed / usage.heapTotal) * 100
    };
  }
}
```

---

## Testing Framework

### Unit Testing Structure

```typescript
// Example unit test structure
describe('DataTransformer', () => {
  let transformer: DataTransformer;

  beforeEach(() => {
    transformer = new DataTransformer();
  });

  describe('transformProduct', () => {
    it('should transform Shopee product correctly', () => {
      const shopeeProduct = {
        item_id: 'shopee_123',
        item_name: 'Test Product',
        price: 150000,
        description: 'Test description',
        images: ['img1.jpg', 'img2.jpg']
      };

      const result = transformer.transformProduct(shopeeProduct, 'shopee');

      expect(result.platformProductId).toBe('shopee_123');
      expect(result.name).toBe('Test Product');
      expect(result.basePrice).toBe(1500); // Converted from cents
      expect(result.images).toHaveLength(2);
      expect(result.images[0]).toHaveProperty('url', 'img1.jpg');
    });

    it('should handle missing required fields', () => {
      const invalidProduct = {
        item_id: 'shopee_123'
        // Missing required fields
      };

      expect(() => {
        transformer.transformProduct(invalidProduct, 'shopee');
      }).toThrow(SyncStoreError);
    });
  });
});
```

### Integration Testing Patterns

```typescript
describe('End-to-End Import Process', () => {
  let testDataDir: string;
  let importer: ShopeeImporter;
  let populator: MasterCatalogPopulator;

  beforeAll(async () => {
    testDataDir = './test-data/e2e';
    await fs.mkdir(testDataDir, { recursive: true });
    
    importer = new ShopeeImporter();
    populator = new MasterCatalogPopulator(testDataDir, 'test-org');
  });

  afterAll(async () => {
    await fs.rm(testDataDir, { recursive: true, force: true });
  });

  it('should complete full import workflow', async () => {
    // Import data
    const importResult = await importer.importMockData({
      outputDir: testDataDir,
      productCount: 50,
      batchSize: 10
    });

    expect(importResult.success).toBe(true);
    expect(importResult.totalProducts).toBe(50);

    // Populate master catalog
    const populationResult = await populator.populateFromImports({
      organizationId: 'test-org',
      batchSize: 25,
      skipExisting: false,
      dryRun: false,
      platforms: ['shopee']
    });

    expect(populationResult.success).toBe(true);
    expect(populationResult.totalProcessed).toBe(50);
    expect(populationResult.successCount).toBe(50);
  });
});
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. API Authentication Failures

**Symptoms:**
- 401 Unauthorized errors
- "Invalid signature" messages
- Token expired errors

**Diagnosis:**
```bash
# Check API credentials
echo "Partner ID: $SHOPEE_PARTNER_ID"
echo "Partner Key: [REDACTED]"
echo "Access Token: [REDACTED]"

# Test API connectivity
curl -X GET "https://partner.shopeemobile.com/api/v2/shop/get_shop_info" \
  -H "Authorization: Bearer $SHOPEE_ACCESS_TOKEN"
```

**Solutions:**
1. Verify API credentials are correct
2. Check token expiration dates
3. Refresh access tokens if needed
4. Verify signature generation algorithm
5. Check system clock synchronization

#### 2. Rate Limiting Issues

**Symptoms:**
- 429 Too Many Requests errors
- Slow import performance
- API quota exceeded messages

**Diagnosis:**
```typescript
// Check rate limiter status
const rateLimiter = new RateLimiter();
console.log('Current request count:', rateLimiter.getCurrentRequestCount());
console.log('Time until reset:', rateLimiter.getTimeUntilReset());
```

**Solutions:**
1. Implement exponential backoff
2. Reduce concurrent requests
3. Increase delays between requests
4. Monitor API usage quotas
5. Implement request queuing

#### 3. Database Connection Issues

**Symptoms:**
- Connection timeout errors
- "Too many connections" errors
- Slow query performance

**Diagnosis:**
```sql
-- Check active connections
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';

-- Check long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

**Solutions:**
1. Optimize connection pool settings
2. Close idle connections
3. Add query timeouts
4. Optimize slow queries
5. Add database indexes

#### 4. Memory Issues

**Symptoms:**
- Out of memory errors
- Slow performance
- Process crashes

**Diagnosis:**
```typescript
// Monitor memory usage
const memoryManager = new MemoryManager();
setInterval(() => {
  const stats = memoryManager.getMemoryStats();
  console.log('Memory usage:', stats);
}, 10000);
```

**Solutions:**
1. Reduce batch sizes
2. Implement streaming processing
3. Add garbage collection triggers
4. Optimize data structures
5. Increase available memory

#### 5. Data Validation Failures

**Symptoms:**
- High error rates during import
- Missing required fields
- Data format inconsistencies

**Diagnosis:**
```typescript
// Run validation report
const validator = new ComprehensiveDataValidator();
const report = await validator.validateAllProducts();
console.log('Validation report:', report);
```

**Solutions:**
1. Update field mappings
2. Add data transformation rules
3. Implement fallback values
4. Improve error handling
5. Update validation rules

### Performance Troubleshooting

#### Slow Import Performance

**Diagnostic Steps:**
1. Check API response times
2. Monitor database query performance
3. Analyze memory usage patterns
4. Review batch processing efficiency

**Optimization Strategies:**
1. Increase batch sizes (within memory limits)
2. Implement parallel processing
3. Add database indexes
4. Optimize data transformation logic
5. Use connection pooling

#### High Memory Usage

**Diagnostic Steps:**
1. Profile memory allocation
2. Identify memory leaks
3. Monitor garbage collection
4. Analyze data structure sizes

**Optimization Strategies:**
1. Implement streaming processing
2. Reduce object retention
3. Use more efficient data structures
4. Add explicit garbage collection
5. Process data in smaller chunks

---

## Deployment Guide

### Environment Setup

#### Production Environment Variables

```bash
# Database Configuration
DATABASE_URL="postgresql://user:password@host:5432/syncstore_prod"
DB_POOL_MIN=10
DB_POOL_MAX=50

# API Credentials
SHOPEE_PARTNER_ID="your_partner_id"
SHOPEE_PARTNER_KEY="your_partner_key"
TIKTOKSHOP_APP_KEY="your_app_key"
TIKTOKSHOP_APP_SECRET="your_app_secret"

# Security
ENCRYPTION_KEY="your_32_character_encryption_key"
JWT_SECRET="your_jwt_secret"

# Performance
NODE_ENV="production"
MAX_BATCH_SIZE=100
MAX_CONCURRENT_IMPORTS=5
MEMORY_LIMIT="2048"

# Monitoring
LOG_LEVEL="info"
METRICS_ENABLED="true"
```

#### Docker Configuration

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build application
RUN npm run build

# Set up non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start application
CMD ["npm", "start"]
```

#### Database Migration

```bash
# Run database migrations
npx prisma migrate deploy

# Seed initial data if needed
npx prisma db seed

# Verify database schema
npx prisma db pull
```

### Monitoring and Logging

#### Application Monitoring

```typescript
import { createPrometheusMetrics } from './monitoring/prometheus';
import { createLogger } from './monitoring/logger';

const metrics = createPrometheusMetrics();
const logger = createLogger();

// Track import performance
metrics.importDuration.observe(
  { platform: 'shopee' },
  importDurationMs
);

// Track error rates
metrics.errorCount.inc({
  platform: 'shopee',
  error_type: 'api_error'
});

// Log important events
logger.info('Import completed', {
  platform: 'shopee',
  productCount: 500,
  duration: importDurationMs
});
```

#### Health Checks

```typescript
// Health check endpoint
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabase(),
      memory: checkMemoryUsage(),
      apis: await checkAPIConnectivity()
    }
  };

  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');
  
  res.status(isHealthy ? 200 : 503).json(health);
});
```

---

## Maintenance Procedures

### Regular Maintenance Tasks

#### Daily Tasks
1. Monitor system health and performance metrics
2. Check error logs for critical issues
3. Verify API connectivity and quotas
4. Review import success rates

#### Weekly Tasks
1. Analyze performance trends
2. Review and clean up old import data
3. Update API credentials if needed
4. Check database performance and optimization

#### Monthly Tasks
1. Review and update field mappings
2. Analyze data quality trends
3. Update documentation
4. Performance testing with production data

### Database Maintenance

#### Cleanup Old Data

```sql
-- Clean up old raw import data (older than 30 days)
DELETE FROM raw_import_data 
WHERE imported_at < NOW() - INTERVAL '30 days' 
AND processed = true;

-- Archive old platform mappings for inactive products
UPDATE platform_mappings 
SET sync_status = 'archived' 
WHERE master_product_id IN (
  SELECT id FROM master_products 
  WHERE status = 'archived' 
  AND updated_at < NOW() - INTERVAL '90 days'
);
```

#### Performance Optimization

```sql
-- Analyze table statistics
ANALYZE master_products;
ANALYZE platform_mappings;
ANALYZE raw_import_data;

-- Reindex tables if needed
REINDEX TABLE master_products;
REINDEX TABLE platform_mappings;

-- Check for unused indexes
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE schemaname = 'public' 
ORDER BY n_distinct DESC;
```

### Backup and Recovery

#### Automated Backups

```bash
#!/bin/bash
# Daily backup script

BACKUP_DIR="/backups/syncstore"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="syncstore_prod"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Clean up old backups (keep 30 days)
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +30 -delete

# Verify backup
if [ $? -eq 0 ]; then
    echo "Backup completed successfully: $BACKUP_DIR/db_backup_$DATE.sql.gz"
else
    echo "Backup failed!" >&2
    exit 1
fi
```

#### Recovery Procedures

```bash
# Restore from backup
gunzip -c /backups/syncstore/db_backup_20251102_120000.sql.gz | psql syncstore_prod

# Verify data integrity after restore
psql syncstore_prod -c "SELECT COUNT(*) FROM master_products;"
psql syncstore_prod -c "SELECT COUNT(*) FROM platform_mappings;"
```

---

## Conclusion

This technical documentation provides comprehensive coverage of the SyncStore Phase 1 implementation, including:

- **Complete API integration patterns** for both Shopee and TikTok Shop platforms
- **Robust error handling and recovery strategies** for production reliability
- **Efficient data transformation and processing systems** for handling large datasets
- **Optimized database schema and performance tuning** for scalability
- **Comprehensive testing framework** for quality assurance
- **Detailed troubleshooting guides** for common issues
- **Production deployment and maintenance procedures** for operational excellence

The system is designed to be maintainable, scalable, and reliable for production use, with clear patterns and practices that can be extended for Phase 2 development.

---

**Document Version:** 1.0.0  
**Last Updated:** November 2, 2025  
**Next Review:** Upon Phase 2 completion