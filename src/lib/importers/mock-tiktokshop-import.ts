/**
 * Mock TikTok Shop Importer for Development and Testing
 * Simulates TikTok Shop product import without real API calls
 */

import type { TikTokShopImportResult, TikTokShopImportOptions } from './tiktokshop-importer';

export interface MockTikTokShopImportOptions extends Omit<TikTokShopImportOptions, 'includeTokopedia'> {
  successRate?: number; // Percentage of successful imports (0-100)
  simulateErrors?: boolean;
  tokopediaProducts?: number; // Number of products to simulate as Tokopedia
  totalProducts?: number; // Total products to simulate (for getImportStats)
}

export class MockTikTokShopImporter {
  private options: Required<MockTikTokShopImportOptions>;

  constructor(options: MockTikTokShopImportOptions = {}) {
    this.options = {
      batchSize: options.batchSize || 50,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      rateLimitDelay: options.rateLimitDelay || 100,
      includeVariants: options.includeVariants ?? true,
      successRate: options.successRate ?? 95,
      simulateErrors: options.simulateErrors ?? true,
      tokopediaProducts: options.tokopediaProducts ?? 0,
      totalProducts: options.totalProducts ?? 500,
      onProgress: options.onProgress || (() => {}),
    };
  }

  /**
   * Simulate TikTok Shop product import
   */
  async simulateImport(totalProducts: number): Promise<TikTokShopImportResult> {
    const startTime = new Date();
    const sessionId = `mock_tiktok_${Date.now()}`;
    
    const result: TikTokShopImportResult = {
      success: false,
      totalProducts,
      importedProducts: 0,
      failedProducts: 0,
      validatedProducts: 0,
      tokopediaEnabledProducts: 0,
      errors: [],
      validationErrors: [],
      duration: 0,
      startTime,
      endTime: new Date(),
      tokopediaIncluded: this.options.tokopediaProducts > 0,
      sessionId,
    };

    console.log('🔄 Starting Mock TikTok Shop Import...');
    console.log(`📦 Simulating import of ${totalProducts} products`);
    
    if (this.options.tokopediaProducts > 0) {
      console.log(`📱 Including ${this.options.tokopediaProducts} Tokopedia products`);
    }

    try {
      // Simulate batch processing
      for (let i = 0; i < totalProducts; i += this.options.batchSize) {
        const batchSize = Math.min(this.options.batchSize, totalProducts - i);
        const batchNumber = Math.floor(i / this.options.batchSize) + 1;
        
        console.log(`📦 Processing batch ${batchNumber} with ${batchSize} products`);
        
        // Simulate processing time
        await this.delay(this.options.rateLimitDelay);
        
        // Simulate batch success/failure
        const batchSuccessful = await this.simulateBatchImport(i, batchSize);
        
        if (batchSuccessful.success) {
          result.importedProducts += batchSuccessful.imported;
          result.validatedProducts += batchSuccessful.imported; // Assume all imported are validated
          result.failedProducts += batchSuccessful.failed;
          result.tokopediaEnabledProducts += batchSuccessful.tokopediaProducts;
        } else {
          result.failedProducts += batchSize;
          result.errors.push({
            error: `Batch ${batchNumber} failed: ${batchSuccessful.error}`,
            timestamp: new Date(),
          });
        }

        // Report progress
        this.options.onProgress({
          current: Math.min(i + batchSize, totalProducts),
          total: totalProducts,
          percentage: Math.round((Math.min(i + batchSize, totalProducts) / totalProducts) * 100),
          currentProduct: this.generateMockProductName(i),
        });
      }

      result.success = result.importedProducts > 0;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();

      // Generate import report
      this.generateImportReport(result);

      return result;

    } catch (error) {
      console.error('❌ Mock TikTok Shop import failed:', error);
      result.errors.push({
        error: `Mock import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();
      return result;
    }
  }

  /**
   * Simulate batch import processing
   */
  private async simulateBatchImport(startIndex: number, batchSize: number): Promise<{
    success: boolean;
    imported: number;
    failed: number;
    tokopediaProducts: number;
    error?: string;
  }> {
    // Simulate some processing time
    await this.delay(Math.random() * 100 + 50);

    // Simulate batch-level failures occasionally
    if (this.options.simulateErrors && Math.random() < 0.05) { // 5% chance of batch failure
      return {
        success: false,
        imported: 0,
        failed: batchSize,
        tokopediaProducts: 0,
        error: 'Simulated batch processing error',
      };
    }

    // Simulate individual product success/failure
    let imported = 0;
    let failed = 0;
    let tokopediaProducts = 0;

    for (let i = 0; i < batchSize; i++) {
      const productIndex = startIndex + i;
      
      // Check if this should be a Tokopedia product
      const isTokopediaProduct = productIndex < this.options.tokopediaProducts;
      
      // Simulate individual product import
      if (Math.random() * 100 < this.options.successRate) {
        imported++;
        
        if (isTokopediaProduct) {
          tokopediaProducts++;
        }
        
        // Generate mock product data
        const mockProduct = this.generateMockProduct(productIndex, isTokopediaProduct);
        
        // Simulate storing the product (just log for now)
        if (isTokopediaProduct && Math.random() < 0.1) { // Only log 10% to avoid spam
          console.log(`📱 Imported Tokopedia product: ${mockProduct.name}`);
        }
      } else {
        failed++;
        if (this.options.simulateErrors) {
          // Don't add individual errors to avoid spam, batch errors are enough
        }
      }
    }

    return {
      success: true,
      imported,
      failed,
      tokopediaProducts,
    };
  }

  /**
   * Generate mock product data
   */
  private generateMockProduct(index: number, isTokopedia: boolean = false) {
    const productTypes = [
      'Racing Frame 5 Inch Carbon',
      'Propeller 9 Inch High Performance', 
      'FPV Camera 1200TVL',
      'ESC 4in1 35A',
      'Flight Controller F4',
      'VTX 5.8GHz 800mW',
      'Receiver ELRS 2.4GHz',
      'Motor 2207 2750KV',
      'Battery 4S 1500mAh',
      'Antenna Pagoda 5.8GHz'
    ];

    const brands = isTokopedia ? 
      ['Tokopedia Official', 'Toko Drone Jakarta', 'FPV Store Tokopedia'] :
      ['Motekar FPV', 'DroneMax', 'FPV Racing Pro', 'AeroTech'];

    const productType = productTypes[index % productTypes.length];
    const brand = brands[index % brands.length];
    const platform = isTokopedia ? 'Tokopedia' : 'TikTok Shop';

    return {
      id: `TTS-${String(index + 1).padStart(6, '0')}`,
      name: `${productType} - ${brand} [${platform}]`,
      price: Math.floor(Math.random() * 500000) + 50000, // 50k - 550k IDR
      stock: Math.floor(Math.random() * 50) + 1,
      platform: platform,
      isTokopedia: isTokopedia,
    };
  }

  /**
   * Generate mock product name for progress reporting
   */
  private generateMockProductName(index: number): string {
    const mockProduct = this.generateMockProduct(index);
    return mockProduct.name;
  }

  /**
   * Generate import report
   */
  private generateImportReport(result: TikTokShopImportResult): void {
    console.log('\n📊 Import Report');
    console.log('================');
    console.log(`Import Duration: ${Math.round(result.duration / 1000)}s`);
    console.log(`Total Products: ${result.totalProducts}`);
    console.log(`Successfully Imported: ${result.importedProducts}`);
    console.log(`Failed: ${result.failedProducts}`);
    console.log(`Success Rate: ${Math.round((result.importedProducts / result.totalProducts) * 100)}%`);
    
    if (result.tokopediaIncluded) {
      console.log(`📱 Tokopedia Integration: Enabled`);
    }

    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.slice(0, 5).forEach((error, index) => {
        console.log(`${index + 1}. ${error.error}`);
      });
      if (result.errors.length > 5) {
        console.log(`... and ${result.errors.length - 5} more errors`);
      }
    }

    console.log('\n✅ Import Report Complete');
    console.log(`✅ Mock import completed: ${result.importedProducts}/${result.totalProducts} products`);
    console.log(`⏱️  Duration: ${Math.round(result.duration / 1000)}s`);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Simulate connection validation
   */
  async validateConnection(): Promise<{ valid: boolean; error?: string }> {
    // Simulate some delay
    await this.delay(100);
    
    // Simulate occasional connection failures
    if (Math.random() < 0.1) { // 10% chance of failure
      return {
        valid: false,
        error: 'Simulated connection error'
      };
    }

    return { valid: true };
  }

  /**
   * Get mock import statistics
   */
  async getImportStats(): Promise<{
    totalProducts: number;
    productsWithVariants: number;
    estimatedImportTime: number;
    tokopediaEnabled: boolean;
  }> {
    // Simulate some delay
    await this.delay(50);

    const totalProducts = this.options.totalProducts; // Use configured total
    
    return {
      totalProducts,
      productsWithVariants: Math.floor(totalProducts * 0.7), // 70% have variants
      estimatedImportTime: (totalProducts * this.options.rateLimitDelay) / 1000,
      tokopediaEnabled: this.options.tokopediaProducts > 0,
    };
  }
}

/**
 * Factory function to create mock TikTok Shop importer
 */
export function createMockTikTokShopImporter(
  options?: MockTikTokShopImportOptions
): MockTikTokShopImporter {
  return new MockTikTokShopImporter(options);
}

/**
 * Quick mock import function for testing
 */
export async function quickMockTikTokShopImport(
  totalProducts = 10,
  options?: MockTikTokShopImportOptions
): Promise<TikTokShopImportResult> {
  const importer = createMockTikTokShopImporter({
    batchSize: Math.min(totalProducts, 10),
    rateLimitDelay: 10, // Fast for testing
    ...options,
    onProgress: (progress) => {
      console.log(`📊 Progress: ${progress.percentage}% (${progress.current}/${progress.total})`);
    },
  });

  return importer.simulateImport(totalProducts);
}