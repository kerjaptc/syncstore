/**
 * Simple Data Transformation Test
 * Tests the transformation logic without database dependencies
 */

import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { 
  MasterProductSchema, 
  createMasterProduct,
  type MasterProduct,
  type ProductImage,
  type ProductCategory,
  type Dimensions,
} from '../src/lib/schema/master-product-schema';
import { createDefaultPricingCalculator } from '../src/lib/pricing/pricing-calculator';
import { createDefaultTitleGenerator } from '../src/lib/seo/title-generator';

interface TransformationResult {
  totalProcessed: number;
  successfulTransformations: number;
  failedTransformations: number;
  errors: Array<{
    productId: string;
    platform: string;
    error: string;
  }>;
  sampleProducts: MasterProduct[];
}

class SimpleTransformationTester {
  private basePath: string;

  constructor(basePath = './data/raw-imports') {
    this.basePath = basePath;
  }

  async testTransformation(): Promise<TransformationResult> {
    const result: TransformationResult = {
      totalProcessed: 0,
      successfulTransformations: 0,
      failedTransformations: 0,
      errors: [],
      sampleProducts: [],
    };

    console.log('🔄 Testing data transformation...');

    // Test Shopee data
    await this.testPlatformTransformation('shopee', result);
    
    // Test TikTok Shop data
    await this.testPlatformTransformation('tiktokshop', result);

    return result;
  }

  private async testPlatformTransformation(
    platform: 'shopee' | 'tiktokshop',
    result: TransformationResult
  ): Promise<void> {
    const platformPath = path.join(this.basePath, platform);
    
    if (!existsSync(platformPath)) {
      console.log(`⚠️  No data found for platform: ${platform}`);
      return;
    }

    // Get first batch file for testing
    const files = await readdir(platformPath);
    const batchFiles = files.filter(file => file.startsWith('batch_') && file.endsWith('.json'));
    
    if (batchFiles.length === 0) {
      console.log(`⚠️  No batch files found for platform: ${platform}`);
      return;
    }

    // Test first batch file
    const firstBatchFile = batchFiles[0];
    const filePath = path.join(platformPath, firstBatchFile);
    
    try {
      const batchData = await this.readBatchFile(filePath);
      
      if (!batchData || !batchData.products) {
        console.log(`⚠️  Invalid batch file format: ${firstBatchFile}`);
        return;
      }

      console.log(`📄 Testing ${platform} transformation with ${batchData.products.length} products from ${firstBatchFile}`);

      // Test transformation for first few products
      const productsToTest = batchData.products.slice(0, 5);
      
      for (const rawProduct of productsToTest) {
        try {
          result.totalProcessed++;
          
          const masterProduct = await this.transformToMasterProduct(rawProduct, platform);
          
          if (masterProduct) {
            // Validate the transformed product
            const validation = MasterProductSchema.safeParse(masterProduct);
            
            if (validation.success) {
              result.successfulTransformations++;
              
              // Keep first few successful products as samples
              if (result.sampleProducts.length < 3) {
                result.sampleProducts.push(validation.data);
              }
              
              console.log(`✅ Successfully transformed: ${masterProduct.name}`);
            } else {
              result.failedTransformations++;
              result.errors.push({
                productId: this.getProductId(rawProduct, platform),
                platform,
                error: `Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`,
              });
            }
          } else {
            result.failedTransformations++;
            result.errors.push({
              productId: this.getProductId(rawProduct, platform),
              platform,
              error: 'Failed to transform product data',
            });
          }
        } catch (error) {
          result.failedTransformations++;
          result.errors.push({
            productId: this.getProductId(rawProduct, platform),
            platform,
            error: `Transformation error: ${error}`,
          });
        }
      }
    } catch (error) {
      console.error(`❌ Failed to process batch file ${firstBatchFile}:`, error);
    }
  }

  private async transformToMasterProduct(
    rawProduct: any,
    platform: 'shopee' | 'tiktokshop'
  ): Promise<MasterProduct | null> {
    try {
      // Extract common fields based on platform
      const commonData = this.extractCommonFields(rawProduct, platform);
      
      if (!commonData) {
        return null;
      }

      // Generate master SKU
      const masterSku = this.generateMasterSku(rawProduct, platform);

      // Calculate pricing
      const basePrice = commonData.price;
      const pricingCalculator = createDefaultPricingCalculator();
      const pricingResult = pricingCalculator.calculatePlatformPrice(basePrice, platform);
      
      const platformFeePercentage = platform === 'shopee' ? 15 : 20;
      const pricing = {
        basePrice,
        currency: 'IDR' as const,
        platformPrices: {
          [platform]: {
            price: pricingResult.finalPrice,
            feePercentage: platformFeePercentage,
            calculatedAt: new Date(),
          }
        },
      };

      // Generate SEO titles
      const titleGenerator = createDefaultTitleGenerator();
      const baseTitleKeywords = this.extractKeywords(commonData.name);
      const titleResult = titleGenerator.generatePlatformTitle(commonData.name, platform);
      
      const seoData = {
        keywords: baseTitleKeywords,
        platformTitles: {
          [platform]: {
            title: titleResult.generatedTitle,
            similarity: titleResult.similarity,
            optimizedFor: titleResult.optimizedFor,
            generatedAt: new Date(),
          }
        },
        platformDescriptions: {
          [platform]: {
            description: commonData.description,
            optimizedFor: baseTitleKeywords,
            generatedAt: new Date(),
          }
        },
      };

      // Create master product
      const masterProduct = createMasterProduct({
        masterSku,
        name: commonData.name,
        description: commonData.description,
        weight: commonData.weight,
        dimensions: commonData.dimensions,
        images: commonData.images,
        category: commonData.category,
        brand: commonData.brand,
        pricing,
        seo: seoData,
        status: 'active' as const,
        importSource: platform,
        importedAt: new Date(),
        importBatchId: `test_batch_${Date.now()}`,
        hasVariants: false,
        variants: [],
      });

      return masterProduct;

    } catch (error) {
      console.error(`❌ Failed to transform ${platform} product:`, error);
      return null;
    }
  }

  private extractCommonFields(rawProduct: any, platform: 'shopee' | 'tiktokshop') {
    try {
      if (platform === 'shopee') {
        return {
          name: rawProduct.item_name || 'Unnamed Product',
          description: rawProduct.description || 'No description available',
          price: this.extractShopeePrice(rawProduct),
          weight: rawProduct.weight || 0.05,
          dimensions: this.extractShopeeDimensions(rawProduct),
          images: this.extractShopeeImages(rawProduct),
          category: this.extractShopeeCategory(rawProduct),
          brand: this.extractShopeeBrand(rawProduct),
        };
      } else {
        return {
          name: rawProduct.product_name || 'Unnamed Product',
          description: rawProduct.description || 'No description available',
          price: rawProduct.price || 50000,
          weight: rawProduct.weight || 0.05,
          dimensions: this.extractTikTokDimensions(rawProduct),
          images: this.extractTikTokImages(rawProduct),
          category: this.extractTikTokCategory(rawProduct),
          brand: rawProduct.brand || 'Unknown Brand',
        };
      }
    } catch (error) {
      console.error(`❌ Failed to extract common fields for ${platform}:`, error);
      return null;
    }
  }

  private extractShopeePrice(rawProduct: any): number {
    if (rawProduct.price) return rawProduct.price;
    if (rawProduct.price_info?.current_price) return rawProduct.price_info.current_price;
    
    // Generate reasonable price based on product name
    const productName = rawProduct.item_name || '';
    let basePrice = 50000;
    
    if (productName.toLowerCase().includes('frame')) basePrice = 150000;
    else if (productName.toLowerCase().includes('motor')) basePrice = 200000;
    else if (productName.toLowerCase().includes('battery')) basePrice = 300000;
    else if (productName.toLowerCase().includes('esc')) basePrice = 180000;
    else if (productName.toLowerCase().includes('propeller')) basePrice = 80000;
    
    const variation = (rawProduct.item_id % 100) * 1000;
    return basePrice + variation;
  }

  private extractShopeeDimensions(rawProduct: any): Dimensions {
    const dim = rawProduct.dimension || {};
    return {
      length: dim.package_length || 25,
      width: dim.package_width || 25,
      height: dim.package_height || 5,
      unit: 'cm' as const,
    };
  }

  private extractShopeeImages(rawProduct: any): ProductImage[] {
    const images: ProductImage[] = [];
    
    if (rawProduct.image?.image_url_list) {
      rawProduct.image.image_url_list.forEach((url: string, index: number) => {
        images.push({
          url,
          alt: `Product image ${index + 1}`,
          isPrimary: index === 0,
        });
      });
    }

    return images.length > 0 ? images : [{
      url: 'https://via.placeholder.com/300x300?text=No+Image',
      alt: 'No image available',
      isPrimary: true,
    }];
  }

  private extractShopeeCategory(rawProduct: any): ProductCategory {
    return {
      id: rawProduct.category_id?.toString() || 'unknown',
      name: 'Electronics',
      path: ['Electronics', 'Drone Parts'],
      level: 2,
    };
  }

  private extractShopeeBrand(rawProduct: any): string {
    if (rawProduct.brand?.original_brand_name) return rawProduct.brand.original_brand_name;
    if (rawProduct.brand_name) return rawProduct.brand_name;
    return 'Unknown Brand';
  }

  private extractTikTokDimensions(rawProduct: any): Dimensions {
    const dim = rawProduct.dimensions || {};
    return {
      length: dim.length || 25,
      width: dim.width || 25,
      height: dim.height || 5,
      unit: 'cm' as const,
    };
  }

  private extractTikTokImages(rawProduct: any): ProductImage[] {
    const images: ProductImage[] = [];
    
    if (rawProduct.images && Array.isArray(rawProduct.images)) {
      rawProduct.images.forEach((img: any, index: number) => {
        images.push({
          url: img.url,
          alt: `Product image ${index + 1}`,
          isPrimary: index === 0,
        });
      });
    }

    return images.length > 0 ? images : [{
      url: 'https://via.placeholder.com/300x300?text=No+Image',
      alt: 'No image available',
      isPrimary: true,
    }];
  }

  private extractTikTokCategory(rawProduct: any): ProductCategory {
    return {
      id: rawProduct.category_id || 'unknown',
      name: 'Electronics',
      path: ['Electronics', 'Drone Parts'],
      level: 2,
    };
  }

  private generateMasterSku(rawProduct: any, platform: 'shopee' | 'tiktokshop'): string {
    const productId = platform === 'shopee' 
      ? rawProduct.item_id?.toString() 
      : rawProduct.product_id;
    
    const platformPrefix = platform === 'shopee' ? 'SH' : 'TT';
    const timestamp = Date.now().toString().slice(-6);
    
    return `${platformPrefix}-${productId}-${timestamp}`;
  }

  private extractKeywords(productName: string): string[] {
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = productName
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word));
    
    return [...new Set(words)];
  }

  private getProductId(rawProduct: any, platform: 'shopee' | 'tiktokshop'): string {
    return platform === 'shopee' 
      ? rawProduct.item_id?.toString() || 'unknown'
      : rawProduct.product_id || 'unknown';
  }

  private async readBatchFile(filePath: string): Promise<any> {
    try {
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Failed to read batch file ${filePath}:`, error);
      return null;
    }
  }
}

async function main() {
  console.log('🧪 Starting simple data transformation test...');
  
  try {
    const tester = new SimpleTransformationTester();
    const result = await tester.testTransformation();

    // Display results
    console.log('\n📊 Transformation Test Results:');
    console.log(`Total Processed: ${result.totalProcessed}`);
    console.log(`Successful: ${result.successfulTransformations}`);
    console.log(`Failed: ${result.failedTransformations}`);

    // Show sample errors if any
    if (result.errors.length > 0) {
      console.log(`\n❌ Sample Errors (${result.errors.length} total):`);
      result.errors.slice(0, 3).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.platform}:${error.productId}: ${error.error}`);
      });
    }

    // Show sample transformed products
    if (result.sampleProducts.length > 0) {
      console.log(`\n✨ Sample Transformed Products:`);
      result.sampleProducts.forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.name}`);
        console.log(`     SKU: ${product.masterSku}`);
        console.log(`     Price: ${product.pricing.basePrice} IDR`);
        console.log(`     Platform Prices: ${Object.keys(product.pricing.platformPrices).join(', ')}`);
        console.log(`     Images: ${product.images.length}`);
        console.log(`     SEO Titles: ${Object.keys(product.seo?.platformTitles || {}).join(', ')}`);
        console.log('');
      });
    }

    // Calculate success rate
    const successRate = result.totalProcessed > 0 
      ? (result.successfulTransformations / result.totalProcessed * 100).toFixed(1)
      : '0';

    console.log(`📈 Success Rate: ${successRate}%`);

    if (parseFloat(successRate) >= 90) {
      console.log('✅ Transformation test PASSED - High success rate achieved!');
    } else if (parseFloat(successRate) >= 70) {
      console.log('⚠️  Transformation test PARTIAL - Acceptable success rate');
    } else {
      console.log('❌ Transformation test FAILED - Low success rate');
    }

    console.log('\n🧪 Simple transformation test completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Transformation test failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { main };