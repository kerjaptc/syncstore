/**
 * Comprehensive Master Catalog Completeness Validation Script
 * Task 7.3: Validate master catalog completeness
 * 
 * This script validates:
 * 1. All imported products are represented in master catalog
 * 2. Platform mapping accuracy and completeness
 * 3. Pricing calculations for sample products
 */

import { db } from '../src/lib/db';
import { masterProducts, platformMappings, importBatches } from '../src/lib/db/master-catalog-schema';
import { eq, count, sql, inArray } from 'drizzle-orm';
import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

interface ValidationResult {
  rawDataAnalysis: RawDataAnalysis;
  masterCatalogAnalysis: MasterCatalogAnalysis;
  platformMappingAnalysis: PlatformMappingAnalysis;
  pricingValidation: PricingValidation;
  completenessScore: number;
  issues: ValidationIssue[];
  recommendations: string[];
}

interface RawDataAnalysis {
  totalRawProducts: number;
  productsByPlatform: Record<string, number>;
  uniqueProductIds: Set<string>;
  sampleRawProducts: any[];
}

interface MasterCatalogAnalysis {
  totalMasterProducts: number;
  productsByStatus: Record<string, number>;
  productsByImportSource: Record<string, number>;
  averageDataQualityScore: number;
  productsWithErrors: number;
  sampleMasterProducts: any[];
}

interface PlatformMappingAnalysis {
  totalMappings: number;
  mappingsByPlatform: Record<string, number>;
  mappingsBySyncStatus: Record<string, number>;
  orphanedMappings: number;
  missingMappings: number;
}

interface PricingValidation {
  productsWithPricing: number;
  pricingAccuracy: number;
  pricingIssues: PricingIssue[];
  samplePricingTests: PricingTest[];
}

interface ValidationIssue {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  count?: number;
  examples?: string[];
}

interface PricingIssue {
  productId: string;
  masterSku: string;
  platform: string;
  expectedPrice: number;
  actualPrice: number;
  difference: number;
}

interface PricingTest {
  productId: string;
  masterSku: string;
  basePrice: number;
  platformPrices: Record<string, number>;
  calculatedPrices: Record<string, number>;
  isAccurate: boolean;
}

class MasterCatalogCompletenessValidator {
  private readonly rawDataPath = './data/raw-imports';
  private readonly platforms = ['shopee', 'tiktokshop'];
  private readonly expectedFeePercentages = {
    shopee: 15,
    tiktokshop: 20
  };

  async validateCompleteness(): Promise<ValidationResult> {
    console.log('🔍 Starting comprehensive master catalog completeness validation...');

    const rawDataAnalysis = await this.analyzeRawData();
    const masterCatalogAnalysis = await this.analyzeMasterCatalog();
    const platformMappingAnalysis = await this.analyzePlatformMappings();
    const pricingValidation = await this.validatePricing();

    const completenessScore = this.calculateCompletenessScore(
      rawDataAnalysis,
      masterCatalogAnalysis,
      platformMappingAnalysis,
      pricingValidation
    );

    const issues = this.identifyIssues(
      rawDataAnalysis,
      masterCatalogAnalysis,
      platformMappingAnalysis,
      pricingValidation
    );

    const recommendations = this.generateRecommendations(issues);

    return {
      rawDataAnalysis,
      masterCatalogAnalysis,
      platformMappingAnalysis,
      pricingValidation,
      completenessScore,
      issues,
      recommendations
    };
  }

  private async analyzeRawData(): Promise<RawDataAnalysis> {
    console.log('📊 Analyzing raw imported data...');

    const analysis: RawDataAnalysis = {
      totalRawProducts: 0,
      productsByPlatform: {},
      uniqueProductIds: new Set(),
      sampleRawProducts: []
    };

    for (const platform of this.platforms) {
      const platformPath = path.join(this.rawDataPath, platform);
      
      if (!existsSync(platformPath)) {
        console.log(`  ⚠️  No raw data found for platform: ${platform}`);
        analysis.productsByPlatform[platform] = 0;
        continue;
      }

      const files = await readdir(platformPath);
      const batchFiles = files.filter(file => file.startsWith('batch_') && file.endsWith('.json'));
      
      let platformProductCount = 0;

      // Analyze first few batch files for sampling
      const sampleFiles = batchFiles.slice(0, 3);
      
      for (const file of sampleFiles) {
        try {
          const filePath = path.join(platformPath, file);
          const content = await readFile(filePath, 'utf8');
          const batchData = JSON.parse(content);
          
          if (batchData?.products) {
            platformProductCount += batchData.products.length;
            
            // Collect unique product IDs
            batchData.products.forEach((product: any) => {
              const productId = platform === 'shopee' 
                ? product.item_id?.toString() 
                : product.product_id;
              
              if (productId) {
                analysis.uniqueProductIds.add(`${platform}:${productId}`);
                
                // Collect sample products
                if (analysis.sampleRawProducts.length < 10) {
                  analysis.sampleRawProducts.push({
                    platform,
                    productId,
                    name: platform === 'shopee' ? product.item_name : product.product_name,
                    price: platform === 'shopee' ? product.price : product.price,
                    hasImages: platform === 'shopee' 
                      ? !!(product.image?.image_url_list?.length)
                      : !!(product.images?.length)
                  });
                }
              }
            });
          }
        } catch (error) {
          console.log(`    ❌ Failed to parse ${file}: ${error}`);
        }
      }

      analysis.productsByPlatform[platform] = platformProductCount;
      analysis.totalRawProducts += platformProductCount;
    }

    return analysis;
  }

  private async analyzeMasterCatalog(): Promise<MasterCatalogAnalysis> {
    console.log('🏪 Analyzing master catalog...');

    // Get total master products
    const [totalResult] = await db.select({ count: count() }).from(masterProducts);
    const totalMasterProducts = totalResult.count;

    // Get products by status
    const statusBreakdown = await db
      .select({
        status: masterProducts.status,
        count: count()
      })
      .from(masterProducts)
      .groupBy(masterProducts.status);

    const productsByStatus: Record<string, number> = {};
    statusBreakdown.forEach(row => {
      productsByStatus[row.status] = row.count;
    });

    // Get products by import source
    const sourceBreakdown = await db
      .select({
        importSource: masterProducts.importSource,
        count: count()
      })
      .from(masterProducts)
      .groupBy(masterProducts.importSource);

    const productsByImportSource: Record<string, number> = {};
    sourceBreakdown.forEach(row => {
      productsByImportSource[row.importSource || 'unknown'] = row.count;
    });

    // Get data quality statistics
    const qualityStats = await db
      .select({
        avgQuality: sql<number>`AVG(COALESCE(${masterProducts.dataQualityScore}, 0))`,
        withErrors: sql<number>`COUNT(CASE WHEN jsonb_array_length(${masterProducts.validationErrors}) > 0 THEN 1 END)`,
      })
      .from(masterProducts);

    const avgQuality = Math.round(qualityStats[0]?.avgQuality || 0);
    const productsWithErrors = qualityStats[0]?.withErrors || 0;

    // Get sample master products
    const sampleMasterProducts = await db
      .select({
        id: masterProducts.id,
        masterSku: masterProducts.masterSku,
        name: masterProducts.name,
        basePrice: masterProducts.basePrice,
        status: masterProducts.status,
        importSource: masterProducts.importSource,
        dataQualityScore: masterProducts.dataQualityScore,
        platformPrices: masterProducts.platformPrices
      })
      .from(masterProducts)
      .limit(10);

    return {
      totalMasterProducts,
      productsByStatus,
      productsByImportSource,
      averageDataQualityScore: avgQuality,
      productsWithErrors,
      sampleMasterProducts
    };
  }

  private async analyzePlatformMappings(): Promise<PlatformMappingAnalysis> {
    console.log('🔗 Analyzing platform mappings...');

    // Get total mappings
    const [totalResult] = await db.select({ count: count() }).from(platformMappings);
    const totalMappings = totalResult.count;

    // Get mappings by platform
    const platformBreakdown = await db
      .select({
        platform: platformMappings.platform,
        count: count()
      })
      .from(platformMappings)
      .groupBy(platformMappings.platform);

    const mappingsByPlatform: Record<string, number> = {};
    platformBreakdown.forEach(row => {
      mappingsByPlatform[row.platform] = row.count;
    });

    // Get mappings by sync status
    const syncStatusBreakdown = await db
      .select({
        syncStatus: platformMappings.syncStatus,
        count: count()
      })
      .from(platformMappings)
      .groupBy(platformMappings.syncStatus);

    const mappingsBySyncStatus: Record<string, number> = {};
    syncStatusBreakdown.forEach(row => {
      mappingsBySyncStatus[row.syncStatus] = row.count;
    });

    // Check for orphaned mappings (mappings without master products)
    const orphanedMappingsResult = await db
      .select({ count: count() })
      .from(platformMappings)
      .leftJoin(masterProducts, eq(platformMappings.masterProductId, masterProducts.id))
      .where(sql`${masterProducts.id} IS NULL`);

    const orphanedMappings = orphanedMappingsResult[0]?.count || 0;

    // Check for missing mappings (master products without mappings)
    const missingMappingsResult = await db
      .select({ count: count() })
      .from(masterProducts)
      .leftJoin(platformMappings, eq(masterProducts.id, platformMappings.masterProductId))
      .where(sql`${platformMappings.id} IS NULL`);

    const missingMappings = missingMappingsResult[0]?.count || 0;

    return {
      totalMappings,
      mappingsByPlatform,
      mappingsBySyncStatus,
      orphanedMappings,
      missingMappings
    };
  }

  private async validatePricing(): Promise<PricingValidation> {
    console.log('💰 Validating pricing calculations...');

    // Get products with pricing data
    const productsWithPricingResult = await db
      .select({ count: count() })
      .from(masterProducts)
      .where(sql`${masterProducts.platformPrices} != '{}'`);

    const productsWithPricing = productsWithPricingResult[0]?.count || 0;

    // Get sample products for detailed pricing validation
    const sampleProducts = await db
      .select({
        id: masterProducts.id,
        masterSku: masterProducts.masterSku,
        name: masterProducts.name,
        basePrice: masterProducts.basePrice,
        platformPrices: masterProducts.platformPrices
      })
      .from(masterProducts)
      .where(sql`${masterProducts.platformPrices} != '{}'`)
      .limit(20);

    const pricingIssues: PricingIssue[] = [];
    const samplePricingTests: PricingTest[] = [];
    let accurateCalculations = 0;
    let totalCalculations = 0;

    for (const product of sampleProducts) {
      const basePrice = parseFloat(product.basePrice.toString());
      const platformPrices = product.platformPrices as any || {};
      const calculatedPrices: Record<string, number> = {};
      let productAccurate = true;

      // Test each platform's pricing
      for (const [platform, expectedFee] of Object.entries(this.expectedFeePercentages)) {
        if (platformPrices[platform]?.price) {
          const expectedPrice = Math.round(basePrice * (1 + expectedFee / 100));
          const actualPrice = platformPrices[platform].price;
          calculatedPrices[platform] = expectedPrice;
          totalCalculations++;

          const difference = Math.abs(expectedPrice - actualPrice);
          const tolerance = Math.max(1, basePrice * 0.001); // 0.1% tolerance or minimum 1 IDR

          if (difference <= tolerance) {
            accurateCalculations++;
          } else {
            productAccurate = false;
            pricingIssues.push({
              productId: product.id,
              masterSku: product.masterSku,
              platform,
              expectedPrice,
              actualPrice,
              difference
            });
          }
        }
      }

      samplePricingTests.push({
        productId: product.id,
        masterSku: product.masterSku,
        basePrice,
        platformPrices: Object.fromEntries(
          Object.entries(platformPrices).map(([platform, data]: [string, any]) => [
            platform,
            data?.price || 0
          ])
        ),
        calculatedPrices,
        isAccurate: productAccurate
      });
    }

    const pricingAccuracy = totalCalculations > 0 
      ? Math.round((accurateCalculations / totalCalculations) * 100) 
      : 0;

    return {
      productsWithPricing,
      pricingAccuracy,
      pricingIssues: pricingIssues.slice(0, 10), // Show first 10 issues
      samplePricingTests: samplePricingTests.slice(0, 5) // Show first 5 tests
    };
  }

  private calculateCompletenessScore(
    rawData: RawDataAnalysis,
    masterCatalog: MasterCatalogAnalysis,
    mappings: PlatformMappingAnalysis,
    pricing: PricingValidation
  ): number {
    let score = 100;

    // Data coverage (30 points)
    if (masterCatalog.totalMasterProducts === 0) {
      score -= 30;
    } else if (rawData.totalRawProducts > 0) {
      const coverageRatio = masterCatalog.totalMasterProducts / rawData.totalRawProducts;
      if (coverageRatio < 0.9) score -= 15;
      else if (coverageRatio < 0.95) score -= 5;
    }

    // Platform mapping completeness (25 points)
    if (mappings.totalMappings === 0) {
      score -= 25;
    } else {
      if (mappings.orphanedMappings > 0) score -= 5;
      if (mappings.missingMappings > masterCatalog.totalMasterProducts * 0.1) score -= 10;
      
      // Check platform coverage
      const expectedPlatforms = this.platforms.length;
      const actualPlatforms = Object.keys(mappings.mappingsByPlatform).length;
      if (actualPlatforms < expectedPlatforms) score -= 10;
    }

    // Data quality (20 points)
    if (masterCatalog.averageDataQualityScore < 70) score -= 15;
    else if (masterCatalog.averageDataQualityScore < 85) score -= 5;
    
    if (masterCatalog.productsWithErrors > masterCatalog.totalMasterProducts * 0.1) score -= 5;

    // Pricing accuracy (25 points)
    if (pricing.pricingAccuracy < 80) score -= 20;
    else if (pricing.pricingAccuracy < 95) score -= 10;
    else if (pricing.pricingAccuracy < 100) score -= 5;

    return Math.max(0, score);
  }

  private identifyIssues(
    rawData: RawDataAnalysis,
    masterCatalog: MasterCatalogAnalysis,
    mappings: PlatformMappingAnalysis,
    pricing: PricingValidation
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Critical issues
    if (masterCatalog.totalMasterProducts === 0) {
      issues.push({
        type: 'critical',
        category: 'Data Coverage',
        message: 'No master products found in catalog'
      });
    }

    if (mappings.totalMappings === 0) {
      issues.push({
        type: 'critical',
        category: 'Platform Mappings',
        message: 'No platform mappings found'
      });
    }

    // Warning issues
    if (mappings.orphanedMappings > 0) {
      issues.push({
        type: 'warning',
        category: 'Platform Mappings',
        message: 'Orphaned platform mappings found',
        count: mappings.orphanedMappings
      });
    }

    if (mappings.missingMappings > 0) {
      issues.push({
        type: 'warning',
        category: 'Platform Mappings',
        message: 'Master products without platform mappings',
        count: mappings.missingMappings
      });
    }

    if (masterCatalog.productsWithErrors > 0) {
      issues.push({
        type: 'warning',
        category: 'Data Quality',
        message: 'Products with validation errors',
        count: masterCatalog.productsWithErrors
      });
    }

    if (pricing.pricingIssues.length > 0) {
      issues.push({
        type: 'warning',
        category: 'Pricing',
        message: 'Products with pricing calculation issues',
        count: pricing.pricingIssues.length,
        examples: pricing.pricingIssues.slice(0, 3).map(issue => 
          `${issue.masterSku} (${issue.platform}): Expected ${issue.expectedPrice}, Got ${issue.actualPrice}`
        )
      });
    }

    // Info issues
    if (masterCatalog.averageDataQualityScore < 90) {
      issues.push({
        type: 'info',
        category: 'Data Quality',
        message: `Average data quality score is ${masterCatalog.averageDataQualityScore}/100`
      });
    }

    return issues;
  }

  private generateRecommendations(issues: ValidationIssue[]): string[] {
    const recommendations: string[] = [];

    const criticalIssues = issues.filter(i => i.type === 'critical');
    const warningIssues = issues.filter(i => i.type === 'warning');

    if (criticalIssues.length > 0) {
      recommendations.push('🚨 Address critical issues immediately before proceeding');
      criticalIssues.forEach(issue => {
        recommendations.push(`   - ${issue.message}`);
      });
    }

    if (warningIssues.length > 0) {
      recommendations.push('⚠️  Review and fix warning issues for optimal performance');
      warningIssues.forEach(issue => {
        if (issue.count) {
          recommendations.push(`   - Fix ${issue.count} instances of: ${issue.message}`);
        } else {
          recommendations.push(`   - ${issue.message}`);
        }
      });
    }

    if (issues.length === 0) {
      recommendations.push('✅ Master catalog is in excellent condition');
      recommendations.push('🚀 Ready to proceed to Phase 2 synchronization features');
    } else if (criticalIssues.length === 0) {
      recommendations.push('📝 Master catalog is functional with minor issues');
      recommendations.push('🔧 Consider addressing warnings for production readiness');
    }

    return recommendations;
  }

  displayResults(result: ValidationResult): void {
    console.log('\n📋 Master Catalog Completeness Validation Results');
    console.log('=================================================');

    // Overall score
    console.log(`\n🎯 Overall Completeness Score: ${result.completenessScore}/100`);
    
    if (result.completenessScore >= 95) {
      console.log('   ✅ Excellent - Ready for production');
    } else if (result.completenessScore >= 80) {
      console.log('   ⚠️  Good - Minor issues to address');
    } else if (result.completenessScore >= 60) {
      console.log('   🔧 Fair - Several issues need attention');
    } else {
      console.log('   ❌ Poor - Significant issues require immediate attention');
    }

    // Raw data analysis
    console.log(`\n📊 Raw Data Analysis:`);
    console.log(`   Total Raw Products: ${result.rawDataAnalysis.totalRawProducts}`);
    console.log(`   Unique Product IDs: ${result.rawDataAnalysis.uniqueProductIds.size}`);
    console.log(`   Platform Breakdown:`);
    Object.entries(result.rawDataAnalysis.productsByPlatform).forEach(([platform, count]) => {
      console.log(`     ${platform}: ${count} products`);
    });

    // Master catalog analysis
    console.log(`\n🏪 Master Catalog Analysis:`);
    console.log(`   Total Master Products: ${result.masterCatalogAnalysis.totalMasterProducts}`);
    console.log(`   Average Data Quality: ${result.masterCatalogAnalysis.averageDataQualityScore}/100`);
    console.log(`   Products with Errors: ${result.masterCatalogAnalysis.productsWithErrors}`);
    console.log(`   Status Breakdown:`);
    Object.entries(result.masterCatalogAnalysis.productsByStatus).forEach(([status, count]) => {
      console.log(`     ${status}: ${count} products`);
    });

    // Platform mapping analysis
    console.log(`\n🔗 Platform Mapping Analysis:`);
    console.log(`   Total Mappings: ${result.platformMappingAnalysis.totalMappings}`);
    console.log(`   Orphaned Mappings: ${result.platformMappingAnalysis.orphanedMappings}`);
    console.log(`   Missing Mappings: ${result.platformMappingAnalysis.missingMappings}`);
    console.log(`   Platform Breakdown:`);
    Object.entries(result.platformMappingAnalysis.mappingsByPlatform).forEach(([platform, count]) => {
      console.log(`     ${platform}: ${count} mappings`);
    });

    // Pricing validation
    console.log(`\n💰 Pricing Validation:`);
    console.log(`   Products with Pricing: ${result.pricingValidation.productsWithPricing}`);
    console.log(`   Pricing Accuracy: ${result.pricingValidation.pricingAccuracy}%`);
    console.log(`   Pricing Issues: ${result.pricingValidation.pricingIssues.length}`);

    if (result.pricingValidation.samplePricingTests.length > 0) {
      console.log(`   Sample Pricing Tests:`);
      result.pricingValidation.samplePricingTests.slice(0, 3).forEach((test, index) => {
        console.log(`     ${index + 1}. ${test.masterSku} (Base: ${test.basePrice} IDR)`);
        Object.entries(test.platformPrices).forEach(([platform, price]) => {
          const calculated = test.calculatedPrices[platform];
          const status = Math.abs(price - calculated) <= 1 ? '✅' : '❌';
          console.log(`        ${platform}: ${price} IDR (expected: ${calculated}) ${status}`);
        });
      });
    }

    // Issues
    if (result.issues.length > 0) {
      console.log(`\n⚠️  Issues Found:`);
      result.issues.forEach(issue => {
        const icon = issue.type === 'critical' ? '🚨' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} [${issue.category}] ${issue.message}`);
        if (issue.count) console.log(`      Count: ${issue.count}`);
        if (issue.examples) {
          issue.examples.forEach(example => console.log(`      - ${example}`));
        }
      });
    }

    // Recommendations
    console.log(`\n📝 Recommendations:`);
    result.recommendations.forEach(rec => {
      console.log(`   ${rec}`);
    });
  }
}

async function main() {
  console.log('🔍 Starting comprehensive master catalog completeness validation...');
  
  try {
    const validator = new MasterCatalogCompletenessValidator();
    const result = await validator.validateCompleteness();
    
    validator.displayResults(result);

    // Exit with appropriate code
    const criticalIssues = result.issues.filter(i => i.type === 'critical').length;
    if (criticalIssues > 0) {
      console.log('\n❌ Validation failed with critical issues');
      process.exit(1);
    } else if (result.completenessScore >= 80) {
      console.log('\n✅ Validation completed successfully');
      process.exit(0);
    } else {
      console.log('\n⚠️  Validation completed with warnings');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Master catalog completeness validation failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

export { MasterCatalogCompletenessValidator, main };