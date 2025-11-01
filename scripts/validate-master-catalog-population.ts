/**
 * Master Catalog Population Validation Script
 * Validates the populated master catalog data
 */

import { db } from '../src/lib/db';
import { masterProducts, platformMappings, importBatches } from '../src/lib/db/master-catalog-schema';
import { eq, count, sql } from 'drizzle-orm';

interface ValidationResult {
  totalMasterProducts: number;
  totalPlatformMappings: number;
  totalImportBatches: number;
  platformBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  dataQualityStats: {
    averageQualityScore: number;
    productsWithErrors: number;
    productsWithWarnings: number;
  };
  pricingValidation: {
    productsWithPricing: number;
    averageBasePrice: number;
    platformPriceCount: Record<string, number>;
  };
  seoValidation: {
    productsWithSEO: number;
    platformTitleCount: Record<string, number>;
  };
  sampleProducts: any[];
}

async function validateMasterCatalog(): Promise<ValidationResult> {
  console.log('🔍 Validating master catalog population...');

  // Get total counts
  const [totalMasterProducts] = await db.select({ count: count() }).from(masterProducts);
  const [totalPlatformMappings] = await db.select({ count: count() }).from(platformMappings);
  const [totalImportBatches] = await db.select({ count: count() }).from(importBatches);

  console.log(`📊 Found ${totalMasterProducts.count} master products`);
  console.log(`📊 Found ${totalPlatformMappings.count} platform mappings`);
  console.log(`📊 Found ${totalImportBatches.count} import batches`);

  // Get platform breakdown
  const platformBreakdownQuery = await db
    .select({
      platform: platformMappings.platform,
      count: count()
    })
    .from(platformMappings)
    .groupBy(platformMappings.platform);

  const platformBreakdown: Record<string, number> = {};
  platformBreakdownQuery.forEach(row => {
    platformBreakdown[row.platform] = row.count;
  });

  // Get status breakdown
  const statusBreakdownQuery = await db
    .select({
      status: masterProducts.status,
      count: count()
    })
    .from(masterProducts)
    .groupBy(masterProducts.status);

  const statusBreakdown: Record<string, number> = {};
  statusBreakdownQuery.forEach(row => {
    statusBreakdown[row.status] = row.count;
  });

  // Get data quality stats
  const qualityStatsQuery = await db
    .select({
      avgQuality: sql<number>`AVG(COALESCE(${masterProducts.dataQualityScore}, 0))`,
      withErrors: sql<number>`COUNT(CASE WHEN jsonb_array_length(${masterProducts.validationErrors}) > 0 THEN 1 END)`,
      withWarnings: sql<number>`COUNT(CASE WHEN jsonb_array_length(${masterProducts.validationWarnings}) > 0 THEN 1 END)`,
    })
    .from(masterProducts);

  const qualityStats = qualityStatsQuery[0];

  // Get pricing validation
  const pricingStatsQuery = await db
    .select({
      avgBasePrice: sql<number>`AVG(CAST(${masterProducts.basePrice} AS NUMERIC))`,
      withPricing: sql<number>`COUNT(CASE WHEN ${masterProducts.platformPrices} != '{}' THEN 1 END)`,
    })
    .from(masterProducts);

  const pricingStats = pricingStatsQuery[0];

  // Get SEO validation
  const seoStatsQuery = await db
    .select({
      withSEO: sql<number>`COUNT(CASE WHEN ${masterProducts.seoData} != '{}' THEN 1 END)`,
    })
    .from(masterProducts);

  const seoStats = seoStatsQuery[0];

  // Get sample products
  const sampleProducts = await db
    .select()
    .from(masterProducts)
    .limit(5);

  // Analyze platform prices and SEO titles from sample products
  const platformPriceCount: Record<string, number> = {};
  const platformTitleCount: Record<string, number> = {};

  sampleProducts.forEach(product => {
    if (product.platformPrices && typeof product.platformPrices === 'object') {
      Object.keys(product.platformPrices).forEach(platform => {
        platformPriceCount[platform] = (platformPriceCount[platform] || 0) + 1;
      });
    }

    if (product.seoData && typeof product.seoData === 'object') {
      const seoData = product.seoData as any;
      if (seoData.platformTitles) {
        Object.keys(seoData.platformTitles).forEach(platform => {
          platformTitleCount[platform] = (platformTitleCount[platform] || 0) + 1;
        });
      }
    }
  });

  return {
    totalMasterProducts: totalMasterProducts.count,
    totalPlatformMappings: totalPlatformMappings.count,
    totalImportBatches: totalImportBatches.count,
    platformBreakdown,
    statusBreakdown,
    dataQualityStats: {
      averageQualityScore: Math.round(qualityStats.avgQuality || 0),
      productsWithErrors: qualityStats.withErrors || 0,
      productsWithWarnings: qualityStats.withWarnings || 0,
    },
    pricingValidation: {
      productsWithPricing: pricingStats.withPricing || 0,
      averageBasePrice: Math.round(pricingStats.avgBasePrice || 0),
      platformPriceCount,
    },
    seoValidation: {
      productsWithSEO: seoStats.withSEO || 0,
      platformTitleCount,
    },
    sampleProducts: sampleProducts.map(p => ({
      id: p.id,
      masterSku: p.masterSku,
      name: p.name,
      basePrice: p.basePrice,
      status: p.status,
      importSource: p.importSource,
    })),
  };
}

async function main() {
  console.log('🔍 Starting master catalog validation...');
  
  try {
    const result = await validateMasterCatalog();

    // Display validation results
    console.log('\n📊 Master Catalog Validation Results');
    console.log('=====================================');

    console.log(`\n📈 Overview:`);
    console.log(`  Master Products: ${result.totalMasterProducts}`);
    console.log(`  Platform Mappings: ${result.totalPlatformMappings}`);
    console.log(`  Import Batches: ${result.totalImportBatches}`);

    console.log(`\n🏪 Platform Breakdown:`);
    Object.entries(result.platformBreakdown).forEach(([platform, count]) => {
      console.log(`  ${platform}: ${count} mappings`);
    });

    console.log(`\n📊 Status Breakdown:`);
    Object.entries(result.statusBreakdown).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} products`);
    });

    console.log(`\n🎯 Data Quality:`);
    console.log(`  Average Quality Score: ${result.dataQualityStats.averageQualityScore}/100`);
    console.log(`  Products with Errors: ${result.dataQualityStats.productsWithErrors}`);
    console.log(`  Products with Warnings: ${result.dataQualityStats.productsWithWarnings}`);

    console.log(`\n💰 Pricing Validation:`);
    console.log(`  Products with Pricing: ${result.pricingValidation.productsWithPricing}/${result.totalMasterProducts}`);
    console.log(`  Average Base Price: ${result.pricingValidation.averageBasePrice.toLocaleString()} IDR`);
    console.log(`  Platform Price Coverage:`);
    Object.entries(result.pricingValidation.platformPriceCount).forEach(([platform, count]) => {
      console.log(`    ${platform}: ${count} products`);
    });

    console.log(`\n🔍 SEO Validation:`);
    console.log(`  Products with SEO Data: ${result.seoValidation.productsWithSEO}/${result.totalMasterProducts}`);
    console.log(`  Platform Title Coverage:`);
    Object.entries(result.seoValidation.platformTitleCount).forEach(([platform, count]) => {
      console.log(`    ${platform}: ${count} products`);
    });

    console.log(`\n📝 Sample Products:`);
    result.sampleProducts.forEach((product, index) => {
      console.log(`  ${index + 1}. ${product.name}`);
      console.log(`     SKU: ${product.masterSku}`);
      console.log(`     Price: ${product.basePrice} IDR`);
      console.log(`     Status: ${product.status}`);
      console.log(`     Source: ${product.importSource}`);
      console.log('');
    });

    // Validation checks
    const validationIssues: string[] = [];
    const validationWarnings: string[] = [];

    if (result.totalMasterProducts === 0) {
      validationIssues.push('No master products found');
    }

    if (result.totalPlatformMappings === 0) {
      validationIssues.push('No platform mappings found');
    }

    if (result.pricingValidation.productsWithPricing < result.totalMasterProducts * 0.9) {
      validationWarnings.push('Less than 90% of products have pricing data');
    }

    if (result.seoValidation.productsWithSEO < result.totalMasterProducts * 0.9) {
      validationWarnings.push('Less than 90% of products have SEO data');
    }

    if (result.dataQualityStats.averageQualityScore < 80) {
      validationWarnings.push('Average data quality score is below 80');
    }

    if (result.dataQualityStats.productsWithErrors > result.totalMasterProducts * 0.1) {
      validationWarnings.push('More than 10% of products have validation errors');
    }

    // Display validation summary
    console.log('\n🎯 Validation Summary');
    console.log('====================');

    if (validationIssues.length > 0) {
      console.log('\n❌ Critical Issues:');
      validationIssues.forEach(issue => console.log(`  - ${issue}`));
    }

    if (validationWarnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      validationWarnings.forEach(warning => console.log(`  - ${warning}`));
    }

    if (validationIssues.length === 0 && validationWarnings.length === 0) {
      console.log('\n✅ All validation checks passed!');
      console.log('🎉 Master catalog is ready for Phase 2!');
    } else if (validationIssues.length === 0) {
      console.log('\n⚠️  Validation completed with warnings');
      console.log('📝 Review warnings but ready to proceed');
    } else {
      console.log('\n❌ Validation failed with critical issues');
      console.log('🔧 Please fix issues before proceeding');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Master catalog validation failed:', error);
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

export { main };