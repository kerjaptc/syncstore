/**
 * Master Catalog Validation Script
 * Validates master catalog completeness and data quality
 */

const { db } = require('../src/lib/db');
const { masterProducts, platformMappings, importBatches } = require('../src/lib/db/master-catalog-schema');
const { eq, count, sql } = require('drizzle-orm');

async function main() {
  console.log('🔍 Starting master catalog validation...');
  
  try {
    // Get overall statistics
    const stats = await getOverallStats();
    displayOverallStats(stats);

    // Validate data completeness
    const completenessResults = await validateDataCompleteness();
    displayCompletenessResults(completenessResults);

    // Validate platform mappings
    const mappingResults = await validatePlatformMappings();
    displayMappingResults(mappingResults);

    // Validate pricing calculations
    const pricingResults = await validatePricingCalculations();
    displayPricingResults(pricingResults);

    // Generate validation report
    const report = generateValidationReport(stats, completenessResults, mappingResults, pricingResults);
    console.log('\n📋 Validation Report:');
    console.log(report);

    console.log('\n✅ Master catalog validation completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Master catalog validation failed:', error);
    process.exit(1);
  }
}

/**
 * Get overall statistics
 */
async function getOverallStats() {
  console.log('\n📊 Gathering overall statistics...');

  const [
    totalProducts,
    totalMappings,
    shopeeProducts,
    tiktokProducts,
    activeProducts,
    importBatchCount
  ] = await Promise.all([
    db.select({ count: count() }).from(masterProducts),
    db.select({ count: count() }).from(platformMappings),
    db.select({ count: count() }).from(platformMappings).where(eq(platformMappings.platform, 'shopee')),
    db.select({ count: count() }).from(platformMappings).where(eq(platformMappings.platform, 'tiktokshop')),
    db.select({ count: count() }).from(masterProducts).where(eq(masterProducts.status, 'active')),
    db.select({ count: count() }).from(importBatches)
  ]);

  return {
    totalProducts: totalProducts[0].count,
    totalMappings: totalMappings[0].count,
    shopeeProducts: shopeeProducts[0].count,
    tiktokProducts: tiktokProducts[0].count,
    activeProducts: activeProducts[0].count,
    importBatchCount: importBatchCount[0].count
  };
}

/**
 * Display overall statistics
 */
function displayOverallStats(stats) {
  console.log('\n📈 Overall Statistics:');
  console.log(`  Total Master Products: ${stats.totalProducts}`);
  console.log(`  Total Platform Mappings: ${stats.totalMappings}`);
  console.log(`  Shopee Products: ${stats.shopeeProducts}`);
  console.log(`  TikTok Shop Products: ${stats.tiktokProducts}`);
  console.log(`  Active Products: ${stats.activeProducts}`);
  console.log(`  Import Batches: ${stats.importBatchCount}`);
}

/**
 * Validate data completeness
 */
async function validateDataCompleteness() {
  console.log('\n🔍 Validating data completeness...');

  // Check for products with missing required fields
  const productsWithMissingData = await db
    .select({
      id: masterProducts.id,
      masterSku: masterProducts.masterSku,
      name: masterProducts.name,
      description: masterProducts.description,
      basePrice: masterProducts.basePrice,
      weight: masterProducts.weight,
      images: masterProducts.images
    })
    .from(masterProducts)
    .where(sql`
      ${masterProducts.name} IS NULL OR 
      ${masterProducts.name} = '' OR
      ${masterProducts.description} IS NULL OR 
      ${masterProducts.description} = '' OR
      ${masterProducts.basePrice} IS NULL OR 
      ${masterProducts.basePrice} <= 0 OR
      ${masterProducts.weight} IS NULL OR
      jsonb_array_length(${masterProducts.images}) = 0
    `);

  // Check for products without platform mappings
  const productsWithoutMappings = await db
    .select({
      id: masterProducts.id,
      masterSku: masterProducts.masterSku,
      name: masterProducts.name
    })
    .from(masterProducts)
    .leftJoin(platformMappings, eq(masterProducts.id, platformMappings.masterProductId))
    .where(sql`${platformMappings.id} IS NULL`);

  // Check for duplicate SKUs
  const duplicateSkus = await db
    .select({
      masterSku: masterProducts.masterSku,
      count: count()
    })
    .from(masterProducts)
    .groupBy(masterProducts.masterSku)
    .having(sql`count(*) > 1`);

  return {
    missingDataCount: productsWithMissingData.length,
    missingDataProducts: productsWithMissingData.slice(0, 5), // Show first 5
    withoutMappingsCount: productsWithoutMappings.length,
    withoutMappingsProducts: productsWithoutMappings.slice(0, 5), // Show first 5
    duplicateSkusCount: duplicateSkus.length,
    duplicateSkus: duplicateSkus.slice(0, 5) // Show first 5
  };
}

/**
 * Display completeness results
 */
function displayCompletenessResults(results) {
  console.log('\n📋 Data Completeness Results:');
  
  if (results.missingDataCount > 0) {
    console.log(`  ❌ Products with missing data: ${results.missingDataCount}`);
    results.missingDataProducts.forEach(product => {
      console.log(`    - ${product.masterSku}: ${product.name || 'No name'}`);
    });
  } else {
    console.log('  ✅ All products have complete required data');
  }

  if (results.withoutMappingsCount > 0) {
    console.log(`  ❌ Products without platform mappings: ${results.withoutMappingsCount}`);
    results.withoutMappingsProducts.forEach(product => {
      console.log(`    - ${product.masterSku}: ${product.name}`);
    });
  } else {
    console.log('  ✅ All products have platform mappings');
  }

  if (results.duplicateSkusCount > 0) {
    console.log(`  ❌ Duplicate SKUs found: ${results.duplicateSkusCount}`);
    results.duplicateSkus.forEach(sku => {
      console.log(`    - ${sku.masterSku}: ${sku.count} occurrences`);
    });
  } else {
    console.log('  ✅ No duplicate SKUs found');
  }
}

/**
 * Validate platform mappings
 */
async function validatePlatformMappings() {
  console.log('\n🔗 Validating platform mappings...');

  // Check mapping accuracy
  const mappingsWithMissingProducts = await db
    .select({
      id: platformMappings.id,
      platform: platformMappings.platform,
      platformProductId: platformMappings.platformProductId
    })
    .from(platformMappings)
    .leftJoin(masterProducts, eq(platformMappings.masterProductId, masterProducts.id))
    .where(sql`${masterProducts.id} IS NULL`);

  // Check sync status distribution
  const syncStatusStats = await db
    .select({
      syncStatus: platformMappings.syncStatus,
      count: count()
    })
    .from(platformMappings)
    .groupBy(platformMappings.syncStatus);

  // Check platform distribution
  const platformStats = await db
    .select({
      platform: platformMappings.platform,
      count: count()
    })
    .from(platformMappings)
    .groupBy(platformMappings.platform);

  return {
    missingProductsCount: mappingsWithMissingProducts.length,
    missingProductsMappings: mappingsWithMissingProducts.slice(0, 5),
    syncStatusStats,
    platformStats
  };
}

/**
 * Display mapping results
 */
function displayMappingResults(results) {
  console.log('\n🔗 Platform Mapping Results:');
  
  if (results.missingProductsCount > 0) {
    console.log(`  ❌ Mappings with missing products: ${results.missingProductsCount}`);
    results.missingProductsMappings.forEach(mapping => {
      console.log(`    - ${mapping.platform}:${mapping.platformProductId}`);
    });
  } else {
    console.log('  ✅ All mappings have valid product references');
  }

  console.log('  📊 Sync Status Distribution:');
  results.syncStatusStats.forEach(stat => {
    console.log(`    - ${stat.syncStatus}: ${stat.count}`);
  });

  console.log('  📊 Platform Distribution:');
  results.platformStats.forEach(stat => {
    console.log(`    - ${stat.platform}: ${stat.count}`);
  });
}

/**
 * Validate pricing calculations
 */
async function validatePricingCalculations() {
  console.log('\n💰 Validating pricing calculations...');

  // Get sample products for pricing validation
  const sampleProducts = await db
    .select({
      id: masterProducts.id,
      masterSku: masterProducts.masterSku,
      name: masterProducts.name,
      basePrice: masterProducts.basePrice,
      platformPrices: masterProducts.platformPrices
    })
    .from(masterProducts)
    .limit(10);

  const pricingIssues = [];

  for (const product of sampleProducts) {
    const basePrice = parseFloat(product.basePrice);
    const platformPrices = product.platformPrices || {};

    // Validate Shopee pricing (15% fee)
    if (platformPrices.shopee) {
      const expectedShopeePrice = Math.round(basePrice * 1.15);
      const actualShopeePrice = platformPrices.shopee.price;
      
      if (Math.abs(expectedShopeePrice - actualShopeePrice) > 1) {
        pricingIssues.push({
          sku: product.masterSku,
          platform: 'shopee',
          expected: expectedShopeePrice,
          actual: actualShopeePrice
        });
      }
    }

    // Validate TikTok Shop pricing (20% fee)
    if (platformPrices.tiktokshop) {
      const expectedTikTokPrice = Math.round(basePrice * 1.20);
      const actualTikTokPrice = platformPrices.tiktokshop.price;
      
      if (Math.abs(expectedTikTokPrice - actualTikTokPrice) > 1) {
        pricingIssues.push({
          sku: product.masterSku,
          platform: 'tiktokshop',
          expected: expectedTikTokPrice,
          actual: actualTikTokPrice
        });
      }
    }
  }

  return {
    sampledProducts: sampleProducts.length,
    pricingIssues: pricingIssues.slice(0, 5) // Show first 5 issues
  };
}

/**
 * Display pricing results
 */
function displayPricingResults(results) {
  console.log('\n💰 Pricing Validation Results:');
  console.log(`  📊 Sampled Products: ${results.sampledProducts}`);
  
  if (results.pricingIssues.length > 0) {
    console.log(`  ❌ Pricing calculation issues found: ${results.pricingIssues.length}`);
    results.pricingIssues.forEach(issue => {
      console.log(`    - ${issue.sku} (${issue.platform}): Expected ${issue.expected}, Got ${issue.actual}`);
    });
  } else {
    console.log('  ✅ All sampled pricing calculations are correct');
  }
}

/**
 * Generate validation report
 */
function generateValidationReport(stats, completeness, mappings, pricing) {
  let report = `📋 Master Catalog Validation Report\n`;
  report += `=====================================\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;

  // Overall health score
  let healthScore = 100;
  
  if (completeness.missingDataCount > 0) healthScore -= 20;
  if (completeness.withoutMappingsCount > 0) healthScore -= 15;
  if (completeness.duplicateSkusCount > 0) healthScore -= 10;
  if (mappings.missingProductsCount > 0) healthScore -= 15;
  if (pricing.pricingIssues.length > 0) healthScore -= 10;

  report += `Overall Health Score: ${Math.max(0, healthScore)}/100\n\n`;

  // Summary
  report += `Summary:\n`;
  report += `  Total Products: ${stats.totalProducts}\n`;
  report += `  Platform Mappings: ${stats.totalMappings}\n`;
  report += `  Data Quality Issues: ${completeness.missingDataCount + completeness.withoutMappingsCount + completeness.duplicateSkusCount}\n`;
  report += `  Mapping Issues: ${mappings.missingProductsCount}\n`;
  report += `  Pricing Issues: ${pricing.pricingIssues.length}\n\n`;

  // Recommendations
  report += `Recommendations:\n`;
  if (completeness.missingDataCount > 0) {
    report += `  - Fix ${completeness.missingDataCount} products with missing required data\n`;
  }
  if (completeness.withoutMappingsCount > 0) {
    report += `  - Create platform mappings for ${completeness.withoutMappingsCount} products\n`;
  }
  if (completeness.duplicateSkusCount > 0) {
    report += `  - Resolve ${completeness.duplicateSkusCount} duplicate SKU conflicts\n`;
  }
  if (mappings.missingProductsCount > 0) {
    report += `  - Fix ${mappings.missingProductsCount} orphaned platform mappings\n`;
  }
  if (pricing.pricingIssues.length > 0) {
    report += `  - Recalculate pricing for products with calculation errors\n`;
  }
  
  if (healthScore >= 95) {
    report += `  ✅ Master catalog is in excellent condition!\n`;
  } else if (healthScore >= 80) {
    report += `  ⚠️  Master catalog has minor issues that should be addressed\n`;
  } else {
    report += `  ❌ Master catalog has significant issues that need immediate attention\n`;
  }

  return report;
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

module.exports = { main };