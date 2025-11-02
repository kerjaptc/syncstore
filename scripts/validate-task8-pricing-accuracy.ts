/**
 * Pricing Accuracy Validation Script
 * Task 8.1: Validate pricing accuracy
 */

import { db } from '../src/lib/db';
import { syncLogs } from '../src/lib/db/sync-logs-schema';
import { masterProducts } from '../src/lib/db/master-catalog-schema';
import { eq, and, isNotNull } from 'drizzle-orm';

interface PricingValidationResult {
  total_synced_products: number;
  pricing_mismatches: PricingMismatch[];
  shopee_accuracy: {
    total_checked: number;
    correct_pricing: number;
    accuracy_percentage: number;
  };
  tiktok_accuracy: {
    total_checked: number;
    correct_pricing: number;
    accuracy_percentage: number;
  };
  overall_accuracy: number;
  validation_status: 'PASS' | 'FAIL';
}

interface PricingMismatch {
  product_id: string;
  product_name: string;
  master_sku: string;
  base_price: number;
  platform: string;
  expected_price: number;
  actual_price: number;
  difference: number;
  difference_percentage: number;
  sync_date: Date;
}

async function validatePricingAccuracy(): Promise<PricingValidationResult> {
  console.log('🧪 Task 8.1: Validating pricing accuracy\n');
  console.log('Checking for pricing mismatches across all synced products...\n');

  try {
    // Step 1: Get all successful sync logs with pricing data
    console.log('1️⃣ Retrieving successful sync logs...');
    
    const syncedProducts = await db
      .select({
        productId: syncLogs.productId,
        platform: syncLogs.platform,
        responsePayload: syncLogs.responsePayload,
        syncedAt: syncLogs.syncedAt,
      })
      .from(syncLogs)
      .where(and(
        eq(syncLogs.status, 'success'),
        isNotNull(syncLogs.responsePayload)
      ));

    console.log(`   ✅ Found ${syncedProducts.length} successful sync records`);

    // Step 2: Get master product data for price comparison
    console.log('\n2️⃣ Retrieving master product data...');
    
    const uniqueProductIds = [...new Set(syncedProducts.map(s => s.productId))];
    console.log(`   📦 Unique products: ${uniqueProductIds.length}`);

    const masterProductsData = await db
      .select({
        id: masterProducts.id,
        name: masterProducts.name,
        masterSku: masterProducts.masterSku,
        basePrice: masterProducts.basePrice,
      })
      .from(masterProducts);

    const masterProductsMap = new Map(masterProductsData.map(p => [p.id, p]));
    console.log(`   ✅ Retrieved ${masterProductsData.length} master products`);

    // Step 3: Validate pricing for each sync record
    console.log('\n3️⃣ Validating pricing accuracy...');
    
    const pricingMismatches: PricingMismatch[] = [];
    let shopeeChecked = 0, shopeeCorrect = 0;
    let tiktokChecked = 0, tiktokCorrect = 0;

    for (const syncRecord of syncedProducts) {
      const masterProduct = masterProductsMap.get(syncRecord.productId);
      if (!masterProduct) {
        console.log(`   ⚠️  Master product not found: ${syncRecord.productId}`);
        continue;
      }

      const basePrice = parseFloat(masterProduct.basePrice);
      const responseData = syncRecord.responsePayload as any;
      
      // Check platform-specific pricing
      if (syncRecord.platform === 'shopee' || syncRecord.platform === 'both') {
        shopeeChecked++;
        const expectedShopeePrice = basePrice * 1.15;
        const actualShopeePrice = responseData.pricing?.shopee ? parseFloat(responseData.pricing.shopee) : null;
        
        if (actualShopeePrice !== null) {
          const difference = Math.abs(actualShopeePrice - expectedShopeePrice);
          const differencePercentage = (difference / expectedShopeePrice) * 100;
          
          if (difference > 0.01) { // Allow 1 cent tolerance for rounding
            pricingMismatches.push({
              product_id: syncRecord.productId,
              product_name: masterProduct.name,
              master_sku: masterProduct.masterSku,
              base_price: basePrice,
              platform: 'shopee',
              expected_price: expectedShopeePrice,
              actual_price: actualShopeePrice,
              difference,
              difference_percentage: differencePercentage,
              sync_date: syncRecord.syncedAt,
            });
          } else {
            shopeeCorrect++;
          }
        }
      }

      if (syncRecord.platform === 'tiktok' || syncRecord.platform === 'both') {
        tiktokChecked++;
        const expectedTiktokPrice = basePrice * 1.20;
        const actualTiktokPrice = responseData.pricing?.tiktok ? parseFloat(responseData.pricing.tiktok) : null;
        
        if (actualTiktokPrice !== null) {
          const difference = Math.abs(actualTiktokPrice - expectedTiktokPrice);
          const differencePercentage = (difference / expectedTiktokPrice) * 100;
          
          if (difference > 0.01) { // Allow 1 cent tolerance for rounding
            pricingMismatches.push({
              product_id: syncRecord.productId,
              product_name: masterProduct.name,
              master_sku: masterProduct.masterSku,
              base_price: basePrice,
              platform: 'tiktok',
              expected_price: expectedTiktokPrice,
              actual_price: actualTiktokPrice,
              difference,
              difference_percentage: differencePercentage,
              sync_date: syncRecord.syncedAt,
            });
          } else {
            tiktokCorrect++;
          }
        }
      }
    }

    // Step 4: Calculate accuracy metrics
    console.log('\n4️⃣ Calculating accuracy metrics...');
    
    const shopeeAccuracy = {
      total_checked: shopeeChecked,
      correct_pricing: shopeeCorrect,
      accuracy_percentage: shopeeChecked > 0 ? Math.round((shopeeCorrect / shopeeChecked) * 100) : 100,
    };

    const tiktokAccuracy = {
      total_checked: tiktokChecked,
      correct_pricing: tiktokCorrect,
      accuracy_percentage: tiktokChecked > 0 ? Math.round((tiktokCorrect / tiktokChecked) * 100) : 100,
    };

    const totalChecked = shopeeChecked + tiktokChecked;
    const totalCorrect = shopeeCorrect + tiktokCorrect;
    const overallAccuracy = totalChecked > 0 ? Math.round((totalCorrect / totalChecked) * 100) : 100;

    console.log(`   🟠 Shopee: ${shopeeCorrect}/${shopeeChecked} correct (${shopeeAccuracy.accuracy_percentage}%)`);
    console.log(`   🔴 TikTok: ${tiktokCorrect}/${tiktokChecked} correct (${tiktokAccuracy.accuracy_percentage}%)`);
    console.log(`   📊 Overall: ${totalCorrect}/${totalChecked} correct (${overallAccuracy}%)`);

    const result: PricingValidationResult = {
      total_synced_products: uniqueProductIds.length,
      pricing_mismatches: pricingMismatches,
      shopee_accuracy: shopeeAccuracy,
      tiktok_accuracy: tiktokAccuracy,
      overall_accuracy: overallAccuracy,
      validation_status: pricingMismatches.length === 0 ? 'PASS' : 'FAIL',
    };

    // Step 5: Display results
    console.log('\n🎯 PRICING ACCURACY VALIDATION RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Synced Products: ${result.total_synced_products}`);
    console.log(`Pricing Mismatches Found: ${result.pricing_mismatches.length}`);
    console.log('');
    console.log('🟠 SHOPEE PRICING ACCURACY:');
    console.log(`   Products Checked: ${result.shopee_accuracy.total_checked}`);
    console.log(`   Correct Pricing: ${result.shopee_accuracy.correct_pricing}`);
    console.log(`   Accuracy: ${result.shopee_accuracy.accuracy_percentage}%`);
    console.log('');
    console.log('🔴 TIKTOK PRICING ACCURACY:');
    console.log(`   Products Checked: ${result.tiktok_accuracy.total_checked}`);
    console.log(`   Correct Pricing: ${result.tiktok_accuracy.correct_pricing}`);
    console.log(`   Accuracy: ${result.tiktok_accuracy.accuracy_percentage}%`);
    console.log('');
    console.log(`📊 OVERALL ACCURACY: ${result.overall_accuracy}%`);

    if (result.pricing_mismatches.length > 0) {
      console.log('\n⚠️  PRICING MISMATCHES DETECTED:');
      console.log('-'.repeat(60));
      result.pricing_mismatches.forEach((mismatch, index) => {
        console.log(`${index + 1}. ${mismatch.product_name} (${mismatch.master_sku}) - ${mismatch.platform.toUpperCase()}`);
        console.log(`   Base Price: ${mismatch.base_price}`);
        console.log(`   Expected: ${mismatch.expected_price.toFixed(2)}`);
        console.log(`   Actual: ${mismatch.actual_price.toFixed(2)}`);
        console.log(`   Difference: ${mismatch.difference.toFixed(2)} (${mismatch.difference_percentage.toFixed(2)}%)`);
        console.log(`   Synced: ${mismatch.sync_date.toISOString()}`);
        console.log('');
      });
    }

    console.log(`🎯 VALIDATION STATUS: ${result.validation_status}`);
    
    if (result.validation_status === 'PASS') {
      console.log('\n🎉 Task 8.1: Pricing accuracy validation - SUCCESS!');
      console.log('All pricing calculations are accurate (0 mismatches found)');
    } else {
      console.log('\n⚠️  Task 8.1: Pricing accuracy validation - ISSUES FOUND');
      console.log(`${result.pricing_mismatches.length} pricing mismatches detected and need correction`);
    }

    return result;

  } catch (error) {
    console.error('❌ Pricing validation failed:', error);
    throw error;
  }
}

// Export for use in other scripts
export { validatePricingAccuracy, type PricingValidationResult };

// Run if called directly
if (require.main === module) {
  validatePricingAccuracy()
    .then(() => {
      console.log('\n✅ Pricing accuracy validation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Pricing accuracy validation failed:', error);
      process.exit(1);
    });
}