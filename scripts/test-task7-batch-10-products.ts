/**
 * Test Script for Task 7.1: Test batch sync with 10 products
 * Tests batch synchronization with 10 products and monitors performance
 */

import { db } from '../src/lib/db';
import { masterProducts } from '../src/lib/db/master-catalog-schema';
import { desc, limit } from 'drizzle-orm';

interface BatchTestResult {
  batch_id: string;
  total_products: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  average_sync_time: number;
  total_duration: number;
  errors: string[];
}

async function testBatchSync10Products(): Promise<BatchTestResult> {
  console.log('🧪 Task 7.1: Testing batch sync with 10 products\n');

  try {
    // Step 1: Select 10 products from master catalog
    console.log('1️⃣ Selecting 10 products from master catalog...');
    
    const products = await db
      .select({
        id: masterProducts.id,
        masterSku: masterProducts.masterSku,
        name: masterProducts.name,
        basePrice: masterProducts.basePrice,
        status: masterProducts.status,
      })
      .from(masterProducts)
      .where(eq(masterProducts.status, 'active'))
      .orderBy(desc(masterProducts.createdAt))
      .limit(10);

    if (products.length < 10) {
      throw new Error(`Only ${products.length} active products found, need at least 10`);
    }

    console.log(`   ✅ Selected ${products.length} products:`);
    products.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} (${product.masterSku}) - ${product.basePrice}`);
    });
    console.log('');

    // Step 2: Start batch sync
    console.log('2️⃣ Starting batch sync...');
    const startTime = Date.now();
    
    const batchResponse = await fetch('http://localhost:3000/api/sync/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token', // Mock auth for testing
      },
      body: JSON.stringify({
        product_ids: products.map(p => p.id),
        platform: 'both', // Test both Shopee and TikTok
      }),
    });

    if (!batchResponse.ok) {
      throw new Error(`Batch sync API failed: ${batchResponse.status} ${batchResponse.statusText}`);
    }

    const batchData = await batchResponse.json();
    if (!batchData.success) {
      throw new Error(`Batch sync failed: ${batchData.error?.message || 'Unknown error'}`);
    }

    const batch_id = batchData.batch_id;
    console.log(`   ✅ Batch sync started: ${batch_id}`);
    console.log(`   📋 Total jobs: ${batchData.total_jobs}`);
    console.log(`   ⏱️  Estimated duration: ${batchData.estimated_duration_minutes} minutes`);
    console.log('');

    // Step 3: Monitor batch progress
    console.log('3️⃣ Monitoring batch progress...');
    let batchStatus: any = null;
    let pollCount = 0;
    const maxPolls = 60; // Maximum 5 minutes of polling (5s intervals)

    while (pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      pollCount++;

      try {
        const statusResponse = await fetch(`http://localhost:3000/api/sync/batch/status?batch_id=${batch_id}`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.success) {
            batchStatus = statusData.data;
            
            console.log(`   📊 Progress: ${batchStatus.progress_percentage}% (${batchStatus.completed + batchStatus.failed}/${batchStatus.total_jobs})`);
            console.log(`   ✅ Completed: ${batchStatus.completed}, ❌ Failed: ${batchStatus.failed}, 🔄 In Progress: ${batchStatus.in_progress}`);
            
            if (batchStatus.is_complete) {
              console.log(`   🎉 Batch completed with status: ${batchStatus.status}`);
              break;
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Status check failed: ${error}`);
      }
    }

    if (pollCount >= maxPolls) {
      throw new Error('Batch sync timeout - exceeded maximum polling time');
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Step 4: Calculate results
    console.log('\n4️⃣ Calculating test results...');
    
    const success_count = batchStatus.completed;
    const failure_count = batchStatus.failed;
    const success_rate = Math.round((success_count / batchStatus.total_jobs) * 100);
    const average_sync_time = totalDuration / batchStatus.total_jobs; // Average time per job
    
    console.log(`   ✅ Success count: ${success_count}`);
    console.log(`   ❌ Failure count: ${failure_count}`);
    console.log(`   📈 Success rate: ${success_rate}%`);
    console.log(`   ⏱️  Average sync time: ${Math.round(average_sync_time)}ms per product`);
    console.log(`   🕐 Total duration: ${Math.round(totalDuration / 1000)}s`);

    // Step 5: Collect error information
    const errors: string[] = [];
    if (batchStatus.error_summary && batchStatus.error_summary.total_errors > 0) {
      Object.entries(batchStatus.error_summary.error_types).forEach(([errorType, count]) => {
        errors.push(`${errorType}: ${count} occurrences`);
      });
    }

    const result: BatchTestResult = {
      batch_id,
      total_products: batchStatus.total_jobs,
      success_count,
      failure_count,
      success_rate,
      average_sync_time: Math.round(average_sync_time),
      total_duration: Math.round(totalDuration / 1000),
      errors,
    };

    console.log('\n🎯 BATCH TEST RESULTS:');
    console.log('='.repeat(50));
    console.log(`Batch ID: ${result.batch_id}`);
    console.log(`Total Products: ${result.total_products}`);
    console.log(`Success Count: ${result.success_count}`);
    console.log(`Failure Count: ${result.failure_count}`);
    console.log(`Success Rate: ${result.success_rate}%`);
    console.log(`Average Sync Time: ${result.average_sync_time}ms per product`);
    console.log(`Total Duration: ${result.total_duration}s`);
    
    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.join(', ')}`);
    } else {
      console.log('Errors: None');
    }

    // Step 6: Verify success criteria
    console.log('\n📋 SUCCESS CRITERIA VERIFICATION:');
    const targetSuccessRate = 100; // 100% success rate required
    const maxAvgSyncTime = 30000; // 30 seconds max per product
    
    const successRatePass = result.success_rate >= targetSuccessRate;
    const syncTimePass = result.average_sync_time <= maxAvgSyncTime;
    
    console.log(`✅ Success Rate >= ${targetSuccessRate}%: ${successRatePass ? 'PASS' : 'FAIL'} (${result.success_rate}%)`);
    console.log(`✅ Avg Sync Time <= ${maxAvgSyncTime}ms: ${syncTimePass ? 'PASS' : 'FAIL'} (${result.average_sync_time}ms)`);
    
    const overallPass = successRatePass && syncTimePass;
    console.log(`\n🎯 OVERALL RESULT: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);

    if (overallPass) {
      console.log('\n🎉 Task 7.1: Batch sync with 10 products - SUCCESS!');
      console.log('Ready to proceed to marketplace verification (Task 7.2)');
    } else {
      console.log('\n⚠️  Task 7.1: Batch sync with 10 products - NEEDS IMPROVEMENT');
      console.log('Review errors and optimize before proceeding');
    }

    return result;

  } catch (error) {
    console.error('❌ Batch test failed:', error);
    throw error;
  }
}

// Export for use in other scripts
export { testBatchSync10Products, type BatchTestResult };

// Run if called directly
if (require.main === module) {
  testBatchSync10Products()
    .then(() => {
      console.log('\n✅ Batch test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Batch test failed:', error);
      process.exit(1);
    });
}