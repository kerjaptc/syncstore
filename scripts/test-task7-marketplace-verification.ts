/**
 * Test Script for Task 7.2: Verify results in marketplaces
 * Spot-checks 3 random products from batch in Shopee and TikTok
 */

import { db } from '../src/lib/db';
import { syncLogs } from '../src/lib/db/sync-logs-schema';
import { masterProducts } from '../src/lib/db/master-catalog-schema';
import { eq, and } from 'drizzle-orm';

interface MarketplaceVerificationResult {
  batch_id: string;
  verified_products: VerifiedProduct[];
  shopee_verification: PlatformVerification;
  tiktok_verification: PlatformVerification;
  overall_status: 'PASS' | 'FAIL';
  issues_found: string[];
}

interface VerifiedProduct {
  product_id: string;
  product_name: string;
  master_sku: string;
  base_price: number;
  shopee_result: ProductVerification;
  tiktok_result: ProductVerification;
}

interface ProductVerification {
  synced: boolean;
  external_id?: string;
  final_price?: number;
  pricing_correct?: boolean;
  seo_title?: string;
  seo_title_valid?: boolean;
  data_integrity?: boolean;
  issues: string[];
}

interface PlatformVerification {
  total_checked: number;
  successful_syncs: number;
  pricing_accuracy: number;
  seo_title_quality: number;
  data_integrity_score: number;
  overall_score: number;
}

async function verifyMarketplaceResults(batchId: string): Promise<MarketplaceVerificationResult> {
  console.log('🧪 Task 7.2: Verifying results in marketplaces\n');
  console.log(`📋 Batch ID: ${batchId}\n`);

  try {
    // Step 1: Get successful sync logs from the batch
    console.log('1️⃣ Retrieving successful sync logs...');
    
    const syncedProducts = await db
      .select({
        productId: syncLogs.productId,
        platform: syncLogs.platform,
        platformProductId: syncLogs.platformProductId,
        responsePayload: syncLogs.responsePayload,
        syncedAt: syncLogs.syncedAt,
      })
      .from(syncLogs)
      .where(and(
        eq(syncLogs.batchId, batchId),
        eq(syncLogs.status, 'success')
      ));

    if (syncedProducts.length === 0) {
      throw new Error('No successful syncs found for this batch');
    }

    console.log(`   ✅ Found ${syncedProducts.length} successful sync records`);

    // Group by product ID
    const productGroups = syncedProducts.reduce((groups, log) => {
      if (!groups[log.productId]) {
        groups[log.productId] = [];
      }
      groups[log.productId].push(log);
      return groups;
    }, {} as Record<string, typeof syncedProducts>);

    const productIds = Object.keys(productGroups);
    console.log(`   📦 Products synced: ${productIds.length}`);

    // Step 2: Select 3 random products for verification
    console.log('\n2️⃣ Selecting 3 random products for spot-check...');
    
    const selectedProductIds = productIds
      .sort(() => Math.random() - 0.5) // Shuffle
      .slice(0, Math.min(3, productIds.length)); // Take up to 3

    console.log(`   🎯 Selected products: ${selectedProductIds.length}`);

    // Step 3: Get product details
    console.log('\n3️⃣ Retrieving product details...');
    
    const productDetails = await db
      .select({
        id: masterProducts.id,
        name: masterProducts.name,
        masterSku: masterProducts.masterSku,
        basePrice: masterProducts.basePrice,
      })
      .from(masterProducts)
      .where(eq(masterProducts.id, selectedProductIds[0])); // We'll do this for each product

    const verifiedProducts: VerifiedProduct[] = [];

    // Step 4: Verify each selected product
    console.log('\n4️⃣ Verifying products in marketplaces...');
    
    for (const productId of selectedProductIds) {
      console.log(`\n   📦 Verifying product: ${productId}`);
      
      // Get product details
      const productDetailResults = await db
        .select({
          id: masterProducts.id,
          name: masterProducts.name,
          masterSku: masterProducts.masterSku,
          basePrice: masterProducts.basePrice,
        })
        .from(masterProducts)
        .where(eq(masterProducts.id, productId));

      if (productDetailResults.length === 0) {
        console.log(`   ❌ Product ${productId} not found in master catalog`);
        continue;
      }

      const product = productDetailResults[0];
      const productSyncs = productGroups[productId];

      console.log(`      Name: ${product.name}`);
      console.log(`      SKU: ${product.masterSku}`);
      console.log(`      Base Price: ${product.basePrice}`);

      // Verify Shopee
      const shopeeSync = productSyncs.find(s => s.platform === 'shopee');
      const shopeeResult = await verifyShopeeProduct(product, shopeeSync);
      
      // Verify TikTok
      const tiktokSync = productSyncs.find(s => s.platform === 'tiktok');
      const tiktokResult = await verifyTikTokProduct(product, tiktokSync);

      verifiedProducts.push({
        product_id: productId,
        product_name: product.name,
        master_sku: product.masterSku,
        base_price: parseFloat(product.basePrice),
        shopee_result: shopeeResult,
        tiktok_result: tiktokResult,
      });
    }

    // Step 5: Calculate platform verification scores
    console.log('\n5️⃣ Calculating verification scores...');
    
    const shopeeVerification = calculatePlatformVerification(verifiedProducts, 'shopee');
    const tiktokVerification = calculatePlatformVerification(verifiedProducts, 'tiktok');

    console.log(`   🟠 Shopee Overall Score: ${shopeeVerification.overall_score}%`);
    console.log(`   🔴 TikTok Overall Score: ${tiktokVerification.overall_score}%`);

    // Step 6: Determine overall status and collect issues
    const issues_found: string[] = [];
    
    verifiedProducts.forEach(product => {
      product.shopee_result.issues.forEach(issue => {
        issues_found.push(`Shopee - ${product.product_name}: ${issue}`);
      });
      product.tiktok_result.issues.forEach(issue => {
        issues_found.push(`TikTok - ${product.product_name}: ${issue}`);
      });
    });

    const minScore = 95; // 95% minimum score required
    const overall_status = (shopeeVerification.overall_score >= minScore && 
                           tiktokVerification.overall_score >= minScore) ? 'PASS' : 'FAIL';

    const result: MarketplaceVerificationResult = {
      batch_id: batchId,
      verified_products: verifiedProducts,
      shopee_verification: shopeeVerification,
      tiktok_verification: tiktokVerification,
      overall_status,
      issues_found,
    };

    // Step 7: Display results
    console.log('\n🎯 MARKETPLACE VERIFICATION RESULTS:');
    console.log('='.repeat(60));
    console.log(`Batch ID: ${result.batch_id}`);
    console.log(`Products Verified: ${result.verified_products.length}`);
    console.log('');
    console.log('🟠 SHOPEE VERIFICATION:');
    console.log(`   Successful Syncs: ${shopeeVerification.successful_syncs}/${shopeeVerification.total_checked}`);
    console.log(`   Pricing Accuracy: ${shopeeVerification.pricing_accuracy}%`);
    console.log(`   SEO Title Quality: ${shopeeVerification.seo_title_quality}%`);
    console.log(`   Data Integrity: ${shopeeVerification.data_integrity_score}%`);
    console.log(`   Overall Score: ${shopeeVerification.overall_score}%`);
    console.log('');
    console.log('🔴 TIKTOK VERIFICATION:');
    console.log(`   Successful Syncs: ${tiktokVerification.successful_syncs}/${tiktokVerification.total_checked}`);
    console.log(`   Pricing Accuracy: ${tiktokVerification.pricing_accuracy}%`);
    console.log(`   SEO Title Quality: ${tiktokVerification.seo_title_quality}%`);
    console.log(`   Data Integrity: ${tiktokVerification.data_integrity_score}%`);
    console.log(`   Overall Score: ${tiktokVerification.overall_score}%`);
    console.log('');
    
    if (result.issues_found.length > 0) {
      console.log('⚠️  ISSUES FOUND:');
      result.issues_found.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    } else {
      console.log('✅ NO ISSUES FOUND');
    }

    console.log(`\n🎯 OVERALL VERIFICATION: ${result.overall_status}`);

    if (result.overall_status === 'PASS') {
      console.log('\n🎉 Task 7.2: Marketplace verification - SUCCESS!');
      console.log('All products verified successfully in both marketplaces');
    } else {
      console.log('\n⚠️  Task 7.2: Marketplace verification - ISSUES DETECTED');
      console.log('Review and fix issues before proceeding');
    }

    return result;

  } catch (error) {
    console.error('❌ Marketplace verification failed:', error);
    throw error;
  }
}

async function verifyShopeeProduct(product: any, syncLog: any): Promise<ProductVerification> {
  console.log(`      🟠 Verifying Shopee sync...`);
  
  if (!syncLog) {
    return {
      synced: false,
      issues: ['Product not synced to Shopee'],
    };
  }

  const issues: string[] = [];
  const responseData = syncLog.responsePayload;
  
  // Check external ID
  const external_id = responseData.external_id;
  if (!external_id || !external_id.toString().startsWith('shopee_')) {
    issues.push('Invalid or missing Shopee external ID');
  }

  // Check pricing (should be base price × 1.15)
  const expectedPrice = parseFloat(product.basePrice) * 1.15;
  const actualPrice = responseData.pricing?.shopee ? parseFloat(responseData.pricing.shopee) : null;
  const pricing_correct = actualPrice && Math.abs(actualPrice - expectedPrice) < 0.01;
  
  if (!pricing_correct) {
    issues.push(`Pricing incorrect: expected ${expectedPrice.toFixed(2)}, got ${actualPrice}`);
  }

  // Check SEO title
  const seo_title = responseData.seo_titles?.shopee;
  const seo_title_valid = seo_title && 
    seo_title.includes(product.name) && 
    seo_title.includes('[BEST SELLER]') &&
    seo_title.length > product.name.length;

  if (!seo_title_valid) {
    issues.push('SEO title missing or invalid format');
  }

  // Check data integrity (no missing required fields)
  const data_integrity = external_id && actualPrice && seo_title;
  if (!data_integrity) {
    issues.push('Missing required sync data');
  }

  console.log(`         ${issues.length === 0 ? '✅' : '⚠️'} ${issues.length} issues found`);

  return {
    synced: true,
    external_id,
    final_price: actualPrice,
    pricing_correct: !!pricing_correct,
    seo_title,
    seo_title_valid: !!seo_title_valid,
    data_integrity: !!data_integrity,
    issues,
  };
}

async function verifyTikTokProduct(product: any, syncLog: any): Promise<ProductVerification> {
  console.log(`      🔴 Verifying TikTok sync...`);
  
  if (!syncLog) {
    return {
      synced: false,
      issues: ['Product not synced to TikTok'],
    };
  }

  const issues: string[] = [];
  const responseData = syncLog.responsePayload;
  
  // Check external ID
  const external_id = responseData.external_id;
  if (!external_id || !external_id.toString().startsWith('tiktok_')) {
    issues.push('Invalid or missing TikTok external ID');
  }

  // Check pricing (should be base price × 1.20)
  const expectedPrice = parseFloat(product.basePrice) * 1.20;
  const actualPrice = responseData.pricing?.tiktok ? parseFloat(responseData.pricing.tiktok) : null;
  const pricing_correct = actualPrice && Math.abs(actualPrice - expectedPrice) < 0.01;
  
  if (!pricing_correct) {
    issues.push(`Pricing incorrect: expected ${expectedPrice.toFixed(2)}, got ${actualPrice}`);
  }

  // Check SEO title
  const seo_title = responseData.seo_titles?.tiktok;
  const seo_title_valid = seo_title && 
    seo_title.includes(product.name) && 
    seo_title.includes('Kualitas Premium') &&
    seo_title.length > product.name.length;

  if (!seo_title_valid) {
    issues.push('SEO title missing or invalid format');
  }

  // Check data integrity
  const data_integrity = external_id && actualPrice && seo_title;
  if (!data_integrity) {
    issues.push('Missing required sync data');
  }

  console.log(`         ${issues.length === 0 ? '✅' : '⚠️'} ${issues.length} issues found`);

  return {
    synced: true,
    external_id,
    final_price: actualPrice,
    pricing_correct: !!pricing_correct,
    seo_title,
    seo_title_valid: !!seo_title_valid,
    data_integrity: !!data_integrity,
    issues,
  };
}

function calculatePlatformVerification(products: VerifiedProduct[], platform: 'shopee' | 'tiktok'): PlatformVerification {
  const results = products.map(p => platform === 'shopee' ? p.shopee_result : p.tiktok_result);
  const total_checked = results.length;
  
  const successful_syncs = results.filter(r => r.synced).length;
  const pricing_accuracy = Math.round((results.filter(r => r.pricing_correct).length / total_checked) * 100);
  const seo_title_quality = Math.round((results.filter(r => r.seo_title_valid).length / total_checked) * 100);
  const data_integrity_score = Math.round((results.filter(r => r.data_integrity).length / total_checked) * 100);
  
  // Overall score is average of all metrics
  const overall_score = Math.round((
    (successful_syncs / total_checked * 100) +
    pricing_accuracy +
    seo_title_quality +
    data_integrity_score
  ) / 4);

  return {
    total_checked,
    successful_syncs,
    pricing_accuracy,
    seo_title_quality,
    data_integrity_score,
    overall_score,
  };
}

// Export for use in other scripts
export { verifyMarketplaceResults, type MarketplaceVerificationResult };

// Run if called directly
if (require.main === module) {
  const batchId = process.argv[2];
  if (!batchId) {
    console.error('Usage: npx tsx scripts/test-task7-marketplace-verification.ts <batch_id>');
    process.exit(1);
  }

  verifyMarketplaceResults(batchId)
    .then(() => {
      console.log('\n✅ Marketplace verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Marketplace verification failed:', error);
      process.exit(1);
    });
}