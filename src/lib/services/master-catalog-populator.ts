/**
 * Master Catalog Populator
 * Transforms raw imported data into master catalog entries
 */

import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { 
  masterProducts, 
  masterProductVariants, 
  platformMappings, 
  importBatches,
  type InsertMasterProduct,
  type InsertMasterProductVariant,
  type InsertPlatformMapping,
  type InsertImportBatch
} from '@/lib/db/master-catalog-schema';
import { 
  MasterProductSchema, 
  type MasterProduct,
  type ProductImage,
  type ProductCategory,
  type Dimensions,
  createMasterProduct,
  updatePlatformPricing
} from '@/lib/schema/master-product-schema';
import { createDefaultPricingCalculator } from '@/lib/pricing/pricing-calculator';
import { createDefaultTitleGenerator } from '@/lib/seo/title-generator';

export interface PopulationOptions {
  organizationId: string;
  batchSize?: number;
  skipExisting?: boolean;
  dryRun?: boolean;
  platforms?: ('shopee' | 'tiktokshop')[];
}

export interface PopulationResult {
  totalProcessed: number;
  successfulProducts: number;
  failedProducts: number;
  skippedProducts: number;
  errors: Array<{
    productId: string;
    platform: string;
    error: string;
  }>;
  warnings: Array<{
    productId: string;
    platform: string;
    warning: string;
  }>;
  importBatchId: string;
}

export class MasterCatalogPopulator {
  private basePath: string;
  private organizationId: string;

  constructor(basePath = './data/raw-imports', organizationId: string) {
    this.basePath = basePath;
    this.organizationId = organizationId;
  }

  /**
   * Populate master catalog from all imported data
   */
  async populateFromImports(options: PopulationOptions): Promise<PopulationResult> {
    const result: PopulationResult = {
      totalProcessed: 0,
      successfulProducts: 0,
      failedProducts: 0,
      skippedProducts: 0,
      errors: [],
      warnings: [],
      importBatchId: `master_import_${Date.now()}`,
    };

    console.log('🚀 Starting master catalog population...');

    try {
      // Create import batch record
      await this.createImportBatch(result.importBatchId, options);

      // Get platforms to process
      const platforms = options.platforms || ['shopee', 'tiktokshop'];

      // Process each platform
      for (const platform of platforms) {
        console.log(`\n📦 Processing ${platform} data...`);
        const platformResult = await this.processPlatformData(platform, options, result.importBatchId);
        
        result.totalProcessed += platformResult.totalProcessed;
        result.successfulProducts += platformResult.successfulProducts;
        result.failedProducts += platformResult.failedProducts;
        result.skippedProducts += platformResult.skippedProducts;
        result.errors.push(...platformResult.errors);
        result.warnings.push(...platformResult.warnings);
      }

      // Update import batch with final results
      await this.updateImportBatch(result.importBatchId, result, 'completed');

      console.log('\n✅ Master catalog population completed!');
      console.log(`📊 Results: ${result.successfulProducts} successful, ${result.failedProducts} failed, ${result.skippedProducts} skipped`);

      return result;
    } catch (error) {
      console.error('❌ Master catalog population failed:', error);
      await this.updateImportBatch(result.importBatchId, result, 'failed');
      throw error;
    }
  }

  /**
   * Process data for a specific platform
   */
  private async processPlatformData(
    platform: 'shopee' | 'tiktokshop',
    options: PopulationOptions,
    importBatchId: string
  ): Promise<PopulationResult> {
    const result: PopulationResult = {
      totalProcessed: 0,
      successfulProducts: 0,
      failedProducts: 0,
      skippedProducts: 0,
      errors: [],
      warnings: [],
      importBatchId,
    };

    const platformPath = path.join(this.basePath, platform);
    
    if (!existsSync(platformPath)) {
      console.log(`⚠️  No data found for platform: ${platform}`);
      return result;
    }

    // Get all batch files for this platform
    const files = await readdir(platformPath);
    const batchFiles = files.filter(file => file.startsWith('batch_') && file.endsWith('.json'));

    console.log(`📁 Found ${batchFiles.length} batch files for ${platform}`);

    // Process each batch file
    for (const file of batchFiles) {
      try {
        const filePath = path.join(platformPath, file);
        const batchData = await this.readBatchFile(filePath);
        
        if (!batchData || !batchData.products) {
          result.warnings.push({
            productId: 'unknown',
            platform,
            warning: `Invalid batch file format: ${file}`,
          });
          continue;
        }

        console.log(`📄 Processing batch file: ${file} (${batchData.products.length} products)`);

        // Process products in this batch
        for (const rawProduct of batchData.products) {
          try {
            result.totalProcessed++;
            
            const productResult = await this.processProduct(rawProduct, platform, options, importBatchId);
            
            if (productResult.success) {
              result.successfulProducts++;
            } else if (productResult.skipped) {
              result.skippedProducts++;
            } else {
              result.failedProducts++;
              result.errors.push({
                productId: productResult.productId || 'unknown',
                platform,
                error: productResult.error || 'Unknown error',
              });
            }

            if (productResult.warnings) {
              result.warnings.push(...productResult.warnings.map(warning => ({
                productId: productResult.productId || 'unknown',
                platform,
                warning,
              })));
            }

          } catch (error) {
            result.failedProducts++;
            result.errors.push({
              productId: 'unknown',
              platform,
              error: `Product processing error: ${error}`,
            });
          }
        }

      } catch (error) {
        result.warnings.push({
          productId: 'unknown',
          platform,
          warning: `Failed to process batch file ${file}: ${error}`,
        });
      }
    }

    return result;
  }

  /**
   * Process a single product
   */
  private async processProduct(
    rawProduct: any,
    platform: 'shopee' | 'tiktokshop',
    options: PopulationOptions,
    importBatchId: string
  ): Promise<{
    success: boolean;
    skipped: boolean;
    productId?: string;
    error?: string;
    warnings?: string[];
  }> {
    const warnings: string[] = [];
    
    try {
      // Extract product ID based on platform
      const productId = platform === 'shopee' 
        ? rawProduct.item_id?.toString() 
        : rawProduct.product_id;

      if (!productId) {
        return {
          success: false,
          skipped: false,
          error: 'Missing product ID',
        };
      }

      // Check if product already exists (if skipExisting is enabled)
      if (options.skipExisting) {
        const existingMapping = await db
          .select()
          .from(platformMappings)
          .where(and(
            eq(platformMappings.platform, platform),
            eq(platformMappings.platformProductId, productId)
          ))
          .limit(1);

        if (existingMapping.length > 0) {
          return {
            success: false,
            skipped: true,
            productId,
          };
        }
      }

      // Transform raw product to master product
      const masterProduct = await this.transformToMasterProduct(rawProduct, platform, importBatchId);
      
      if (!masterProduct) {
        return {
          success: false,
          skipped: false,
          productId,
          error: 'Failed to transform product data',
        };
      }

      // Validate master product
      const validation = MasterProductSchema.safeParse(masterProduct);
      if (!validation.success) {
        return {
          success: false,
          skipped: false,
          productId,
          error: `Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`,
        };
      }

      if (options.dryRun) {
        console.log(`🔍 [DRY RUN] Would create master product: ${masterProduct.name}`);
        return {
          success: true,
          skipped: false,
          productId,
          warnings,
        };
      }

      // Insert master product into database
      const insertedProduct = await this.insertMasterProduct(masterProduct, options.organizationId);
      
      // Create platform mapping
      await this.createPlatformMapping(insertedProduct.id, rawProduct, platform, productId);

      console.log(`✅ Created master product: ${masterProduct.name} (${productId})`);

      return {
        success: true,
        skipped: false,
        productId,
        warnings,
      };

    } catch (error) {
      return {
        success: false,
        skipped: false,
        productId: rawProduct.item_id?.toString() || rawProduct.product_id,
        error: `Processing error: ${error}`,
      };
    }
  }

  /**
   * Transform raw product data to master product schema
   */
  private async transformToMasterProduct(
    rawProduct: any,
    platform: 'shopee' | 'tiktokshop',
    importBatchId: string
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
        currency: 'IDR',
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
        status: 'active',
        importSource: platform,
        importedAt: new Date(),
        importBatchId,
        hasVariants: false, // Will be updated if variants are found
        variants: [],
      });

      return masterProduct;

    } catch (error) {
      console.error(`❌ Failed to transform ${platform} product:`, error);
      return null;
    }
  }

  /**
   * Extract common fields from raw product data
   */
  private extractCommonFields(rawProduct: any, platform: 'shopee' | 'tiktokshop') {
    try {
      if (platform === 'shopee') {
        return {
          name: rawProduct.item_name || 'Unnamed Product',
          description: rawProduct.description || 'No description available',
          price: this.extractShopeePrice(rawProduct),
          weight: rawProduct.weight || 0,
          dimensions: this.extractShopeeDimensions(rawProduct),
          images: this.extractShopeeImages(rawProduct),
          category: this.extractShopeeCategory(rawProduct),
          brand: this.extractShopeeBrand(rawProduct),
        };
      } else {
        return {
          name: rawProduct.product_name || 'Unnamed Product',
          description: rawProduct.description || 'No description available',
          price: rawProduct.price || 0,
          weight: rawProduct.weight || 0,
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

  /**
   * Extract Shopee-specific data
   */
  private extractShopeePrice(rawProduct: any): number {
    // Shopee might have price in different formats
    if (rawProduct.price) return rawProduct.price;
    if (rawProduct.price_info?.current_price) return rawProduct.price_info.current_price;
    
    // For mock data, generate a reasonable price based on product name
    const productName = rawProduct.item_name || '';
    let basePrice = 50000; // Default base price in IDR
    
    if (productName.toLowerCase().includes('frame')) basePrice = 150000;
    else if (productName.toLowerCase().includes('motor')) basePrice = 200000;
    else if (productName.toLowerCase().includes('battery')) basePrice = 300000;
    else if (productName.toLowerCase().includes('esc')) basePrice = 180000;
    else if (productName.toLowerCase().includes('propeller')) basePrice = 80000;
    
    // Add some variation based on item_id
    const variation = (rawProduct.item_id % 100) * 1000;
    return basePrice + variation;
  }

  private extractShopeeDimensions(rawProduct: any): Dimensions {
    const dim = rawProduct.dimension || {};
    return {
      length: dim.package_length || 0,
      width: dim.package_width || 0,
      height: dim.package_height || 0,
      unit: 'cm',
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
      name: 'Electronics', // Default category
      path: ['Electronics', 'Drone Parts'],
      level: 2,
    };
  }

  private extractShopeeBrand(rawProduct: any): string {
    if (rawProduct.brand?.original_brand_name) return rawProduct.brand.original_brand_name;
    if (rawProduct.brand_name) return rawProduct.brand_name;
    return 'Unknown Brand';
  }

  /**
   * Extract TikTok Shop-specific data
   */
  private extractTikTokDimensions(rawProduct: any): Dimensions {
    const dim = rawProduct.dimensions || {};
    return {
      length: dim.length || 0,
      width: dim.width || 0,
      height: dim.height || 0,
      unit: 'cm',
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
      name: 'Electronics', // Default category
      path: ['Electronics', 'Drone Parts'],
      level: 2,
    };
  }

  /**
   * Generate master SKU from product data
   */
  private generateMasterSku(rawProduct: any, platform: 'shopee' | 'tiktokshop'): string {
    const productId = platform === 'shopee' 
      ? rawProduct.item_id?.toString() 
      : rawProduct.product_id;
    
    const platformPrefix = platform === 'shopee' ? 'SH' : 'TT';
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    
    return `${platformPrefix}-${productId}-${timestamp}`;
  }

  /**
   * Extract keywords from product name
   */
  private extractKeywords(productName: string): string[] {
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = productName
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word));
    
    return [...new Set(words)]; // Remove duplicates
  }

  /**
   * Insert master product into database
   */
  private async insertMasterProduct(masterProduct: MasterProduct, organizationId: string) {
    const insertData: InsertMasterProduct = {
      organizationId,
      masterSku: masterProduct.masterSku,
      name: masterProduct.name,
      description: masterProduct.description,
      weight: masterProduct.weight.toString(),
      dimensions: masterProduct.dimensions,
      images: masterProduct.images,
      category: masterProduct.category,
      brand: masterProduct.brand,
      basePrice: masterProduct.pricing.basePrice.toString(),
      currency: masterProduct.pricing.currency,
      platformPrices: masterProduct.pricing.platformPrices as any,
      hasVariants: masterProduct.hasVariants,
      seoData: (masterProduct.seo || {}) as any,
      tags: masterProduct.tags,
      status: masterProduct.status,
      importSource: masterProduct.importSource,
      importedAt: masterProduct.importedAt,
      importBatchId: masterProduct.importBatchId,
    };

    const [inserted] = await db.insert(masterProducts).values(insertData).returning();
    return inserted;
  }

  /**
   * Create platform mapping
   */
  private async createPlatformMapping(
    masterProductId: string,
    rawProduct: any,
    platform: 'shopee' | 'tiktokshop',
    platformProductId: string
  ) {
    const mappingData: InsertPlatformMapping = {
      masterProductId,
      platform,
      platformProductId,
      platformData: rawProduct,
      isActive: true,
      syncStatus: 'synced',
      lastSyncAt: new Date(),
    };

    await db.insert(platformMappings).values(mappingData);
  }

  /**
   * Read batch file
   */
  private async readBatchFile(filePath: string): Promise<any> {
    try {
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Failed to read batch file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Create import batch record
   */
  private async createImportBatch(batchId: string, options: PopulationOptions) {
    const batchData: InsertImportBatch = {
      organizationId: options.organizationId,
      batchId,
      platform: 'multi', // Multiple platforms
      importType: 'master_catalog_population',
      status: 'running',
      startedAt: new Date(),
      importConfig: options as any,
    };

    await db.insert(importBatches).values(batchData);
  }

  /**
   * Update import batch with results
   */
  private async updateImportBatch(
    batchId: string,
    result: PopulationResult,
    status: 'completed' | 'failed'
  ) {
    await db
      .update(importBatches)
      .set({
        status,
        completedAt: new Date(),
        totalProducts: result.totalProcessed,
        successfulProducts: result.successfulProducts,
        failedProducts: result.failedProducts,
        skippedProducts: result.skippedProducts,
        errors: result.errors,
        warnings: result.warnings,
      })
      .where(eq(importBatches.batchId, batchId));
  }

  /**
   * Generate population report
   */
  async generateReport(importBatchId: string): Promise<string> {
    const batch = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.batchId, importBatchId))
      .limit(1);

    if (batch.length === 0) {
      return 'Import batch not found';
    }

    const batchData = batch[0];
    
    let report = `📊 Master Catalog Population Report\n`;
    report += `=====================================\n\n`;
    report += `Batch ID: ${batchData.batchId}\n`;
    report += `Status: ${batchData.status}\n`;
    report += `Started: ${batchData.startedAt?.toISOString()}\n`;
    report += `Completed: ${batchData.completedAt?.toISOString()}\n\n`;

    report += `Results:\n`;
    report += `  Total Processed: ${batchData.totalProducts}\n`;
    report += `  Successful: ${batchData.successfulProducts}\n`;
    report += `  Failed: ${batchData.failedProducts}\n`;
    report += `  Skipped: ${batchData.skippedProducts}\n\n`;

    if (batchData.errors && Array.isArray(batchData.errors) && batchData.errors.length > 0) {
      report += `Errors (${batchData.errors.length}):\n`;
      batchData.errors.slice(0, 10).forEach((error: any) => {
        report += `  - ${error.platform}:${error.productId}: ${error.error}\n`;
      });
      if (batchData.errors.length > 10) {
        report += `  ... and ${batchData.errors.length - 10} more errors\n`;
      }
      report += `\n`;
    }

    if (batchData.warnings && Array.isArray(batchData.warnings) && batchData.warnings.length > 0) {
      report += `Warnings (${batchData.warnings.length}):\n`;
      batchData.warnings.slice(0, 5).forEach((warning: any) => {
        report += `  - ${warning.platform}:${warning.productId}: ${warning.warning}\n`;
      });
      if (batchData.warnings.length > 5) {
        report += `  ... and ${batchData.warnings.length - 5} more warnings\n`;
      }
    }

    return report;
  }
}

// Export singleton instance
export const masterCatalogPopulator = new MasterCatalogPopulator('./data/raw-imports', 'default-org');