/**
 * Mock Shopee Import for Phase 1 Testing
 * Simulates full import process using mock data
 */

import { ShopeeImporter, type ShopeeImportResult, type ShopeeImportOptions } from './shopee-importer';
import { productValidator } from '../validators/product-validator';
import { rawDataStore } from '../storage/raw-data-store';
import shopeeData from '../mock-data/shopee-sample.json';

export class MockShopeeImporter {
  private options: Required<ShopeeImportOptions>;

  constructor(options: ShopeeImportOptions = {}) {
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
   * Simulate full Shopee import with mock data
   */
  async simulateImport(productCount = 500): Promise<ShopeeImportResult> {
    const startTime = new Date();
    const result: ShopeeImportResult = {
      success: false,
      totalProducts: productCount,
      importedProducts: 0,
      failedProducts: 0,
      errors: [],
      duration: 0,
      startTime,
      endTime: new Date(),
    };

    try {
      console.log('🔄 Starting Mock Shopee Import...');
      console.log(`📦 Simulating import of ${productCount} products`);

      // Initialize storage
      await rawDataStore.initialize();

      // Generate mock products based on sample data
      const mockProducts = this.generateMockProducts(productCount);
      
      // Process products in batches
      for (let i = 0; i < mockProducts.length; i += this.options.batchSize) {
        const batch = mockProducts.slice(i, i + this.options.batchSize);
        
        try {
          await this.processBatch(batch, i);
          result.importedProducts += batch.length;
          
          // Report progress
          this.options.onProgress({
            current: Math.min(i + this.options.batchSize, mockProducts.length),
            total: mockProducts.length,
            percentage: Math.round((Math.min(i + this.options.batchSize, mockProducts.length) / mockProducts.length) * 100),
            currentProduct: batch[0]?.item_name,
          });
          
          // Simulate rate limiting
          await this.delay(this.options.rateLimitDelay);
          
        } catch (error) {
          console.error(`❌ Batch ${i}-${i + batch.length} failed:`, error);
          result.failedProducts += batch.length;
          result.errors.push({
            error: `Batch import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
          });
        }
      }

      // Generate final report
      await this.generateImportReport(result);
      
      result.success = result.importedProducts > 0;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();
      
      console.log(`✅ Mock import completed: ${result.importedProducts}/${result.totalProducts} products`);
      console.log(`⏱️  Duration: ${Math.round(result.duration / 1000)}s`);
      
      return result;

    } catch (error) {
      console.error('❌ Mock Shopee import failed:', error);
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
   * Generate mock products based on sample data
   */
  private generateMockProducts(count: number): any[] {
    const baseProduct = shopeeData.shopee_product_detail_response.response;
    const baseVariants = shopeeData.shopee_variant_list_response.response.model;
    
    const products = [];
    
    for (let i = 0; i < count; i++) {
      // Create variations of the base product
      const product = {
        ...baseProduct,
        item_id: 123456789 + i,
        item_name: this.generateProductName(i),
        description: this.generateDescription(i),
        item_sku: `PRODUCT-${String(i + 1).padStart(3, '0')}`,
        price: this.generatePrice(),
        create_time: Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000, // Random date within last year
        update_time: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000, // Random date within last month
      };

      // Add variants if enabled
      if (this.options.includeVariants && Math.random() > 0.3) { // 70% chance of having variants
        product.variants = this.generateVariants(product.item_id, baseVariants);
        product.has_model = true;
      } else {
        product.has_model = false;
      }

      products.push(product);
    }
    
    return products;
  }

  /**
   * Generate product name variations
   */
  private generateProductName(index: number): string {
    const productTypes = [
      'Frame Racing Drone',
      'Propeller High Performance',
      'Battery LiPo',
      'Motor Brushless',
      'ESC Speed Controller',
      'Camera FPV',
      'Antenna Receiver',
      'Landing Gear',
      'Gimbal Stabilizer',
      'Remote Controller'
    ];
    
    const sizes = ['3 Inch', '4 Inch', '5 Inch', '6 Inch', '7 Inch', '9 Inch'];
    const materials = ['Carbon Fiber', 'Aluminum', 'Plastic', 'Titanium'];
    
    const type = productTypes[index % productTypes.length];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    const material = materials[Math.floor(Math.random() * materials.length)];
    
    return `${type} ${size} ${material}`;
  }

  /**
   * Generate product description
   */
  private generateDescription(index: number): string {
    const descriptions = [
      'Premium quality drone part manufactured with precision engineering. Perfect for racing and freestyle applications.',
      'High-performance component designed for professional FPV pilots. Lightweight yet durable construction.',
      'Professional-grade part with excellent build quality. Suitable for both beginners and advanced users.',
      'Top-tier component with superior performance characteristics. Ideal for competitive racing.',
      'Quality assured part with rigorous testing. Perfect for custom drone builds.',
    ];
    
    const baseDesc = descriptions[index % descriptions.length];
    return `${baseDesc} Pre-order 5 hari kerja. Garansi 30 hari. Kualitas terjamin.`;
  }

  /**
   * Generate random price
   */
  private generatePrice(): number {
    const basePrices = [50000, 75000, 100000, 150000, 200000, 250000, 300000, 500000];
    const basePrice = basePrices[Math.floor(Math.random() * basePrices.length)];
    
    // Apply 15% Shopee fee to get final price
    return Math.round(basePrice * 1.15);
  }

  /**
   * Generate product variants
   */
  private generateVariants(productId: number, baseVariants: any[]): any[] {
    const colors = ['Red', 'Blue', 'Black', 'White', 'Green'];
    const variantCount = Math.floor(Math.random() * 4) + 1; // 1-4 variants
    
    const variants = [];
    
    for (let i = 0; i < variantCount; i++) {
      const color = colors[i % colors.length];
      const baseVariant = baseVariants[0];
      
      variants.push({
        ...baseVariant,
        model_id: productId * 1000 + i + 1,
        model_sku: `PRODUCT-${String(productId).slice(-3)}-${color.toUpperCase()}`,
        tier_index: [i],
        normal_stock: Math.floor(Math.random() * 50) + 1,
        reserved_stock: Math.floor(Math.random() * 5),
        price: this.generatePrice(),
      });
    }
    
    return variants;
  }

  /**
   * Process a batch of products
   */
  private async processBatch(products: any[], batchIndex: number): Promise<void> {
    const batchId = `batch_${Date.now()}_${batchIndex}`;
    
    console.log(`📦 Processing batch ${Math.floor(batchIndex / this.options.batchSize) + 1} with ${products.length} products`);
    
    // Validate each product
    const validatedProducts = [];
    const validationErrors = [];
    
    for (const product of products) {
      const validation = productValidator.validateShopeeProduct(product);
      
      if (validation.isValid) {
        validatedProducts.push(validation.data);
        
        if (validation.warnings.length > 0) {
          console.warn(`⚠️  Product ${product.item_id} has warnings:`, validation.warnings);
        }
      } else {
        validationErrors.push({
          productId: product.item_id,
          errors: validation.errors,
        });
        console.error(`❌ Product ${product.item_id} validation failed:`, validation.errors);
      }
    }
    
    // Store validated products
    if (validatedProducts.length > 0) {
      await rawDataStore.storeBatch('shopee', batchId, validatedProducts, {
        organizationId: 'mock-org',
        storeId: 'mock-store',
      });
    }
    
    // Log validation results
    console.log(`✅ Batch validation: ${validatedProducts.length}/${products.length} products valid`);
    
    if (validationErrors.length > 0) {
      console.log(`❌ Validation errors: ${validationErrors.length} products failed`);
    }
  }

  /**
   * Generate comprehensive import report
   */
  private async generateImportReport(result: ShopeeImportResult): Promise<void> {
    const validationStats = productValidator.getStats();
    const storageStats = await rawDataStore.getStats();
    
    console.log('\n📊 Import Report');
    console.log('================');
    console.log(`Import Duration: ${Math.round(result.duration / 1000)}s`);
    console.log(`Total Products: ${result.totalProducts}`);
    console.log(`Successfully Imported: ${result.importedProducts}`);
    console.log(`Failed: ${result.failedProducts}`);
    console.log(`Success Rate: ${Math.round((result.importedProducts / result.totalProducts) * 100)}%`);
    
    console.log('\n📋 Validation Statistics:');
    console.log(`Total Validated: ${validationStats.totalValidated}`);
    console.log(`Valid: ${validationStats.validCount}`);
    console.log(`Invalid: ${validationStats.invalidCount}`);
    console.log(`With Warnings: ${validationStats.warningCount}`);
    
    console.log('\n💾 Storage Statistics:');
    console.log(`Total Entries: ${storageStats.totalEntries}`);
    console.log(`Storage Size: ${(storageStats.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
    
    if (Object.keys(validationStats.errorsByField).length > 0) {
      console.log('\n❌ Most Common Field Errors:');
      Object.entries(validationStats.errorsByField)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .forEach(([field, count]) => {
          console.log(`  ${field}: ${count} errors`);
        });
    }
    
    if (result.errors.length > 0) {
      console.log('\n🚨 Import Errors:');
      result.errors.slice(0, 5).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.error}`);
      });
      
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more errors`);
      }
    }
    
    console.log('\n✅ Import Report Complete');
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Quick mock import function
 */
export async function runMockShopeeImport(productCount = 500): Promise<ShopeeImportResult> {
  const importer = new MockShopeeImporter({
    batchSize: 25,
    rateLimitDelay: 50, // Faster for mock
    onProgress: (progress) => {
      console.log(`📊 Progress: ${progress.percentage}% (${progress.current}/${progress.total}) - ${progress.currentProduct || 'Processing...'}`);
    },
  });

  return importer.simulateImport(productCount);
}